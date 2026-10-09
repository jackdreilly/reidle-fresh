import type { PageProps } from "@/router";
import StatsTabs from "@/components/StatsTabs";
import { HeadColumn, Table, TableBody, TableCell, TableHead, TableRow, TableRowHeader } from "@/components/Tables";
import { Name } from "@/components/DailyTable";
import { useSession } from "@/lib/session";
import { timerTime, utcToday } from "@/lib/time";
import type { WeekOutput } from "@/lib/types";

function startOfWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
}

function getLegacyColor(v: number): string {
  return {
    1: "rgb(217 249 157)",
    2: "rgb(254 240 138)",
    3: "rgb(254 215 170)",
    4: "hsl(0deg 96.3% 89.41%)",
    5: "hsl(0deg 96.3% 84.41%)",
    6: "hsl(0deg 96.3% 79.41%)",
    7: "hsl(0deg 96.3% 74.41%)",
    8: "hsl(0deg 96.3% 70.41%)",
    9: "hsl(0deg 96.3% 65.2%)",
  }[v] ??
    "#dddddd";
}

function getPointsColor(v: number): string {
  if (v >= 4) return "rgb(217 249 157)";
  if (v >= 2) return "rgb(254 240 138)";
  if (v >= 1) return "rgb(254 215 170)";
  if (v <= 0) return "#dddddd";
  return {
    "0.7": "hsl(20deg 96.3% 88%)",
    "0.6": "hsl(15deg 96.3% 86%)",
    "0.5": "hsl(10deg 96.3% 85%)",
    "0.4": "hsl(5deg 96.3% 85%)",
    "0.3": "hsl(0deg 96.3% 85%)",
    "0.2": "hsl(0deg 96.3% 80%)",
    "0.1": "hsl(0deg 96.3% 75%)",
  }[v.toFixed(1)] ?? "#dddddd";
}

export default function Weekly({ params, data: { players } }: PageProps<{ players: WeekOutput }>) {
  const { name: myName, played_today } = useSession();
  const week = new Date(params.date);
  const isNewWeek = startOfWeek(week).getTime() >=
    startOfWeek(new Date()).getTime();
  const getColor = isNewWeek ? getPointsColor : getLegacyColor;
  return (
    <StatsTabs route="this_week">
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
              <HeadColumn>{isNewWeek ? "Σ" : "Π"}</HeadColumn>
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
                  {days.map(({ score, time, submission_id, day }) => (
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
                          href={!played_today && day === utcToday()
                            ? undefined
                            : `/submissions/${submission_id}/playback`}
                        >
                          {score}
                        </a>
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    {isNewWeek ? score : (
                      <span title={`${score}`}>
                        {score < 1000
                          ? score
                          : score.toString().slice(0, 1) + "e" +
                            Math.floor(Math.log10(score))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{timerTime(time)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
        : "No data for this week yet. Check back later!"}
    </StatsTabs>
  );
}
