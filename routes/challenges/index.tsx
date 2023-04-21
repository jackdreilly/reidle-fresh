import { PageProps } from "$fresh/server.ts";
import { Name } from "@/components/daily_table.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { Table, TableCell, TableRow } from "@/components/tables.tsx";
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
      <div class="flex">
        <a
          href="/challenges/play"
          class="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-700 flex gap-2"
        >
          <IconPlayerPlay class="w-6 h-6" />
          {pending_challenges
            ? `${pending_challenges} Pending Challenge${
              pending_challenges > 1 ? "s" : ""
            }!`
            : "Start New Challenge!"}
        </a>
      </div>
      <h1 class="my-4">Today</h1>
      <Table
        columns={["Name", "Score", "W", "L"]}
      >
        {today_leaderboard.map((
          { name, total_points, num_losses, num_wins },
        ) => (
          <TableRow class={name === myName ? "bg-yellow-100" : ""}>
            {[name, total_points, num_wins, num_losses].map((x) => (
              <TableCell>{x}</TableCell>
            ))}
          </TableRow>
        ))}
      </Table>
      <h1 class="my-4">Your Challenges</h1>
      <Table
        columns={["See", "Word", "Time", "Winner", "Others"]}
      >
        {history.map((
          {
            challenge_id,
            time,
            answer,
            winner: { name, time: winning_time },
            players,
          },
        ) => (
          <TableRow class={name === myName ? "bg-green-100" : ""}>
            {[
              <a
                href={`/challenges/challenge/${challenge_id}`}
                type="button"
                class="px-3 py-2 bg-white rounded border(gray-400 1)
            hover:bg-gray-200 flex gap-2"
              >
                <IconEye class="w-6 h-6" />
              </a>,
              <div>{answer}</div>,
              <TimerText seconds={time} />,
              <div>
                <span>
                  <Name name={name} />
                </span>
                <span class="mx-2">
                  <TimerText seconds={winning_time} />
                </span>
              </div>,
              <div>{players.join(", ")}</div>,
            ].map((x) => <TableCell>{x}</TableCell>)}
          </TableRow>
        ))}
      </Table>
      <h1 class="my-4">Yesterday</h1>
      <Table
        columns={["Name", "Score", "W", "L"]}
      >
        {yesterday_leaderboard.map((
          { name, total_points, num_losses, num_wins },
        ) => (
          <TableRow class={name === myName ? "bg-yellow-100" : ""}>
            {[name, total_points, num_wins, num_losses].map((x) => (
              <TableCell>{x}</TableCell>
            ))}
          </TableRow>
        ))}
      </Table>
    </ReidleTemplate>
  );
}
