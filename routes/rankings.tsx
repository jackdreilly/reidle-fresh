import { RouteContext } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import Rankings from "@/islands/Rankings.tsx";
import { SessionData } from "@/utils/utils.ts";

export default async function rankings(
  req: Request,
  ctx: RouteContext<null, SessionData>,
) {
  return (
    <ReidleTemplate
      playedToday={ctx.state.playedToday}
      route="/rankings"
      title="Wrapped"
    >
      <Rankings />
    </ReidleTemplate>
  );
}
