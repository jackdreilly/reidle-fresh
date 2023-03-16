import { PageProps } from "$fresh/server.ts";
import GameTemplate from "@/components/game_template.tsx";
import Game from "@/islands/game.tsx";
import { SessionHandler } from "@/utils/utils.ts";
import { Wordle } from "@/utils/wordle.ts";

interface PracticeData {
  word: string;
  startingWord: string;
  winnersTime?: number | null;
}

const wordlePromise = Wordle.make(true);
export const handler: SessionHandler<PracticeData> = {
  async GET(req, ctx) {
    const { connection: cxn } = ctx.state;
    const wordle = await wordlePromise;
    const word = wordle.todaysAnswer();
    const startingWord = wordle.todaysWord();
    const winnersTime = await cxn.queryObject<
      { time: number }
    >`select time from submissions where day = CURRENT_DATE order by time limit 1`
      .then((x) => x.rows[0]?.time ?? 0);
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
