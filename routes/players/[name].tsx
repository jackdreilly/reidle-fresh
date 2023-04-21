import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData, SessionHandler, timerTime } from "@/utils/utils.ts";
import { Chart } from "https://deno.land/x/fresh_charts@0.2.1/mod.ts";
import { Buckets, runSql, Schemas } from "@/utils/sql_files.ts";
interface Data {
  name: string;
  stats: Schemas["player_stats"]["output"];
}

const height = 200;
const width = 400;

export const handler: SessionHandler<Data> = {
  async GET(_, ctx) {
    const name = ctx.params.name ?? "";
    return ctx.state.render(ctx, {
      stats: await runSql({
        file: "player_stats",
        connection: ctx.state.connection,
        args: { name },
        single_row: true,
      }),
      name,
    });
  },
};

export default function Page(
  { data: { name, playedToday, stats: { total, rank, penalty, time, week } } }:
    PageProps<
      Data & SessionData
    >,
) {
  const [scores, _penalties, times] = ([rank, penalty, time] as Buckets[]).map(
    (x) =>
      x.map(({ bucket, count }) => [bucket, count]).toSorted(([a], [c]) =>
        a < c ? -1 : a > c ? 1 : 0
      ),
  );
  const penalties = _penalties.filter(([a, b]) => a !== 0);
  return (
    <ReidleTemplate playedToday={playedToday} route="/players" title={name}>
      <h1 class="text-2xl">{name}</h1>
      <div class="m-2">
        <h2 class="text-xl">Total Games: {total}</h2>
      </div>
      <div class="p-4 mx-auto max-w-screen-md">
        <Chart
          options={{ devicePixelRatio: 1 }}
          width={width}
          height={height}
          type="bar"
          data={{
            labels: scores.map(([a, _]) =>
              a.toString()
            ),
            datasets: [{
              label: "Scores",
              data: scores.map(([_, b]) =>
                b
              ),
            }],
          }}
        />
      </div>
      <div class="p-4 mx-auto max-w-screen-md">
        <Chart
          options={{ devicePixelRatio: 1 }}
          width={width}
          height={height}
          type="bar"
          data={{
            labels: times.map(([a, _]) => timerTime(a)),
            datasets: [{
              label: "Times",
              data: times.map(([_, b]) => b),
            }],
          }}
        />
      </div>
      <div class="p-4 mx-auto max-w-screen-md">
        <Chart
          options={{ devicePixelRatio: 1 }}
          width={width}
          height={height}
          type="bar"
          data={{
            labels: penalties.map(([a, _]) => timerTime(a)),
            datasets: [{
              label: "Penalties",
              data: penalties.map(([_, b]) => b),
            }],
          }}
        />
      </div>
      <div class="p-4 mx-auto max-w-screen-md">
        <Chart
          options={{ devicePixelRatio: 1 }}
          width={width}
          height={height}
          type="line"
          data={{
            labels: week.map(({ week }) => week.slice(5, 10)),
            datasets: [{
              label: "Times",
              data: week.map(({ time }) => time),
            }],
          }}
        />
      </div>
      <div class="p-4 mx-auto max-w-screen-md">
        <Chart
          options={{ devicePixelRatio: 1 }}
          width={width}
          height={height}
          type="line"
          data={{
            labels: week.map(({ week }) => week.slice(5, 10)),
            datasets: [{
              label: "Scores",
              data: week.map(({ rank }) => rank),
            }],
          }}
        />
      </div>
      <div class="p-4 mx-auto max-w-screen-md">
        <Chart
          options={{ devicePixelRatio: 1 }}
          height={height}
          width={width}
          type="line"
          data={{
            labels: week.map(({ week }) => week.slice(5, 10)),
            datasets: [{
              label: "Penalties",
              data: week.map(({ penalty }) => penalty),
            }],
          }}
        />
      </div>
    </ReidleTemplate>
  );
}
