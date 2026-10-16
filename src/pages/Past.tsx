import { useState } from "preact/hooks";
import { navigate, type PageProps } from "@/router";
import StatsTabs, { prettyDay, RankBadge } from "@/components/StatsTabs";
import { Name } from "@/components/DailyTable";
import { useSession } from "@/lib/session";
import { timerTime } from "@/lib/time";

type Day = {
  day: string;
  starter: string | null;
  answer: string | null; // null = today, not played yet
  players: number;
  winner: string;
  winner_time: number;
  my_rank: number | null;
  my_time: number | null;
};
type Week = { week: string; live: boolean; winner: string | null; leader: string | null };
type Champ = { name: string; wins: number; last: string; best_streak: number; current_streak: number };
export type PastData = { month: string; first_month: string; days: Day[]; weeks: Week[]; hall: Champ[] };

const monthLabel = (iso: string, month: "long" | "short" = "long") =>
  prettyDay(iso, { month, year: "numeric" });
const ym = (iso: string) => iso.slice(0, 7);
const pastHref = (month: string) => `/stats/past_winners?month=${month}`;

function shiftMonth(iso: string, by: number) {
  const d = new Date(iso.slice(0, 7) + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + by);
  return ym(d.toISOString());
}

function monthsBetween(first: string, last: string) {
  const out: string[] = [];
  for (let m = ym(last); m >= ym(first); m = shiftMonth(m, -1)) out.push(m);
  return out;
}

export default function Past({ data }: PageProps<PastData>) {
  const { name: me } = useSession();
  const thisMonth = new Date().toISOString().slice(0, 7);
  return (
    <StatsTabs route="past_winners">
      <HallOfFame hall={data.hall} me={me ?? ""} />
      <MonthNav month={ym(data.month)} first={ym(data.first_month)} last={thisMonth} />
      <MonthHighlights days={data.days} me={me ?? ""} />
      <Archive days={data.days} weeks={data.weeks} />
    </StatsTabs>
  );
}

/* ---------- Hall of fame ---------- */

function HallOfFame({ hall, me }: { hall: Champ[]; me: string }) {
  const [open, setOpen] = useState(false);
  if (!hall.length) return null;
  const champ = hall.find((c) => c.current_streak > 0);
  const podium = hall.slice(0, 3);
  const rest = hall.slice(3);
  const shown = open ? rest : rest.slice(0, 6);
  const mine = hall.findIndex((c) => c.name === me);
  const total = hall.reduce((a, c) => a + c.wins, 0);
  const medal = [
    "border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-100 text-amber-950",
    "border-gray-300 bg-gray-100 text-gray-900",
    "border-gray-200 bg-orange-200 text-orange-900",
  ];
  return (
    <section class="mb-4">
      <header class="mb-2 flex items-baseline justify-between px-1">
        <h2 class="text-lg font-semibold text-gray-900">Hall of fame</h2>
        <span class="text-xs text-gray-400">{total} weekly titles</span>
      </header>
      {champ && (
        <a
          href={`/players/${champ.name}`}
          class="mb-2 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:shadow-md"
        >
          <span class="text-lg" aria-hidden>👑</span>
          <span>
            <b>{champ.name}</b> holds the title
            {champ.current_streak > 1 ? <> · <b>{champ.current_streak}</b> weeks running</> : " · won last week"}
          </span>
        </a>
      )}
      <ol class="grid grid-cols-3 gap-2" aria-label="Most weekly titles">
        {podium.map((c, i) => (
          <li>
            <a
              href={`/players/${c.name}`}
              class={"flex h-full flex-col items-center rounded-2xl border px-2 py-3 text-center transition-shadow hover:shadow-md " +
                medal[i] + (c.name === me ? " ring-2 ring-amber-300" : "")}
            >
              <span class="text-2xl leading-none" aria-hidden>{["🥇", "🥈", "🥉"][i]}</span>
              <span class="mt-1 w-full truncate text-sm font-bold">{c.name}</span>
              <span class="text-2xl font-black tabular-nums leading-tight">{c.wins}</span>
              <span class="text-[10px] uppercase tracking-wider opacity-60">{c.wins === 1 ? "title" : "titles"}</span>
              {c.best_streak > 1 && <span class="mt-1 text-[10px] opacity-70">best run {c.best_streak}</span>}
            </a>
          </li>
        ))}
      </ol>
      {rest.length > 0 && (
        <div class="mt-2 flex flex-wrap items-center gap-1.5 px-1 text-xs">
          {shown.map((c) => (
            <a
              href={`/players/${c.name}`}
              class={"rounded-full border px-2 py-0.5 hover:bg-gray-50 " +
                (c.name === me ? "border-amber-200 bg-amber-50 text-amber-900" : "border-gray-200 bg-white text-gray-700")}
            >
              {c.name} <b class="tabular-nums">{c.wins}</b>
            </a>
          ))}
          {rest.length > shown.length && (
            <button type="button" class="px-1 text-gray-400 hover:text-gray-800" onClick={() => setOpen(true)}>
              +{rest.length - shown.length} more
            </button>
          )}
        </div>
      )}
      {!open && mine >= 9 && (
        <p class="mt-1 px-1 text-xs text-gray-500">You: #{mine + 1} with {hall[mine].wins} {hall[mine].wins === 1 ? "title" : "titles"}</p>
      )}
    </section>
  );
}

