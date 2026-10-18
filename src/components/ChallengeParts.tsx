import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { Name } from "@/components/DailyTable";
import { RankBadge } from "@/components/StatsTabs";
import { useSession } from "@/lib/session";
import type { Leaderboard } from "@/lib/types";

/** Small letter tiles for a 5-letter word: green = the answer, gray = the starting word, "?" = still hidden. */
export function Tiles({ word, tone }: { word?: string | null; tone: "green" | "gray" }) {
  const letters = (word ?? "?????").toUpperCase().split("");
  return (
    <span class="inline-flex gap-0.5" aria-label={word ? word.toUpperCase() : "hidden word"}>
      {letters.map((l) => (
        <span
          aria-hidden="true"
          class={"inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold " +
            (!word ? "bg-gray-200 text-gray-400" : tone === "green" ? "bg-green-500 text-white" : "bg-gray-200 text-gray-700")}
        >
          {l}
        </span>
      ))}
    </span>
  );
}

export const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
};

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Primary green call to action, shared by every challenge screen. */
export function ChallengeButton(
  { href, onClick, children, disabled, secondary }: {
    href?: string;
    onClick?: () => void;
    children: ComponentChildren;
    disabled?: boolean;
    secondary?: boolean;
  },
) {
  const cls = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition active:scale-95 focus:outline-none focus:ring-4 focus:ring-green-300 disabled:opacity-50 " +
    (secondary
      ? "bg-white text-green-700 ring-1 ring-green-300 hover:bg-green-50"
      : "bg-gradient-to-r from-green-500 to-green-600 text-white hover:opacity-90");
  return href
    ? <a href={href} class={cls}>{children}</a>
    : <button type="button" class={cls} disabled={disabled} onClick={onClick}>{children}</button>;
}

/** "Next challenge" when some are waiting for you, otherwise "New challenge" (both go through challenge_next). */
export function NextChallenge({ pending, secondary }: { pending: number; secondary?: boolean }) {
  return (
    <ChallengeButton href="/challenges/play" secondary={secondary}>
      {pending ? `Next challenge · ${pending} open` : "New challenge"}
    </ChallengeButton>
  );
}

export function Target() {
  return (
    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" />
    </svg>
  );
}

/** Challenge points leaderboard with a Today/Yesterday toggle (hub and single challenge pages). */
export function ChallengeLeaderboard({ today, yesterday }: { today: Leaderboard; yesterday: Leaderboard }) {
  const { name: myName } = useSession();
  const [day, setDay] = useState<"today" | "yesterday">("today");
  const board = day === "today" ? today : yesterday;
  return (
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
