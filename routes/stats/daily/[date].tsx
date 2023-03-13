import { Handlers, PageProps } from "$fresh/server.ts";
import StatsTemplate from "@/components/stats_template.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableRowHeader,
} from "@/components/tables.tsx";
import TimerText from "@/components/timer_text.tsx";
import run from "@/utils/db.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
interface Submission {
  name: string;
  time: number;
  penalty: number;
  paste: string;
  id: number;
}
type Data = Submission[];

export const handler: Handlers<Data, WithSession> = {
  async GET(_, ctx) {
    const day = new Date(ctx.params["date"]).toISOString().slice(0, 10);
    const submissions = await run((cxn) =>
      cxn.queryObject<
        Submission
      >`select name, time, penalty, paste, id from submissions where day = ${day} order by "rank"`
    ).then((x) => x?.rows ?? []);
    return ctx.render(submissions);
  },
};

export default function Page(
  { data: submissions }: PageProps<Data>,
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
