import { Pool, PoolClient } from "psql";

const pool = new Pool(Deno.env.get("POSTGRES_URL")!, 4, true);
export async function run<T>(
  runner: (cxn: PoolClient) => Promise<T> | T,
): Promise<T> {
  const connection = await (async () => {
    try {
      return pool.connect();
    } catch (e) {
      console.error(e, e.stack);
      await pool.end();
      return pool.connect();
    }
  })();
  const result = await runner(connection);
  connection.release();
  return result;
}
