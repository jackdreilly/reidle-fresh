import { PageProps } from "$fresh/server.ts";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import GameTemplate from "@/components/game_template.tsx";
import Game from "@/islands/game.tsx";
import { runSql, Schemas } from "../../../../utils/sql_files.ts";
type ChallengePlay = Schemas["challenge_play"]["output"] & {
  challenge_id: number;
};
export const handler: SessionHandler<ChallengePlay> = {
  async GET(req, ctx) {
    const {
      state: { name, connection, render },
      params: { challenge_id: cid },
    } = ctx;
    const challenge_id = parseInt(cid);
    const data = await runSql({
      file: "challenge_play",
      connection,
      single_row: true,
      args: { name, challenge_id },
    });
    if (data.already_played) {
      return new Response("already played", {
        status: 307,
        headers: { location: `/challenges/challenge/${challenge_id}` },
      });
    }
    return render(ctx, { ...data, challenge_id });
  },
};

export default function Challenge(
  {
    data: {
      starting_word,
      answer,
      playedToday,
      challenge_id,
      leader,
    },
  }: PageProps<
    ChallengePlay & SessionData
  >,
) {
  return (
    <GameTemplate
      title="Challenge"
      isPractice={false}
      playedToday={playedToday}
    >
      <Game
        challenge_id={challenge_id}
        isPractice={false}
        winnersTime={leader?.time}
        startingWord={starting_word.toUpperCase()}
        word={answer.toUpperCase()}
        winner={leader?.name}
      />
    </GameTemplate>
  );
}
