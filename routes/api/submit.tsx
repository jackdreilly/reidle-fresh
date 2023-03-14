import sendEmail from "@/utils/mail.ts";
import { getName, SessionHandler, timerTime } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  async POST(req, ctx) {
    const { time, penalty, playback, word, paste } = await req.json();
    const name = getName(ctx);
    if (
      (await ctx.state.connection.queryObject<
        { played: boolean }
      >`
      SELECT
          count(*) > 0 as played
      FROM
          submissions
      WHERE
          name = ${name}
      AND
          day = CURRENT_DATE
      `).rows[0].played
    ) {
      return new Response("Already played", { status: 400 });
    }
    await ctx.state.connection.queryArray`
WITH existing AS (
    SELECT
        id,
        time AS "time"
    FROM
        submissions
    WHERE
        CURRENT_DATE
        =
        day
),

previous AS (
    SELECT
        CAST(NULL AS BIGINT) AS id,
        CAST(${time} AS REAL) AS "time"
),

unioned AS (
    SELECT * FROM existing
    UNION ALL
    SELECT * FROM previous
),

ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            ORDER BY
                "time"
        ) AS "rank"
    FROM
        unioned
),

scored AS (
    SELECT
        *,
        LEAST("rank", 5) AS score
    FROM
        ranked
),

updates AS (
    UPDATE
    submissions
    SET
        "rank" = scored."rank",
        score = scored.score
    FROM
        scored
    WHERE
        submissions.id = scored.id
)

INSERT INTO
submissions(
    name,
    time,
    penalty,
    playback,
    word,
    paste,
    score,
    "rank"
)
SELECT
    ${name} AS "name",
    ${time} AS "time",
    ${penalty} AS penalty,
    ${playback} AS playback,
    ${word} AS word,
    ${paste} AS paste,
    score AS score,
    "rank" AS "rank"
FROM
    scored
WHERE
    id IS NULL
      `;

    await sendEmail(
      `${new Date().getUTCFullYear()}-${
        new Date().getUTCMonth().toString().padStart(2, "0")
      }-${new Date().getUTCDate().toString().padStart(2, "0")}`,
      `${name}: ${timerTime(time)}`,
    );
    return new Response();
  },
};
