import { runSql } from "@/utils/sql_files.ts";
import { PoolClient } from "psql";

export default async function getWinner(
  connection: PoolClient,
): Promise<string> {
  return (await runSql({
    file: "current_winner",
    connection,
    single_row: true,
  })).name;
}