/* ---------- Month navigation ---------- */

function MonthNav({ month, first, last }: { month: string; first: string; last: string }) {
  const prev = month > first ? shiftMonth(month, -1) : null;
  const next = month < last ? shiftMonth(month, 1) : null;
  const arrow = "flex h-8 w-8 items-center justify-center rounded-full text-lg text-gray-600 hover:bg-gray-100";
  return (
    <nav class="mb-3 flex items-center justify-between gap-2" aria-label="Month">
      {prev
        ? <a class={arrow} href={pastHref(prev)} aria-label="Previous month">‹</a>
        : <span class={arrow + " opacity-0"} aria-hidden>‹</span>}
      <select
        aria-label="Jump to month"
        class="rounded-lg border-0 bg-transparent py-1 text-center text-lg font-semibold text-gray-900 hover:bg-gray-100"
        value={month}
        onChange={(e) => void navigate(pastHref((e.target as HTMLSelectElement).value))}
      >
        {monthsBetween(first, last).map((m) => <option value={m}>{monthLabel(m + "-01")}</option>)}
      </select>
      {next
        ? <a class={arrow} href={pastHref(next)} aria-label="Next month">›</a>
        : <span class={arrow + " opacity-0"} aria-hidden>›</span>}
    </nav>
  );
}

/* ---------- Month highlights ---------- */

function MonthHighlights({ days, me }: { days: Day[]; me: string }) {
  if (!days.length) return null;
  const played = days.filter((d) => d.my_rank != null);
  const myWins = played.filter((d) => d.my_rank === 1).length;
  const myBest = played.length ? Math.min(...played.map((d) => d.my_time!)) : null;
  const avgRank = played.length ? played.reduce((a, d) => a + d.my_rank!, 0) / played.length : null;

  const wins = new Map<string, number>();
  for (const d of days) wins.set(d.winner, (wins.get(d.winner) ?? 0) + 1);
  const topWins = [...wins].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
  const fastest = days.reduce((a, d) => (d.winner_time < a.winner_time ? d : a));

  const tile = "rounded-2xl border p-3 min-w-0";
  const label = "text-[11px] font-semibold uppercase tracking-wider";
  return (
    <section class="mb-4" aria-label="Month highlights">
      <div class={tile + " mb-2 border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100 text-sky-950"}>
        <div class={label + " text-sky-700"}>Your month</div>
        {played.length
          ? (
            <div class="mt-1 text-sm leading-snug">
              <span class="text-lg font-bold tabular-nums">{played.length}</span>
              <span class="text-xs"> / {days.length} days</span>
              {myWins > 0 && <span class="ml-2 font-semibold">🥇×{myWins}</span>}
              <div class="text-xs opacity-70">
                avg place {avgRank!.toFixed(1)} · best {timerTime(myBest!)}
              </div>
            </div>
          )
          : <div class="mt-1 text-sm opacity-70">No games this month</div>}
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class={tile + " border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-100 text-amber-950"}>
          <div class={label + " text-amber-700"}>Most daily wins</div>
          <ol class="mt-1 text-sm">
            {topWins.map(([n, c], i) => (
              <li class={"flex items-center justify-between gap-1 " + (n === me ? "font-bold" : "")}>
                <span class="truncate">{i === 0 ? "🥇 " : ""}{n}</span>
                <span class="tabular-nums font-semibold">{c}</span>
              </li>
            ))}
          </ol>
        </div>
        <a
          class={tile + " block border-green-300 bg-green-50 text-green-800 hover:shadow-md"}
          href={`/stats/daily/${fastest.day}`}
        >
          <div class={label + " text-green-700"}>⚡ Fastest win</div>
          <div class="mt-1 text-lg font-bold tabular-nums">{timerTime(fastest.winner_time)}</div>
          <div class="truncate text-xs opacity-70">{fastest.winner} · {prettyDay(fastest.day, { month: "short", day: "numeric" })}</div>
        </a>
      </div>
    </section>
  );
}

