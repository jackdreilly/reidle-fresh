import TimerText from "@/components/timer_text.tsx";
import { PlaybackEvent, scoreColor } from "@/utils/playback.ts";
import { Scoring, ScoringHistory } from "@/utils/wordle.ts";
import { useEffect, useState } from "preact/hooks";
export default function PlaybackComponent(
  { events }: { events: PlaybackEvent[] },
) {
  const [eventIndex, setEventIndex] = useState(0);
  const [word, setWord] = useState("");
  const [history, setHistory] = useState<ScoringHistory>([]);
  const [penalties, setPenalties] = useState(0);
  const [error, setError] = useState<string>("");
  const [won, setWon] = useState(false);
  useEffect(() => {
    if (won || eventIndex === events.length) {
      return;
    }
    const { letter, backspace, clear, score, error } = events[eventIndex];
    if (letter) {
      setWord((s) => s.slice(0, 4) + letter);
    }
    if (backspace) {
      setWord((s) => s.slice(0, s.length - 1));
    }
    if (clear) {
      setWord((s) => "");
    }
    if (score) {
      setHistory((s) => [...s, score]);
      setWord("");
      if (
        !won && score.reduce((a, b) => a && b.score === Scoring.green, true)
      ) {
        setWon((_) => true);
        setError("");
      }
    }
    if (error) {
      setError((_) => error.message);
      setPenalties((p) => p + error.penalty);
    }
    new Promise((r) => setTimeout(r, 120)).then((_) =>
      setEventIndex((i) => i + 1)
    );
  }, [eventIndex]);
  const activeRow = history.length;
  const activeCol = word.length;
  const event = events[eventIndex] ?? { time: 0, letter: "a" };
  const totalSeconds = event.time / 1000;
  return (
    <>
      <div class="m-1 text-center">
        <TimerText
          seconds={totalSeconds}
          class="mx-2 text-gray"
        />
        {penalties
          ? (
            <TimerText
              seconds={penalties}
              class="mx-2 text-red-400"
            />
          )
          : null}
      </div>
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
            {won
              ? (
                <>
                  You won in <TimerText seconds={totalSeconds} />!
                </>
              )
              : null}
            {error}
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
              {[...Array(Math.max(6, history.length + 1)).keys()].filter((i) =>
                i < history.length || !won
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
                          borderColor: row < history.length
                            ? "transparent"
                            : row === activeRow && column < activeCol
                            ? "#878a8c"
                            : "#d3d6da",
                          borderStyle: "solid",
                          borderWidth: "2px",
                          width: "45px",
                          height: "45px",
                          backgroundColor: row < history.length
                            ? scoreColor(history[row][column].score)
                            : null,
                          color: row < history.length ? "white" : null,
                        }}
                        class="col"
                        key={column}
                      >
                        {row === activeRow && column < activeCol
                          ? word[column]
                          : row < history.length
                          ? history[row][column].letter
                          : null}
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
