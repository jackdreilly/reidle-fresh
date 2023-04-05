import { PageProps } from "$fresh/server.ts";
import StatsTemplate from "@/components/stats_template.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableRowHeader,
} from "@/components/tables.tsx";
import getWinner from "@/utils/get_winner.ts";
import { SessionHandler } from "@/utils/utils.ts";
interface Submission {
  name: string;
  week: string;
}
interface Data {
  submissions: Submission[];
  name: string;
}

export const handler: SessionHandler<Data> = {
  async GET(_, ctx) {
    const name = ctx.state.name;
    await getWinner(ctx.state.connection);
    return ctx.state.render(ctx,{
      submissions: await ctx.state.connection.queryObject<Submission>`
      SELECT
        name,
        week::TEXT AS week
      FROM
        winners
      ORDER BY
        week DESC
      `.then((x) => x.rows),
      name,
    });
  },
};

export default function Page(
  { data: { submissions, playedToday, name: myName } }: PageProps<Data & {playedToday: boolean}>,
) {
  return (
    <StatsTemplate playedToday={playedToday} route="past_winners">
      <Table columns={["Name", "Week"]}>
        <TableBody>
          {submissions.map(({ name, week }, i) => (
            <TableRow class={name === myName ? "bg-yellow-100" : ""}>
              <TableRowHeader>{name}</TableRowHeader>
              <TableCell>
                <a
                  class="font-medium text-blue-600 dark:text-blue-500 hover:underline"
                  href={`/stats/weekly/${week}`}
                >
                  {week}
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </StatsTemplate>
  );
}
