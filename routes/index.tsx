import { Handlers, PageProps } from "$fresh/server.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";

interface Session {
  name?: string
}
export type Data = { session: Session };

export const handler: Handlers<
  Data,
  WithSession
> = {
  GET(_req, ctx) {
    return ctx.render({
      session: ctx.state.session.data
    });
  },
};

export default function Home({ data: { session: { name } } }: PageProps<Data>) {
  return name ? <>{name}</> : <a href="set-name">Set Name</a>
}