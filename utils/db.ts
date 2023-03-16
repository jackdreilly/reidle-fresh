import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { Pool, PoolClient } from "https://deno.land/x/postgres@v0.14.0/mod.ts";

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

export function connectionMiddleware(
  _: Request,
  ctx: MiddlewareHandlerContext<{ connection: PoolClient }>,
) {
  return run((cxn) => {
    ctx.state.connection = cxn;
    return ctx.next();
  });
}