/* ---------- Day-by-day archive, grouped by week ---------- */

function Archive({ days, weeks }: { days: Day[]; weeks: Week[] }) {
  if (!days.length) {
    return (
      <div class="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
        No games this month.
      </div>
    );
  }
  return (
    <div class="space-y-4">
      {weeks.map((w) => {
        const end = addDays(w.week, 6);
        const wdays = days.filter((d) => d.day >= w.week && d.day <= end);
        if (!wdays.length) return null;
        return (
          <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" aria-label={`Week of ${w.week}`}>
            <a
              href={`/stats/weekly/${w.week}`}
              class="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-sm hover:bg-gray-100"
            >
              <span class="font-semibold text-gray-700">
                {prettyDay(w.week, { month: "short", day: "numeric" })} – {prettyDay(end, { month: "short", day: "numeric" })}
              </span>
              {w.live
                ? (
                  <span class="flex items-center gap-1.5 text-xs text-gray-500">
                    <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-green-500" />
                    {w.leader ? <>leading: <b class="text-gray-800">{w.leader}</b></> : "in progress"}
                  </span>
                )
                : w.winner
                ? <span class="truncate text-xs font-semibold text-amber-700">🏆 {w.winner}</span>
                : null}
            </a>
            <ul class="divide-y divide-gray-100">
              {wdays.map((d) => <DayRow d={d} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function DayRow({ d }: { d: Day }) {
  const hidden = d.answer == null;
  return (
    <li>
      <a href={`/stats/daily/${d.day}`} class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50">
        <span class="w-8 shrink-0 text-center leading-tight">
          <span class="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {prettyDay(d.day, { weekday: "short" })}
          </span>
          <span class="block text-base font-bold tabular-nums text-gray-800">{Number(d.day.slice(8, 10))}</span>
        </span>
        <span class="shrink-0">
          <Tiles word={hidden ? "?????" : d.answer!} hidden={hidden} />
          <span class="mt-0.5 block text-[10px] text-gray-400">
            {hidden ? "play to reveal" : d.starter ? <>from <span class="uppercase tracking-wide">{d.starter}</span></> : " "}
          </span>
        </span>
        <span class="min-w-0 flex-1 leading-tight">
          <span class="block truncate text-sm font-medium text-gray-900">🥇 {d.winner}</span>
          <span class="block text-[11px] tabular-nums text-gray-400">
            {timerTime(d.winner_time)} · {d.players} played
          </span>
        </span>
        <span class="flex w-9 shrink-0 flex-col items-center leading-tight" title={d.my_rank ? "Your place" : "You didn't play"}>
          {d.my_rank
            ? (
              <>
                <RankBadge rank={d.my_rank} />
                <span class="text-[10px] tabular-nums text-gray-400">{timerTime(d.my_time!)}</span>
              </>
            )
            : <span class="text-xs text-gray-300">—</span>}
        </span>
      </a>
    </li>
  );
}

function Tiles({ word, hidden }: { word: string; hidden: boolean }) {
  return (
    <span class="flex gap-0.5" aria-label={hidden ? "Answer hidden" : `Answer ${word.toUpperCase()}`}>
      {[...word.toUpperCase()].map((ch) => (
        <span
          class={"flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold " +
            (hidden ? "bg-gray-200 text-gray-400" : "bg-green-500 text-white")}
          aria-hidden
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
