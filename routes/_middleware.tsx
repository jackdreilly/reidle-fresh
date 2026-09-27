import { MiddlewareHandler } from "$fresh/server.ts";
import {
  decode,
  encode,
} from "https://deno.land/std@0.182.0/encoding/base64.ts";
import { SessionData } from "@/utils/utils.ts";
import * as cookie from "https://deno.land/std@0.178.0/http/cookie.ts";
import { logPageViewAsync, runRead, runWrite } from "@/utils/db.ts";
import { runSql } from "../utils/sql_files.ts";

export const handler: MiddlewareHandler<SessionData> = async (req, ctx) => {
  const splits = req.url.split("/");
  if (
    splits[splits.length - 1].includes(".") || req.url.includes("_fresh") ||
    req.headers.get("accept") === "text/event-stream"
  ) {
    return ctx.next();
  }
  const name = cookie.getCookies(req.headers)["name"] ?? "";
  const url = req.url.split(/(reillybrothers\.net|:8000)/).slice(-1)[0] ?? "";
  const method = req.method ?? "";
  const page_view_args = {
    name,
    url,
    method,
  };
  console.log(page_view_args);

  ctx.state.name = name;
  if (ctx.state.name === "undefined") {
    ctx.state.name = "";
  }
  if (!ctx.state.name && !req.url.includes("/sign-in")) {
    return new Response("need to sign in", {
      status: 302,
      headers: { location: `/sign-in?redirect=${req.url}` },
    });
  }
  if (req.url.includes("/sign-in")) {
    ctx.state.render = (ctxSuper, data) => ctxSuper.render(data);
    const response = await ctx.next();
    if (req.method === "POST" && ctx.state.name) {
      cookie.setCookie(response.headers, {
        name: "name",
        value: ctx.state.name,
        path: "/",
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  }

  logPageViewAsync(page_view_args);

  const isRead = req.method === "GET" || req.method === "HEAD";
  const runner = isRead ? runRead : runWrite;
  let routeStarted = false;

  try {
    return await runner(async (cxn) => {
      ctx.state.connection = cxn;

      const playedCookie = playedToday(name, req);
      let isPlayed = playedCookie;
      if (!playedCookie && name) {
        isPlayed = await runSql({
          file: "played_today",
          connection: cxn,
          args: { name },
          single_row: true,
        }).then((x) => x.played).catch(() => false);
      }

      ctx.state.playedToday = isPlayed;
      ctx.state.playedTodayPromise = Promise.resolve(isPlayed);

      ctx.state.render = (ctxSuper, data) => {
        return ctxSuper.render({
          ...ctxSuper.state,
          ...data,
          playedToday: isPlayed,
        });
      };
      routeStarted = true;
      const response = await ctx.next();
      if (ctx.state.name) {
        cookie.setCookie(response.headers, {
          name: "name",
          value: ctx.state.name,
          path: "/",
          expires: new Date().getTime() + (1000 * 60 * 60 * 24 * 365),
          maxAge: 60 * 60 * 24 * 365,
        });
      }
      if (!ctx.state.name) {
        cookie.deleteCookie(response.headers, "name", { path: "/" });
        cookie.deleteCookie(response.headers, "playedToday", { path: "/" });
      }
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
    });
  } catch (err) {
    if (routeStarted) {
      throw err;
    }
    console.error("Database connection error in middleware:", (err as Error).message);
    return new Response("Database temporarily unavailable", { status: 503 });
  }
};

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
