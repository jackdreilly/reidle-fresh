import { PageProps } from "$fresh/server.ts";
import GameTemplate from "@/components/game_template.tsx";
import Game from "@/islands/game.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import { Wordle } from "@/utils/wordle.ts";

interface PracticeData {
  word: string;
  startingWord: string;
}

const wordlePromise = Wordle.make(true);
export const handler: SessionHandler<PracticeData> = {
  async GET(req, ctx) {
    const wordle = await wordlePromise;
    const url = new URL(req.url);
    const { searchParams } = url;
    if (["word", "startingWord"].every((x) => searchParams.has(x))) {
      return ctx.state.render(ctx, {
        word: wordle.answers[parseInt(searchParams.get("word") ?? "0")],
        startingWord:
          wordle.words[parseInt(searchParams.get("startingWord") ?? "0")],
      });
    }
    const word = Math.floor(Math.random() * wordle.answers.length);
    const startingWord = Math.floor(Math.random() * wordle.words.length);
    return new Response("set params", {
      status: 307,
      headers: {
        location: new URL(
          `${url.origin}${url.pathname}?${new URLSearchParams([[
            "word",
            word.toString(),
          ], ["startingWord", startingWord.toString()]])}`,
        ).toString(),
      },
    });
  },
};

export default function Page(
  { data: { word, startingWord, playedToday } }: PageProps<
    PracticeData & SessionData
  >,
) {
  return (
    <GameTemplate title="Practice" isPractice={true} playedToday={playedToday}>
      <Game
        isPractice={true}
        word={word}
        startingWord={startingWord}
      />
    </GameTemplate>
  );
}
