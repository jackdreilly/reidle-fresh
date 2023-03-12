import { ReidleHeader } from "@/components/reidle_template.tsx";
import TimerText from "@/components/timer_text.tsx";
import { Playback, PlaybackEvent, scoreColor } from "@/utils/playback.ts";
import { ScoredWord, Scoring, ScoringHistory, Wordle } from "@/utils/wordle.ts";
import { useEffect, useState } from "preact/hooks";
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
  const [startTime, _] = useState(new Date());
  const [error, setErrorPrivatePrivate] = useState("");
  const [wordle, setWordle] = useState<Wordle>();
  const [currentWord, setCurrentWordPrivate] = useState(startingWord);
  const [previousWords, setPreviousWordsPrivate] = useState<ScoringHistory>([]);
  const [won, setWon] = useState<Date | null>(null);
  const [__, setTicks] = useState(0);
  const [played, setPlayed] = useState(false);
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
    const word = typeof input === "string" ? input : input(currentWord);
    setCurrentWordPrivate((oldWord) => {
      if (!word.length) {
        addPlayback({ c: true });
      } else if (word.length < currentWord.length) {
        addPlayback({ b: true });
      } else {
        addPlayback({ l: word.slice(word.length - 1) });
      }
      return word;
    });
  }
  function setPreviousWords(
    input: ScoringHistory | ((word: ScoringHistory) => ScoringHistory),
  ) {
    const words = typeof input === "object" ? input : input(previousWords);
    addPlayback({ s: words[words.length - 1] });
    setPreviousWordsPrivate(words);
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
    Wordle.make(false).then(setWordle);
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
      <ReidleHeader>
        {!won
          ? (
            <TimerText
              seconds={totalSeconds}
              class="text-gray text-lg"
            />
          )
          : null}
        {penalties
          ? (
            <TimerText
              seconds={penalties}
              class="mx-10 text-red-400 text-lg"
            />
          )
          : null}
        {winnersTime && (
          <TimerText
            seconds={winnersTime}
            class="mx-10 text-green-400 text-lg"
          />
        )}
      </ReidleHeader>
      <div style={{ flexGrow: 1 }}>
        <div
          style={{
            width: "100%",
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <div
            style={{
              height: 20,
              textAlign: "center",
              fontSize: 12,
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
                  class="ml-3 px-1 py-1 text-[12px] bg-white rounded border(gray-500 2) hover:bg-gray-200 active:bg-gray-300 disabled:(opacity-50 cursor-not-allowed)"
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
      </div>
    </>
  );
}
