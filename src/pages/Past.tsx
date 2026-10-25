import { useState } from "preact/hooks";
import { navigate, type PageProps } from "@/router";
import StatsTabs, { prettyDay } from "@/components/StatsTabs";
import { useSession } from "@/lib/session";

type Ranked = {
  name: string;
  rank: number;
  prev: number | null; // last week's rank; null = not ranked then
  points: number;
  form: (number | null)[]; // weekly place in each week of the window, oldest first; null = didn't play
  best: number; // career-high rank
  weeks_at_1: number;
  drop: number; // points that fall out of the window next week
  new: boolean; // first time ranked
};
type Week = { week: string; live: boolean; players: number; podium: string[] };
type Champ = { name: string; wins: number; last: string; best_streak: number; current_streak: number };
export type PastData = {
  window: number;
  as_of: string | null;
  rankings: Ranked[];
  weeks_at_1: { name: string; weeks: number }[]; // all-time leaders
  weeks: Week[];
  hall: Champ[];
};

// Keep in step with finish_points() in the database and the Help page.
export const FINISH_POINTS = [10, 6, 4, 3, 2];

const short = (iso: string) => prettyDay(iso, { month: "short", day: "numeric" });

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function Past({ data }: PageProps<PastData>) {
  const { name } = useSession();
  const me = name ?? "";
  return (
    <StatsTabs route="past_winners">
      <PowerRankings data={data} me={me} />
      <Records hall={data.hall} atOne={data.weeks_at_1} me={me} />
      <WeeklyPodiums weeks={data.weeks} me={me} />
    </StatsTabs>
  );
}

/* ---------- Power rankings ---------- */

function PowerRankings({ data, me }: { data: PastData; me: string }) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [how, setHow] = useState(false);
  const { rankings, window: win, as_of } = data;
  if (!rankings.length || !as_of) return null;
  const top = rankings.filter((r, i) => all || i < 10 || r.name === me);
  return (
    <section class="mb-4" aria-labelledby="pr-title">
      <header class="mb-2 flex items-baseline justify-between gap-2 px-1">
        <h2 id="pr-title" class="text-lg font-semibold text-gray-900">Power rankings</h2>
        <button type="button" class="text-xs text-gray-400 hover:text-gray-800" onClick={() => setHow(!how)} aria-expanded={how}>
          {how ? "Hide" : "How it works"}
        </button>
      </header>
      {how && (
        <p class="mb-2 rounded-xl bg-gray-50 px-3 py-2 text-xs leading-snug text-gray-600">
          Each week's finish earns points: {FINISH_POINTS.map((p, i) => `${["1st", "2nd", "3rd", "4th", "5th"][i]} ${p}`).join(", ")},
          {" "}anyone else who played 1. Your total is your last {win} finished weeks, so old weeks drop off as new
          ones count, like tennis rankings. Arrows show the move since last week. The squares are your last {win} finishes,
          oldest first. Tap a player for more.
        </p>
      )}
      <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div class="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <span class="flex-1">After week of {short(as_of)}</span>
          <span>Last {win} weeks</span>
          <span class="w-8 text-right">Pts</span>
        </div>
        <ol class="divide-y divide-gray-100">
          {top.map((r) => (
            <RankRow r={r} me={r.name === me} open={open === r.name} toggle={() => setOpen(open === r.name ? null : r.name)} win={win} />
          ))}
        </ol>
      </div>
      <div class="mt-1 flex items-center justify-between px-1 text-xs">
        {rankings.length > top.length || all
          ? (
            <button type="button" class="text-gray-400 hover:text-gray-800" onClick={() => setAll(!all)}>
              {all ? "Show top 10" : `Show all ${rankings.length}`}
            </button>
          )
          : <span />}
        <a href="/rankings" class="text-gray-400 hover:text-gray-800">Daily chart ›</a>
      </div>
    </section>
  );
}

