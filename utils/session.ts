import { MiddlewareHandlerContext } from "$fresh/server.ts";
import {
  decode,
  encode,
} from "https://deno.land/std@0.182.0/encoding/base64.ts";
import { SessionData } from "@/utils/utils.ts";
import * as cookie from "https://deno.land/std@0.178.0/http/cookie.ts";

export async function sessionMiddleware(
  req: Request,
  ctx: MiddlewareHandlerContext<SessionData>,
) {
  const name = cookie.getCookies(req.headers)["name"];
  ctx.state.name = name;
  ctx.state.playedToday = playedToday(name, req) ||
    (await ctx.state.connection.queryObject<{ count: number }>`
  SELECT COUNT(*) AS "count"
  FROM submissions
  WHERE
    CURRENT_DATE = day
    AND name = ${name}
    `.then((x) => x.rows[0].count > 0));
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
  if (ctx.state.playedToday) {
    cookie.setCookie(response.headers, {
      name: "playedToday",
      value: encode(JSON.stringify({
        name: ctx.state.name,
        isoDate: new Date().toISOString(),
      })),
      path: "/",
      expires: new Date().getTime() + (1000 * 60 * 60 * 24),
      maxAge: 60 * 60 * 24,
    });
  }
  return response;
}

function playedToday(
  name: string,
  req: Request,
): boolean {
  if (!name) {
    return false;
  }
  const playedTodayCookie = cookie.getCookies(req.headers)["playedToday"] as
    | string
    | undefined;
  if (!playedTodayCookie) {
    return false;
  }
  let parsed: { name: string; isoDate: string };
  try {
    parsed = JSON.parse(new TextDecoder().decode(decode(playedTodayCookie)));
  } catch {
    return false;
  }
  if (parsed.name !== name) {
    return false;
  }
  const date = new Date(parsed.isoDate);
  if (isNaN(date.getTime())) {
    return false;
  }
  const now = new Date();
  if (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  ) {
    return true;
  }
  return false;
}
