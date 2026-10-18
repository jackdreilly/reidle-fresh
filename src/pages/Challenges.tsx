import { useEffect, useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { Name } from "@/components/DailyTable";
import { RankBadge } from "@/components/StatsTabs";
import TimerText from "@/components/TimerText";
import { ChallengeButton, NextChallenge, ordinal, plural, Target, Tiles } from "@/components/ChallengeParts";
import { patchSession, useSession } from "@/lib/session";
import type { Leaderboard } from "@/lib/types";

type Open = { challenge_id: number; set_by: string; leader: { name: string; time: number }; player_count: number };
type Mine = {
  challenge_id: number;
  answer: string;
  time: number;
  rank: number;
  player_count: number;
  winner: { name: string; time: number };
};
type Data = {
  open: Open[];
  history: Mine[];
  today_leaderboard: Leaderboard;
  yesterday_leaderboard: Leaderboard;
  pending_challenges: number;
};

export default function Challenges(
  { data: { open = [], history, today_leaderboard, yesterday_leaderboard, pending_challenges } }: PageProps<Data>,
) {
  const { name: myName } = useSession();
  // This page is the freshest count we have: keep the badge in the top bar in step with it.
  useEffect(() => patchSession({ pending_challenges }), [pending_challenges]);
  const [day, setDay] = useState<"today" | "yesterday">("today");
  const board = day === "today" ? today_leaderboard : yesterday_leaderboard;
  return (
    <div class="mx-auto w-full max-w-xl space-y-6">
      <section class="rounded-2xl border border-green-300 bg-green-50 p-4 shadow-sm">
        <div class="flex items-start gap-3">
          <span class="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
            <Target />
          </span>
          <div class="min-w-0 flex-1">
            <h1 class="text-lg font-semibold text-gray-900">
              {open.length ? `${plural(open.length, "challenge")} waiting for you` : "Challenges"}
            </h1>
            <p class="text-sm text-gray-600">
              {open.length
                ? "Beat the time to take the win."
                : "Play a fresh word. Everyone else then gets a shot at your time."}
            </p>
          </div>
        </div>
        {open.length > 0 && (
          <ul class="mt-3 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {open.map((c) => (
              <li>
                <a
                  href={`/challenges/challenge/${c.challenge_id}/play`}
                  class="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-gray-50"
                >
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-medium text-gray-900">
                      {c.set_by.toLowerCase()}'s challenge
                    </div>
                    <div class="text-xs text-gray-500">{plural(c.player_count, "player")} so far</div>
                  </div>
                  <div class="text-right">
                    <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">To beat</div>
                    <div class="text-sm font-semibold tabular-nums text-gray-900">
                      <TimerText seconds={c.leader.time} />
                      <span class="ml-1 font-normal text-gray-500">{c.leader.name.toLowerCase()}</span>
                    </div>
                  </div>
                  <span class="rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white">Play</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <div class="mt-4 flex flex-wrap items-center gap-3">
          {open.length
            ? <NextChallenge pending={open.length} />
            : <ChallengeButton href="/challenges/play">Start a new challenge</ChallengeButton>}
          <span class="text-xs text-gray-500">Winner +1 per player · every play −1</span>
        </div>
      </section>

      <section>
        <header class="mb-2 flex items-center justify-between px-1">
          <h2 class="text-base font-semibold text-gray-900">Leaderboard</h2>
          <div class="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 text-xs font-medium" role="tablist">
            {(["today", "yesterday"] as const).map((d) => (
              <button
                type="button"
                role="tab"
                aria-selected={day === d}
                onClick={() => setDay(d)}
                class={"rounded-lg px-3 py-1 capitalize transition-colors " +
                  (day === d ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800")}
              >
                {d}
              </button>
            ))}
          </div>
        </header>
        <LeaderboardTable board={board} myName={myName ?? ""} empty={day === "today" ? "No scored challenges yet today." : "Nobody scored yesterday."} />
      </section>

      <section>
        <header class="mb-2 px-1">
          <h2 class="text-base font-semibold text-gray-900">Your challenges today</h2>
        </header>
        {history.length
          ? (
            <ul class="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {history.map((h) => {
                const won = h.rank === 1;
                return (
                  <li>
                    <a href={`/challenges/challenge/${h.challenge_id}`} class="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-gray-50">
                      <Tiles word={h.answer} tone="green" />
                      <div class="min-w-0 flex-1 text-right">
                        <div class="text-sm font-semibold tabular-nums text-gray-900"><TimerText seconds={h.time} /></div>
                        <div class="truncate text-xs text-gray-500">
                          {won
                            ? (h.player_count > 1 ? `Beat ${plural(h.player_count - 1, "player")}` : "Waiting for challengers")
                            : <>{h.winner.name.toLowerCase()} won in <TimerText seconds={h.winner.time} /></>}
                        </div>
                      </div>
                      <span
                        class={"shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold " +
                          (won ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600")}
                      >
                        {won ? "🏆 1st" : ordinal(h.rank)} of {h.player_count}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )
          : (
            <div class="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
              You haven't played a challenge today.
            </div>
          )}
      </section>
    </div>
  );
}

function LeaderboardTable({ board, myName, empty }: { board: Leaderboard; myName: string; empty: string }) {
  if (!board.length) {
    return (
      <div class="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">{empty}</div>
    );
  }
  return (
    <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          <tr>
            <th scope="col" class="py-2 pl-3 pr-2">Player</th>
            <th scope="col" class="px-2 py-2 text-right">W–L</th>
            <th scope="col" class="py-2 pl-2 pr-3 text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          {board.map(({ name, total_points, num_wins, num_losses }, i) => {
            const me = name === myName;
            return (
              <tr class={"border-b border-gray-100 last:border-0 " + (me ? "bg-amber-50" : "")}>
                <th scope="row" class={"py-2.5 pl-3 pr-2 font-medium " + (me ? "shadow-[inset_3px_0_0_var(--color-amber-400)]" : "")}>
                  <div class="flex items-center gap-2">
                    <RankBadge rank={i + 1} />
                    <Name name={name} class="text-gray-900 hover:text-blue-600" />
                  </div>
                </th>
                <td class="px-2 py-2.5 text-right tabular-nums text-gray-500">{num_wins}–{num_losses}</td>
                <td class={"py-2.5 pl-2 pr-3 text-right font-semibold tabular-nums " + (total_points < 0 ? "text-rose-600" : "text-gray-900")}>
                  {total_points > 0 ? `+${total_points}` : total_points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
