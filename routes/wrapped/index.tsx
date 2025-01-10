import { RouteContext } from "$fresh/server.ts";
import { SessionData } from "@/utils/utils.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { runSql } from "@/utils/sql_files.ts";
import { asset } from "$fresh/runtime.ts";

export default async function MyPage(
  req: Request,
  ctx: RouteContext<null, SessionData>,
) {
  const users = await runSql({
    file: "wrapped/users",
    connection: ctx.state.connection,
  });
  const name = ctx.state.name;
  return (
    <ReidleTemplate
      playedToday={ctx.state.playedToday}
      route="/wrapped"
      title="Wrapped"
    >
      <img
        style={{ maxWidth: "500px", maxHeight: "300px" }}
        src={asset("/wrapped.jpg")}
        class="p-4"
      />
      <h1 class="p-5 m-5 text-lg">Welcome to Reidle Wrapped 2024!</h1>
      <div class="p-2">
        <a
          class="font-medium text-blue-600 dark:text-blue-500 hover:underline"
          href={`/wrapped/${name}/0`}
        >
          {name}, Unwrap to your Reidle Wrapped 2024 Starting Here!
        </a>
      </div>
      <h2 class="p-5 m-5 text-md">All users Wrapped 2024!</h2>
      <ul class="inline-grid">
        {users.map(({ name }) => (
          <a
            class="font-medium text-blue-600 dark:text-blue-500 hover:underline"
            href={`/wrapped/${name}/0`}
          >
            {name}
          </a>
        ))}
      </ul>
    </ReidleTemplate>
  );
}
