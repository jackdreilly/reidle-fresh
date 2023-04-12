import { PageProps } from "$fresh/server.ts";
import { Challenge } from "@/routes/challenges.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import GameTemplate from "@/components/game_template.tsx";
import Game from "@/islands/game.tsx";
interface ChallengeWithWords extends Challenge {
  starting_word: string;
  answer: string;
  already_played: boolean;
  best_time?: number;
}
export const handler: SessionHandler<ChallengeWithWords> = {
  async GET(req, ctx) {
    const { state: { name, connection, render }, params: { challenge_id } } =
      ctx;
    const data = await connection.queryObject<ChallengeWithWords>`
      SELECT
          id::INT AS id,
          starting_word,
          answer,
          EXISTS (
            SELECT
                name
            FROM
                challenge_submissions
            WHERE
                challenge_id = ${challenge_id}
            AND
                name = ${name}
          ) AS already_played,
          (
            SELECT
                MIN(time)
            FROM
                challenge_submissions
            WHERE
                challenge_id = ${challenge_id}
          ) AS best_time
      FROM
          challenges
      WHERE
          id = ${challenge_id}
      LIMIT
          1
  `.then((r) => r.rows[0]);
    if (data.already_played) {
      return new Response("already played", {
        status: 307,
        headers: { location: `/challenges/challenge/${challenge_id}` },
      });
    }
    return render(ctx, data);
  },
};

export default function Challenge(
  { data: { starting_word, answer, playedToday, id, best_time } }: PageProps<
    ChallengeWithWords & SessionData
  >,
) {
  return (
    <GameTemplate
      title="Challenge"
      isPractice={false}
      playedToday={playedToday}
    >
      <Game
        challenge_id={id}
        isPractice={false}
        winnersTime={best_time}
        startingWord={starting_word.toUpperCase()}
        word={answer.toUpperCase()}
      />
    </GameTemplate>
  );
}
