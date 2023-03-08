import { Handlers, PageProps } from "$fresh/server.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { getName } from "@/utils/utils.ts";

export const handler: Handlers<
  string,
  WithSession
> = {
  GET(_req, ctx) {
    return ctx.render(getName(ctx));
  },
};

export default function Home({ data: name }: PageProps<string>) {
  return (
    <ReidleTemplate>
      Welcome to Reidle, <strong>{name}</strong>!
      {!name ? "Make sure to set your name to play" : null}
    </ReidleTemplate>
  );
}
