import type { PageProps } from "@/router";
import { DailyTable } from "@/components/DailyTable";
import TimerText from "@/components/TimerText";
import { ChallengeButton, ChallengeLeaderboard, NextChallenge, ordinal, plural, Tiles } from "@/components/ChallengeParts";
import { useSession } from "@/lib/session";
import { fromNow } from "@/lib/time";
import type { DailySubmission, Leaderboard } from "@/lib/types";

type Data = {
  challenge_id: number;
  played: boolean;
  submissions: DailySubmission[];
  starting_word?: string | null;
  answer?: string | null;
  created_at?: string | null;
  pending_challenges?: number;
  today_leaderboard?: Leaderboard;
  yesterday_leaderboard?: Leaderboard;
};

export default function Challenge(
  {
    data: {
      challenge_id, played, submissions, starting_word, answer, created_at, pending_challenges = 0,
      today_leaderboard = [], yesterday_leaderboard = [],
    },
  }: PageProps<Data>,
) {
  const { name } = useSession();
  const leader = submissions[0];
  const myRank = submissions.findIndex((s) => s.name === name) + 1;
  return (
    <div class="mx-auto w-full max-w-xl space-y-4">
      <a href="/challenges" class="inline-flex items-center gap-1 px-1 text-sm text-gray-500 hover:text-gray-800">
        <span aria-hidden="true">←</span> Challenges
      </a>
      <section class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div class="flex items-baseline justify-between gap-2">
          <h1 class="text-lg font-semibold text-gray-900">Challenge #{challenge_id}</h1>
          <span class="text-xs text-gray-400">
            {plural(submissions.length, "player")}{created_at ? ` · ${fromNow(created_at)}` : ""}
          </span>
        </div>
        <dl class="mt-3 grid grid-cols-2 gap-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          <div>
            <dt class="mb-1">Starting word</dt>
            <dd><Tiles word={played ? starting_word : null} tone="gray" /></dd>
          </div>
          <div>
            <dt class="mb-1">Answer</dt>
            <dd><Tiles word={played ? answer : null} tone="green" /></dd>
          </div>
        </dl>
        {played
          ? (
            <div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-green-50 px-3 py-2.5">
              <div class="text-sm text-gray-900">
                {myRank === 1
                  ? <><b>🏆 You're leading</b>{submissions.length > 1 ? ` ahead of ${plural(submissions.length - 1, "player")}` : ". Waiting for challengers."}</>
                  : <>You placed <b>{ordinal(myRank)}</b> of {submissions.length}</>}
              </div>
              <NextChallenge pending={pending_challenges} />
            </div>
          )
          : (
            <div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-green-50 px-3 py-2.5">
              <div class="text-sm text-gray-900">
                {leader
                  ? <>Time to beat: <b class="tabular-nums"><TimerText seconds={leader.time} /></b> by {leader.name.toLowerCase()}</>
                  : "Nobody has played this one yet."}
              </div>
              <ChallengeButton href={`/challenges/challenge/${challenge_id}/play`}>Play</ChallengeButton>
            </div>
          )}
      </section>
      <DailyTable hide={!played} name={name ?? ""} submissions={submissions} />
      <div class="pt-2">
        <ChallengeLeaderboard today={today_leaderboard} yesterday={yesterday_leaderboard} />
      </div>
    </div>
  );
}
