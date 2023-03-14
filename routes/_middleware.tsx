import { MiddlewareHandlerContext } from "$fresh/server.ts";
import {
  cookieSession,
  WithSession,
} from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
import * as postgres from "https://deno.land/x/postgres@v0.14.0/mod.ts";
import { PoolClient } from "https://deno.land/x/postgres@v0.14.0/mod.ts";

interface WithConnection {
  connection: PoolClient;
}

export type State = unknown & WithSession & WithConnection;

const session = cookieSession();

function sessionHandler(req: Request, ctx: MiddlewareHandlerContext<State>) {
  return session(req, ctx);
}
const pool = new postgres.Pool(Deno.env.get("POLYSCALE_URL")!, 4);
async function connectionHandler(
  req: Request,
  ctx: MiddlewareHandlerContext<State>,
) {
  ctx.state.connection = await pool.connect();
  const response = await sessionHandler(req, ctx);
  ctx.state.connection.release();
  return response;
}
export const handler = [connectionHandler];
