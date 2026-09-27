import TimerText from "@/components/timer_text.tsx";
import { Wordle } from "@/utils/wordle.ts";

export default function ErrorBar(
  {
    winTime,
    error,
    penalty,
    battleCallback,
    pendingChallenges,
    wordle,
    isPractice,
    challenge_id,
    lost,
  }: {
    isPractice: boolean;
    pendingChallenges: number;
    winTime: number | null;
    error: string | null;
    penalty: number;
    wordle: Wordle | undefined;
    challenge_id?: number;
    lost?: boolean;
    battleCallback?(): void | undefined;
  },
) {
  return (
    <div
      class="w-full min-w-0 px-1 flex items-center justify-center overflow-hidden select-none"
      style={{ height: "clamp(28px, 5dvh, 40px)" }}
    >
      {lost ? (
        <div class="animate-toast flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-full text-xs font-bold shadow-xs">
          <span>⏰ Time's up!</span>
          <a
            href="/challenges/play"
            class="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-full text-[11px] font-bold transition-colors"
          >
            {pendingChallenges
              ? `${pendingChallenges} Pending Challenge${pendingChallenges > 1 ? "s" : ""}`
              : "Next Challenge"}
          </a>
        </div>
      ) : winTime ? (
        <div class="animate-toast flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-full text-xs font-bold shadow-xs">
          <span>🎉</span>
          <span>
            {battleCallback ? (
              <span>{error || "Victory"}</span>
            ) : (
              <span>
                Solved in <TimerText seconds={winTime} />!
              </span>
            )}
          </span>
          {battleCallback ? (
            <button
              type="button"
              class="ml-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-[11px] font-bold transition-colors shadow-xs"
              onClick={battleCallback}
            >
              Next Round ⚔️
            </button>
          ) : challenge_id !== undefined || !isPractice ? (
            <a
              href="/challenges/play"
              class="ml-1 inline-flex shrink-0 items-center whitespace-nowrap px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-full text-[11px] font-bold transition-colors shadow-xs"
              title="Play the next challenge"
            >
              Next Challenge →
            </a>
          ) : (
            <a
              href="/practice"
              class="ml-1 px-3 py-1 bg-gray-900 hover:bg-black text-white rounded-full text-[11px] font-bold transition-colors"
            >
              Play Again ↺
            </a>
          )}
        </div>
      ) : error ? (
        <div
          key={`${error}-${penalty}`}
          class="animate-row-shake flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-full text-xs font-bold shadow-sm tracking-wide"
        >
          <span>⚠️</span>
          <span>{error}</span>
          {penalty ? (
            <span class="bg-red-800 text-red-100 text-[10px] px-1.5 py-0.5 rounded-full font-mono ml-0.5">
              +{penalty}s
            </span>
          ) : null}
        </div>
      ) : !wordle ? (
        <div class="flex items-center gap-2 text-xs text-gray-400 font-medium">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>Loading Reidle dictionary...</span>
        </div>
      ) : null}
    </div>
  );
}
