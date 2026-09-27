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
  const [my_words, words, images] = await Promise.all([
    runSql({
      args: { name },
      file: "wrapped/top_words",
      connection: ctx.state.connection,
    }),
    runSql({
      file: "wrapped/top_words_overall",
      connection: ctx.state.connection,
    }),
    runSql({
      args: { name },
      file: "wrapped/wordcloud_images_words",
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
        The favorite word of {name} was{"  "}
        <span class="font-bold">
          {my_words[0].words}
        </span>
        , which was used{" "}
        <span class="font-bold">
          {my_words[0].count}
        </span>{" "}
        times!
      </div>
      <img
        class="p-10 m-10 shadow rounded h-[400px] w-[400px]"
        src={`data:image/png;base64,${
          images.filter((c) => c.name === name)[0].image
        }`}
      />
      <div>
        The overall favorite word was{"  "}
        <span class="font-bold">
          {words[0].words}
        </span>
        , which was used{" "}
        <span class="font-bold">
          {words[0].count}
        </span>{" "}
        times!
      </div>
      <img
        class="p-10 m-10 shadow rounded h-[400px] w-[400px]"
        src={`data:image/png;base64,${
          images.filter((c) => c.name === "all")[0].image
        }`}
      />
    </ReidleTemplate>
  );
}
