import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import TimerText from "@/components/timer_text.tsx";
import { WeekData } from "../utils/week.ts";
export interface WeekTableData extends WeekData {
  name: string;
}
export default function WeekTable(
  { data: { names, dates, table } }: { data: WeekTableData },
) {
  return (
    <>
      <table class="table-auto">
        <thead>
          <tr class="text-xs">
            <th>Name</th>
            <th>Π</th>
            {dates.map((d) => <th key={d}>{d}</th>)}
            <th>⏱️</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => (
            <tr>
              <td class="px-2 font-bold">{names[i]}</td>
              <td class="px-2">{row[0]}</td>
              {row.slice(2).map((score) => <td class="px-2">{score}</td>)}
              <td class="px-2">
                <TimerText seconds={row[1]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
