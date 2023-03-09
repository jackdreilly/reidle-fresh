import { getName, SessionHandler } from "@/utils/utils.ts";
import runDb from "@/utils/db.ts";

export const handler: SessionHandler<null> = {
  async POST(req, ctx) {
    const { time, penalty, playback, word, paste } = await req.json();
    const name = getName(ctx);
    runDb((cxn) => {
      cxn.queryObject<
        {
          name: string;
          time: number;
          penalty: number;
          playback: Record<string, unknown>[];
          word: string;
          paste: string;
        }
      >`
WITH existing AS (
    SELECT
        id,
        time AS "time"
    FROM
        submissions
    WHERE
        DATE(TIMEZONE('UTC', NOW()))
        =
        DATE(TIMEZONE('UTC', created_at))
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
        ) AS rank
    FROM
        unioned
),

scored AS (
    SELECT
        *,
        LEAST(rank, 5) AS score
    FROM
        ranked
),

updates AS (
    UPDATE
    submissions
    SET
        rank = scored.rank,
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
    rank
)
SELECT
    ${name} AS "name",
    ${time} AS "time",
    ${penalty} AS penalty,
    ${playback} AS playback,
    ${word} AS word,
    ${paste} AS paste,
    score AS score,
    rank AS rank
FROM
    scored
WHERE
    id IS NULL
      `;
    });
    return new Response();
  },
};
