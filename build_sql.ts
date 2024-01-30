await new Deno.Command(
  "dbt",
  { cwd: "reidbt", args: ["compile", "--vars", "{export: true}"] },
).output();
await Deno.mkdir("sql", { recursive: true });
for await (const fileObject of Deno.readDir("sql")) {
  const { name: file } = fileObject;
  if (file.includes("wrapped")) {
    continue;
  }
  await Deno.copyFile(
    `reidbt/target/compiled/reidbt/models/${file}`,
    `sql/${file}`,
  );
}
