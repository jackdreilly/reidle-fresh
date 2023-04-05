import { PageProps } from "$fresh/server.ts";
import GameTemplate from "@/components/game_template.tsx";
import Game from "@/islands/game.tsx";
import {
  guardLogin,
  guardNotPlayed,
  SessionData,
  SessionHandler,
} from "@/utils/utils.ts";

interface PlayData {
  word: string;
  startingWord: string;
  winnersTime: number;
}

export const handler: SessionHandler<PlayData> = {
  async GET(_, ctx) {
    return guardLogin(ctx) ?? guardNotPlayed(ctx.state.playedToday) ??
      ctx.state.render(
        ctx,
        await ctx.state.connection.queryObject<PlayData>`
SELECT
    COALESCE(
            (
                SELECT
                    time
                FROM
                    "submissions"
                WHERE
                    "day" = CURRENT_DATE
                ORDER BY
                    "time"
                LIMIT 1
            ), 0
        )                      AS "winnersTime",
    UPPER(CONVERT_FROM(DECODE("word", 'base64'), 'UTF8'))   AS "startingWord",
    UPPER(CONVERT_FROM(DECODE("answer", 'base64'), 'UTF8')) AS "word"
FROM
    "daily_words"
WHERE
    "day" = CURRENT_DATE
LIMIT 1
    `.then((x) => x.rows[0]),
      );
  },
};

export default function Page(
  { data: { word, startingWord, winnersTime, playedToday } }: PageProps<
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
      />
    </GameTemplate>
  );
}
