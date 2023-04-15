import { PoolClient } from "https://deno.land/x/postgres@v0.14.0/mod.ts";

interface Submission {
  id: number;
  name: string;
  day: number;
  score: number;
  total_score: number;
  total_time: number;
}
export interface WeekData {
  dates: number[];
  names: string[];
  ids: number[][];
  table: number[][];
  startDay: Date;
}
export async function fetchWeek(
  startDay: Date,
  connection: PoolClient,
): Promise<WeekData> {
  const endDay = new Date(startDay);
  endDay.setDate(endDay.getDate() + 6);
  const submissions = await connection.queryObject<Submission>`
    WITH last_week AS (
        SELECT
            id,
            name,
            time,
            score,
            EXTRACT(ISODOW FROM day)::INT AS day
        FROM
            submissions
        WHERE
            day BETWEEN ${startDay} AND ${endDay}
        AND
            challenge_id IS NULL
    ),

    name_day_ids AS (
      SELECT DISTINCT id, name, day FROM last_week
    ),
    
    all_days AS (
        SELECT DISTINCT day
        FROM last_week
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
    
    totals AS (
        SELECT
            name,
            SUM(time_filled) AS total_time,
            EXP(SUM(LN(score_filled))) AS total_score
        FROM
            expanded
        GROUP BY
            1
    )
    
    SELECT
        id,
        day,
        name,
        score_filled AS score,
        total_score::INT AS total_score,
        total_time::INT AS total_time
    FROM
        totals
    NATURAL INNER JOIN expanded
    NATURAL INNER JOIN name_day_ids
    ORDER BY
      total_score,
      day,
      total_time
      `.then((x) => x.rows);
  const dates = Array.from(
    new Set<number>(submissions.map((s) => s.day)),
  ).toSorted();
  const names = [] as string[];
  for (const { name } of submissions) {
    if (names.includes(name)) {
      continue;
    }
    names.push(name);
  }
  const dateLookup = Object.fromEntries(dates.map((d, i) => [d, i + 2]));
  const nameLookup = Object.fromEntries(names.map((d, i) => [d, i]));
  const table = names.map((_) => ["", "", ...dates].map((_) => 5));
  const ids = names.map((_) => ["", "", ...dates].map((_) => -1));
  for (
    const { day, score, total_score, name, total_time, id } of submissions
  ) {
    const name_index = nameLookup[name];
    const date_index = dateLookup[day];
    const row = table[name_index];
    row[date_index] = score;
    row[0] = total_score;
    row[1] = total_time;
    ids[name_index][date_index] = id;
  }
  return {
    dates,
    table,
    names,
    startDay,
    ids,
  };
}
