import { MiddlewareHandlerContext } from "$fresh/server.ts";
import * as cookie from "https://deno.land/std@0.178.0/http/cookie.ts";

export async function sessionMiddleware(
  req: Request,
  ctx: MiddlewareHandlerContext<{ name: string }>,
) {
  const name = cookie.getCookies(req.headers)["name"];
  if (!name) {
    if (!req.url.includes("sign-in") && !req.url.includes("inngest")) {
      return new Response("need to sign in", {
        status: 302,
        headers: { location: "/sign-in" },
      });
    }
  }
  ctx.state.name = name;
  const response = await ctx.next();
  cookie.setCookie(response.headers, {
    name: "name",
    value: ctx.state.name,
    path: "/",
  });
  return response;
}