function RankRow({ r, me, open, toggle, win }: { r: Ranked; me: boolean; open: boolean; toggle: () => void; win: number }) {
  return (
    <li class={me ? "bg-amber-50" : ""}>
      <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50" onClick={toggle} aria-expanded={open}>
        <span class={"w-5 shrink-0 text-right text-base font-bold tabular-nums " + (r.rank === 1 ? "text-amber-700" : "text-gray-800")}>
          {r.rank}
        </span>
        <Move r={r} />
        <span class={"min-w-0 flex-1 truncate text-sm " + (me ? "font-bold text-gray-900" : "font-medium text-gray-900")}>
          {r.rank === 1 && <span aria-hidden>👑 </span>}{r.name}
        </span>
        <Form form={r.form} />
        <span class="w-8 shrink-0 text-right text-sm font-bold tabular-nums text-gray-900">{r.points}</span>
      </button>
      {open && (
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-2 text-xs text-gray-500">
          <span>Career high <b class="text-gray-800">#{r.best}</b></span>
          {r.weeks_at_1 > 0 && <span><b class="text-gray-800">{r.weeks_at_1}</b> {r.weeks_at_1 === 1 ? "week" : "weeks"} at #1</span>}
          <span>
            {r.drop > 0 ? <><b class="text-gray-800">{r.drop}</b> pts drop off next week</> : `nothing to defend from ${win} weeks ago`}
          </span>
          <a
            href={`/players/${r.name}`}
            class="text-gray-400 underline hover:text-gray-800"
            onClick={(e) => { e.preventDefault(); void navigate(`/players/${r.name}`); }}
          >
            Stats
          </a>
        </div>
      )}
    </li>
  );
}

function Move({ r }: { r: Ranked }) {
  const base = "w-8 shrink-0 text-center text-[10px] font-bold tabular-nums";
  if (r.prev == null) {
    return <span class={base + " text-sky-600"} title={r.new ? "First week ranked" : "Back in the rankings"}>{r.new ? "NEW" : "RE"}</span>;
  }
  const d = r.prev - r.rank;
  if (d > 0) return <span class={base + " text-green-600"} title={`Up ${d} from #${r.prev}`}>▲{d}</span>;
  if (d < 0) return <span class={base + " text-rose-600"} title={`Down ${-d} from #${r.prev}`}>▼{-d}</span>;
  return <span class={base + " text-gray-300"} title="No change">–</span>;
}

const PLACE = ["bg-amber-300 text-amber-900", "bg-gray-200 text-gray-700", "bg-orange-200 text-orange-900"];

function Form({ form }: { form: (number | null)[] }) {
  return (
    <span class="flex shrink-0 gap-0.5" aria-label={"Recent finishes: " + form.map((p) => p ?? "–").join(", ")}>
      {form.map((p) => (
        <span
          class={"flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold tabular-nums leading-none " +
            (p == null ? "border border-dashed border-gray-200" : PLACE[p - 1] ?? "text-gray-400")}
          aria-hidden
        >
          {p != null && p <= 9 ? p : ""}
        </span>
      ))}
    </span>
  );
}

/* ---------- Records ---------- */

function Records({ hall, atOne, me }: { hall: Champ[]; atOne: PastData["weeks_at_1"]; me: string }) {
  const champ = hall.find((c) => c.current_streak > 0);
  const titles = hall.slice(0, 5);
  const streak = hall.reduce<Champ | null>((a, c) => (!a || c.best_streak > a.best_streak ? c : a), null);
  if (!hall.length) return null;
  const tile = "min-w-0 rounded-2xl border p-3";
  const label = "text-[11px] font-semibold uppercase tracking-wider";
  const row = (name: string, n: number) => (
    <li class={"flex items-center justify-between gap-1 " + (name === me ? "font-bold" : "")}>
      <a href={`/players/${name}`} class="truncate hover:underline">{name}</a>
      <span class="tabular-nums font-semibold">{n}</span>
    </li>
  );
  return (
    <section class="mb-4" aria-label="Records">
      {champ && (
        <a
          href={`/stats/weekly/${champ.last}`}
          class="mb-2 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:shadow-md"
        >
          <span class="text-lg" aria-hidden>🏆</span>
          <span>
            <b>{champ.name}</b> won last week
            {champ.current_streak > 1 && <> · <b>{champ.current_streak}</b> in a row</>}
          </span>
        </a>
      )}
      <div class="grid grid-cols-2 gap-2">
        <div class={tile + " border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-100 text-amber-950"}>
          <div class={label + " text-amber-700"}>Most weekly wins</div>
          <ol class="mt-1 text-sm" aria-label="Most weekly titles">{titles.map((c) => row(c.name, c.wins))}</ol>
        </div>
        <div class={tile + " border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100 text-sky-950"}>
          <div class={label + " text-sky-700"}>Weeks at #1</div>
          <ol class="mt-1 text-sm">{atOne.map((r) => row(r.name, r.weeks))}</ol>
        </div>
      </div>
      {streak && streak.best_streak > 1 && (
        <p class="mt-1 px-1 text-xs text-gray-500">
          Longest winning run: <b class="text-gray-800">{streak.name}</b>, {streak.best_streak} weeks in a row
        </p>
      )}
    </section>
  );
}

/* ---------- Every week's podium, newest first ---------- */

function WeeklyPodiums({ weeks, me }: { weeks: Week[]; me: string }) {
  const [shown, setShown] = useState(12);
  if (!weeks.length) {
    return (
      <div class="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
        No weeks played yet.
      </div>
    );
  }
  const list = weeks.slice(0, shown);
  const thisYear = new Date().getUTCFullYear();
  return (
    <section aria-labelledby="wk-title">
      <header class="mb-2 flex items-baseline justify-between px-1">
        <h2 id="wk-title" class="text-lg font-semibold text-gray-900">Every week</h2>
        <span class="text-xs text-gray-400">{weeks.filter((w) => !w.live).length} weeks</span>
      </header>
      <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div class="flex gap-2 border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <span class="w-16 shrink-0">Week</span><span class="flex-1">🥇 1st</span><span class="flex-1">🥈 2nd</span><span class="flex-1">🥉 3rd</span>
        </div>
        <ul class="divide-y divide-gray-100" aria-label="Weekly podiums">
          {list.map((w, i) => {
            const year = Number(w.week.slice(0, 4));
            const prevYear = i > 0 ? Number(list[i - 1].week.slice(0, 4)) : thisYear;
            return (
              <>
                {year !== prevYear && (
                  <li class="bg-gray-50 px-3 py-1 text-xs font-bold text-gray-500">{year}</li>
                )}
                <li>
                  <a href={`/stats/weekly/${w.week}`} class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                    <span class="w-16 shrink-0 leading-tight">
                      <span class="block font-semibold text-gray-800">{short(w.week)}</span>
                      <span class="block text-[10px] text-gray-400">
                        {w.live
                          ? <span class="inline-flex items-center gap-1"><span class="h-2 w-2 animate-pulse rounded-full bg-green-500" />so far</span>
                          : `– ${short(addDays(w.week, 6))}`}
                      </span>
                    </span>
                    {[0, 1, 2].map((p) => {
                      const n = w.podium[p];
                      return (
                        <span class={"min-w-0 flex-1 truncate " + (n === me ? "font-bold text-amber-900" : p === 0 ? "font-semibold text-gray-900" : "text-gray-700")}>
                          {n ?? <span class="text-gray-300">—</span>}
                        </span>
                      );
                    })}
                  </a>
                </li>
              </>
            );
          })}
        </ul>
      </div>
      {weeks.length > shown && (
        <button
          type="button"
          class="mt-2 w-full rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          onClick={() => setShown(shown + 26)}
        >
          Show older weeks
        </button>
      )}
    </section>
  );
}
