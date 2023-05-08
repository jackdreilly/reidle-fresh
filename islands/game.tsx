import ErrorBar from "@/components/ErrorBar.tsx";
import TimerText from "@/components/timer_text.tsx";
import { Playback, PlaybackEvent, scoreColor } from "@/utils/playback.ts";
import { ScoredWord, Scoring, ScoringHistory, Wordle } from "@/utils/wordle.ts";
import { useEffect, useMemo, useState } from "preact/hooks";
import Confetti from "./confetti.tsx";
import { BattleState } from "@/utils/sql_files.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";
export type Battle = {
  battle_id: number;
  state: BattleState;
  supabase: SupabaseClient;
};

interface GameProperties {
  word: string;
  isPractice: boolean;
  startingWord: string;
  winnersTime?: number | null;
  challenge_id?: number;
  battle?: Battle;
  winner?: string;
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
  }: GameProperties,
) {
  const [pendingChallenges, setPendingChallenges] = useState(0);
  const [playback, setPlayback] = useState<Playback>({ events: [] });
  const [penalties, setPenalties] = useState(0);
  const [startTime, setStartTime] = useState(new Date());
  const [error, setErrorPrivatePrivate] = useState("");
  const [wordle, setWordle] = useState<Wordle>();
  const [currentWord, setCurrentWordPrivate] = useState(startingWord);
  const [previousWords, setPreviousWordsPrivate] = useState<ScoringHistory>([]);
  const [won, setWon] = useState<Date | null>(null);
  const [ticks, setTicks] = useState(0);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [enableHelp, setEnableHelp] = useState(false);
  useEffect(() => {
    if (!battle) {
      return;
    }
    setPreviousWords(battle.state.history);
    if (
      !won && battle.state.history.length &&
      battle.state.history[battle.state.history.length - 1].every((x) =>
        x.score === Scoring.green
      )
    ) {
      setWon(new Date());
    }
    if (
      won &&
      (battle?.state?.history[battle.state.history.length - 1]?.some((x) =>
        x.score !== Scoring.green
      ) ?? true)
    ) {
      setWon(null);
      setStartTime(new Date());
      setCurrentWord(startingWord);
    }
  }, [battle, wordle, won]);
  useEffect(() => {
    if (!previousWords.length && currentWord) {
      scoreWord();
    }
  }, [currentWord, previousWords]);
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
      setStartTime((_) => new Date());
      setCandidates(wordle.words);
    }
    helper();
  }, []);
  useEffect(() => wordle && scoreWord(), [wordle]);
  function addError(error: string, penalty: number | undefined = undefined) {
    setErrorPrivatePrivate(error);
    if (penalty) {
      setPenalties((p) => p + penalty);
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
    if (!won || isPractice || battle) {
      return;
    }
    const response = fetch("/api/submit", {
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
  const activeRow = previousWords.length;
  const activeCol = currentWord.length;
  function keyColor(c: string): string {
    return scoreColor(keyboardLookup[c]) ?? "#d3d6da";
  }
  function scoreWord() {
    if (!wordle) {
      return;
    }
    const wordScore = wordScorer({ wordle, currentWord, previousWords, word });
    if (wordScore instanceof Array) {
      if (battle) {
        battle.state.history = [...previousWords, wordScore];
        battle.supabase.from("battles").update({
          state: battle.state,
        }).eq("battle_id", battle.battle_id).then((_) => {
          // console.log({ update_response });
        });
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
  const numRows = Math.max(6, previousWords.length + 1);
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
  return (
    <>
      <div class="w-full flex flex-col h-full max-w-6xl flex-grow-1 text-center text-lg">
        <div class="m-1 h-8 flex place-content-evenly">
          {battle && (
            <button
              class="p-2 font-bold hover:bg-gray-200 rounded border-2 border-black flex items-center justify-center"
              onClick={async () => {
                if (navigator.share) {
                  await navigator.share({
                    title: "Battle Me on Reidle!",
                    url: window.location.href,
                  });
                  return;
                }
                navigator.clipboard.writeText(window.location.href).then(() => {
                  alert(
                    "Copied battle link to clipboard, now share link with friends!",
                  );
                })
                  .catch((e) => {
                    console.error(e);
                    alert("something went wrong");
                  });
              }}
            >
              <svg
                class="h-6 w-6"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.475l6.733-3.366A2.52 2.52 0 0113 4.5z" />
              </svg>
            </button>
          )}
          {!won && wordle
            ? (
              <div>
                {winner && challenge_id !== undefined && (
                  <span class="pr-2 font-bold">{winner}</span>
                )}
                <TimerText
                  seconds={challenge_id && winnersTime
                    ? Math.max(0, winnersTime - totalSeconds)
                    : totalSeconds}
                  class={"mx-2 text-gray " +
                    (challenge_id && winnersTime &&
                        (winnersTime - totalSeconds) < 10
                      ? "text-red-800 animate-pulse font-bold"
                      : "")}
                />
              </div>
            )
            : <div />}
          {penalties
            ? (
              <TimerText
                seconds={penalties}
                class="mx-2 text-red-400"
              />
            )
            : <div />}
          {(!challenge_id && winnersTime && winnersTime > 0)
            ? (
              <div>
                {winner && (
                  <span class="pr-2 text-green-400 font-bold">{winner}</span>
                )}
                <TimerText
                  seconds={winnersTime}
                  class="mx-2 text-green-400"
                />
              </div>
            )
            : <div />}
          {isPractice && !won
            ? (
              <button
                type="button"
                class="text-blue-700 border border-blue-700 hover:bg-blue-700 hover:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-full text-sm p-2.5 text-center inline-flex items-center dark:border-blue-500 dark:text-blue-500 dark:hover:text-white dark:focus:ring-blue-800 dark:hover:bg-blue-500"
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
                    cand[
                      Math.floor(Math.random() * cand.length)
                    ],
                  );
                }}
              >
                {enableHelp ? doubleCandidates.length : "?"}
              </button>
            )
            : undefined}
        </div>
        <ErrorBar
          battleCallback={battle
            ? () => {
              fetch(`/battles/${battle?.battle_id}/restart`, {
                method: "POST",
              });
            }
            : undefined}
          pendingChallenges={pendingChallenges}
          wordle={wordle}
          penalty={penalties}
          winTime={won ? totalSeconds : null}
          error={error}
          challenge_id={challenge_id}
          lost={!!challenge_id && !!winnersTime && (totalSeconds > winnersTime)}
        />
        <div class="flex justify-center items-center flex-grow overflow-hidden m-2 p-2 font-bold text-center">
          <div
            class="relative h-full max-h-[25rem] w-full"
            style={{
              maxWidth: "min(20.8rem, 40vh)",
              fontSize: "min(50px, 5vh)",
            }}
          >
            <div class="absolute bottom-[50%] right-[50%] h-full w-full">
              {won &&
                  (!challenge_id || !winnersTime || totalSeconds < winnersTime)
                ? <Confetti />
                : null}
            </div>
            <div
              class={`grid gap-[3px] p-[5px] box-border h-full w-full`}
              style={`grid-template-rows: repeat(${numRows}, minmax(0, 1fr))`}
            >
              {[...Array(numRows).keys()].filter(
                (_) => wordle,
              )
                .filter((
                  i,
                ) => i < previousWords.length || !won)
                .map((row) => (
                  <div
                    class="grid grid-cols-5 gap-[3px]"
                    key={row}
                  >
                    {[0, 1, 2, 3, 4].map((column) => (
                      <div
                        class="border-solid border-2 grid items-center"
                        style={{
                          borderColor: row < previousWords.length
                            ? "transparent"
                            : row === activeRow && column < activeCol
                            ? "#878a8c"
                            : "#d3d6da",
                          backgroundColor: row < previousWords.length
                            ? scoreColor(previousWords[row][column].score)
                            : null,
                          color: row < previousWords.length ? "white" : null,
                        }}
                        key={column}
                      >
                        {row === activeRow && column < activeCol
                          ? currentWord[column]
                          : row < previousWords.length
                          ? previousWords[row][column].letter
                          : null}
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        </div>
        <div class="m-1">
          <div
            class="mx-auto max-w-xl h-[calc(min(25vh,12rem))] grid grid-rows-3 gap-1 text-2xl select-none"
            style={{ width: "inherit" }}
          >
            {"QWERTYUIOP,ASDFGHJKL,↵ZXCVBNM␡".split(",").map((row) => (
              <div
                class={[
                  "touch-manipulation grid gap-1",
                  "grid-cols-" + row.length,
                ]
                  .join(" ")}
              >
                {row.split("").map((c) => (
                  <button
                    class={[
                      "rounded-lg cursor-pointer font-bold",
                      `text-[${keyColor(c) === "#d3d6da" ? "black" : "white"}]`,
                      `bg-[${keyColor(c)}]`,
                    ].join(" ")}
                    style={{
                      webkitTapHighlightColor: "rgba(0,0,0,.3)",
                      outline: "none",
                    }}
                    key={c}
                    onPointerDown={() =>
                      onKeyDown(
                        c === "↵"
                          ? "ENTER"
                          : c === "␡"
                          ? "BACKSPACE"
                          : c.toUpperCase(),
                      )}
                  >
                    {c === "␡"
                      ? (
                        <svg
                          class="p-1 m-auto"
                          style={{ maxWidth: "35px" }}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            clipRule="evenodd"
                            fillRule="evenodd"
                            d="M7.22 3.22A.75.75 0 017.75 3h9A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17h-9a.75.75 0 01-.53-.22L.97 10.53a.75.75 0 010-1.06l6.25-6.25zm3.06 4a.75.75 0 10-1.06 1.06L10.94 10l-1.72 1.72a.75.75 0 101.06 1.06L12 11.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L12 8.94l-1.72-1.72z"
                          />
                        </svg>
                      )
                      : c === "↵"
                      ? (
                        <svg
                          class="p-1 m-auto"
                          style={{ maxWidth: "35px" }}
                          fill="currentColor"
                          viewBox="0 0 1200 1200"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path d="M808.969,133.929v257.06H942.94v267.899H417.981V508.763L0,787.417
                     l417.982,278.654V915.946h524.959H1200V658.888V390.988v-257.06H942.941H808.969L808.969,133.929z" />
                        </svg>
                      )
                      : c}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
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
