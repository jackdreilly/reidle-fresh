import { PageProps } from "$fresh/server.ts";
import GameTemplate from "@/components/game_template.tsx";
import Game from "@/islands/game.tsx";
import { guardNotPlayed, SessionData, SessionHandler } from "@/utils/utils.ts";

interface PlayData {
  word: string;
  startingWord: string;
  winnersTime: number;
  winner?: string;
}

export const handler: SessionHandler<PlayData> = {
  async GET(_, ctx) {
    return guardNotPlayed(await ctx.state.playedTodayPromise) ??
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
                AND
                    "challenge_id" IS NULL
                ORDER BY
                    "time"
                LIMIT 1
            ), 0
        )                      AS "winnersTime",
        (
            SELECT
                name
            FROM
                "submissions"
            WHERE
                "day" = CURRENT_DATE
            AND
                "challenge_id" IS NULL
            ORDER BY
                "time"
            LIMIT 1
        ) AS "winner",
    UPPER(word) AS "startingWord",
    UPPER(answer) AS "word"
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
  { data: { word, startingWord, winnersTime, playedToday, winner } }: PageProps<
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
      />
    </GameTemplate>
  );
}
