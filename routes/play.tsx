import { PageProps } from "$fresh/server.ts";
import Game from "@/islands/game.tsx";
import { getName, SessionHandler } from "@/utils/utils.ts";
import { Wordle } from "@/utils/wordle.ts";
import GameTemplate from "@/components/game_template.tsx";
import run from "@/utils/db.ts";

interface PracticeData {
  word: string;
  startingWord: string;
  winnersTime?: number | null;
}

const wordlePromise = Wordle.make(true);
export const handler: SessionHandler<PracticeData> = {
  async GET(req, ctx) {
    const name = getName(ctx);
    if (!name) {
      return new Response("", {
        status: 307,
        headers: { Location: "/set-name" },
      });
    }
    const wordle = await wordlePromise;
    const word = wordle.todaysAnswer();
    const startingWord = wordle.todaysWord();
    const winnersTime = await run((cxn) =>
      cxn.queryObject<
        { time: number }
      >`select time from submissions where day = CURRENT_DATE order by time limit 1`
    ).then((x) => x?.rows[0]?.time ?? 0);
    return ctx.render({ word, startingWord, winnersTime });
  },
};

export default function Page(
  { data: { word, startingWord, winnersTime } }: PageProps<PracticeData>,
) {
  return (
    <GameTemplate isPractice={false}>
      <Game
        isPractice={false}
        word={word}
        startingWord={startingWord}
        winnersTime={winnersTime}
      />
    </GameTemplate>
  );
}
