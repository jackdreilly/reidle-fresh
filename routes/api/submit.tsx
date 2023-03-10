import { getName, SessionHandler, timerTime } from "@/utils/utils.ts";
import run from "../../utils/db.ts";
import sendEmail from "../../utils/mail.ts";

export const handler: SessionHandler<null> = {
  async POST(req, ctx) {
    const { time, penalty, playback, word, paste } = await req.json();
    const name = getName(ctx);
    const success = await run(async (cxn) => {
      const response = await cxn.queryObject<{ name: string; count: number }>`
        SELECT
            id, name
        FROM
            submissions
        WHERE
            name = ${name}
        AND
            day = CURRENT_DATE
        `;
      if (response.rowCount ?? 0) {
        return false;
      }
      await cxn.queryObject<
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

      await sendEmail(
        `${new Date().getUTCFullYear()}-${
          new Date().getUTCMonth().toString().padStart(2, "0")
        }-${new Date().getUTCDate().toString().padStart(2, "0")}`,
        `${name}: ${timerTime(time)}`,
      );
      return true;
    });
    if (success) {
      return new Response();
    }
    return new Response(`${name} already played`, { status: 400 });
  },
};
