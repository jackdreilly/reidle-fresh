import { Handlers, PageProps } from "$fresh/server.ts";
import StatsTemplate from "@/components/stats_template.tsx";
import run from "@/utils/db.ts";
import { getName } from "@/utils/utils.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
import getWinner from "@/utils/get_winner.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableRowHeader,
} from "@/components/tables.tsx";
interface Submission {
  name: string;
  week: string;
}
interface Data {
  submissions: Submission[];
  name: string;
}

export const handler: Handlers<Data, WithSession> = {
  async GET(_, ctx) {
    const name = getName(ctx);
    await getWinner();
    const submissions = await run((cxn) =>
      cxn.queryObject<Submission>`
    SELECT
      name,
      week::TEXT AS week
    FROM
      winners
    ORDER BY
      week DESC
    `.then(({ rows }) => rows)
    ) ?? [];
    return ctx.render({
      submissions,
      name,
    });
  },
};

export default function Page(
  { data: { submissions } }: PageProps<Data>,
) {
  return (
    <StatsTemplate>
      <Table columns={["Name", "Week"]}>
        <TableBody>
          {submissions.map(({ name, week }, i) => (
            <TableRow>
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
