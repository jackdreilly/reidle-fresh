import type { PageProps } from "@/router";
import { navigate } from "@/router";
import { refreshSession, switchLeague, useSession } from "@/lib/session";
import { rpc } from "@/lib/supabase";
import { timerTime } from "@/lib/time";
import { useState } from "preact/hooks";

type Who = { name: string; time: number } | null;
type Row = {
  id: number; name: string; role: string; is_public: boolean; today: string; reset_at: string; members: number;
  played: boolean; started?: boolean; players_today: number; my_rank_today: number | null; my_time_today?: number | null;
  leader_today: Who; best_other_today?: Who;
  yesterday: { winner: string; winner_time?: number; players: number; my_rank: number | null; my_time?: number | null } | null;
  open_challenges: number;
  week: {
    leader: string | null; players: number; my_place: number | null; my_score: number | null;
    leader_score?: number | null; days_left?: number; next?: { name: string; score: number } | null;
  };
};

const ord = (n: number) => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]);
const label = "text-[10px] font-semibold uppercase tracking-wider";
/** Rank chip colours: gold for 1st, a plain chip otherwise. */
const chip = (rank: number | null | undefined) =>
  rank === 1 ? "bg-amber-300 text-[#1c1917]" : rank ? "bg-gray-200 text-gray-900" : "bg-gray-100 text-gray-400";

type FactProps = { k: string; v: string; n: string; accent?: boolean };

/** One labelled fact in a card's grid: small label, the value, a line of detail. */
function Fact({ k, v, n, accent }: FactProps) {
  return (
    <div class="min-w-0">
      <div class={`${label} text-gray-500`}>{k}</div>
      <div class={`truncate text-[15px] font-bold tabular-nums ${accent ? "text-amber-700" : "text-gray-900"}`}>{v}</div>
      <div class="truncate text-xs text-gray-500">{n}</div>
    </div>
  );
}

const played = (r: Row): FactProps => ({
  k: "Played", v: `${r.players_today} / ${r.members}`,
  n: r.played ? (r.members > r.players_today ? `${r.members - r.players_today} to go` : "everyone's in") : "so far",
});

/** Week standing in a few words: "12 pts behind dad", "+9 pts on olga". */
function weekGap(w: Row["week"]): string {
  if (!w.my_place || !w.next || w.my_score == null) return "";
  const d = Math.round(Math.abs(Number(w.my_score) - Number(w.next.score)));
  if (!d) return `tied with ${w.next.name}`;
  const pts = `${d} ${d === 1 ? "pt" : "pts"}`;
  return w.my_place === 1 ? `+${pts} on ${w.next.name}` : `${pts} behind ${w.next.name}`;
}
/** The ISO date before an ISO date. */
const dayBefore = (d: string) => new Date(Date.parse(d) - 86400_000).toISOString().slice(0, 10);
const daysLeft = (n?: number) => (n == null ? "" : n === 0 ? "last day" : `${n} ${n === 1 ? "day" : "days"} left`);

function weekFact(w: Row["week"]): FactProps {
  if (w.my_place) return { k: "Week", v: `${ord(w.my_place)} / ${w.players}`, n: weekGap(w) || (w.leader ? `${w.leader} leads` : ""), accent: w.my_place === 1 };
  return { k: "Week", v: "—", n: w.leader ? `${w.leader} leads` : "no games yet" };
}

/** Today's facts for a league you've played: your time, how many are in, and who's ahead (or behind) you. */
function doneFacts(r: Row): FactProps[] {
  const mine = r.my_time_today ?? null;
  const lead = r.leader_today;
  const other = r.best_other_today ?? null;
  const youLead = r.my_rank_today === 1;
  const behind = !youLead && mine != null && lead ? mine - lead.time : null;
  return [
    { k: "Your time", v: mine != null ? timerTime(mine) : "—", n: youLead ? "fastest so far" : behind != null ? `+${timerTime(behind)} off lead` : "" },
    played(r),
    youLead
      ? { k: "Next best", v: other ? timerTime(other.time) : "—", n: other ? other.name : "nobody yet" }
      : { k: "Leader", v: lead ? timerTime(lead.time) : "—", n: lead ? lead.name : "" },
  ];
}

function todoFacts(r: Row): FactProps[] {
  const best = r.best_other_today ?? r.leader_today;
  return [
    { k: "To beat", v: best ? timerTime(best.time) : "—", n: best ? best.name : "nobody yet" },
    played(r),
    weekFact(r.week),
  ];
}

/** Open a league at a page: switch first so the page loads with that league. */
export async function openLeague(id: number, to: string) {
  await switchLeague(id);
  await navigate(to);
}

