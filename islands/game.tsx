import { useEffect, useState } from "preact/hooks";
import { ScoredWord, Scoring, ScoringHistory, Wordle } from "../wordle.ts";
interface GameProperties {
  startingWord?: string;
  startingFirstWord?: string;
  onFinish(time: number, penalty: number, scoring: ScoringHistory): void;
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
interface State {
  previousWords: ScoredWord[];
  currentWord: string;
  result?: boolean;
}
export default function Game(
  { startingWord, startingFirstWord, onFinish }: GameProperties,
) {
  const [{ currentWord, previousWords }, setState] = useState<State>({
    previousWords: [],
    currentWord: "",
  });
  const [error, setError] = useState("");
  const [wordle, setWordle] = useState<Wordle>();
  const [word, setWord] = useState(startingWord);
  const [firstWord, setFirstWord] = useState(startingFirstWord);
  useEffect(() => {
    Wordle.make().then((wordle) => {
      setWordle((s) => wordle);
      const theWord = word ?? wordle.randomAnswer();
      if (!word) {
        setWord(theWord);
      }
      if (!firstWord) {
        const newFirstWord = wordle.randomWord();
        setFirstWord(newFirstWord);
        scoreWord(wordle, theWord, newFirstWord, []);
      }
    });
  }, []);
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
      setState((s) => ({
        ...s,
        currentWord: superPressed
          ? ""
          : currentWord.slice(0, currentWord.length - 1),
      }));
      return;
    }
    if (key === "ENTER") {
      scoreWord(wordle, word ?? "", currentWord, previousWords);
      return;
    }
    if ("ABCDEFGHIJKLMNOPQRSTUVWXYZ -".includes(key)) {
      const nextWord = currentWord.slice(0, 4) + key;
      setState((s) => ({ ...s, currentWord: nextWord }));
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
  const activeRow = previousWords.length;
  const activeCol = currentWord.length;
  function keyColor(c: string): string {
    return scoreColor(keyboardLookup[c]) ?? "#d3d6da";
  }
  return (
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
          height: 50,
          textAlign: "center",
          fontSize: 30,
          fontFamily: "sans-serif",
          color: "red",
        }}
      >
        {error}
        {error
          ? (
            <button style={{ margin: 5 }} onClick={() => setError("")}>
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
          {[0, 1, 2, 3, 4, 5].map((row) => (
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
  );
  function scoreWord(
    wordle: Wordle,
    word: string,
    currentWord: string,
    previousWords: ScoredWord[],
  ) {
    if (currentWord.length < 5) {
      setError("Need 5 letters");
      return;
    }
    if (currentWord.includes(" ") || currentWord.includes("-")) {
      setError("Includes space or -");
      return;
    }
    if (!wordle?.isWord(currentWord)) {
      setError("Not a word");
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
      setError(error);
      return;
    }
    setState((s) => ({
      ...s,
      currentWord: "",
      previousWords: guesses,
    }));
    setError("");
  }
}
