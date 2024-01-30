import { PageProps } from "$fresh/server.ts";
import GameTemplate from "@/components/game_template.tsx";
import Game from "@/islands/game.tsx";
import { guardNotPlayed, SessionData, SessionHandler } from "@/utils/utils.ts";
import { runSql, Schemas } from "@/utils/sql_files.ts";

type PlayData = Schemas["play"]["output"];

export const handler: SessionHandler<PlayData> = {
  async GET(_, ctx) {
    return guardNotPlayed(await ctx.state.playedTodayPromise) ??
      ctx.state.render(
        ctx,
        await runSql({
          file: "play",
          connection: ctx.state.connection,
          single_row: true,
          args: {
            name: ctx.state.name,
          },
        }),
      );
  },
};

export default function Page(
  {
    data: { word, startingWord, winnersTime, playedToday, winner, checkpoint },
  }: PageProps<
    PlayData & SessionData
  >,
) {
  return (
    <GameTemplate title="Play" isPractice={false} playedToday={playedToday}>
      <Game
        isPractice={false}
        word={word}
        startingWord={startingWord}
        winnersTime={winnersTime}
        winner={winner}
        checkpoint={checkpoint}
      />
    </GameTemplate>
  );
}
