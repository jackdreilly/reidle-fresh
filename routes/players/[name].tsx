import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData, SessionHandler, timerTime } from "@/utils/utils.ts";
import { Chart } from "https://deno.land/x/fresh_charts@0.2.1/mod.ts";
type Buckets = { bucket: number; count: number }[];
interface Stats {
  total: number;
  rank: Buckets;
  time: Buckets;
  penalty: Buckets;
  week: { week: string; time: number; penalty: number; rank: number }[];
}
interface Data {
  name: string;
  stats: Stats;
}

export const handler: SessionHandler<Data> = {
  async GET(_, ctx) {
    const name = ctx.params.name ?? "";
    const stats = await ctx.state.connection.queryObject<{ stats: Stats }>`
        with MYSUBMISSIONS as (
    select
        TIME,
        PENALTY,
        rank,
        day
    from SUBMISSIONS where NAME = ${name}
),

TOTAL_SUBMISSIONS as (
    select count(*) as TOTAL from MYSUBMISSIONS
),

BY_SCORE as (
    select
        RANK,
        count(*) as SCORE_COUNT
    from MYSUBMISSIONS group by 1
),

BY_TIME as (
    select
        width_bucket(TIME, array[0, 5, 10, 15,20,30,40,50,60,80,100,120,180,240,300,360,420,480,540,600, 1200]) as BUCKET,
        count(*) as C
    from MYSUBMISSIONS group by 1
),

BY_TIME_JSON as (
    select json_agg(json_build_object('bucket', (array[0, 5, 10, 15,20,30,40,50,60,80,100,120,180,240,300,360,420,480,540,600, 1200])[BUCKET], 'count', C)) as BY_TIME
    from BY_TIME
    WHERE (array[0, 5, 10, 15,20,30,40,50,60,80,100,120,180,240,300,360,420,480,540,600, 1200])[BUCKET] IS NOT NULL
),

BY_PENALTY as (
    select
        PENALTY,
        count(*) as PENALTY_COUNT
    from MYSUBMISSIONS group by 1
),

BY_PENALTY_JSON as (
    select json_agg(
            json_build_object('bucket', PENALTY, 'count', PENALTY_COUNT)
        ) as BY_PENALTY
    from BY_PENALTY
),

BY_SCORE_JSON as (
    select json_agg(
            json_build_object('bucket', RANK, 'count', SCORE_COUNT)
        ) as BY_SCORE
    from BY_SCORE
),

BY_WEEK AS (
  SELECT
    DATE_TRUNC('week', day) as week,
    AVG(time) as time,
    AVG(penalty) as penalty,
    AVG(rank) as rank
  FROM
    MYSUBMISSIONS
  GROUP BY
    1
  ORDER BY
    1
),

BY_WEEK_JSON AS (
  SELECT
    json_agg(json_build_object('week', week,'time', time, 'rank', rank, 'penalty', penalty))
      AS BY_WEEK
  FROM
    BY_WEEK
)

select json_build_object(
        'total', TOTAL_SUBMISSIONS.TOTAL,
        'rank', BY_SCORE_JSON.BY_SCORE,
        'penalty', BY_PENALTY_JSON.BY_PENALTY,
        'time', BY_TIME_JSON.BY_TIME,
        'week', BY_WEEK_JSON.BY_WEEK
) as stats
from
    BY_SCORE_JSON,
    BY_PENALTY_JSON,
    BY_TIME_JSON,
    TOTAL_SUBMISSIONS,
    BY_WEEK_JSON
        `.then((x) => x.rows[0]?.stats);
    return ctx.state.render(ctx, { stats, name });
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
