import { PageProps } from "$fresh/server.ts";
import { DailyTable } from "@/components/daily_table.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import { runSql, Schemas } from "../../../../utils/sql_files.ts";
type Data = Schemas["challenge_page"]["output"] & { challenge_id: number };
export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    const {
      params: { challenge_id: cid },
      state: { connection, name, render },
    } = ctx;
    const challenge_id = parseInt(cid);
    return render(
      ctx,
      {
        challenge_id,
        ...await runSql({
          file: "challenge_page",
          single_row: true,
          connection,
          args: { name, challenge_id },
        }),
      },
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
