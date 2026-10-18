import { useState } from "preact/hooks";
import type { PageProps } from "@/router";
import Game from "@/components/Game";
import TimerText from "@/components/TimerText";
import { ChallengeButton, plural, Target } from "@/components/ChallengeParts";

type Data = {
  challenge_id: number;
  starting_word: string;
  answer: string;
  leader?: { name: string; time: number } | null;
  set_by?: string | null;
  player_count?: number;
};

export default function ChallengePlay(
  { data: { challenge_id, starting_word, answer, leader, set_by, player_count = 0 } }: PageProps<Data>,
) {
  // The timer begins when the game mounts, so mount it only on an explicit tap
  // (never from a restored/background tab or a stray navigation).
  const [started, setStarted] = useState(false);
  if (!started) {
    return (
      <div class="flex h-full flex-col items-center justify-start gap-5 p-6 pt-8 text-center">
        <span class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white [&>svg]:h-7 [&>svg]:w-7">
          <Target />
        </span>
        <div>
          <h1 class="text-2xl font-bold text-gray-900">
            {set_by ? `${set_by.toLowerCase()}'s challenge` : "New challenge"}
          </h1>
          <p class="mt-1 text-sm text-gray-500">
            {leader
              ? `${plural(player_count, "player")} so far · #${challenge_id}`
              : "You go first. Everyone else gets to chase your time."}
          </p>
        </div>
        {leader
          ? (
            <div class="w-full max-w-xs rounded-2xl border border-green-300 bg-green-50 p-4">
              <div class="text-[11px] font-semibold uppercase tracking-wider text-green-700">Time to beat</div>
              <div class="mt-1 text-3xl font-bold tabular-nums text-gray-900"><TimerText seconds={leader.time} /></div>
              <div class="text-sm text-gray-600">{leader.name.toLowerCase()}</div>
            </div>
          )
          : null}
        <ChallengeButton onClick={() => setStarted(true)}>
          <span class="px-6 text-lg">Start</span>
        </ChallengeButton>
        <p class="text-sm text-gray-500">The clock starts when you press Start.</p>
        <a href="/challenges" class="text-sm text-gray-500 underline hover:text-gray-800">Back to challenges</a>
      </div>
    );
  }
  return (
    <Game
      challenge_id={challenge_id}
      isPractice={false}
      winnersTime={leader?.time}
      startingWord={starting_word}
      word={answer}
      winner={leader?.name}
    />
  );
}
