import { PageProps } from "$fresh/server.ts";
import GameTemplate from "@/components/game_template.tsx";
import PlaybackComponent from "@/islands/playback.tsx";
import { Playback } from "@/utils/playback.ts";
import { SessionHandler } from "@/utils/utils.ts";
interface Data {
  playback: Playback;
}

export const handler: SessionHandler<Data> = {
  async GET(_, ctx) {
    return ctx.render({
      playback: await ctx.state.connection.queryObject<
        { playback: Playback }
      >`select playback from submissions where id = ${ctx.params.id} limit 1`
        .then((x) => x.rows[0].playback),
    });
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
