import { PoolClient } from "https://deno.land/x/postgres@v0.14.0/mod.ts";
import run from "@/utils/db.ts";

export interface DailySubmission {
  name: string;
  time: number;
  penalty: number;
  paste: string;
  id: number;
}
export type Data = DailySubmission[];

export async function fetchDay(date: Date, cxn?: PoolClient): Promise<Data> {
  const day = date.toISOString().slice(0, 10);
  const submissions = await run((cxn) =>
    cxn.queryObject<
      DailySubmission
    >`
        SELECT
          name, time, penalty, paste, id 
        FROM
          submissions
        WHERE
          day = ${day}
        ORDER BY
          "rank"
      `.then((x) => x.rows), cxn);
  return submissions ?? [];
}
