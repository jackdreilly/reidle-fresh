import { RouteContext } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData } from "@/utils/utils.ts";
import { runSql } from "@/utils/sql_files.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableRowHeader,
} from "@/components/tables.tsx";
import { Name } from "@/components/daily_table.tsx";

export default async function MyPage(
  req: Request,
  ctx: RouteContext<null, SessionData>,
) {
  const name = ctx.params["name"];
  const myName = name;
  const rows = await runSql({
    file: "wrapped/overall_score",
    connection: ctx.state.connection,
  });
  const my_row = rows.filter((c) => c.name === name)[0];
  return (
    <ReidleTemplate
      playedToday={ctx.state.playedToday}
      route="/wrapped"
      title="Wrapped"
    >
      <div class="p-1 text-md m-1 inline-block">
        <h1 class="italic inline p-2">Wrapped {name}</h1>
        <a
          class="font-medium text-blue-600 dark:text-blue-500 hover:underline"
          href={`${ctx.url.pathname.split("/").slice(0, -1).join("/")}/${
            parseInt(ctx.url.pathname.split("/").slice(-1)[0]) + 1
          }`}
        >
          Next Page ({parseInt(ctx.route.split("/").slice(-1)[0]) + 1}) ➡️
        </a>
      </div>

      <h2>Next up...</h2>
      <div>
        The average score of {name} was{"  "}
        <span class="font-bold">
          {my_row.overall_score}
        </span>
      </div>
      <div class="p-3 m-3 overflow-scroll">
        <Table columns={["Name", "Score", "Rank"]}>
          <TableBody>
            {rows.map(({ name, overall_rank, overall_score }) => (
              <TableRow class={name === myName ? "bg-yellow-100" : ""}>
                <TableRowHeader>
                  <Name name={name} />
                </TableRowHeader>
                <TableCell>
                  {overall_score}
                </TableCell>
                <TableCell>
                  {overall_rank}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReidleTemplate>
  );
}
