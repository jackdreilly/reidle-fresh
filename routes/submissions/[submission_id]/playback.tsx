import { PageProps } from "$fresh/server.ts";
import GameTemplate from "@/components/game_template.tsx";
import PlaybackComponent from "@/islands/playback.tsx";
import { Playback } from "@/utils/playback.ts";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
interface Data {
  playback: Playback;
}

export const handler: SessionHandler<Data> = {
  async GET(r, ctx) {
    return ctx.state.render(ctx, {
      playback: await ctx.state.connection.queryObject<
        { playback: Playback }
      >`select playback from submissions where submission_id = ${ctx.params.submission_id} limit 1`
        .then((x) => x.rows[0].playback),
    });
  },
};

export default function Page(
  { data: { playedToday, playback: { events } } }: PageProps<
    Data & SessionData
  >,
) {
  return (
    <GameTemplate title="Playback" isPractice={false} playedToday={playedToday}>
      <PlaybackComponent events={events} />
    </GameTemplate>
  );
}
