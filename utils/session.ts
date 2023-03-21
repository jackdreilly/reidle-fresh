import { MiddlewareHandlerContext } from "$fresh/server.ts";
import * as cookie from "https://deno.land/std@0.178.0/http/cookie.ts";

export async function sessionMiddleware(
  req: Request,
  ctx: MiddlewareHandlerContext<{ name: string }>,
) {
  const name = cookie.getCookies(req.headers)["name"];
  ctx.state.name = name;
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
