import ErrorBar from "@/components/ErrorBar.tsx";
import TimerText from "@/components/timer_text.tsx";
import { Playback, PlaybackEvent, scoreColor } from "@/utils/playback.ts";
import { BattleState, Checkpoint } from "@/utils/sql_files.ts";
import { ScoredWord, Scoring, ScoringHistory, Wordle } from "@/utils/wordle.ts";
import {
  ChatMessage,
  PartyChatInput,
  PartyChatToast,
} from "@/components/PartyChat.tsx";
import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { useEffect, useMemo, useState } from "preact/hooks";
import Confetti from "@/islands/confetti.tsx";
import IconClock from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/clock.tsx";

export type Battle = {
  battle_id: number;
  state: BattleState;
  supabase: SupabaseClient | null;
  users: string[];
  sendMessage?: (text: string) => void;
  broadcastMove?: (wordScore: ScoredWord, wordStr: string, isWin: boolean) => void;
  broadcastPenalty?: (penaltySeconds: number) => void;
  broadcastRestart?: (newState: BattleState) => void;
  penaltiesMap?: Record<string, number>;
  currentToast?: ChatMessage | null;
  dismissToast?: () => void;
};

interface GameProperties {
  word: string;
  isPractice: boolean;
  startingWord: string;
  winnersTime?: number | null;
  challenge_id?: number;
  battle?: Battle;
  winner?: string;
  name?: string;
  checkpoint?: Checkpoint;
}

