import { useState } from "preact/hooks";
import type { PageProps } from "@/router";
import Game from "@/components/Game";
import TimerText from "@/components/TimerText";

type Data = {
  challenge_id: number;
  starting_word: string;
  answer: string;
  leader?: { name: string; time: number } | null;
};

export default function ChallengePlay({ data: { challenge_id, starting_word, answer, leader } }: PageProps<Data>) {
  // The timer begins when the game mounts, so mount it only on an explicit tap
  // (never from a restored/background tab or a stray navigation).
  const [started, setStarted] = useState(false);
  if (!started) {
    return (
      <div class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 class="text-2xl font-bold">Challenge</h1>
        {leader ? <div>Time to beat: <b>{leader.name}</b> <TimerText seconds={leader.time} /></div> : null}
        <button
          type="button"
          onClick={() => setStarted(true)}
          class="rounded-lg bg-linear-to-br from-purple-600 to-blue-500 px-10 py-3 text-xl font-bold text-white shadow hover:opacity-90"
        >
          Start
        </button>
        <p class="text-sm text-gray-500">The clock starts when you press Start.</p>
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
