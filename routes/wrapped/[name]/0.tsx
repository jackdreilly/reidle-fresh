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
    file: "wrapped/wins",
    connection: ctx.state.connection,
    args: { name },
  });
  const num_wins = rows.filter((r) => r.name === name)[0]?.num_wins ?? 0;
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
      <h1>Welcome to Reidle Wrapped 2023!</h1>
      <h2>Getting started...</h2>
      <div>
        {name} won <span class="black font-bold">{num_wins}</span>{" "}
        daily wins this year!
      </div>
      <div class="p-3 m-3 overflow-scroll">
        <Table columns={["Name", "Wins"]}>
          <TableBody>
            {rows.map(({ name, num_wins }) => (
              <TableRow class={name === myName ? "bg-yellow-100" : ""}>
                <TableRowHeader>
                  <Name name={name} />
                </TableRowHeader>
                <TableCell>
                  {num_wins}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReidleTemplate>
  );
}
