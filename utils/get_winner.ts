import runDb from "@/utils/db.ts";

interface Result {
  name: string;
}

export default function getWinner(): Promise<string> {
  return runDb(async (cxn) => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    const results = (await cxn
      .queryObject`select name from winners where week > ${d} limit 1`)
      .rows as Result[];
    if (results.length) {
      return results[0].name;
    }
    return cxn.queryObject`
WITH last_day AS (
    SELECT
        TIMEZONE(
            'UTC', NOW()
        )::DATE - EXTRACT(
            DOW FROM TIMEZONE('UTC', NOW())::DATE
        )::INTEGER AS last_day,
        TIMEZONE(
            'UTC', NOW()
        )::DATE - EXTRACT(
            DOW FROM TIMEZONE('UTC', NOW())::DATE
        )::INTEGER - 6::INTEGER AS start_day

),

last_week AS (
    SELECT
        name,
        time,
        score,
        TIMEZONE('UTC', created_at)::DATE AS play_date
    FROM
        submissions, last_day
    WHERE
        TIMEZONE('UTC', created_at)::DATE BETWEEN start_day AND last_day
),

all_days AS (
    SELECT DISTINCT play_date
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
        `.then((s) => (s.rows as Result[])[0]?.name ?? "no winner");
  });
}
