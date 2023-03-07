import { HandlerContext } from "$fresh/server.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";

const nameKey = "name";

export function getName<T>(ctx: HandlerContext<T, WithSession>): string {
    return ctx.state.session.get(nameKey) ?? "";
}
export function setName<T>(ctx: HandlerContext<T, WithSession>, name: string) {
    return ctx.state.session.set(nameKey, name);
}