import { RouteContext } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { runSql } from "@/utils/sql_files.ts";
import { SessionData } from "@/utils/utils.ts";
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
  const [rows] = await Promise.all([
    runSql({
      file: "wrapped/games_missed",
      connection: ctx.state.connection,
    }),
  ]);
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
        {name} missed{" "}
        <span class="font-bold">
          {rows.filter((c) => c.name === name)[0]?.games_missed ?? 0}
        </span>{" "}
        games, which is one game missed every{" "}
        <span class="font-bold">
          {rows.filter((c) => c.name === name)[0]?.tardy_rate ?? 0}
        </span>{" "}
        played!
      </div>
      <div class="p-3 m-3 overflow-scroll">
        <Table columns={["Name", "Missed", "Rate"]}>
          <TableBody>
            {rows.map(({ name, games_missed, tardy_rate }) => (
              <TableRow class={name === myName ? "bg-yellow-100" : ""}>
                <TableRowHeader>
                  <Name name={name} />
                </TableRowHeader>
                <TableCell>
                  {games_missed}
                </TableCell>
                <TableCell>
                  {tardy_rate}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReidleTemplate>
  );
}
