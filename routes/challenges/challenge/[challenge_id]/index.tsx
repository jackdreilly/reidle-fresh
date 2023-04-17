import { PageProps } from "$fresh/server.ts";
import { DailyTable, DailyTableData } from "@/components/daily_table.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
interface Data {
  challenge_id: number;
  played: boolean;
  submissions: DailyTableData;
}
export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    const { params: { challenge_id }, state: { connection, name, render } } =
      ctx;
    return render(
      ctx,
      await connection.queryObject<Data>`
      select
      challenge_id,
      EXISTS (
        select 1 from submissions where name = ${name} and challenge_id = ${challenge_id}
      ) as played,
      coalesce((
        select json_agg(
          json_build_object(
          'name', name,
          'time', time,
          'penalty', penalty,
          'paste', paste,
          'submission_id', submission_id
          ) order by time
        ) from submissions where challenge_id = ${challenge_id}
      ), json_build_array()) as submissions
    from challenges where challenge_id = ${challenge_id};
      `.then((r) => r.rows[0]),
    );
  },
};

export default function Page(
  { data: { challenge_id, played, submissions, playedToday, name } }: PageProps<
    Data & SessionData
  >,
) {
  return (
    <ReidleTemplate
      route="/challenges"
      title="Challenge"
      playedToday={playedToday}
    >
      <h1>Challenge {challenge_id}</h1>
      {played ? null : (
        <a
          class="inline-block text-white bg-gradient-to-br from-purple-600 to-blue-500 hover:bg-gradient-to-bl focus:ring-4 focus:outline-none focus:ring-blue-300  font-medium rounded-lg text-sm px-5 py-2.5 text-center m-2"
          href={`/challenges/challenge/${challenge_id}/play`}
        >
          Play
        </a>
      )}
      <DailyTable hide={!played} name={name} submissions={submissions} />
    </ReidleTemplate>
  );
}
