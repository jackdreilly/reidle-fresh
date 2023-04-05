import { HandlerContext, PageProps } from "$fresh/server.ts";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
interface Player {
  name: string;
  email: string;
  notifications_enabled: boolean;
}
interface Data {
  players: Player[];
}

async function data(ctx: HandlerContext<Data, SessionData>): Promise<Data> {
  return {
    players: (await ctx.state.connection.queryObject<
      Player
    >`
SELECT
    name,
    email,
    notifications_enabled
FROM
    players
ORDER BY
    name
`)
      .rows,
  };
}

export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    if (ctx.state.name.toLowerCase() !== "jack") {
      return new Response("unauthorized", { status: 401 });
    }
    return ctx.state.render(ctx,await data(ctx));
  },
  async POST(req, ctx) {
    if (ctx.state.name.toLowerCase() !== "jack") {
      return new Response("unauthorized", { status: 401 });
    }
    const request = (await req.formData()).get("request") as string;
    if (request === "rebuild") {
      await ctx.state.connection.queryObject`
WITH
scorings AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY day ORDER BY time) AS rank,
        LEAST(4, ROW_NUMBER() OVER (PARTITION BY day ORDER BY time)) AS score,
        time,
        name,
        day
    FROM
        submissions
),
update_scores AS (
    UPDATE
        submissions
    SET
        score = scorings.score,
        rank = scorings.rank
    FROM
        scorings
    WHERE
        submissions.id = scorings.id
),
all_submissions AS (
    SELECT
        name,
        score,
        time,
        day,
        DATE_TRUNC('week', day)::DATE AS week
    FROM
        scorings
    WHERE
        DATE_TRUNC('week', day)::DATE != DATE_TRUNC('week', CURRENT_DATE)::DATE
),
week_names AS (
    SELECT DISTINCT
        week,
        name
    FROM
        all_submissions
),
week_days AS (
    SELECT DISTINCT
        week,
        day
    FROM
        all_submissions
),
week_day_names AS (
    SELECT
        week,
        day,
        name
    FROM
        week_names
    FULL OUTER JOIN
        week_days
    USING
        (week)
),
with_scores AS (
    SELECT
        week,
        day,
        name,
        COALESCE(score, 5) AS score,
        COALESCE(time, 600) AS time
    FROM
        week_day_names
    FULL OUTER JOIN
        all_submissions
    USING
        (week, day, name)
),
weekly AS (
    SELECT
        week,
        name,
        ROUND(EXP(SUM(LN(score))))::INT AS weekly_score,
        SUM(time) AS weekly_time
    FROM
        with_scores
    GROUP BY
        week,
        name
),
weekly_ranked AS (
    SELECT
        week,
        name,
        ROW_NUMBER() OVER (PARTITION BY week ORDER BY weekly_score, weekly_time) AS weekly_rank
    FROM
        weekly
),
winners AS (
    SELECT
        week,
        name
    FROM
        weekly_ranked
    WHERE
        weekly_rank = 1
)
INSERT INTO
    winners(
        week,
        name
    )
SELECT
    week,
    name
FROM
    winners
ON CONFLICT (week)
DO UPDATE
    SET
        week = EXCLUDED.week,
        name = EXCLUDED.name
    `;
    }
    return new Response("", {
      status: 303,
      headers: { location: "/admin" },
    });
  },
};


export default function Page({ data: { players } }: PageProps<Data>) {
  return (
    <div>
      <form method="POST">
        <input
          class="m-4 p-4 rounded-md shadow-md inline-block cursor-pointer hover:bg-gray-200"
          type="submit"
          name="request"
          value="rebuild"
        />
      </form>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Notifications Enabled</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr>
              <td>{player.name}</td>
              <td>{player.email}</td>
              <td>{player.notifications_enabled ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
