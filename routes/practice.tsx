import Game from "@/islands/game.tsx";
import { SessionHandler } from "@/utils/utils.ts";
import { Wordle } from "@/utils/wordle.ts";
import { PageProps } from "$fresh/server.ts";

interface PracticeData {
  word: string;
  startingWord: string;
}

const wordlePromise = Wordle.make(true);
export const handler: SessionHandler<PracticeData> = {
  async GET(req, ctx) {
    const wordle = await wordlePromise;
    const word = wordle.randomAnswer();
    console.log(word);
    const startingWord = wordle.randomWord();
    return ctx.render({ word, startingWord });
  },
};

export default function Page(
  { data: { word, startingWord } }: PageProps<PracticeData>,
) {
  return (
    <html style={{ height: "100%", margin: 0, padding: 0 }}>
      <head>
        <title>Practice</title>
      </head>
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          margin: 0,
          padding: 0,
        }}
      >
        <h2 style={{ textAlign: "center" }}>Practice</h2>
        <div style={{ flexGrow: 1 }}>
          <Game
            word={word}
            startingWord={startingWord}
            onFinish={(time, penalty, scoring) =>
              console.log(time, penalty, scoring)}
          />
        </div>
      </body>
    </html>
  );
}
