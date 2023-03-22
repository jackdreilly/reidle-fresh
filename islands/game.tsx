import ErrorBar from "@/components/ErrorBar.tsx";
import TimerText from "@/components/timer_text.tsx";
import { Playback, PlaybackEvent, scoreColor } from "@/utils/playback.ts";
import { ScoredWord, Scoring, ScoringHistory, Wordle } from "@/utils/wordle.ts";
import { useEffect, useMemo, useState } from "preact/hooks";
interface GameProperties {
  word: string;
  isPractice: boolean;
  startingWord: string;
  winnersTime?: number | null;
}
export default function Game(
  { word, startingWord, isPractice, winnersTime }: GameProperties,
) {
  const [playback, setPlayback] = useState<Playback>({ events: [] });
  const [penalties, setPenalties] = useState(0);
  const [startTime, setStartTime] = useState(new Date());
  const [error, setErrorPrivatePrivate] = useState("");
  const [wordle, setWordle] = useState<Wordle>();
  const [currentWord, setCurrentWordPrivate] = useState(startingWord);
  const [previousWords, setPreviousWordsPrivate] = useState<ScoringHistory>([]);
  const [won, setWon] = useState<Date | null>(null);
  const [__, setTicks] = useState(0);
  const [played, setPlayed] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [enableHelp, setEnableHelp] = useState(false);
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
    if (isPractice) {
      return;
    }
    async function helper() {
      const response = await fetch("/api/played", {
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });
      const played = await response.json();
      if (!played) {
        return;
      }
      addError("You already played! This game won't count", 120);
      setPlayed(true);
      await new Promise((r) => setTimeout(r, 100));
      addError("You already played! This game won't count");
    }
    helper();
  }, []);
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
    const interval = setInterval(() => setTicks((s) => s + 1), 1000);
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
    if (!won || isPractice || played) {
      return;
    }
    fetch("/api/submit", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        time: totalSeconds,
        penalty: penalties,
        word,
        playback,
        paste: previousWords.map((w) =>
          w.map(({ score }) => ["🟩", "🟨", "⬜"][score]).join("")
        ).join("\n"),
      }),
    }).then((a) =>
      a.status !== 200 ? addError("You already played today", 0) : null
    ).catch(() => addError("An error occurred, play again", 0));
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
    setCurrentWord("");
    const wordScore = wordScorer({ wordle, currentWord, previousWords, word });
    if (wordScore instanceof Array) {
      setPreviousWords((s) => [...s, wordScore]);
      if (currentWord === word) {
        setWon(new Date());
      }
      return;
    }
    const { error, penalty } = wordScore;
    addError(error, penalty);
  }
  const totalSeconds = penalties + Math.round(
    ((won ?? new Date()).getTime() - startTime.getTime()) / 1000,
  );
  return (
    <>
      <div class="w-full flex flex-col h-full max-w-6xl flex-grow-1 text-center text-lg">
        <div class="m-1 h-8 flex place-content-evenly">
          {!won && wordle
            ? (
              <TimerText
                seconds={totalSeconds}
                class="mx-2 text-gray"
              />
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
          {(winnersTime && winnersTime > 0)
            ? (
              <TimerText
                seconds={winnersTime}
                class="mx-2 text-green-400"
              />
            )
            : <div />}
          {isPractice
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
                      Math.round(Math.random() * cand.length)
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
          wordle={wordle}
          penalty={penalties}
          winTime={won ? totalSeconds : null}
          error={error}
        />
        <div class="flex justify-center items-center flex-grow overflow-hidden">
          <div class="font-bold text-center text-[30px] sm:text-[40px] grid grid-rows-6 sm:gap-[5px] sm:p-[10px] gap-[3px] p-[5px] box-border">
            {[...Array(Math.max(6, previousWords.length + 1)).keys()].filter(
              (_) => wordle,
            )
              .filter((
                i,
              ) => i < previousWords.length || !won)
              .map((row) => (
                <div
                  class="grid grid-cols-5 sm:gap-[5px] gap-[3px]"
                  key={row}
                >
                  {[0, 1, 2, 3, 4].map((column) => (
                    <div
                      class="sm:m-[3px] m-[2px] sm:p-[5px] p-[3px] border-solid border-2 sm:w-[45px] sm:h-[45px] sm:leading-[50px] w-[35px] h-[35px] leading-[40px]"
                      style={{
                        boxSizing: "unset",
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
        <div
          style={{ height: 200, margin: "0 8px", userSelect: "none" }}
          id="keyboard"
        >
          {"QWERTYUIOP,ASDFGHJKL,↵ZXCVBNM␡".split(",").map((row) => (
            <div
              style={{
                display: "flex",
                touchAction: "manipulation",
                width: "100%",
                margin: "0 auto 8px",
                justifyContent: "center",
              }}
              key={row}
            >
              {row.split("").map((c) => (
                <button
                  style={{
                    fontFamily: "sans-serif",
                    fontSize: "1.25em",
                    fontWeight: "bold",
                    maxWidth: 50,
                    border: "0",
                    padding: "0",
                    margin: "0 6px 0 0",
                    height: "58px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    webkitUserSelect: "none",
                    mozUserSelect: "none",
                    userSelect: "none",
                    backgroundColor: keyColor(c),
                    color: keyColor(c) === "#d3d6da" ? "black" : "white",
                    flex: "1",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    textTransform: "uppercase",
                    webkitTapHighlightColor: "rgba(0,0,0,.3)",
                  }}
                  class="col"
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
                  {c}
                </button>
              ))}
            </div>
          ))}
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
