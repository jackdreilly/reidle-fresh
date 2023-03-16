import { asset } from "$fresh/runtime.ts";
import { Handlers } from "$fresh/server.ts";
import { PoolClient } from "https://deno.land/x/postgres@v0.14.0/mod.ts";

type SessionData = {
  connection: PoolClient;
  name: string;
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
