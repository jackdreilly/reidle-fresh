import { PageProps } from "$fresh/server.ts";
import { Playback } from "@/utils/playback.ts";
import { SessionHandler } from "@/utils/utils.ts";
import GameTemplate from "../../../components/game_template.tsx";
import PlaybackComponent from "../../../islands/playback.tsx";
import run from "../../../utils/db.ts";
interface Data {
  playback: Playback;
}

export const handler: SessionHandler<Data> = {
  async GET(_, ctx) {
    const playback = await run(async (cxn) => {
      const response = await cxn.queryObject<
        { playback: Playback }
      >`select playback from submissions where id = ${ctx.params.id} limit 1`;
      return response.rows[0].playback;
    }) ?? { events: [] };
    return ctx.render({ playback });
  },
};

export default function Page(
  { data: { playback: { events } } }: PageProps<Data>,
) {
  return (
    <GameTemplate title="Playback" isPractice={false}>
      <PlaybackComponent events={events} />
    </GameTemplate>
  );
}
