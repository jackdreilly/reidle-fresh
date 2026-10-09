import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";

interface Data {
  name: string;
}

export const handler: SessionHandler<Data> = {
  GET(_, ctx) {
    return ctx.state.render(ctx, { name: ctx.state.name });
  },
};

export default function Page(
  { data: { name, playedToday } }: PageProps<Data & SessionData>,
) {
  return (
    <ReidleTemplate playedToday={playedToday} route="/account" title="Account">
      <h1 class="text-2xl uppercase">{name}</h1>
    </ReidleTemplate>
  );
}
