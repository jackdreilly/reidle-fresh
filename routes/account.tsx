import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
interface Data {}

export const handler: SessionHandler<Data> = {
  async GET(_, ctx) {
    return ctx.state.render(ctx, {});
  },
};

export default function Page(
  {
    data: {
      name,
      playedToday,
    },
  }: PageProps<
    Data & SessionData
  >,
) {
  return (
    <ReidleTemplate playedToday={playedToday} route="/account" title="Account">
      <div class="max-w-md">
        <div class="mb-6 flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center uppercase shadow-sm">
            {name.slice(0, 2)}
          </div>
          <div>
            <h1 class="text-2xl font-black tracking-tight text-gray-900 uppercase">
              {name}
            </h1>
            <p class="text-xs text-gray-400">Reidle Player Profile</p>
          </div>
        </div>

        <div class="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
          <p class="text-sm text-gray-600">
            Your player name is set when you sign in.
          </p>
          <div class="pt-4 mt-4 border-t border-gray-100">
            <a
              href="/sign-out"
              class="inline-flex text-xs text-red-600 hover:text-red-800 font-bold px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              Sign Out
            </a>
          </div>
        </div>
      </div>
    </ReidleTemplate>
  );
}