/** Dashboard for players in more than one league: what's left to play today, how the rest went, and yesterday. */
export default function Leagues({ data }: PageProps<Row[]>) {
  const { league } = useSession();
  const [busy, setBusy] = useState(false);
  const inGlobal = data.some((r) => r.is_public);
  const todo = data.filter((r) => !r.played);
  const done = data.filter((r) => r.played);
  const yday = data.filter((r) => r.yesterday);
  const ring = (r: Row) => (league?.id === r.id && data.length > 1 ? { boxShadow: "0 0 0 2px #0ea5e9" } : undefined);

  const extras = (r: Row) => (r.open_challenges > 0 || (r.is_public && data.length > 1)) && (
    <div class="mt-2 flex flex-wrap items-center gap-2">
      {r.open_challenges > 0 && (
        <button type="button" onClick={() => void openLeague(r.id, "/challenges")}
          class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
          🎯 {r.open_challenges} open {r.open_challenges === 1 ? "challenge" : "challenges"}
        </button>
      )}
      {r.is_public && data.length > 1 && (
        <button type="button" disabled={busy} class="ml-auto px-2 py-1.5 text-xs text-gray-500 underline"
          onClick={async () => {
            if (!confirm(`Leave ${r.name}? You can rejoin any time from here.`)) return;
            setBusy(true);
            try {
              await rpc("leave_league", { p_league: r.id });
              const s = await refreshSession(); // the server moves you off it if it was current
              await navigate(s.leagues.length > 1 ? "/leagues" : "/", { replace: true });
            } finally { setBusy(false); }
          }}>
          Leave
        </button>
      )}
    </div>
  );

  const head = (r: Row) => (
    <div class="flex items-baseline justify-between gap-2">
      <h2 class="truncate text-[17px] font-bold text-gray-900">{r.name}</h2>
      <span class="shrink-0 text-xs text-gray-500">{r.members} {r.members === 1 ? "player" : "players"}</span>
    </div>
  );

  return (
    <div class="mx-auto max-w-md space-y-2.5">
      <header class="px-1">
        <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Your leagues</div>
        <h1 class="text-2xl font-bold text-gray-900">{todo.length ? "Today" : "All played today 🎉"}</h1>
      </header>

      {todo.length > 0 && <div class={`px-1 pt-1 text-xs font-bold uppercase tracking-wider text-rose-700`}>To play · {todo.length}</div>}
      {todo.map((r) => (
        <section class="rounded-2xl border border-rose-200 bg-rose-50 p-4" style={ring(r)}>
          <button type="button" class="block w-full text-left" onClick={() => void openLeague(r.id, "/play")}
            aria-label={`${r.started ? "Resume" : "Play"} ${r.name}`}>
            {head(r)}
            <div class="mt-2.5 flex items-center gap-3">
              <div class="grid min-w-0 flex-1 grid-cols-3 gap-2">{todoFacts(r).map((f) => <Fact {...f} />)}</div>
              <span class="flex h-12 shrink-0 items-center rounded-full bg-gradient-to-r from-pink-500 to-pink-600 px-4 text-sm font-semibold text-white shadow-sm">
                {r.started ? "Resume" : "▶ Play"}
              </span>
            </div>
          </button>
          {extras(r)}
        </section>
      ))}

      {done.length > 0 && <div class="px-1 pt-2 text-xs font-bold uppercase tracking-wider text-green-700">Done today · {done.length}</div>}
      {done.map((r) => {
        const w = r.week;
        return (
          <section class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm" style={ring(r)}>
            <button type="button" class="block w-full text-left" onClick={() => void openLeague(r.id, "/stats/today")}>
              {head(r)}
              <div class="mt-2.5 flex items-center gap-3">
                <div class={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-extrabold ${chip(r.my_rank_today)}`}>
                  {r.my_rank_today ? ord(r.my_rank_today) : "—"}
                </div>
                <div class="grid min-w-0 flex-1 grid-cols-3 gap-2">{doneFacts(r).map((f) => <Fact {...f} />)}</div>
              </div>
              <div class="mt-2.5 flex items-center gap-2 rounded-lg bg-gray-100 px-2.5 py-1.5 text-sm">
                <span class={`${label} text-gray-500`}>Week</span>
                <b class={w.my_place === 1 ? "text-amber-700" : "text-gray-900"}>{w.my_place ? `${ord(w.my_place)} of ${w.players}` : "—"}</b>
                <span class="min-w-0 flex-1 truncate text-gray-500">
                  {[weekGap(w) || (w.my_place !== 1 && w.leader ? `${w.leader} leads` : ""), daysLeft(w.days_left)].filter(Boolean).join(" · ")}
                </span>
              </div>
            </button>
            {extras(r)}
          </section>
        );
      })}

      {yday.length > 0 && (
        <>
          <div class="px-1 pt-2 text-xs font-bold uppercase tracking-wider text-gray-500">Yesterday</div>
          <div class="rounded-2xl border border-gray-200 bg-white px-4 py-1">
            {yday.map((r) => {
              const y = r.yesterday!;
              const won = y.my_rank === 1;
              return (
                <button type="button" onClick={() => void openLeague(r.id, `/stats/daily/${dayBefore(r.today)}`)}
                  class="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 border-b border-gray-100 py-2 text-left text-sm last:border-b-0">
                  <span class="truncate font-semibold text-gray-900">{r.name}</span>
                  <span class="truncate text-gray-500">
                    {won ? "you won" : y.winner}{y.winner_time != null ? ` ${timerTime(y.winner_time)}` : ""}
                  </span>
                  <span class={`min-w-10 rounded-md px-1.5 py-0.5 text-center font-bold ${chip(y.my_rank)}`}>{y.my_rank ? ord(y.my_rank) : "—"}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div class="flex flex-wrap gap-2 px-1 pt-2">
        <a href="/leagues/new" class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white">+ New league</a>
        {!inGlobal && (
          <button type="button" disabled={busy} class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            onClick={async () => {
              setBusy(true);
              try { await openLeague(await rpc<number>("join_league", { p_code: "global" }), "/stats/today"); } finally { setBusy(false); }
            }}>
            🌍 Join Reidle Global
          </button>
        )}
      </div>
    </div>
  );
}
