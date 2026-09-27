import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import Rankings from "@/islands/Rankings.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  GET(_, ctx) {
    return ctx.state.render(ctx, null);
  },
};

export default function Page(
  { data: { playedToday } }: PageProps<
    null & SessionData
  >,
) {
  return (
    <ReidleTemplate playedToday={playedToday} route="/rankings" title="Rankings">
      <div class="mb-6">
        <div class="flex items-center gap-2">
          <span class="text-2xl">📈</span>
          <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
            Power Rankings
          </h1>
        </div>
        <p class="text-xs sm:text-sm text-gray-500 mt-1">
          Historical player skill ratings and competitive trends over the past year.
        </p>
      </div>

      <div class="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xs">
        <Rankings />
      </div>
    </ReidleTemplate>
  );
}
