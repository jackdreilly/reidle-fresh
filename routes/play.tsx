import { PageProps } from "$fresh/server.ts";
import Game from "@/islands/game.tsx";
import { SessionHandler } from "@/utils/utils.ts";
import { Wordle } from "@/utils/wordle.ts";
import GameTemplate from "@/components/game_template.tsx";

interface PracticeData {
  word: string;
  startingWord: string;
}

const wordlePromise = Wordle.make(true);
export const handler: SessionHandler<PracticeData> = {
  async GET(req, ctx) {
    const wordle = await wordlePromise;
    const word = wordle.todaysAnswer();
    const startingWord = wordle.todaysWord();
    return ctx.render({ word, startingWord });
  },
};

export default function Page(
  { data: { word, startingWord } }: PageProps<PracticeData>,
) {
  return (
    <GameTemplate title="Play">
      <Game
        isPractice={false}
        word={word}
        startingWord={startingWord}
        onFinish={(time, penalty, scoring) =>
          console.log(time, penalty, scoring)}
      />
    </GameTemplate>
  );
}
