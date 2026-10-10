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
  months: { month: string; games: number; median: number; win: number; beat: number | null }[];
  places: { place: number; count: number }[];
  guesses: { guesses: number; count: number }[];
  times: { bucket: number; count: number }[];
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
      {d.streak.current > 1 && (
        <p class="mt-3 text-sm font-medium text-sky-900">
          🔥 {d.streak.current}-day streak{d.streak.current_wins > 1 && <> · 👑 won the last {d.streak.current_wins} in a row</>}
        </p>
      )}
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

/** Monthly median solve time: one series, lower is better. */
function TrendChart({ months }: { months: Data["months"] }) {
  const W = 440, H = 160, L = 38, R = 10, T = 10, B = 22;
  const vals = months.map((m) => m.median);
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10);
  const hi = Math.ceil((Math.max(...vals) + 5) / 10) * 10;
  const step = Math.max(10, Math.ceil((hi - lo) / 4 / 10) * 10);
  const ticks = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);
  const top = ticks[ticks.length - 1];
  const n = months.length;
  const x = (i: number) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (top - lo || 1));
  const every = Math.ceil(n / 8);
  const area = `M${x(0)},${y(vals[0])} ` + vals.map((v, i) => `L${x(i)},${y(v)}`).join(" ") + ` L${x(n - 1)},${H - B} L${x(0)},${H - B} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="w-full" role="img" aria-label="Median solve time by month">
      <defs>
        <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color={ACCENT} stop-opacity=".18" />
          <stop offset="1" stop-color={ACCENT} stop-opacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#f1f5f9" />
          <text x={L - 6} y={y(t) + 3} text-anchor="end" font-size="10" fill="#9ca3af">{timerTime(t)}</text>
        </g>
      ))}
      {n > 1 && <path d={area} fill="url(#trend-fill)" />}
      <polyline fill="none" stroke={ACCENT} stroke-width="2" stroke-linejoin="round" points={vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
      {months.map((m, i) => (
        <g>
          <circle cx={x(i)} cy={y(m.median)} r={4} fill="white" stroke={ACCENT} stroke-width="2" />
          <circle cx={x(i)} cy={y(m.median)} r={12} fill="transparent">
            <title>{`${monthYear(m.month)}: median ${timerTime(m.median)} · ${m.games} games · won ${pct(m.win)}`}</title>
          </circle>
        </g>
      ))}
      {months.map((m, i) => (i % every === 0 || i === n - 1) && (
        <text x={x(i)} y={H - 6} text-anchor="middle" font-size="10" fill="#9ca3af">
          {prettyDay(m.month, m.month.slice(5, 7) === "01" || i === 0 ? { month: "short", year: "2-digit" } : { month: "short" })}
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

function TimeHistogram({ times }: { times: Data["times"] }) {
  const max = Math.max(1, ...times.map((t) => t.count));
  const total = times.reduce((a, t) => a + t.count, 0) || 1;
  return (
    <div>
      <div class="flex h-28 items-end gap-0.5">
        {times.map((t) => (
          <div class="group flex h-full flex-1 flex-col justify-end" title={`${timerTime(t.bucket)}+: ${t.count} games (${pct(t.count / total)})`}>
            <div class="rounded-t-[4px] bg-sky-300 transition-colors group-hover:bg-sky-500" style={{ height: `${(t.count / max) * 100}%`, minHeight: "2px" }} />
          </div>
        ))}
      </div>
      <div class="mt-1 flex gap-0.5 text-[10px] tabular-nums text-gray-400">
        {times.map((t, i) => <div class="flex-1 text-center">{i % Math.ceil(times.length / 6) === 0 ? timerTime(t.bucket) : ""}</div>)}
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
            <span class="w-20 shrink-0 text-gray-500">{prettyDay(g.day, { weekday: "short", month: "short", day: "numeric" })}</span>
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

      {d.months.length > 1 && (
        <Card title="Median time by month" aside="lower is faster">
          <TrendChart months={d.months} />
        </Card>
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
          <TimeHistogram times={d.times} />
        </Card>
      </div>

      <Card title="Recent games">
        <Recent games={d.recent} hide={!played_today} />
      </Card>
    </div>
  );
}
