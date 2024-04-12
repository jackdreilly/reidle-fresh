import { MiddlewareHandler } from "$fresh/server.ts";
import {
  decode,
  encode,
} from "https://deno.land/std@0.182.0/encoding/base64.ts";
import { SessionData } from "@/utils/utils.ts";
import * as cookie from "https://deno.land/std@0.178.0/http/cookie.ts";
import { run } from "@/utils/db.ts";
import { runSql } from "../utils/sql_files.ts";

export const handler: MiddlewareHandler<SessionData> = (req, ctx) => {
  const splits = req.url.split("/");
  if (
    splits[splits.length - 1].includes(".") || req.url.includes("_fresh") ||
    req.headers.get("accept") === "text/event-stream" ||
    splits[splits.length - 1].includes(".") || req.url.includes("/api/inngest")
  ) {
    return ctx.next();
  }
  const name = cookie.getCookies(req.headers)["name"] ?? "";
  console.log({ name, url: req.url });
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
  return run(async (cxn) => {
    ctx.state.connection = cxn;
    ctx.state.playedTodayPromise = playedToday(name, req) ? true : runSql({
      file: "played_today",
      connection: cxn,
      args: { name },
      single_row: true,
    }).then((x) => x.played);

    ctx.state.render = async (ctxSuper, data) => {
      ctx.state.playedToday = await ctx.state.playedTodayPromise;
      return ctxSuper.render({
        ...ctxSuper.state,
        ...data,
      });
    };
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
