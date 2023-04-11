import { PageProps } from "$fresh/server.ts";
import { Challenge } from "@/routes/challenges.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import GameTemplate from "@/components/game_template.tsx";
import Game from "@/islands/game.tsx";
interface ChallengeWithWords extends Challenge {
  starting_word: string;
  answer: string;
}
export const handler: SessionHandler<ChallengeWithWords> = {
  async GET(req, ctx) {
    const { state: { name, connection, render } } = ctx;
    const data = await connection.queryObject<ChallengeWithWords>`
      SELECT
          id::INT AS id,
          starting_word,
          answer
      FROM
          challenges
      WHERE
          id = ${ctx.params.challenge_id}
      LIMIT
          1
  `.then((r) => r.rows[0]);
    return render(ctx, data);
  },
};

export default function Challenge(
  { data: { starting_word, answer, playedToday, id } }: PageProps<
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
        startingWord={starting_word.toUpperCase()}
        word={answer.toUpperCase()}
      />
    </GameTemplate>
  );
}
