import * as postgres from "https://deno.land/x/postgres@v0.14.0/mod.ts";
const databaseUrl = Deno.env.get("POLYSCALE_URL")!;
const pool = new postgres.Pool(databaseUrl, 4);
type Runner<T> = (client: postgres.PoolClient) => T | Promise<T>;
export default async function run<T>(
  runner: Runner<T>,
  connection?: postgres.PoolClient,
): Promise<T | null> {
  const doClose = !connection;
  connection ??= await pool.connect();
  let result: T | null = null;
  try {
    result = await runner(connection);
    doClose && connection?.release();
  } catch (e) {
    console.error(e, e.stack);
    doClose && await pool.end();
  }
  return result;
}
