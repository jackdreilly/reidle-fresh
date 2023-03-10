import { HandlerContext, Handlers } from "$fresh/server.ts";
import { asset } from "$fresh/runtime.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";

const nameKey = "name";

export function getName<T>(ctx: HandlerContext<T, WithSession>): string {
  return ctx.state.session.get(nameKey) ?? "";
}
export function setName<T>(ctx: HandlerContext<T, WithSession>, name: string) {
  return ctx.state.session.set(nameKey, name);
}
export type SessionHandler<T> = Handlers<T, WithSession>;
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
    millis ? "." + millis.toString().slice(0,3).padStart(3, "0") : ""
  }`;
}

export default function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
) {
  const body = String.raw({ raw: strings }, ...values);
  return new Response(body, { headers: { "Content-Type": "text/html" } });
}
