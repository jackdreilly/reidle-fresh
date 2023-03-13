import * as postgres from "https://deno.land/x/postgres@v0.14.0/mod.ts";
const databaseUrl = Deno.env.get("POLYSCALE_URL")!;
const pool = new postgres.Pool(databaseUrl, 4);
type Runner<T> = (client: postgres.Client) => Promise<T> | T;
export default async function run<T>(runner: Runner<T>): Promise<T | null> {
  const connection = await pool.connect();
  let result: T | null = null;
  try {
    result = await runner(connection);
    connection.release();
  } catch (e) {
    console.error(e, e.stack);
    await pool.end();
  }
  return result;
}