export default function Game(
  {
    word,
    startingWord,
    isPractice,
    winnersTime,
    challenge_id,
    winner,
    battle,
    name,
    checkpoint,
  }: GameProperties,
) {
  const checkpointDate = () =>
    (checkpoint?.created_at &&
        (new Date().getTime() - new Date(checkpoint?.created_at).getTime()) >
          10000)
      ? new Date(checkpoint?.created_at)
      : new Date();
  const isPlaying = !isPractice && !challenge_id && !battle && !!checkpoint;
  const [pendingChallenges, setPendingChallenges] = useState(0);
  const [playback, setPlayback] = useState<Playback>({ events: [] });
  const [penalties, setPenalties] = useState(checkpoint?.penalty ?? 0);
  const [startTime, setStartTime] = useState(checkpointDate());
  const [error, setErrorPrivatePrivate] = useState("");
  const [wordle, setWordle] = useState<Wordle>();
  const [currentWord, setCurrentWordPrivate] = useState(
    battle?.state?.history?.length ? "" : startingWord,
  );
  const [previousWords, setPreviousWordsPrivate] = useState<ScoringHistory>([]);
  const [won, setWon] = useState<Date | null>(null);
  const [ticks, setTicks] = useState(0);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [enableHelp, setEnableHelp] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showPenaltyBox, setShowPenaltyBox] = useState(false);
  const [shakeRow, setShakeRow] = useState(false);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    fetch("/api/checkpoint", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        penalties,
        history: previousWords,
      }),
    });
  }, [isPlaying, penalties, previousWords]);

  useEffect(() => {
    if (!isPlaying || !checkpoint.history?.length) {
      return;
    }
    setPreviousWords(checkpoint.history);
    setCurrentWord("");
  }, [checkpoint, startingWord, word]);

  useEffect(() => {
    if (!battle) {
      return;
    }
    const incomingHistory = battle.state.history ?? [];
    if (incomingHistory.length >= previousWords.length || won) {
      setPreviousWords(incomingHistory);
    }
    const isGameOver = incomingHistory.length > 0 &&
      incomingHistory[incomingHistory.length - 1].every((x) =>
        x.score === Scoring.green
      );

    if (incomingHistory.length > 0 && battle.state.message) {
      if (isGameOver || battle.state.last_player !== name) {
        setErrorPrivatePrivate(battle.state.message);
      }
    }
    if (!won && isGameOver) {
      setWon(new Date());
    }
    if (
      won &&
      (incomingHistory.length === 0 ||
        incomingHistory[incomingHistory.length - 1]?.some((x) =>
          x.score !== Scoring.green
        ))
    ) {
      setWon(null);
      setStartTime(new Date());
      setCurrentWord(startingWord);
      setErrorPrivatePrivate("");
    }
  }, [battle?.state, wordle, won]);

  useEffect(() => {
    if (!previousWords.length && currentWord && wordle) {
      if (battle) {
        if (battle.state?.history && battle.state.history.length > 0) {
          setPreviousWords(battle.state.history);
          setCurrentWord("");
          return;
        }
      }
      scoreWord();
    }
  }, [currentWord, previousWords, wordle, battle?.state?.history]);

  function addPlayback(
    { l, b, c, s, e }: {
      l?: string;
      b?: boolean;
      c?: boolean;
      s?: ScoredWord;
      e?: { m: string; p: number };
    },
  ) {
    const event: PlaybackEvent = {
      time: (new Date().getTime() - startTime.getTime()),
      ...(l
        ? { letter: l }
        : b
        ? { backspace: true }
        : c
        ? { clear: true }
        : s
        ? { score: s }
        : e
        ? { error: { message: e.m, penalty: e.p } }
        : {}),
    };
    setPlayback((v) => {
      v.events.push(event);
      return v;
    });
  }

  function setCurrentWord(input: string | ((word: string) => string)) {
    const newWord = typeof input === "string" ? input : input(currentWord);
    setCurrentWordPrivate((oldWord) => {
      if (!newWord.length) {
        addPlayback({ c: true });
      } else if (newWord.length < currentWord.length) {
        addPlayback({ b: true });
      } else {
        addPlayback({ l: newWord.slice(newWord.length - 1) });
      }
      return newWord;
    });
  }

  const doubleCandidates = useMemo(() => {
    if (!wordle) {
      return [];
    }
    return !isPractice
      ? candidates
      : candidates.filter((c) =>
        c.split("").every((l, i) =>
          [l, " ", "-", undefined].includes(currentWord[i])
        )
      );
  }, [currentWord, wordle, candidates]);

  function setPreviousWords(
    input: ScoringHistory | ((word: ScoringHistory) => ScoringHistory),
  ) {
    const words = typeof input === "object" ? input : input(previousWords);
    addPlayback({ s: words[words.length - 1] });
    setPreviousWordsPrivate(words);
    setCandidates((candidates) =>
      candidates.filter((currentWord) =>
        wordScorer({
          wordle: wordle!,
          word,
          currentWord,
          previousWords: words,
        }) instanceof
          Array
      )
    );
  }

  useEffect(() => {
    async function helper() {
      const wordle = await Wordle.make(false);
      setWordle((_) => wordle);
      setStartTime((_) => checkpointDate());
      setCandidates(wordle.words);
    }
    helper();
  }, []);

  function addError(error: string, penalty: number | undefined = undefined) {
    setErrorPrivatePrivate(error);
    setShakeRow(true);
    setTimeout(() => setShakeRow(false), 500);

    if (penalty) {
      setPenalties((p) => p + penalty);
      if (battle) {
        battle.broadcastPenalty?.(penalty);
      }
    }
    if (error) {
      addPlayback({ e: { m: error, p: penalty ?? 0 } });
    }
  }

  useEffect(() => {
    if (!wordle) {
      return;
    }
    const interval = setInterval(() => {
      setTicks((s) => s + 1);
      if (battle) {
        setPenalties((p) => Math.max(0, p - 1));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [wordle]);

  const keyboardLookup = useMemo(() => {
    const keyboardLookup: Record<string, Scoring> = {};
    previousWords.forEach((w) =>
      w.forEach(({ letter, score }) => {
        const previous = keyboardLookup[letter];
        switch (score) {
          case Scoring.orange:
            if (previous === Scoring.green) {
              return;
            }
            break;
          case Scoring.gray:
            if ([Scoring.green, Scoring.orange].includes(previous)) {
              return;
            }
        }
        keyboardLookup[letter] = score;
      })
    );
    return keyboardLookup;
  }, [previousWords]);

  function onKeyDown(
    key: string,
    superPressed?: boolean,
  ) {
    if (won) {
      return;
    }
    if (!wordle) {
      return;
    }
    if (key === "BACKSPACE") {
      setCurrentWord((w) => superPressed ? "" : w.slice(0, w.length - 1));
      return;
    }
    if (key === "ENTER") {
      scoreWord();
      return;
    }
    if ("ABCDEFGHIJKLMNOPQRSTUVWXYZ -".includes(key)) {
      setCurrentWord((w) => w.slice(0, 4) + key);
    }
  }

  function onKeyDownWrapper(event: KeyboardEvent) {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    if (event.metaKey && event.key.toUpperCase() !== "BACKSPACE") {
      return;
    }
    event.preventDefault();
    const key = event.key.toUpperCase();
    return onKeyDown(key, event.shiftKey || event.metaKey);
  }

  useEffect(() => {
    if (!wordle) {
      return;
    }
    self.addEventListener("keydown", onKeyDownWrapper);

    return () => self.removeEventListener("keydown", onKeyDownWrapper);
  }, [wordle, onKeyDownWrapper]);

  useEffect(() => {
    if (won && battle) {
      setPenalties(0);
    }
    if (!won || isPractice || battle) {
      return;
    }
    fetch("/api/submit", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        challenge_id,
        time: totalSeconds,
        penalty: penalties,
        word,
        playback,
        paste: previousWords.map((w) =>
          w.map(({ score }) => ["🟩", "🟨", "⬜"][score]).join("")
        ).join("\n"),
      }),
    }).then(async (response) => {
      if (response.status !== 200) {
        addError("You already played today", 0);
      }
      const json_response: { pending_challenges: number } | undefined =
        await response.json().catch(() => undefined);
      if (json_response?.pending_challenges) {
        setPendingChallenges(json_response.pending_challenges);
      }
    }).catch(() => addError("An error occurred, play again", 0));
  }, [won]);

  const activePenalties = useMemo(() => {
    if (!battle?.penaltiesMap) return [];
    const now = Date.now();
    return Object.entries(battle.penaltiesMap)
      .map(([playerName, endsAt]) => ({
        player: playerName,
        remaining: Math.max(0, Math.ceil((endsAt - now) / 1000)),
      }))
      .filter((p) => p.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);
  }, [battle?.penaltiesMap, ticks]);

  const activeRow = previousWords.length;
  const activeCol = currentWord.length;

  function scoreWord() {
    if (!wordle) {
      return;
    }
    if (battle && penalties > 0) {
      setErrorPrivatePrivate("You're still in the penalty box!");
      setShakeRow(true);
      setTimeout(() => setShakeRow(false), 500);
      return;
    }
    const wordScore = wordScorer({ wordle, currentWord, previousWords, word });
    if (wordScore instanceof Array) {
      if (battle) {
        const isWin = currentWord === word;
        battle.broadcastMove?.(wordScore, currentWord, isWin);
      }
      setPreviousWords((s) => [...s, wordScore]);
      if (currentWord === word) {
        setWon(new Date());
        return;
      }
      setCurrentWord("");
      return;
    }
    setCurrentWord("");
    const { error, penalty } = wordScore;
    addError(error, penalty);
  }

  const totalSeconds = penalties +
    ((won ?? new Date()).getTime() - startTime.getTime()) / 1000;
  const numRows = Math.max(6, previousWords.length + (won ? 0 : 1));

  useEffect(() => {
    if (
      !won && challenge_id && winnersTime && totalSeconds > winnersTime
    ) {
      setCurrentWord(word);
    }
  }, [totalSeconds]);

  useEffect(() => {
    if (
      !won && challenge_id && winnersTime && totalSeconds > winnersTime &&
      currentWord === word
    ) {
      scoreWord();
    }
  }, [currentWord]);

  // Key style determination
  function getKeyStyle(c: string) {
    const score = keyboardLookup[c];
    if (score === Scoring.green) {
      return {
        bg: "bg-emerald-600 text-white font-black hover:bg-emerald-700",
        style: { backgroundColor: "#16a34a", color: "#ffffff" },
      };
    }
    if (score === Scoring.orange) {
      return {
        bg: "bg-amber-600 text-white font-black hover:bg-amber-700",
        style: { backgroundColor: "#ca8a04", color: "#ffffff" },
      };
    }
    if (score === Scoring.gray) {
      return {
        bg: "bg-slate-500 text-white font-medium hover:bg-slate-600",
        style: { backgroundColor: "#64748b", color: "#ffffff" },
      };
    }
    return {
      bg: "bg-gray-200 text-gray-900 font-bold hover:bg-gray-300 active:bg-gray-400",
      style: { backgroundColor: "#e2e8f0", color: "#0f172a" },
    };
  }

  function leaveGame() {
    const path = globalThis.location.pathname;
    const fallback = path.startsWith("/battles/")
      ? "/battles"
      : path.startsWith("/challenges/")
      ? "/challenges"
      : "/";

    // A direct visit (or an external referrer) should not send someone away
    // from Reidle when they use the in-game back control.
    let hasInternalReferrer = false;
    try {
      hasInternalReferrer = !!document.referrer &&
        new URL(document.referrer).origin === globalThis.location.origin;
    } catch (_) {
      // Fall through to the mode's home page.
    }

    if (hasInternalReferrer) {
      globalThis.history.back();
    } else {
      globalThis.location.assign(fallback);
    }
  }

  return (
    <div
      class="w-full h-full min-h-0 flex flex-col items-center justify-between max-w-lg mx-auto py-0 sm:py-1 select-none"
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
    >
      {/* Top Game Bar */}
      <div
        class="w-full px-1 sm:px-2 flex items-center justify-between gap-1 shrink-0"
        style={{ height: "clamp(28px, 5dvh, 40px)" }}
      >
        {/* Left: Mode / Multi-user info */}
        <div class="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            class="shrink-0 p-1.5 text-gray-600 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg border border-gray-200 transition-colors"
            onClick={leaveGame}
            title="Back to Reidle"
            aria-label="Back to Reidle"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          {battle ? (
            <>
              <button
                type="button"
                class="p-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1 border border-gray-200 transition-colors"
                title="Share battle link"
                onClick={async () => {
                  if (navigator.share) {
                    await navigator.share({
                      title: "Battle Me on Reidle!",
                      url: window.location.href,
                    });
                    return;
                  }
                  navigator.clipboard.writeText(window.location.href).then(
                    () => alert("Copied battle link to clipboard!"),
                  ).catch(() => alert("Could not copy battle link"));
                }}
              >
                <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.475l6.733-3.366A2.52 2.52 0 0113 4.5z" />
                </svg>
                <span class="hidden sm:inline">Share</span>
              </button>

              <button
                type="button"
                class="p-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1 border border-gray-200 transition-colors"
                onClick={() => setShowUsers((x) => !x)}
                title="View players in room"
              >
                <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
                </svg>
                <span>{battle.users?.length ?? 1}</span>
              </button>

              <div class="relative inline-block">
                <button
                  type="button"
                  class={`p-1.5 rounded-lg border flex items-center gap-1 text-xs font-bold transition-colors ${
                    activePenalties.length > 0
                      ? "border-red-500 bg-red-50 text-red-700 animate-pulse"
                      : "border-gray-200 bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                  onClick={() => setShowPenaltyBox((s) => !s)}
                  title="View penalty box"
                >
                  <span>🛑</span>
                  <span>
                    {activePenalties.length > 0
                      ? `${activePenalties.length}`
                      : "Box"}
                  </span>
                </button>
                {showPenaltyBox && (
                  <div class="absolute top-full left-0 mt-2 z-50 w-56 p-3 bg-white rounded-xl shadow-xl border border-gray-200 text-xs">
                    <div class="font-bold text-red-700 border-b border-gray-100 pb-1.5 flex justify-between items-center">
                      <span>🛑 Penalty Box</span>
                      <button
                        type="button"
                        class="text-gray-400 hover:text-black font-bold px-1"
                        onClick={() => setShowPenaltyBox(false)}
                      >
                        ✕
                      </button>
                    </div>
                    {activePenalties.length === 0 ? (
                      <div class="py-2.5 text-gray-400 italic text-center">
                        Penalty box is clear
                      </div>
                    ) : (
                      <div class="divide-y divide-gray-100 py-1 max-h-44 overflow-y-auto">
                        {activePenalties.map(({ player, remaining }) => (
                          <div class="py-1 flex justify-between items-center" key={player}>
                            <span class="font-medium truncate max-w-[120px]">
                              {player === name ? `${player} (You)` : player}
                            </span>
                            <span class="text-red-600 font-mono font-bold bg-red-50 border border-red-200 px-1.5 py-0.2 rounded">
                              {remaining}s
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                class="p-1.5 rounded-lg border border-gray-200 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors flex items-center gap-1"
                onClick={() => setShowLeaderboard((s) => !s)}
                title="View Battle Scores"
              >
                <span>🏆</span>
              </button>

              {battle.sendMessage && (
                <PartyChatInput onSendMessage={battle.sendMessage} />
              )}
            </>
          ) : isPractice ? (
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold uppercase tracking-wider">
                Practice
              </span>
              {!won && (
                <button
                  type="button"
                  class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded-full text-xs font-bold transition-colors"
                  onClick={() => {
                    if (!enableHelp) {
                      setEnableHelp(true);
                      return;
                    }
                    const cand =
                      currentWord.length === 5 && doubleCandidates.length === 1
                        ? candidates
                        : doubleCandidates;
                    setCurrentWord(
                      cand[Math.floor(Math.random() * cand.length)],
                    );
                  }}
                >
                  {enableHelp ? `${doubleCandidates.length} words` : "💡 Hint"}
                </button>
              )}
            </div>
          ) : (
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="text-xs uppercase font-bold tracking-wider text-gray-500">
                {challenge_id ? "Challenge" : "Daily Reidle"}
              </span>
            </div>
          )}
        </div>

        {/* Center / Right: Live Timer & Penalty */}
        <div class="flex items-center gap-2">
          {penalties > 0 && (
            <div class="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-mono font-bold">
              <span>🛑</span>
              <TimerText seconds={penalties} />
            </div>
          )}

          {!won && wordle ? (
            <div class="inline-flex min-w-[6.25rem] shrink-0 items-center justify-center gap-1.5 px-3 py-1 bg-gray-100 border border-gray-200 rounded-full text-xs font-mono font-bold text-gray-800 shadow-2xs whitespace-nowrap">
              <IconClock size={16} class="h-4 w-4 shrink-0 text-gray-400" />
              {winner && challenge_id !== undefined && (
                <span class="text-emerald-700 font-semibold">{winner}:</span>
              )}
              <TimerText
                seconds={challenge_id && winnersTime
                  ? Math.max(0, winnersTime - totalSeconds)
                  : totalSeconds}
                class={challenge_id && winnersTime && (winnersTime - totalSeconds) < 10
                  ? "text-red-700 animate-pulse font-black"
                  : ""}
              />
            </div>
          ) : winnersTime && winnersTime > 0 && !challenge_id ? (
            <div class="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-mono font-bold">
              <span>🏆 {winner}:</span>
              <TimerText seconds={winnersTime} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Error / Win / Lose Banner */}
      <ErrorBar
        isPractice={isPractice}
        battleCallback={battle
          ? () => {
            fetch(`/battles/${battle?.battle_id}/restart`, {
              method: "POST",
            }).then(async (res) => {
              if (res.ok) {
                const newState = await res.json().catch(() => null);
                if (newState) {
                  battle.broadcastRestart?.(newState);
                }
              }
            });
          }
          : undefined}
        pendingChallenges={pendingChallenges}
        wordle={wordle}
        penalty={penalties}
        winTime={won ? totalSeconds : null}
        error={battle && won ? (battle.state.message || (battle.state.last_player ? `${battle.state.last_player} Won` : "Game Over")) : error}
        challenge_id={challenge_id}
        lost={!!challenge_id && !!winnersTime && (totalSeconds > winnersTime)}
      />

      {/* Game Board Container */}
      <div class="relative flex-1 w-full flex items-center justify-center min-h-0 px-1 sm:px-2 py-0.5">
        <div
          class="relative w-full max-w-[340px] max-h-full h-full min-h-0 flex flex-col justify-center"
          style={{ maxHeight: "min(48dvh, 360px)" }}
        >
          {won && (!challenge_id || !winnersTime || totalSeconds < winnersTime) ? (
            <div
              class="fixed inset-0 z-30 pointer-events-none"
            >
              <Confetti />
            </div>
          ) : null}

          <div
            class="grid gap-1 sm:gap-2 w-full h-full min-h-0"
            style={`grid-template-rows: repeat(${numRows}, minmax(0, 1fr))`}
          >
            {[...Array(numRows).keys()]
              .filter((_) => wordle)
              .filter((i) => i < previousWords.length || !won)
              .map((row) => {
                const isCurrentRow = row === activeRow;
                const isPreviousRow = row < previousWords.length;
                const rowShaking = isCurrentRow && shakeRow;

                return (
                  <div
                    class={`grid grid-cols-5 gap-1.5 sm:gap-2 ${rowShaking ? "animate-row-shake" : ""}`}
                    key={row}
                  >
                    {[0, 1, 2, 3, 4].map((column) => {
                      const letter = isPreviousRow
                        ? previousWords[row][column].letter
                        : isCurrentRow && column < activeCol
                        ? currentWord[column]
                        : "";

                      const score = isPreviousRow ? previousWords[row][column].score : null;
                      const hasLetter = letter.length > 0;
                      const isRevealed = score !== null;

                      let cellBg = "bg-white";
                      let cellBorder = "border-gray-200";
                      let cellText = "text-gray-900";
                      let inlineStyle: Record<string, string> = {};

                      if (isRevealed) {
                        const color = scoreColor(score!);
                        inlineStyle.backgroundColor = color ?? "#64748b";
                        inlineStyle.borderColor = "transparent";
                        cellText = "text-white";
                        cellBorder = "border-transparent";
                      } else if (isCurrentRow && hasLetter) {
                        cellBorder = "border-gray-700";
                        cellText = "text-gray-900";
                      }

                      return (
                        <div
                          key={column}
                          class={[
                            "h-full min-h-0 w-full flex items-center justify-center rounded-md sm:rounded-lg border-2 font-black transition-all duration-150 uppercase select-none shadow-2xs",
                            cellBg,
                            cellBorder,
                            cellText,
                            numRows > 8 ? "text-xs sm:text-base" : numRows > 6 ? "text-sm sm:text-lg" : "text-xl sm:text-2xl",
                            isCurrentRow && hasLetter ? "animate-tile-pop" : "",
                            isRevealed ? "animate-tile-flip" : "",
                          ].join(" ")}
                          style={{
                            ...inlineStyle,
                            animationDelay: isRevealed ? `${column * 100}ms` : undefined,
                          }}
                        >
                          {letter}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Virtual Keyboard */}
      <div class="w-full max-w-lg px-0.5 sm:px-2 pt-0.5 pb-0 shrink-0 select-none">
        <div class="flex flex-col gap-1 sm:gap-2">
          {/* Row 1 */}
          <div class="flex gap-1 sm:gap-1.5 justify-center w-full">
            {"QWERTYUIOP".split("").map((c) => {
              const { bg, style } = getKeyStyle(c);
              return (
                <button
                  type="button"
                  key={c}
                  style={{ ...style, height: "clamp(40px, 7dvh, 56px)" }}
                  class={`flex-1 rounded-md sm:rounded-lg flex items-center justify-center text-sm sm:text-base font-bold transition-all active:scale-95 shadow-2xs ${bg}`}
                  onPointerDown={() => onKeyDown(c)}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {/* Row 2 */}
          <div class="flex gap-1 sm:gap-1.5 justify-center w-full px-2 sm:px-3">
            {"ASDFGHJKL".split("").map((c) => {
              const { bg, style } = getKeyStyle(c);
              return (
                <button
                  type="button"
                  key={c}
                  style={{ ...style, height: "clamp(40px, 7dvh, 56px)" }}
                  class={`flex-1 rounded-md sm:rounded-lg flex items-center justify-center text-sm sm:text-base font-bold transition-all active:scale-95 shadow-2xs ${bg}`}
                  onPointerDown={() => onKeyDown(c)}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {/* Row 3: Enter + ZXCVBNM + Backspace */}
          <div class="flex gap-1 sm:gap-1.5 justify-center w-full">
            <button
              type="button"
              class="flex-[1.5] bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-900 rounded-md sm:rounded-lg flex items-center justify-center text-xs sm:text-sm font-black transition-all active:scale-95 shadow-2xs tracking-wider"
              style={{ height: "clamp(40px, 7dvh, 56px)" }}
              onPointerDown={() => onKeyDown("ENTER")}
            >
              ENTER
            </button>

            {"ZXCVBNM".split("").map((c) => {
              const { bg, style } = getKeyStyle(c);
              return (
                <button
                  type="button"
                  key={c}
                  style={{ ...style, height: "clamp(40px, 7dvh, 56px)" }}
                  class={`flex-1 rounded-md sm:rounded-lg flex items-center justify-center text-sm sm:text-base font-bold transition-all active:scale-95 shadow-2xs ${bg}`}
                  onPointerDown={() => onKeyDown(c)}
                >
                  {c}
                </button>
              );
            })}

            <button
              type="button"
              class="flex-[1.5] bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-900 rounded-md sm:rounded-lg flex items-center justify-center transition-all active:scale-95 shadow-2xs"
              style={{ height: "clamp(40px, 7dvh, 56px)" }}
              onPointerDown={() => onKeyDown("BACKSPACE")}
              title="Delete"
            >
              <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
                <path
                  clipRule="evenodd"
                  fillRule="evenodd"
                  d="M7.22 3.22A.75.75 0 017.75 3h9A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17h-9a.75.75 0 01-.53-.22L.97 10.53a.75.75 0 010-1.06l6.25-6.25zm3.06 4a.75.75 0 10-1.06 1.06L10.94 10l-1.72 1.72a.75.75 0 101.06 1.06L12 11.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L12 8.94l-1.72-1.72z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Battle Party Chat Toast */}
      {battle && (
        <PartyChatToast
          toast={battle.currentToast ?? null}
          onDismiss={() => battle.dismissToast?.()}
        />
      )}

      {/* Battle Leaderboard Modal */}
      {battle && showLeaderboard && (
        <div class="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-toast">
          <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-5 max-h-[90vh] flex flex-col overflow-hidden">
            <div class="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 class="text-base font-black flex items-center gap-2 text-gray-900">
                <span>🏆</span>
                <span>Battle Leaderboard</span>
                {battle.state?.round && (
                  <span class="text-xs bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-full border border-purple-200">
                    Round {battle.state.round}
                  </span>
                )}
              </h3>
              <button
                type="button"
                class="p-1 text-gray-400 hover:text-gray-700 font-bold text-lg"
                onClick={() => setShowLeaderboard(false)}
              >
                ✕
              </button>
            </div>

            {won && (
              <div class="my-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <div class="text-[11px] uppercase tracking-wider font-bold text-emerald-700">
                  Round Winner!
                </div>
                <div class="text-xl font-black text-emerald-900 mt-0.5">
                  🎉 {battle.state?.last_player || name}
                </div>
                <div class="text-xs text-emerald-700 mt-1">
                  Answer: <span class="font-bold tracking-widest uppercase">{word}</span>
                </div>
              </div>
            )}

            <div class="flex-grow overflow-y-auto my-2 space-y-4 pr-1">
              <div>
                <h4 class="text-[11px] uppercase font-bold text-gray-400 mb-2 tracking-wider">
                  Wins Leaderboard
                </h4>
                {Object.keys(battle.state?.leaderboard ?? {}).length === 0 ? (
                  <div class="text-xs text-gray-400 italic py-2 text-center">
                    No completed rounds yet in this room.
                  </div>
                ) : (
                  <div class="border border-gray-100 rounded-xl overflow-hidden shadow-2xs">
                    <table class="w-full text-xs">
                      <thead class="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold border-b border-gray-100">
                        <tr>
                          <th class="py-2 px-3 text-left">Rank</th>
                          <th class="py-2 px-3 text-left">Player</th>
                          <th class="py-2 px-3 text-right">Wins</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100">
                        {Object.entries(battle.state?.leaderboard ?? {})
                          .sort(([, a], [, b]) => b - a)
                          .map(([playerName, wins], idx) => {
                            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
                            const isMe = playerName === name;
                            return (
                              <tr key={playerName} class={isMe ? "bg-amber-50 font-bold" : ""}>
                                <td class="py-2 px-3">{medal}</td>
                                <td class="py-2 px-3 truncate max-w-[150px]">
                                  {playerName} {isMe ? "(You)" : ""}
                                </td>
                                <td class="py-2 px-3 text-right font-mono font-bold text-amber-700">
                                  {wins}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div class="pt-3 border-t border-gray-100 flex gap-2">
              <button
                type="button"
                class="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 text-xs active:scale-98"
                onClick={() => {
                  setShowLeaderboard(false);
                  fetch(`/battles/${battle.battle_id}/restart`, {
                    method: "POST",
                  }).then(async (res) => {
                    if (res.ok) {
                      const newState = await res.json().catch(() => null);
                      if (newState) {
                        battle.broadcastRestart?.(newState);
                      }
                    }
                  });
                }}
              >
                <span>⚔️</span>
                <span>Next Round</span>
              </button>
              <button
                type="button"
                class="py-2.5 px-4 border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                onClick={() => setShowLeaderboard(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function wordScorer(
  { wordle, word, currentWord, previousWords }: {
    wordle: Wordle;
    word: string;
    currentWord: string;
    previousWords: ScoringHistory;
  },
): { error: string; penalty?: number } | ScoredWord {
  if (currentWord === word) {
    return word.split("").map((letter) => ({ letter, score: Scoring.green }));
  }
  if (currentWord.length < 5) {
    return { error: "Need 5 letters" };
  }
  if (currentWord.includes(" ") || currentWord.includes("-")) {
    return { error: "Includes space or -" };
  }
  if (!wordle?.isWord(currentWord)) {
    return { error: "Not a word", penalty: 5 };
  }
  const scoring = [
    Scoring.gray,
    Scoring.gray,
    Scoring.gray,
    Scoring.gray,
    Scoring.gray,
  ];
  word?.split("").forEach((letter, position) => {
    if (currentWord[position] === letter) {
      scoring[position] = Scoring.green;
      return;
    }
  });
  currentWord.split("").forEach((letter, position) => {
    if (scoring[position] === Scoring.green) {
      return;
    }
    const offPositions = word?.split("").filter((_, pos) =>
      scoring[pos] !== Scoring.green
    ).filter((l) => l === letter).length ?? 0;
    const usedPositions = currentWord.split("").filter((l, pos) =>
      l === letter && scoring[pos] === Scoring.orange
    ).length;
    if (usedPositions < offPositions) {
      scoring[position] = Scoring.orange;
    }
  });
  const guesses = [
    ...previousWords,
    currentWord.split("").map((l, p) => ({
      letter: l,
      score: scoring[p],
    })),
  ];
  const error = wordle?.error(guesses);
  if (error) {
    return { error, penalty: 10 };
  }
  return guesses[guesses.length - 1];
}
