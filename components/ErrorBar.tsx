import TimerText from "@/components/timer_text.tsx";
import { Wordle } from "../utils/wordle.ts";
export default function ErrorBar(
  { winTime, error, penalty, wordle }: {
    winTime: number | null;
    error: string | null;
    penalty: number;
    wordle: Wordle | undefined;
  },
) {
  return (
    <div class="h-8 p-1">
      <style>
        {`
      @keyframes fade-out {

        0%,
        50% {
            opacity: 1;
        }
    
        100% {
            opacity: 0;
        }
    
      }
      `}
      </style>
      {winTime && (
        <div class="text-green-800">
          You won in <TimerText seconds={winTime} />!
          <a href="/practice" class="p-1 border-2 border-black rounded mx-2">
            Practice?
          </a>
        </div>
      )}
      {error && (
        <div
          key={`${error} ${penalty}`}
          class="text-red-800 opacity-0"
          style={{ animation: "fade-out 2s" }}
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
