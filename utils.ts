import { HandlerContext } from "https://deno.land/x/fresh@1.0.1/src/server/mod.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";

const nameKey = "name";

export function getName<T>(ctx: HandlerContext<T, WithSession>): string {
    return ctx.state.session.get(nameKey) ?? "";
}
export function setName<T>(ctx: HandlerContext<T, WithSession>, name: string) {
    return ctx.state.session.set(nameKey, name);
}