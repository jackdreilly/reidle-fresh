import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import { BattleHomePage, runSql } from "../utils/sql_files.ts";
import moment from "npm:moment";

export const handler: SessionHandler<BattleHomePage> = {
  async GET(req, ctx) {
    const data = await runSql({
      file: "battle_home_page",
      connection: ctx.state.connection,
      single_row: true,
    });
    return ctx.state.render(ctx, data ?? {
      users: [],
      updated_at: new Date(0),
      active_battles: [],
    });
  },
};

export default function Page(
  { data: { playedToday, users = [], updated_at, active_battles = [] } }: PageProps<
    BattleHomePage & SessionData
  >,
) {
  const updatedDate = updated_at ? new Date(updated_at) : null;
  const isRecent = updatedDate && (new Date().getTime() - updatedDate.getTime()) < 1000 * 30;

  return (
    <ReidleTemplate route="/battles" title="Battles" playedToday={playedToday}>
      <div class="mb-8">
        <div class="flex items-center gap-2">
          <span class="text-2xl">⚔️</span>
          <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
            Wordle Battles
          </h1>
        </div>
        <p class="text-sm text-gray-500 mt-1 max-w-xl">
          Real-time head-to-head multiplayer Wordle races. First player to guess the secret word wins the round!
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Party Room Card */}
        <div class="bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 rounded-2xl border border-emerald-200/80 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <span class="text-xs uppercase font-extrabold tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full">
                Public Arena
              </span>
              <div class="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <span
                  class={`w-2.5 h-2.5 rounded-full ${
                    isRecent ? "bg-emerald-500 animate-pulse" : "bg-gray-300"
                  }`}
                />
                <span>{isRecent ? "Active Now" : "Open 24/7"}</span>
              </div>
            </div>

            <h2 class="text-xl font-black text-gray-900 mb-2">
              The Party Room
            </h2>
            <p class="text-xs text-gray-600 mb-4 leading-relaxed">
              Hop in and battle whoever is online. Automatic round restarts, live scoreboard, and in-game party chat!
            </p>

            {/* Active Players Chips */}
            {isRecent && users.length > 0 && (
              <div class="mb-5 bg-white/80 border border-emerald-100 rounded-xl p-3">
                <div class="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1.5">
                  Players in room ({users.length}):
                </div>
                <div class="flex flex-wrap gap-1.5">
                  {users.map((u) => (
                    <span
                      key={u}
                      class="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md text-xs font-semibold border border-emerald-200"
                    >
                      {u}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <a
            href="/battles/party_room"
            class="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold text-sm shadow-sm transition-all"
          >
            <span>⚔️</span>
            <span>Join Party Room</span>
          </a>
        </div>

        {/* Private Room Card */}
        <div class="bg-gradient-to-br from-purple-50/80 via-white to-purple-50/30 rounded-2xl border border-purple-200/80 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <span class="text-xs uppercase font-extrabold tracking-wider text-purple-800 bg-purple-100/80 px-2.5 py-1 rounded-full">
                Custom Match
              </span>
              <span class="text-xs font-medium text-gray-500">
                Invite-only
              </span>
            </div>

            <h2 class="text-xl font-black text-gray-900 mb-2">
              Private Room
            </h2>
            <p class="text-xs text-gray-600 mb-4 leading-relaxed">
              Create a dedicated battle room with a shareable URL to play exclusively with your coworkers or friends.
            </p>

            {/* Active Private Rooms */}
            {active_battles.length > 0 && (
              <div class="mb-5 bg-white/80 border border-purple-100 rounded-xl p-3">
                <div class="text-[11px] font-bold text-purple-800 uppercase tracking-wider mb-2">
                  Active Rooms ({active_battles.length}):
                </div>
                <div class="space-y-1.5 max-h-36 overflow-y-auto">
                  {active_battles.map(({ battle_id, users }) => (
                    <a
                      key={battle_id}
                      href={`/battles/${battle_id}`}
                      class="flex items-center justify-between px-3 py-2 bg-purple-50/60 hover:bg-purple-100/70 border border-purple-200/80 rounded-lg text-xs font-semibold text-purple-900 transition-colors"
                    >
                      <span class="truncate max-w-[180px]">
                        Room #{battle_id}: {users.join(", ")}
                      </span>
                      <span class="text-purple-700 font-bold shrink-0">Join →</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <a
            href="/battles/new"
            class="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 hover:bg-purple-700 active:scale-98 text-white rounded-xl font-bold text-sm shadow-sm transition-all"
          >
            <span>🔒</span>
            <span>Create Private Room</span>
          </a>
        </div>
      </div>
    </ReidleTemplate>
  );
}
