import { PoolClient } from "https://deno.land/x/postgres@v0.14.0/mod.ts";

interface Result {
  name: string;
}

export default async function getWinner(cxn: PoolClient): Promise<string> {
  const name = await cxn.queryObject<Result>`
            SELECT
                name
            FROM
                winners
            WHERE
                week = DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7' day
            LIMIT
                1`
    .then((x) => x.rows[0]?.name);
  if (name) {
    return name;
  }
  return cxn.queryObject<Result>`
WITH last_day AS (
    SELECT
        (DATE_TRUNC('week', now())::DATE - interval '1' day)::DATE as last_day,
        (DATE_TRUNC('week', now())::DATE - interval '7' day)::DATE as start_day
),

last_week AS (
    SELECT
        name,
        time,
        score,
        day
    FROM
        submissions, last_day
    WHERE
        day BETWEEN start_day AND last_day
    AND
        challenge_id IS NULL
),

all_days AS (
    SELECT DISTINCT day
    FROM last_week
    ORDER BY 1
),

all_names AS (
    SELECT DISTINCT name FROM last_week
),

crossed AS (
    SELECT * FROM all_days, all_names
),

expanded AS (
    SELECT
        *,
        COALESCE(score, 5) AS score_filled,
        COALESCE(time, 300) AS time_filled
    FROM
        last_week NATURAL FULL OUTER JOIN crossed
),

winner AS (
    SELECT name
    FROM
        expanded
    GROUP BY
        1
    ORDER BY
        EXP(SUM(LN(score_filled))),
        SUM(time_filled)
    LIMIT
        1
)

INSERT INTO
winners(
    name,
    week
)
SELECT
    name,
    start_day
FROM
    winner,
    last_day
RETURNING
    name
        `.then((x_1) => x_1.rows[0]?.name);
}
