import {
  HeadColumn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@/components/tables.tsx";
import { timerTime } from "@/utils/utils.ts";
import { WeekData } from "@/utils/week.ts";
export interface WeekTableData extends WeekData {
  name: string;
  startDay: Date;
}
export default function WeekTable(
  { data: { names, dates, ids, table, startDay } }: { data: WeekTableData },
) {
  function getDay(dow: number): string {
    const day = new Date(startDay);
    day.setDate(day.getDate() + dow - 1);
    return day.toISOString().slice(0, 10);
  }
  function getColor(v: number): string {
    return {
      1: "rgb(217 249 157)",
      2: "rgb(254 240 138)",
      3: "rgb(254 215 170)",
      4: "rgb(254 202 202)",
    }[v] ??
      "#dddddd";
  }

  return (
    <>
      <h1>{startDay.toISOString().slice(0, 10)}</h1>
      <Table>
        <TableHead>
          <HeadColumn>Name</HeadColumn>
          {dates.map((d) => (
            <HeadColumn>
              <a
                class="text-blue-600 dark:text-blue-500 hover:underline"
                href={`/stats/daily/${getDay(d)}`}
              >
                {" MTWRFSU"[d]}
              </a>
            </HeadColumn>
          ))}
          <HeadColumn>Π</HeadColumn>
          <HeadColumn>⏱️</HeadColumn>
        </TableHead>
        <TableBody>
          {names.map((name, i) => (
            <TableRow>
              <TableRowHeader>
                <a
                  class="text-blue-600 dark:text-blue-500 hover:underline"
                  href={`/players/${name}`}
                >
                  {name}
                </a>
              </TableRowHeader>
              {table[i].slice(2).map((v, j) => {
                const id = ids[i][j + 2] ?? -1;
                return (
                  <TableCell
                    style={{
                      backgroundColor: getColor(v),
                      padding: 0,
                      textAlign: "center",
                    }}
                  >
                    {id < 0 ? v : (
                      <a
                        class="leading-[35px] w-full block"
                        href={`/submissions/${id}/playback`}
                      >
                        {v}
                      </a>
                    )}
                  </TableCell>
                );
              })}
              <TableCell>
                {table[i][0] < 1000
                  ? table[i][0]
                  : table[i][0].toString().slice(0, 2) + "K"}
              </TableCell>
              <TableCell>{timerTime(table[i][1])}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
/**
 * name,
          ...table[i].slice(2),
          ,
          ,
 */
