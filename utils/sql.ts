import { sql_files } from "@/utils/sql_files.ts";

type SqlFile = typeof sql_files[number];
type SqlFiles = Record<SqlFile, string>;
export const sql: SqlFiles = await (async () => {
  const x = {} as SqlFiles;
  for (const f of sql_files) {
    x[f] = await Deno.readTextFile(`sql/${f}.sql`);
  }
  return x;
})();
