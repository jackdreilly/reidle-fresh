import type { ComponentChildren } from "preact";
import type { PageProps } from "@/router";
import { Name } from "@/components/DailyTable";
import { prettyDay } from "@/components/StatsTabs";
import { useSession } from "@/lib/session";
import { isoDay, timerTime, utcToday } from "@/lib/time";

type Run = { len: number; from: string; to: string } | null;
type Data = {
  total: number;
  since: string | null;
  last: string | null;
  wins: number;
  podiums: number;
  beat: number | null;
  beat_30: number | null;
  median: number | null;
  median_30: number | null;
  median_prev_30: number | null;
  avg_penalty: number | null;
  clean: number | null;
  avg_guesses: number | null;
  weeks_won: number;
  last_week_won: string | null;
  streak: { current: number; longest: Run; current_wins: number; longest_wins: Run };
  fastest: { time: number; day: string; submission_id: number; word: string | null; place: number; n: number } | null;
  /** [day, place, players, submission_id] for the last ~year. */
  calendar: [string, number, number, number][];
  /** Weekly samples of a rolling 28-day window. */
  trend: { week: string; games: number; median: number; p25: number; p75: number; beat: number | null }[];
  places: { place: number; count: number }[];
  guesses: { guesses: number; count: number }[];
  /** Even bins of `width` seconds starting at `from`; the end bins also hold the outliers. */
  times: { width: number; from: number; counts: number[] } | null;
  weekdays: { dow: number; games: number; win: number; beat: number | null; median: number }[];
  rivals: {
    name: string; games: number; wins: number; losses: number;
    recent_wins: number; recent_games: number; last: string;
  }[];
  recent: {
    day: string; time: number; penalty: number; place: number; n: number;
    word: string | null; guesses: number | null; submission_id: number | null;
  }[];
};

const pct = (v: number | null | undefined) => v == null ? "–" : `${Math.round(v * 100)}%`;
const ordinal = (n: number) => {
  const t = n % 100, o = n % 10;
  return n + (t >= 11 && t <= 13 ? "th" : ["th", "st", "nd", "rd"][o] ?? "th");
};
const short = (iso: string) => prettyDay(iso, { month: "short", day: "numeric" });
const monthYear = (iso: string) => prettyDay(iso, { month: "short", year: "numeric" });

// Finishing-place colours, shared with the weekly chips: gold-green 1st, yellow 2nd, orange 3rd.
const PLACE = ["#22c55e", "#facc15", "#fb923c", "#cbd5e1"];
const placeColor = (p: number) => PLACE[Math.min(p, 4) - 1];
const ACCENT = "#0ea5e9";

