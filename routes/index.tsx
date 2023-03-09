import { Handlers, PageProps } from "$fresh/server.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { getName } from "@/utils/utils.ts";
import getWinner from "@/utils/get_winner.ts";

interface Data {
  name: string;
  winner: string;
}

export const handler: Handlers<
  Data,
  WithSession
> = {
  async GET(_req, ctx) {
    return ctx.render({ name: getName(ctx), winner: await getWinner() });
  },
};

export default function Home(
  { data: { name, winner } }: PageProps<Data>,
) {
  return (
    <ReidleTemplate>
      Welcome to Reidle, <strong>{name}</strong>!
      {!name ? "Make sure to set your name to play" : null}
      <div>
        Last week's winner: {winner}
      </div>
    </ReidleTemplate>
  );
}
