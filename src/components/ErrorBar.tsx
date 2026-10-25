import TimerText from "@/components/TimerText";
import { Wordle } from "@/lib/wordle";
import { Battle } from "@/components/Game";
import { useSession } from "@/lib/session";

const pill = "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold shadow-sm transition active:scale-95";
export default function ErrorBar(
  {
    winTime,
    error,
    penalty,
    battleCallback,
    wordle,
    isPractice,
    challenge_id,
    lost,
    leader,
    revealed,
    onReveal,
    keepPlaying,
    onKeepPlaying,
  }: {
    isPractice: boolean;
    winTime: number | null;
    error: string | null;
    penalty: number;
    wordle: Wordle | undefined;
    challenge_id?: number;
    lost?: boolean;
    leader?: string;
    revealed?: boolean;
    /** Set while a challenge is behind the time to beat: fills in and scores the answer. */
    onReveal?(): void;
    keepPlaying?: boolean;
    onKeepPlaying?(): void;
    battleCallback?(): void | undefined;
  },
) {
  const pending = useSession().pending_challenges ?? 0;
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
      {winTime
        ? (
          <div class="flex items-center justify-center gap-2 text-green-800">
            {battleCallback
              ? <span>{error}!</span>
              : (
                <span class="font-semibold">
                  <TimerText seconds={winTime} />
                  {challenge_id !== undefined ? (lost ? <span class="ml-1 font-normal text-gray-600">{revealed ? "· answer shown" : "· not the fastest"}</span> : " · you lead!") : "!"}
                </span>
              )}
            {battleCallback
              ? (
                <button class={pill + " bg-white text-gray-700 ring-1 ring-gray-300"} onClick={battleCallback}>
                  New Battle
                </button>
              )
              : challenge_id !== undefined
              ? (
                <>
                  <a href={`/challenges/challenge/${challenge_id}`} class={pill + " bg-white text-green-700 ring-1 ring-green-300"}>Results</a>
                  <a href="/challenges/play" class={pill + " bg-green-500 text-white"}>{pending ? `Next (${pending})` : "New challenge"}</a>
                </>
              )
              : !isPractice
              ? (
                <a href="/challenges/play" class={pill + " bg-green-500 text-white"}>
                  {pending ? `${pending} open challenge${pending > 1 ? "s" : ""}` : "Try a challenge"}
                </a>
              )
              : (
                <a href="/practice" class={pill + " bg-white text-gray-700 ring-1 ring-gray-300"}>
                  Practice again
                </a>
              )}
          </div>
        )
        : onReveal
        ? (
          <div class="flex items-center justify-center gap-2 text-sm text-gray-700">
            <span>{keepPlaying ? "Your time still counts" : `${leader ? leader.toLowerCase() : "The leader"} wins this one`}</span>
            <button type="button" class={pill + " bg-white text-gray-700 ring-1 ring-gray-300"} onClick={onReveal}>
              Show answer
            </button>
            {!keepPlaying && (
              <button type="button" class={pill + " bg-green-500 text-white"} onClick={onKeepPlaying}>
                Keep playing
              </button>
            )}
          </div>
        )
        : null}
      {error && !winTime && (
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
          <div class="animate-pulse text-blue-400 font-bold">
            Loading...
          </div>
        )}
    </div>
  );
}
