import { asset } from "$fresh/runtime.ts";
import { HandlerContext, Handlers } from "$fresh/server.ts";
import { PoolClient } from "https://deno.land/x/postgres@v0.14.0/mod.ts";

export type SessionData = {
  connection: PoolClient;
  name: string;
  playedToday: boolean;
  render<T>(
    ctx: HandlerContext<T, SessionData>,
    data: T,
  ): Promise<Response> | Response;
};

export type SessionHandler<T> = Handlers<
  T,
  SessionData
>;
export async function readAsset(
  path: string,
  server: boolean,
): Promise<string> {
  return server
    ? Deno.readTextFile("static/" + path)
    : (await fetch(asset(path))).text();
}

export function timerTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const totalMillis = Math.round(1000 * (totalSeconds - 60 * minutes));
  const seconds = Math.floor(totalMillis / 1000);
  const millis = 0 * totalMillis % 1000;
  return `${minutes}:${seconds.toString().padStart(2, "0")}${
    millis ? "." + millis.toString().slice(0, 3).padStart(3, "0") : ""
  }`;
}

type JSONable =
  | boolean
  | string
  | number
  | undefined
  | null
  | JSONArray
  | JSONObject;

type JSONArray = JSONable[];
interface JSONObject {
  [x: string]: JSONable;
}

export function jsonResponse(json: JSONable): Response {
  return new Response(JSON.stringify(json), {
    headers: { "Content-Type": "application/json" },
  });
}

export function guardLogin(
  { state: { name } }: { state: { name: string } },
): Response | undefined {
  if (!name) {
    return new Response("need to sign in", {
      status: 302,
      headers: { location: "/sign-in" },
    });
  }
}
export function guardNotPlayed(
  played: boolean,
): Response | undefined {
  if (played) {
    return new Response("Already played", {
      status: 307,
      headers: { location: "/" },
    });
  }
}
type Message = unknown;
export function spy<T>(t: T, ...messages: Message[]): T {
  console.log(...messages, t);
  return t;
}
