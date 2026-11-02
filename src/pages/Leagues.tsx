import type { PageProps } from "@/router";
import { navigate } from "@/router";
import { refreshSession, switchLeague, useSession } from "@/lib/session";
import { rpc } from "@/lib/supabase";
import { timerTime } from "@/lib/time";
import { useState } from "preact/hooks";

type Row = {
  id: number; name: string; role: string; is_public: boolean; today: string; reset_at: string; members: number;
  played: boolean; players_today: number; my_rank_today: number | null;
  leader_today: { name: string; time: number } | null;
  yesterday: { winner: string; players: number; my_rank: number | null } | null;
  open_challenges: number;
  week: { leader: string | null; players: number; my_place: number | null; my_score: number | null };
};

const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm";
const ord = (n: number) => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]);

type StatProps = { label: string; value: string; note: string };

/** One tile of a league card's mini grid: small label, the headline, and a line of detail. */
function Stat({ label, value, note }: StatProps) {
  return (
    <div class="min-w-0 rounded-lg bg-gray-50 px-2.5 py-2">
      <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
      <div class="truncate text-sm font-semibold text-gray-900 tabular-nums">{value}</div>
      <div class="truncate text-xs text-gray-500">{note}</div>
    </div>
  );
}

function today(r: Row): Omit<StatProps, "label"> {
  if (r.played) {
    const rank = r.my_rank_today ?? 0;
    const note = rank > 1 && r.leader_today ? `${r.leader_today.name} leads` : rank === 1 ? "you lead" : "";
    return { value: `${ord(rank)} of ${r.players_today}`, note };
  }
  if (r.leader_today) return { value: r.leader_today.name, note: `${timerTime(r.leader_today.time)} · ${r.players_today} played` };
  return { value: "—", note: "nobody yet" };
}

function week(r: Row): Omit<StatProps, "label"> {
  const w = r.week;
  if (w.my_place) return { value: `${ord(w.my_place)} of ${w.players}`, note: w.my_place === 1 ? "you lead" : w.leader ? `${w.leader} leads` : "" };
  if (w.leader) return { value: w.leader, note: "leads" };
  return { value: "—", note: "no games yet" };
}

function yesterday(r: Row): Omit<StatProps, "label"> {
  const y = r.yesterday;
  if (!y) return { value: "—", note: "no games" };
  return { value: y.winner, note: y.my_rank === 1 ? "won · that's you" : y.my_rank ? `won · you ${ord(y.my_rank)}` : "won" };
}

/** Open a league at a page: switch first so the page loads with that league. */
export async function openLeague(id: number, to: string) {
  await switchLeague(id);
  await navigate(to);
}

/** Dashboard for players in more than one league: where each stands today. */
export default function Leagues({ data }: PageProps<Row[]>) {
  const { league } = useSession();
  const [busy, setBusy] = useState(false);
  const inGlobal = data.some((r) => r.is_public);
  return (
    <div class="mx-auto max-w-md space-y-3">
      <header class="px-1">
        <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Your leagues</div>
        <h1 class="text-2xl font-bold text-gray-900">{data.filter((r) => !r.played).length ? "Still to play today" : "All played today 🎉"}</h1>
      </header>
      {data.map((r) => (
        <section class={card} style={league?.id === r.id ? { boxShadow: "0 0 0 2px #0ea5e9" } : undefined}>
          <button type="button" class="block w-full text-left" onClick={() => void openLeague(r.id, "/stats/today")}>
            <div class="flex items-center justify-between gap-2">
              <h2 class="truncate text-lg font-semibold text-gray-900">{r.name}</h2>
              <span class="shrink-0 text-xs text-gray-500">{r.members} {r.members === 1 ? "player" : "players"}</span>
            </div>
            <div class="mt-3 grid grid-cols-3 gap-1.5">
              <Stat label="Today" {...today(r)} />
              <Stat label="Week" {...week(r)} />
              <Stat label="Yesterday" {...yesterday(r)} />
            </div>
          </button>
          <div class="mt-3 flex flex-wrap gap-2">
            {!r.played && (
              <button type="button" onClick={() => void openLeague(r.id, "/play")}
                class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">▶ Play</button>
            )}
            {r.is_public && data.length > 1 && (
              <button type="button" disabled={busy} class="ml-auto px-2 py-2 text-xs text-gray-500 underline"
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
            {r.open_challenges > 0 && (
              <button type="button" onClick={() => void openLeague(r.id, "/challenges")}
                class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                🎯 {r.open_challenges} open {r.open_challenges === 1 ? "challenge" : "challenges"}
              </button>
            )}
          </div>
        </section>
      ))}
      <div class="flex flex-wrap gap-2 px-1">
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
