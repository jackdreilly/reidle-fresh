import runDb from "@/utils/db.ts";

interface Submission {
  name: string;
  play_date: string;
  score: number;
  total_score: number;
  total_time: number;
}
export interface WeekData {
  dates: number[];
  names: string[];
  table: number[][];
  thisWeek: boolean;
}
export async function fetchWeek(thisWeek: boolean): Promise<WeekData> {
  const offsetDays = thisWeek ? 7 : 0;
  const submissions = await runDb((connection) =>
    connection.queryObject`
      WITH last_day AS (
        SELECT
            TIMEZONE(
                'UTC', NOW()
            )::DATE + ${offsetDays}::INTEGER - EXTRACT(
                DOW FROM TIMEZONE('UTC', NOW())::DATE
            )::INTEGER AS last_day,
            TIMEZONE(
                'UTC', NOW()
            )::DATE + ${offsetDays}::INTEGER - EXTRACT(
                DOW FROM TIMEZONE('UTC', NOW())::DATE
            )::INTEGER - 6 AS start_day
    
    ),
    
    last_week AS (
        SELECT
            name,
            time,
            score,
            EXTRACT(ISODOW FROM TIMEZONE('UTC', created_at)::DATE)::INT AS play_date
        FROM
            submissions, last_day
        WHERE
            TIMEZONE('UTC', created_at)::DATE BETWEEN start_day AND last_day
    ),
    
    all_days AS (
        SELECT DISTINCT play_date
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
        play_date,
        name,
        score_filled AS score,
        total_score::INT AS total_score,
        total_time::INT AS total_time
    FROM
        totals
    NATURAL INNER JOIN expanded ORDER BY play_date, total_score, total_time    
      `.then((x) => x.rows as Submission[])
  );
  const dates = Array.from(
    new Set<number>(submissions.map((s) => parseInt(s.play_date))),
  ).toSorted();
  const names = [] as string[];
  for (const { name } of submissions) {
    if (names.includes(name)) {
      break;
    }
    names.push(name);
  }
  const dateLookup = Object.fromEntries(dates.map((d, i) => [d, i + 2]));
  const nameLookup = Object.fromEntries(names.map((d, i) => [d, i]));
  const table = names.map((_) => ["", "", ...dates].map((_) => 0));
  for (
    const { play_date, score, total_score, name, total_time } of submissions
  ) {
    table[nameLookup[name]][dateLookup[parseInt(play_date)]] = score;
    table[nameLookup[name]][0] = total_score;
    table[nameLookup[name]][1] = total_time;
  }
  return {
    dates,
    table,
    names,
    thisWeek,
  };
}