function Card({ title, aside, children, class: cls }: { title?: string; aside?: ComponentChildren; children: ComponentChildren; class?: string }) {
  return (
    <section class={"rounded-2xl border border-gray-200 bg-white p-4 shadow-sm " + (cls ?? "")}>
      {title && (
        <header class="mb-3 flex items-baseline justify-between gap-2">
          <h2 class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{title}</h2>
          {aside && <span class="text-xs text-gray-400">{aside}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

function Tile({ label, value, sub, href }: { label: string; value: ComponentChildren; sub?: ComponentChildren; href?: string }) {
  const body = (
    <>
      <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
      <div class="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</div>
      {sub && <div class="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </>
  );
  const cls = "block rounded-2xl border border-gray-200 bg-white p-3 shadow-sm";
  return href ? <a class={cls + " transition-shadow hover:shadow-md"} href={href}>{body}</a> : <div class={cls}>{body}</div>;
}

/** Faster (lower) is better, so a drop in time is green. */
function Delta({ now, before }: { now: number | null; before: number | null }) {
  if (now == null || before == null || Math.abs(now - before) < 0.5) return null;
  const faster = now < before;
  return (
    <span class={faster ? "text-green-600" : "text-rose-600"}>
      {faster ? "▼" : "▲"} {timerTime(Math.abs(now - before))} vs prior 30d
    </span>
  );
}

function Hero({ name, d, me }: { name: string; d: Data; me: boolean }) {
  return (
    <div class="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100 p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="truncate text-2xl font-bold text-sky-950">{name}{me && <span class="ml-2 align-middle text-xs font-medium text-sky-700">(you)</span>}</h1>
          <p class="mt-0.5 text-sm text-sky-800">
            {d.since ? <>Playing since {monthYear(d.since)} · {d.total.toLocaleString()} games</> : "No daily games yet"}
          </p>
        </div>
        {d.weeks_won > 0 && (
          <div class="shrink-0 rounded-xl bg-amber-100 px-3 py-1.5 text-center ring-1 ring-amber-300" title={d.last_week_won ? `Last weekly win: week of ${short(d.last_week_won)}` : undefined}>
            <div class="text-lg font-bold leading-none text-amber-900">🏆 {d.weeks_won}</div>
            <div class="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">{d.weeks_won === 1 ? "week won" : "weeks won"}</div>
          </div>
        )}
      </div>
      <Rivalry rivals={d.rivals} />
      {d.streak.current > 1 && (
        <p class="mt-3 text-sm font-medium text-sky-900">
          🔥 {d.streak.current}-day streak{d.streak.current_wins > 1 && <> · 👑 won the last {d.streak.current_wins} in a row</>}
        </p>
      )}
    </div>
  );
}

/** Nemesis = the regular opponent with the worst record against; "owns" = the best. */
function Rivalry({ rivals }: { rivals: Data["rivals"] }) {
  const rate = (r: Data["rivals"][number]) => r.wins / (r.wins + r.losses || 1);
  const regulars = rivals.filter((r) => r.games >= 10).sort((a, b) => rate(a) - rate(b));
  if (regulars.length < 2) return null;
  const nemesis = regulars[0], victim = regulars[regulars.length - 1];
  const chip = (emoji: string, label: string, r: Data["rivals"][number]) => (
    <a href={`/players/${r.name}`} class="flex min-w-0 items-center gap-1.5 rounded-lg bg-white/60 px-2 py-1 text-xs ring-1 ring-sky-200 hover:bg-white">
      <span>{emoji}</span>
      <span class="text-sky-700">{label}</span>
      <span class="truncate font-semibold text-sky-950">{r.name}</span>
      <span class="tabular-nums text-sky-700">{r.wins}–{r.losses}</span>
    </a>
  );
  return (
    <div class="mt-3 flex flex-wrap gap-2">
      {rate(nemesis) < 0.5 && chip("😈", "Nemesis", nemesis)}
      {rate(victim) > 0.5 && chip("🎯", "Owns", victim)}
    </div>
  );
}

function Calendar({ days, weeks }: { days: Data["calendar"]; weeks: number }) {
  const byDay = new Map(days.map((d) => [d[0], d]));
  const today = new Date(utcToday() + "T00:00:00Z");
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (today.getUTCDay() + 6) % 7 - (weeks - 1) * 7);
  const C = 12, G = 2, L = 16, T = 14;
  const cells = [];
  const months = [];
  for (let w = 0; w < weeks; w++) {
    for (let r = 0; r < 7; r++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + w * 7 + r);
      if (d > today) continue;
      const iso = isoDay(d);
      if (d.getUTCDate() === 1) months.push({ w, label: prettyDay(iso, { month: "short" }) });
      const hit = byDay.get(iso);
      const tip = `${prettyDay(iso)} · ${hit ? `${ordinal(hit[1])} of ${hit[2]}` : "didn't play"}`;
      const rect = (
        <rect x={L + w * (C + G)} y={T + r * (C + G)} width={C} height={C} rx={2.5}
          fill={hit ? placeColor(hit[1]) : "#f3f4f6"}>
          <title>{tip}</title>
        </rect>
      );
      cells.push(hit ? <a href={`/stats/daily/${iso}`}>{rect}</a> : rect);
    }
  }
  const width = L + weeks * (C + G);
  return (
    <svg viewBox={`0 0 ${width} ${T + 7 * (C + G)}`} class="w-full" role="img" aria-label="Games played calendar">
      {months.map(({ w, label }) => <text x={L + w * (C + G)} y={10} font-size="10" fill="#9ca3af">{label}</text>)}
      {[["M", 0], ["W", 2], ["F", 4]].map(([l, r]) => (
        <text x={0} y={T + (r as number) * (C + G) + 9.5} font-size="9" fill="#9ca3af">{l}</text>
      ))}
      {cells}
    </svg>
  );
}

function Legend() {
  return (
    <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
      {["1st", "2nd", "3rd", "4th+"].map((l, i) => (
        <span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PLACE[i] }} />{l}</span>
      ))}
      <span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-sm bg-gray-100" />no game</span>
    </div>
  );
}

type Point = { x: string; y: number; lo?: number; hi?: number; tip: string };

/** Smoothed weekly trend: a line, an optional shaded band, gridlines and a hover strip per point. */
function Trend({ points, format, domain, refLine, label }: {
  points: Point[]; format: (v: number) => string; domain?: [number, number]; refLine?: number; label: string;
}) {
  const W = 440, H = 150, L = 38, R = 8, T = 8, B = 20;
  const ys = points.flatMap((p) => [p.y, p.lo ?? p.y, p.hi ?? p.y]);
  let [lo, hi] = domain ?? [Math.min(...ys), Math.max(...ys)];
  let step = (hi - lo) / 4;
  if (!domain) {
    const pad = Math.max(2, (hi - lo) * 0.1);
    step = [1, 2, 5, 10, 15, 20, 30, 60].find((s) => s >= (hi - lo + 2 * pad) / 4) ?? 120;
    lo = Math.max(0, Math.floor((lo - pad) / step) * step);
    hi = Math.ceil((hi + pad) / step) * step;
  }
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const n = points.length;
  const x = (i: number) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  const line = points.map((p, i) => `${x(i)},${y(p.y)}`).join(" ");
  const band = points[0]?.lo != null
    ? `M${points.map((p, i) => `${x(i)},${y(p.hi!)}`).join(" L")} L${points.map((p, i) => `${x(i)},${y(p.lo!)}`).reverse().join(" L")} Z`
    : null;
  // Month labels at the first point of each month, thinned to ~6.
  const marks = points.map((p, i) => ({ i, m: p.x.slice(0, 7) })).filter((p, k, a) => k === 0 || p.m !== a[k - 1].m);
  const every = Math.ceil(marks.length / 6);
  const strip = (W - L - R) / Math.max(1, n - 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="w-full" role="img" aria-label={label}>
      {ticks.map((t) => (
        <g>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#f1f5f9" />
          <text x={L - 6} y={y(t) + 3} text-anchor="end" font-size="10" fill="#9ca3af">{format(t)}</text>
        </g>
      ))}
      {refLine != null && <line x1={L} x2={W - R} y1={y(refLine)} y2={y(refLine)} stroke="#cbd5e1" stroke-dasharray="3 3" />}
      {band && <path d={band} fill={ACCENT} fill-opacity=".15" />}
      <polyline fill="none" stroke={ACCENT} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points={line} />
      {n > 0 && <circle cx={x(n - 1)} cy={y(points[n - 1].y)} r={4} fill={ACCENT} stroke="white" stroke-width="2" />}
      {points.map((p, i) => (
        <rect x={x(i) - strip / 2} y={T} width={strip} height={H - T - B} fill="transparent"><title>{p.tip}</title></rect>
      ))}
      {marks.filter((_, k) => k % every === 0).map(({ i, m }) => (
        <text x={Math.min(Math.max(x(i), L + 12), W - R - 12)} y={H - 5} text-anchor="middle" font-size="10" fill="#9ca3af">
          {prettyDay(m + "-01", m.endsWith("-01") || i === 0 ? { month: "short", year: "2-digit" } : { month: "short" })}
        </text>
      ))}
    </svg>
  );
}

/** Horizontal bars, Wordle-share style: label, bar, count. */
function Bars({ rows }: { rows: { label: string; count: number; color?: string; title?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((a, r) => a + r.count, 0) || 1;
  return (
    <div class="space-y-1.5">
      {rows.map((r) => (
        <div class="flex items-center gap-2 text-xs" title={r.title ?? `${r.label}: ${r.count} (${pct(r.count / total)})`}>
          <span class="w-8 shrink-0 text-right font-medium tabular-nums text-gray-600">{r.label}</span>
          <div class="h-5 flex-1">
            <div
              class="flex h-full min-w-[1.75rem] items-center justify-end rounded-r-md px-1.5 text-[11px] font-semibold tabular-nums text-gray-900"
              style={{ width: `${(r.count / max) * 100}%`, backgroundColor: r.color ?? "#bae6fd" }}
            >
              {r.count}
            </div>
          </div>
          <span class="w-9 shrink-0 text-right tabular-nums text-gray-400">{pct(r.count / total)}</span>
        </div>
      ))}
    </div>
  );
}

function TimeHistogram({ times }: { times: NonNullable<Data["times"]> }) {
  const { width, from, counts } = times;
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, c) => a + c, 0) || 1;
  const last = counts.length - 1;
  const range = (i: number) =>
    i === 0 && last > 0 ? `under ${timerTime(from + width)}`
    : i === last && last > 0 ? `${timerTime(from + i * width)} or more`
    : `${timerTime(from + i * width)}–${timerTime(from + (i + 1) * width)}`;
  const every = Math.ceil(counts.length / 5);
  return (
    <div>
      <div class="flex h-28 items-end gap-0.5">
        {counts.map((c, i) => (
          <div class="group flex h-full flex-1 flex-col justify-end" title={`${range(i)}: ${c} games (${pct(c / total)})`}>
            <div class="rounded-t-[4px] bg-sky-300 transition-colors group-hover:bg-sky-500" style={{ height: `${(c / max) * 100}%`, minHeight: c ? "2px" : "0" }} />
          </div>
        ))}
      </div>
      <div class="relative mt-1 h-3 text-[10px] tabular-nums text-gray-400">
        {counts.map((_, i) => i > 0 && i % every === 0 && (
          <span class="absolute -translate-x-1/2" style={{ left: `${(i / counts.length) * 100}%` }}>{timerTime(from + i * width)}</span>
        ))}
      </div>
    </div>
  );
}

function Rivals({ rivals }: { rivals: Data["rivals"] }) {
  return (
    <ul class="divide-y divide-gray-100">
      {rivals.map((r) => {
        const decided = r.wins + r.losses || 1;
        const share = r.wins / decided;
        const recent = r.recent_games ? r.recent_wins / r.recent_games : null;
        return (
          <li class="py-2 first:pt-0 last:pb-0">
            <div class="flex items-baseline justify-between gap-2 text-sm">
              <Name name={r.name} class="font-medium text-gray-900 hover:text-blue-600" />
              <span class="tabular-nums">
                <span class="font-bold text-green-700">{r.wins}</span>
                <span class="text-gray-400"> – </span>
                <span class="font-bold text-rose-700">{r.losses}</span>
              </span>
            </div>
            <div class="mt-1 flex h-2 overflow-hidden rounded-full bg-rose-200" title={`You were faster in ${pct(share)} of ${r.games} shared days`}>
              <div class="bg-green-500" style={{ width: `${share * 100}%` }} />
            </div>
            <div class="mt-0.5 flex justify-between text-[11px] text-gray-400">
              <span>{r.games} days head to head</span>
              {recent != null && <span>last 90d: {pct(recent)}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Weekdays({ weekdays }: { weekdays: Data["weekdays"] }) {
  const max = Math.max(0.01, ...weekdays.map((w) => w.win));
  const best = weekdays.reduce((a, w) => (w.games >= 3 && w.win > (a?.win ?? -1) ? w : a), null as Data["weekdays"][number] | null);
  return (
    <div class="grid grid-cols-7 gap-1.5 text-center">
      {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
        const w = weekdays.find((x) => x.dow === dow);
        return (
          <div title={w ? `${w.games} games · won ${pct(w.win)} · median ${timerTime(w.median)}` : "No games"}>
            <div class="flex h-16 items-end rounded-md bg-gray-50">
              <div class={"w-full rounded-md " + (w && w === best ? "bg-green-500" : "bg-green-300")} style={{ height: `${w ? Math.max(4, (w.win / max) * 100) : 0}%` }} />
            </div>
            <div class="mt-1 text-[11px] font-semibold text-gray-600">{"MTWTFSS"[dow - 1]}</div>
            <div class="text-[10px] tabular-nums text-gray-400">{w ? pct(w.win) : "–"}</div>
          </div>
        );
      })}
    </div>
  );
}

function Recent({ games, hide }: { games: Data["recent"]; hide: boolean }) {
  return (
    <ul class="divide-y divide-gray-100 text-sm">
      {games.map((g) => {
        const row = (
          <>
            <span class="w-24 shrink-0 whitespace-nowrap text-gray-500">{prettyDay(g.day, { weekday: "short", month: "short", day: "numeric" })}</span>
            <span class="min-w-0 flex-1 truncate font-mono text-xs font-semibold uppercase tracking-widest text-gray-700">
              {g.word ?? (hide ? "?????" : "")}
            </span>
            {g.guesses != null && <span class="hidden w-14 text-right text-xs text-gray-400 sm:inline">{g.guesses} rows</span>}
            <span class="w-12 text-right tabular-nums text-gray-900">{timerTime(g.time)}</span>
            <span
              class="ml-2 inline-flex w-16 shrink-0 items-center justify-end gap-1 text-xs tabular-nums text-gray-500"
              title={`${ordinal(g.place)} of ${g.n}`}
            >
              <span class="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: placeColor(g.place) }} />
              {ordinal(g.place)}/{g.n}
            </span>
          </>
        );
        return (
          <li>
            {g.submission_id
              ? <a class="-mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50" href={`/submissions/${g.submission_id}/playback`} title="Watch replay">{row}</a>
              : <div class="flex items-center gap-2 py-1.5">{row}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export default function Player({ params, data: d }: PageProps<Data>) {
  const { name: myName, played_today } = useSession();
  const me = params.name === myName;
  if (!d.total) {
    return (
      <div class="mx-auto w-full max-w-xl space-y-4">
        <Hero name={params.name} d={d} me={me} />
        <div class="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
          No daily games yet. Stats show up after the first one.
        </div>
      </div>
    );
  }
  const longest = d.streak.longest;
  const longestWins = d.streak.longest_wins;
  const placeRows = [1, 2, 3, 4, 5, 6].map((p) => ({
    label: p === 6 ? "6+" : ordinal(p),
    count: d.places.find((x) => x.place === p)?.count ?? 0,
    color: placeColor(p),
  })).filter((r, i) => i < 4 || r.count > 0);
  const guessRows = d.guesses.map((g) => ({ label: g.guesses >= 7 ? "7+" : `${g.guesses}`, count: g.count }));
  return (
    <div class="mx-auto w-full max-w-xl space-y-4">
      <Hero name={params.name} d={d} me={me} />

      <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tile label="Wins" value={d.wins.toLocaleString()} sub={`${pct(d.wins / d.total)} of games · ${pct(d.podiums / d.total)} podium`} />
        <Tile label="Beats the field" value={pct(d.beat)} sub={d.beat_30 != null ? `${pct(d.beat_30)} in the last 30d` : "of opponents, on average"} />
        <Tile
          label="Fastest"
          value={d.fastest ? timerTime(d.fastest.time) : "–"}
          sub={d.fastest && <>{short(d.fastest.day)}{d.fastest.word && <> · <span class="font-mono uppercase">{d.fastest.word}</span></>} ▶</>}
          href={d.fastest ? `/submissions/${d.fastest.submission_id}/playback` : undefined}
        />
        <Tile
          label="Median time"
          value={timerTime(d.median_30 ?? d.median ?? 0)}
          sub={d.median_30 == null ? "all-time" : d.median_prev_30 != null && Math.abs(d.median_30 - d.median_prev_30) >= 0.5
            ? <Delta now={d.median_30} before={d.median_prev_30} />
            : `last 30d · all-time ${timerTime(d.median ?? 0)}`}
        />
        <Tile
          label="Longest streak"
          value={<>{longest?.len ?? 0}<span class="ml-1 text-sm font-medium text-gray-400">days</span></>}
          sub={longest && `${short(longest.from)} – ${short(longest.to)}`}
        />
        <Tile
          label="Best win run"
          value={<>{longestWins?.len ?? 0}<span class="ml-1 text-sm font-medium text-gray-400">in a row</span></>}
          sub={longestWins ? `${short(longestWins.from)} – ${short(longestWins.to)}` : "no wins yet"}
        />
      </div>

      <Card title="Last year" aside={`${d.calendar.length} games`}>
        <div class="md:hidden"><Calendar days={d.calendar} weeks={26} /></div>
        <div class="hidden md:block"><Calendar days={d.calendar} weeks={53} /></div>
        <Legend />
      </Card>

      {d.trend.length > 1 && (
        <>
          <Card title="Speed" aside="median of the last 4 weeks · band = middle half">
            <Trend
              label="Rolling median solve time"
              format={timerTime}
              points={d.trend.map((t) => ({
                x: t.week, y: t.median, lo: t.p25, hi: t.p75,
                tip: `4 weeks to ${short(t.week)}: median ${timerTime(t.median)}, middle half ${timerTime(t.p25)}–${timerTime(t.p75)} (${t.games} games)`,
              }))}
            />
          </Card>
          {d.trend.some((t) => t.beat != null) && (
            <Card title="Form" aside="share of the field beaten, last 4 weeks">
              <Trend
                label="Rolling share of the field beaten"
                format={(v) => `${Math.round(v * 100)}%`}
                domain={[0, 1]}
                refLine={0.5}
                points={d.trend.filter((t) => t.beat != null).map((t) => ({
                  x: t.week, y: t.beat!,
                  tip: `4 weeks to ${short(t.week)}: beat ${pct(t.beat)} of the field (${t.games} games)`,
                }))}
              />
            </Card>
          )}
        </>
      )}

      <div class="grid gap-4 md:grid-cols-2">
        <Card title="Finishes"><Bars rows={placeRows} /></Card>
        {guessRows.length > 0 && (
          <Card title="Rows to solve" aside={d.avg_guesses != null ? `avg ${d.avg_guesses.toFixed(1)}` : undefined}>
            <Bars rows={guessRows} />
          </Card>
        )}
      </div>

      {d.rivals.length > 0 && (
        <Card title="Head to head" aside="faster on shared days">
          <Rivals rivals={d.rivals} />
        </Card>
      )}

      <div class="grid gap-4 md:grid-cols-2">
        <Card title="Win rate by weekday"><Weekdays weekdays={d.weekdays} /></Card>
        <Card title="Solve times" aside={d.clean != null ? `${pct(d.clean)} penalty-free` : undefined}>
          {d.times && <TimeHistogram times={d.times} />}
        </Card>
      </div>

      <Card title="Recent games">
        <Recent games={d.recent} hide={!played_today} />
      </Card>
    </div>
  );
}
