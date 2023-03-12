import { Handlers, PageProps } from "$fresh/server.ts";
import StatsTemplate from "@/components/stats_template.tsx";
import runDb from "@/utils/db.ts";
import { getName, timerTime } from "@/utils/utils.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
import { Table } from "../../components/tables.tsx";
interface Submission {
  name: string;
  day: Date;
  id: number;
  time: number;
  penalty: number;
  score: number;
  rank: number;
  paste: number;
  playback: Record<string, unknown>[];
}
interface Data {
  submissions: Submission[];
  name: string;
}

export const handler: Handlers<Data, WithSession> = {
  async GET(_, ctx) {
    const name = getName(ctx);
    const submissions = await runDb((connection) =>
      connection.queryObject`
      SELECT
        *
      FROM
        submissions
      WHERE
        CURRENT_DATE = day
      ORDER BY
        rank
      LIMIT
        100
      `.then((x) => x.rows as Submission[])
    ) ?? [];
    return ctx.render({
      submissions,
      name,
    });
  },
};

export default function Page(
  { data: { submissions, name: myName } }: PageProps<Data>,
) {
  return (
    <StatsTemplate>
      <h2 class="text-2xl">Today</h2>
      <Table
        columns={["Name", "Time", "Pen", "Score", "Paste", "Date"]}
        rows={submissions.map((
          { name, time, penalty, score, paste, day },
        ) => [
          name.slice(0, 13),
          timerTime(time),
          penalty,
          score,
          paste,
          `${day.getUTCMonth()}/${day.getUTCDate()}`,
        ])}
        columnStyles={{ Paste: "whitespace-pre-wrap text-[7px] leading-[4px]" }}
      />
    </StatsTemplate>
  );
}
