import { RouteContext } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData } from "@/utils/utils.ts";
import { runSql } from "@/utils/sql_files.ts";
import { Chart } from "https://deno.land/x/fresh_charts@0.2.1/Chart.tsx";

export default async function MyPage(
  req: Request,
  ctx: RouteContext<null, SessionData>,
) {
  const name = ctx.params["name"];
  const rows = await runSql({
    file: "wrapped/dow",
    connection: ctx.state.connection,
    args: { name },
  });
  function dowConverer(dow: number): string {
    return [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ][dow] ?? "Monday";
  }
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
        The best day of the week for {name} was{" "}
        <span class="font-bold">
          {dowConverer(rows.filter((c) => c.dow_rank === 1)[0]?.dow)}
        </span>!
      </div>
      <Chart
        width={300}
        height={200}
        type="bar"
        options={{ devicePixelRatio: 1, scales: { y: { beginAtZero: false } } }}
        data={{
          labels: rows.map((c) => dowConverer(c.dow).substring(0, 3)),
          datasets: [{
            label: "Score",
            data: rows.map((c) => c.dow_score),
          }],
        }}
      />
    </ReidleTemplate>
  );
}
