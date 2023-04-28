import TimerText from "@/components/timer_text.tsx";
import { Wordle } from "@/utils/wordle.ts";
export default function ErrorBar(
  { winTime, error, penalty, pendingChallenges, wordle, challenge_id, lost }: {
    pendingChallenges: number;
    winTime: number | null;
    error: string | null;
    penalty: number;
    wordle: Wordle | undefined;
    challenge_id?: number;
    lost?: boolean;
  },
) {
  return (
    <div class="h-8 p-1">
      <style>
        {`
      @keyframes fade-out {

        0%,
        25% {
            opacity: 1;
        }
    
        100% {
            opacity: 0;
        }
    
      }
      `}
      </style>
      {lost
        ? (
          <div class="text-red-600">
            <a
              href={`/challenges/play`}
              class="p-1 border-2 border-black rounded mx-2"
            >
              {pendingChallenges
                ? `${pendingChallenges} More Challenge${
                  pendingChallenges > 1 ? "s" : ""
                }`
                : "Start New Challenge"}
            </a>
          </div>
        )
        : winTime
        ? (
          <div class="text-green-800">
            <TimerText seconds={winTime} />!
            {challenge_id !== undefined
              ? (
                <a
                  href={`/challenges/play`}
                  class="p-1 border-2 border-black rounded mx-2"
                >
                  {pendingChallenges
                    ? `${pendingChallenges} More Challenge${
                      pendingChallenges > 1 ? "s" : ""
                    }`
                    : "Start New Challenge"}
                </a>
              )
              : (
                <a
                  href="/practice"
                  class="p-1 border-2 border-black rounded mx-2"
                >
                  Practice?
                </a>
              )}
          </div>
        )
        : null}
      {error && (
        <div
          key={`${error} ${penalty}`}
          class="text-red-800 opacity-0"
          style={{ animation: "fade-out 4s" }}
        >
          {error}
        </div>
      )}
      {wordle
        ? null
        : (
          <div class="animate-bounce animate-pulse text-blue-400 font-bold">
            Loading...
          </div>
        )}
    </div>
  );
}
