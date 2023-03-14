import { PoolClient } from "https://deno.land/x/postgres@v0.14.0/mod.ts";

export interface DailySubmission {
  name: string;
  time: number;
  penalty: number;
  paste: string;
  id: number;
}
export type Data = DailySubmission[];

export async function fetchDay(date: Date, cxn: PoolClient): Promise<Data> {
  const day = date.toISOString().slice(0, 10);
  const response = await cxn.queryObject<
    DailySubmission
  >`
        SELECT
          id, name, time, penalty, paste
        FROM
          submissions
        WHERE
          day = ${day}
        ORDER BY
          "rank"
      `;
  return response.rows;
}
