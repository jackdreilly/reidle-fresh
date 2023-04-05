import { sendEmail } from "@/routes/api/inngest.ts";
import { SessionHandler, timerTime } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  async POST(req, ctx) {
    const { time, penalty, playback, word, paste } = await req.json();
    const name = ctx.state.name;
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
        LEAST("rank", 4) AS score
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

    const subject = `${new Date().getUTCFullYear()}-${
      (new Date().getUTCMonth() + 1).toString().padStart(2, "0")
    }-${new Date().getUTCDate().toString().padStart(2, "0")}`;
    const text = `${name}: ${timerTime(time)}`;
    await sendEmail(
      { subject, text },
    );
    return new Response();
  },
};
