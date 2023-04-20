import { sql_files } from "@/utils/sql_files.ts";
await Deno.run({
  cmd: ["dbt", "compile", "--vars", "{export: true}"],
  cwd: "reidbt",
}).status();
await Deno.mkdir("sql", { recursive: true });
for (const file of sql_files) {
  await Deno.copyFile(
    `reidbt/target/compiled/reidbt/models/${file}.sql`,
    `sql/${file}.sql`,
  );
}
