import { Handlers, PageProps } from "$fresh/server.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";

interface Data {
  name: string
}

export const handler: Handlers<
  Data,
  WithSession
> = {
  GET(req, ctx) {
    const name = (new URL(req.url)).searchParams.get("name");
    if (name) {
      ctx.state.session.set('name', name);
      return new Response("", {
        status: 307,
        headers: { Location: "/" },
      });
    }
    return ctx.render({ name: "" });
  }
};

export default function Page({ data: { name } }: PageProps<Data>) {
  return (
    <form>
      <input type="text" placeholder="Your name" name="name" value={name} />
      <button type="submit">Set Name</button>
    </form>
  );
}