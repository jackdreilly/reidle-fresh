import * as postgres from "https://deno.land/x/postgres@v0.14.0/mod.ts";
const databaseUrl = Deno.env.get("POLYSCALE_URL")!;
const pool = new postgres.Pool(databaseUrl, 3, true);
type Cleanup = () => unknown;
export default async function runDb<T>(
  runner: (
    client: postgres.PoolClient,
    cleanup: (cleanup: Cleanup) => void,
  ) => T | Promise<T>,
): Promise<T | null> {
  try {
    const cxn = await pool.connect();
    const cleanups = [] as Cleanup[];
    const returnValue = await runner(cxn, (x) => cleanups.push(x));
    await pool.end();
    await pool.connect();
    Promise.all(cleanups.map((x) => x())).then(() => cxn.release());
    return returnValue;
  } catch (e) {
    if (e instanceof postgres.ConnectionError) {
      await pool.end();
      await pool.connect();
    }
    return null;
  }
}
