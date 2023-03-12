import { Handlers, PageProps } from "$fresh/server.ts";
import StatsTemplate from "@/components/stats_template.tsx";
import { Table } from "@/components/tables.tsx";
import runDb from "@/utils/db.ts";
import { timerTime } from "@/utils/utils.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
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
}

export const handler: Handlers<Data, WithSession> = {
  async GET(_, ctx) {
    const day = new Date(ctx.params["date"]).toISOString().slice(0, 10);
    const submissions = await runDb((connection) =>
      connection.queryObject`
      SELECT
        *
      FROM
        submissions
      WHERE
        day = ${day}
      ORDER BY
        rank
      `.then((x) => x.rows as Submission[])
    ) ?? [];
    return ctx.render({
      submissions,
    });
  },
};

export default function Page(
  { data: { submissions } }: PageProps<Data>,
) {
  return (
    <StatsTemplate>
      <Table
        columns={["Name", "Time", "Pen", "Paste"]}
        rows={submissions.map((
          { name, time, penalty, paste },
        ) => [
          name.slice(0, 13),
          timerTime(time),
          penalty,
          paste,
        ])}
        columnStyles={{ Paste: "whitespace-pre-wrap text-[7px] leading-[4px]" }}
      />
    </StatsTemplate>
  );
}
