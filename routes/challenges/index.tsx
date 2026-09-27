import { PageProps } from "$fresh/server.ts";
import { Name } from "@/components/daily_table.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { Table, TableBody, TableCell, TableRow } from "@/components/tables.tsx";
import TimerText from "@/components/timer_text.tsx";
import { runSql, Schemas } from "@/utils/sql_files.ts";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import IconEye from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/eye.tsx";
import IconPlayerPlay from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/player-play.tsx";

type Data = Schemas["challenges_json"]["output"];

export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    const { state: { name } } = ctx;
    return ctx.state.render(
      ctx,
      await runSql({
        file: "challenges_json",
        connection: ctx.state.connection,
        args: { name },
        single_row: true,
      }),
    );
  },
};

export default function Page(
  {
    data: {
      playedToday,
      today_leaderboard,
      yesterday_leaderboard,
      history,
      name: myName,
      pending_challenges,
    },
  }: PageProps<
    Data & SessionData
  >,
) {
  return (
    <ReidleTemplate
      playedToday={playedToday}
      route="/challenges"
      title="Challenges"
    >
      {/* Header & Primary Action */}
      <div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-2xl">🎯</span>
            <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
              Wordle Challenges
            </h1>
          </div>
          <p class="text-xs sm:text-sm text-gray-500 mt-1">
            Head-to-head asynchronous races against friends on the same secret word.
          </p>
        </div>

        <a
          href="/challenges/play"
          class="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all self-start sm:self-auto"
          style={{ backgroundColor: "#059669", color: "#ffffff" }}
        >
          <IconPlayerPlay class="w-5 h-5" />
          <span>
            {pending_challenges
              ? `${pending_challenges} Pending Challenge${
                pending_challenges > 1 ? "s" : ""
              }!`
              : "Start New Challenge"}
          </span>
        </a>
      </div>

      <div class="space-y-8">
        {/* Today's Leaderboard */}
        <div>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <span>☀️</span>
              <span>Today's Standings</span>
            </h2>
            <span class="text-xs text-gray-400 font-medium">Daily points</span>
          </div>

          <Table columns={["Player", "Points", "Wins", "Losses"]}>
            <TableBody>{today_leaderboard.length === 0 ? (
              <TableRow>
                <TableCell class="text-center py-6 text-gray-400 italic">
                  No challenges played today yet.
                </TableCell>
              </TableRow>
            ) : (
              today_leaderboard.map(
                ({ name, total_points, num_losses, num_wins }) => (
                  <TableRow class={name === myName ? "bg-emerald-50/70 font-semibold" : ""}>
                    <TableCell>
                      <Name name={name} />
                    </TableCell>
                    <TableCell class="font-mono font-bold text-gray-900">
                      {total_points}
                    </TableCell>
                    <TableCell class="font-mono text-emerald-700 font-bold">
                      {num_wins}
                    </TableCell>
                    <TableCell class="font-mono text-gray-500">
                      {num_losses}
                    </TableCell>
                  </TableRow>
                ),
              )
            )}</TableBody>
          </Table>
        </div>

        {/* Your Challenges History */}
        <div>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <span>📜</span>
              <span>Your Recent Challenges</span>
            </h2>
            <span class="text-xs text-gray-400 font-medium">{history.length} completed</span>
          </div>

          <Table columns={["Action", "Word", "Your Time", "Winner", "Opponents"]}>
            <TableBody>{history.length === 0 ? (
              <TableRow>
                <TableCell class="text-center py-6 text-gray-400 italic">
                  You haven't played any challenges yet. Start one above!
                </TableCell>
              </TableRow>
            ) : (
              history.map(
                ({
                  challenge_id,
                  time,
                  answer,
                  winner: { name, time: winning_time },
                  players,
                }) => {
                  const iWon = name === myName;
                  return (
                    <TableRow class={iWon ? "bg-emerald-50/50" : ""}>
                      <TableCell>
                        <a
                          href={`/challenges/challenge/${challenge_id}`}
                          class="inline-flex items-center justify-center p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors shadow-2xs"
                          title="View challenge details"
                        >
                          <IconEye class="w-4 h-4" />
                        </a>
                      </TableCell>
                      <TableCell class="font-mono font-bold uppercase tracking-wider text-gray-900">
                        {answer}
                      </TableCell>
                      <TableCell class="font-mono text-gray-700">
                        <TimerText seconds={time} />
                      </TableCell>
                      <TableCell>
                        <div class="flex items-center gap-1.5">
                          <Name name={name} />
                          <span class="font-mono text-xs text-gray-400">
                            (<TimerText seconds={winning_time} />)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell class="text-xs text-gray-500 truncate max-w-[200px]">
                        {players.join(", ")}
                      </TableCell>
                    </TableRow>
                  );
                },
              )
            )}</TableBody>
          </Table>
        </div>

        {/* Yesterday's Leaderboard */}
        {yesterday_leaderboard.length > 0 && (
          <div>
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                <span>⏮️</span>
                <span>Yesterday's Results</span>
              </h2>
            </div>

            <Table columns={["Player", "Points", "Wins", "Losses"]}>
              <TableBody>{yesterday_leaderboard.map(
                ({ name, total_points, num_losses, num_wins }) => (
                  <TableRow class={name === myName ? "bg-emerald-50/70 font-semibold" : ""}>
                    <TableCell>
                      <Name name={name} />
                    </TableCell>
                    <TableCell class="font-mono font-bold text-gray-900">
                      {total_points}
                    </TableCell>
                    <TableCell class="font-mono text-emerald-700 font-bold">
                      {num_wins}
                    </TableCell>
                    <TableCell class="font-mono text-gray-500">
                      {num_losses}
                    </TableCell>
                  </TableRow>
                ),
              )}</TableBody>
            </Table>
          </div>
        )}
      </div>
    </ReidleTemplate>
  );
}
