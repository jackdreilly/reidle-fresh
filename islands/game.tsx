import { ReidleHeader } from "@/components/reidle_template.tsx";
import TimerText from "@/components/timer_text.tsx";
import { Scoring, ScoringHistory, Wordle } from "@/utils/wordle.ts";
import { useEffect, useState } from "preact/hooks";
interface GameProperties {
  word: string;
  isPractice: boolean;
  startingWord: string;
}
function scoreColor(score: Scoring): string | null {
  switch (score) {
    case Scoring.gray:
      return "#787c7e";
    case Scoring.orange:
      return "#c9b458";
    case Scoring.green:
      return "#6aaa64";
    default:
      return null;
  }
}
export default function Game(
  { word, startingWord, isPractice }: GameProperties,
) {
  const [penalties, setPenalties] = useState(0);
  const [startTime, _] = useState(new Date());
  const [error, setErrorPrivate] = useState("");
  const [wordle, setWordle] = useState<Wordle>();
  const [currentWord, setCurrentWord] = useState(startingWord);
  const [previousWords, setPreviousWords] = useState<ScoringHistory>([]);
  const [won, setWon] = useState<Date | null>(null);
  const [__, setTicks] = useState(0);
  useEffect(() => {
    Wordle.make(false).then(setWordle);
  }, []);
  useEffect(() => wordle && scoreWord(), [wordle]);
  function addError(error: string, penalty: number | undefined = undefined) {
    setErrorPrivate(error);
    if (penalty) {
      setPenalties((p) => p + penalty);
    }
  }
  useEffect(() => {
    const interval = setInterval(() => setTicks((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  function clearError() {
    addError("");
  }
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
    self.addEventListener("keydown", onKeyDownWrapper);

    return () => self.removeEventListener("keydown", onKeyDownWrapper);
  }, [onKeyDownWrapper]);
  useEffect(() => {
    if (!won || isPractice) {
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
        playback: [],
        paste: previousWords.map((w) =>
          w.map(({ score }) => ["🟩", "🟨", "⬜"][score]).join("")
        ).join("\n"),
      }),
    }).then((a) =>
      a.status !== 200 ? setErrorPrivate("You already played today") : null
    ).catch(() => setErrorPrivate("An error occurred, play again"));
  }, [won]);
  const activeRow = previousWords.length;
  const activeCol = currentWord.length;
  function keyColor(c: string): string {
    return scoreColor(keyboardLookup[c]) ?? "#d3d6da";
  }
  const title = isPractice ? "Practice" : "Play";
  function scoreWord() {
    if (currentWord === word) {
      setPreviousWords(
        (s) => [
          ...s,
          word.split("").map((letter) => ({ letter, score: Scoring.green })),
        ],
      );
      setCurrentWord("");
      clearError();
      setWon(new Date());
    }
    if (currentWord.length < 5) {
      addError("Need 5 letters");
      return;
    }
    if (currentWord.includes(" ") || currentWord.includes("-")) {
      addError("Includes space or -");
      return;
    }
    if (!wordle?.isWord(currentWord)) {
      addError("Not a word", 5);
      return;
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
      addError(error, 10);
      return;
    }
    setPreviousWords(guesses);
    setCurrentWord("");
    clearError();
  }
  const totalSeconds = penalties + Math.round(
    ((won ?? new Date()).getTime() - startTime.getTime()) / 1000,
  );
  return (
    <>
      <ReidleHeader />
      <div class="m-3 flex">
        <h2 class="text-center mr-10 text-xl">{title}</h2>
        {!won
          ? (
            <TimerText
              seconds={totalSeconds}
              class="text-gray text-lg"
            />
          )
          : null}
        {penalties
          ? <TimerText seconds={penalties} class="mx-10 text-red-400 text-lg" />
          : null}
      </div>
      <div style={{ flexGrow: 1 }}>
        <div
          style={{
            width: "100%",
            maxWidth: 800,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <div
            style={{
              height: 30,
              textAlign: "center",
              fontSize: 20,
              fontFamily: "sans-serif",
              color: won && !error ? "green" : "red",
            }}
          >
            {won && !error
              ? (
                <>
                  You won in <TimerText seconds={totalSeconds} />!
                  <a
                    class="px-3 py-2 bg-white rounded border(gray-500 2) hover:bg-gray-200 active:bg-gray-300 disabled:(opacity-50 cursor-not-allowed) m-5"
                    href="practice"
                    style={{ fontSize: "12px" }}
                  >
                    Practice{isPractice ? " again" : null}?
                  </a>
                </>
              )
              : null}
            {error}
            {error
              ? (
                <button
                  onClick={clearError}
                  class="ml-3 px-1 py-1 text-sm bg-white rounded border(gray-500 2) hover:bg-gray-200 active:bg-gray-300 disabled:(opacity-50 cursor-not-allowed)"
                >
                  Dismiss
                </button>
              )
              : null}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexGrow: 1,
              overflow: "hidden",
            }}
          >
            <div
              id="board"
              style={{
                fontFamily: "sans-serif",
                fontWeight: "bold",
                textAlign: "center",
                fontSize: "40px",
                display: "grid",
                gridTemplateRows: "repeat(6, 1fr)",
                gridGap: 5,
                padding: 10,
                boxSizing: "border-box",
              }}
            >
              {[0, 1, 2, 3, 4, 5].filter((i) =>
                i < previousWords.length || !won
              )
                .map((row) => (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                      gridGap: 5,
                    }}
                    class="row"
                    key={row}
                  >
                    {[0, 1, 2, 3, 4].map((column) => (
                      <div
                        style={{
                          boxSizing: "unset",
                          lineHeight: "50px",
                          margin: "3px",
                          padding: "5px",
                          borderColor: row < previousWords.length
                            ? "transparent"
                            : row === activeRow && column < activeCol
                            ? "#878a8c"
                            : "#d3d6da",
                          borderStyle: "solid",
                          borderWidth: "2px",
                          width: "45px",
                          height: "45px",
                          backgroundColor: row < previousWords.length
                            ? scoreColor(previousWords[row][column].score)
                            : null,
                          color: row < previousWords.length ? "white" : null,
                        }}
                        class="col"
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
                      maxWidth: 40,
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
                    onClick={() =>
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
      </div>
    </>
  );
}
