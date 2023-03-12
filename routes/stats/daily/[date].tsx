import { Handlers, PageProps } from "$fresh/server.ts";
import StatsTemplate from "@/components/stats_template.tsx";
import {
  Table,
  TableBody,
  TableCell, TableRow,
  TableRowHeader
} from "@/components/tables.tsx";
import runDb from "@/utils/db.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
import TimerText from "@/components/timer_text.tsx";
import { Playback } from "../../../utils/playback.ts";
interface Submission {
  name: string;
  day: Date;
  id: number;
  time: number;
  penalty: number;
  score: number;
  rank: number;
  paste: number;
  playback: Playback;
}
interface Data {
  submissions: Submission[];
}

export const handler: Handlers<Data, WithSession> = {
  async GET(_, ctx) {
    const day = new Date(ctx.params["date"]).toISOString().slice(0, 10);
    const submissions = await runDb(async (cxn) => {
      const response = await cxn.queryObject<Submission>`
      SELECT
        name, time, penalty, paste, id
      FROM
        submissions
      WHERE
        day = ${day}
      ORDER BY
        rank
      `;
      return response.rows;
    }) ?? [];
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
      >
        <TableBody>
          {submissions.map((
            { name, time, penalty, paste, id },
          ) => (
            <TableRow>
              <TableRowHeader>
                <a href={`/submissions/${id}/playback`}>{name.slice(0, 13)}</a>
              </TableRowHeader>
              <TableCell>
                <TimerText seconds={time} />
              </TableCell>
              <TableCell>{penalty}</TableCell>
              <TableCell class="whitespace-pre-wrap text-[7px] leading-[4px]">
                {paste}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </StatsTemplate>
  );
}
