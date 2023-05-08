import { PageProps } from "$fresh/server.ts";
import StatsTemplate from "@/components/stats_template.tsx";
import {
  HeadColumn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@/components/tables.tsx";
import { runSql, WeekOutput } from "@/utils/sql_files.ts";
import { SessionData, SessionHandler, timerTime } from "@/utils/utils.ts";
import { Name } from "@/components/daily_table.tsx";

type Data = {
  players: WeekOutput;
  week: Date;
};

export const handler: SessionHandler<Data> = {
  async GET(_, ctx) {
    const week = new Date(ctx.params["startDay"]);
    return ctx.state.render(
      ctx,
      {
        week,
        players: await runSql({
          file: "week_json",
          connection: ctx.state.connection,
          args: { week },
        }),
      },
    );
  },
};

function getColor(v: number): string {
  return {
    1: "rgb(217 249 157)",
    2: "rgb(254 240 138)",
    3: "rgb(254 215 170)",
    4: "rgb(254 202 202)",
  }[v] ??
    "#dddddd";
}

export default function Page(
  { data: { playedToday, players, week, name: myName } }: PageProps<
    Data & SessionData
  >,
) {
  return (
    <StatsTemplate playedToday={playedToday} route="this_week">
      <h1>{week.toISOString().slice(0, 10)}</h1>
      {players.length
        ? (
          <Table>
            <TableHead>
              <HeadColumn>Name</HeadColumn>
              {players[0].results.days.map(({ day }) => (
                <HeadColumn>
                  <a
                    class="text-blue-600 dark:text-blue-500 hover:underline"
                    href={`/stats/daily/${
                      new Date(day).toISOString().slice(0, 10)
                    }`}
                  >
                    {"MTWRFSU"[(new Date(day).getUTCDay() + 6) % 7]}
                  </a>
                </HeadColumn>
              ))}
              <HeadColumn>Π</HeadColumn>
              <HeadColumn>⏱️</HeadColumn>
            </TableHead>
            <TableBody>
              {players.map((
                { name, results: { days, totals: { score, time } } },
                i,
              ) => (
                <TableRow>
                  <TableRowHeader
                    class={name === myName ? "bg-yellow-100" : ""}
                  >
                    <Name name={name} />
                  </TableRowHeader>
                  {days.map(({ score, time, submission_id }) => (
                    <TableCell
                      style={{
                        backgroundColor: getColor(score),
                        padding: 0,
                        textAlign: "center",
                      }}
                    >
                      {!submission_id ? score : (
                        <a
                          class="leading-[35px] w-full block"
                          href={`/submissions/${submission_id}/playback`}
                        >
                          {score}
                        </a>
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    {score < 1000
                      ? score
                      : Math.floor(score).toString().slice(0, 2) + "K"}
                  </TableCell>
                  <TableCell>{timerTime(time)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
        : "No data for this week yet. Check back later!"}
    </StatsTemplate>
  );
}
