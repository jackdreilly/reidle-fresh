import { SessionData, SessionHandler } from "@/utils/utils.ts";
import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { moment } from "https://deno.land/x/deno_moment@v1.1.2/moment.ts";
import {
  DailyTable,
  DailyTableData,
} from "../../../../components/daily_table.tsx";
import { DailySubmission } from "../../../stats/daily/[date].tsx";
export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    const { state: { name, connection, render }, params: { challenge_id } } =
      ctx;
    const rows = await connection.queryObject<
      DailySubmission & {
        challenge_id: number;
        challenge_created_at: string;
        challenger: string;
      }
    >`
WITH
challenge AS (
  SELECT
    challenger,
    created_at AS challenge_created_at,
    id AS challenge_id
  FROM
    challenges
  WHERE
    id = ${challenge_id}
),
challengers AS (
  SELECT
    challenger AS name
  from
    challenge
  UNION
  SELECT
    name
  from
    challenge_requests
  WHERE
    challenge_id = ${challenge_id}
),
submissions AS (
SELECT
    id,
    created_at,
    name,
    time,
    penalty,
    paste,
    playback,
    word,
    day,
    score,
    rank
FROM
  challenge_submissions
WHERE
  challenge_id = ${challenge_id}
)
SELECT
  *
FROM
  challenge,
  challengers
FULL OUTER JOIN
  submissions
USING (
  name
)
ORDER BY
    time NULLS LAST
  `.then((r) => r.rows);
    const challenge = rows[0];
    const submissions = rows;
    return render(ctx, { challenge, submissions });
  },
};
type Data = {
  challenge: {
    challenge_id: number;
    challenge_created_at: string;
    challenger: string;
  };
  submissions: DailyTableData;
};

export default function Page(
  {
    data: {
      challenge: { challenge_id, challenger, challenge_created_at: created_at },
      submissions,
      playedToday,
      name,
    },
  }: PageProps<Data & SessionData>,
) {
  const playedChallenge = submissions.filter((x) => x.time).map((x) => x.name)
    .includes(
      name,
    );
  return (
    <ReidleTemplate
      route="/challenges"
      title={`Challenge ${challenge_id}`}
      playedToday={playedToday}
    >
      <h1 class="m-4 p-4 text-xl">Challenge {challenge_id}</h1>
      <div>
        <span class="font-bold">Created:</span>
        <span class="pl-2">{moment(created_at).fromNow()}</span>
      </div>
      <div>
        <span class="font-bold">Challenger:</span>
        <span class="pl-2">{challenger}</span>
      </div>
      {!playedChallenge
        ? (
          <a
            href={`/challenges/challenge/${challenge_id}/play`}
            class="inline-block m-4 text-white bg-gradient-to-br from-purple-600 to-blue-500 hover:bg-gradient-to-bl focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center mr-2 mb-2"
          >
            Play
          </a>
        )
        : null}
      <DailyTable
        name={name}
        hide={!playedChallenge}
        submissions={submissions}
        challenge={true}
      />
    </ReidleTemplate>
  );
}
