import { RouteContext } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { runSql } from "@/utils/sql_files.ts";
import { SessionData } from "@/utils/utils.ts";

export default async function MyPage(
  req: Request,
  ctx: RouteContext<null, SessionData>,
) {
  const name = ctx.params["name"];
  const myName = name;
  const { story } = await runSql({
    args: { name },
    file: "wrapped/stories",
    connection: ctx.state.connection,
    single_row: true,
  });
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
          href="/wrapped"
        >
          Back To Wrapped 2023
        </a>
      </div>

      <h2>Finally...</h2>
      <h3>A short story about {name}</h3>
      <div class="p-10 m-10">
        {story}
      </div>
      <div class="p-5">
        Thanks to {name} for a great Reidle 2023!
      </div>
    </ReidleTemplate>
  );
}
