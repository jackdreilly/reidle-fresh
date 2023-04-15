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
          'id', id
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
      <a
        class="font-medium text-blue-600 dark:text-blue-500 hover:underline float align-center"
        href="/challenges"
      >
        <svg
          class="h-5 w-5 inline mx-2"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            clipRule="evenodd"
            fillRule="evenodd"
            d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
          />
        </svg>
        Back to challenges
      </a>
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
