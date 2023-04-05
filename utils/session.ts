import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { SessionData } from "@/utils/utils.ts";
import * as cookie from "https://deno.land/std@0.178.0/http/cookie.ts";

export async function sessionMiddleware(
  req: Request,
  ctx: MiddlewareHandlerContext<SessionData>,
) {
  const name = cookie.getCookies(req.headers)["name"];
  ctx.state.name = name;
  ctx.state.playedToday =
    !!(await ctx.state.connection.queryObject<{ count: number }>`
    SELECT COUNT(*) AS count
    FROM submissions
    WHERE name = ${name}
    AND day = CURRENT_DATE
  `)?.rows[0]?.count;
  ctx.state.render = (ctxSuper, data) =>
    ctxSuper.render({ ...ctxSuper.state, ...data });
  const response = await ctx.next();
  cookie.setCookie(response.headers, {
    name: "name",
    value: ctx.state.name,
    path: "/",
    expires: new Date().getTime() + (1000 * 60 * 60 * 24 * 365),
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
