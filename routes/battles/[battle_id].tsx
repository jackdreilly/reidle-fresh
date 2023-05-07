import { SessionHandler } from "@/utils/utils.ts";
import ReidleTemplate from "../../components/reidle_template.tsx";
import { PageProps } from "https://deno.land/x/fresh@1.1.5/server.ts";
import Battle from "../../islands/Battle.tsx";
interface Data {
  battle_id: number;
}
export const handler: SessionHandler<Data> = {
  GET(req, ctx) {
    const { battle_id: bidString } = ctx.params;
    const battle_id = parseInt(bidString);
    return ctx.state.render(ctx, { battle_id });
  },
};
export default function Page(
  { data: { battle_id, playedToday } }: PageProps<
    { battle_id: number } & { playedToday: boolean }
  >,
) {
  return (
    <ReidleTemplate
      route="/battles"
      title="Battle"
      fullPage={true}
      playedToday={playedToday}
    >
      <Battle battle_id={battle_id} />
    </ReidleTemplate>
  );
}
