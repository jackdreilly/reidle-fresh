import TimerText from "@/components/timer_text.tsx";
import { WeekData } from "@/utils/week.ts";
import { Table } from "@/components/tables.tsx";
import { timerTime } from "../utils/utils.ts";
export interface WeekTableData extends WeekData {
  name: string;
  startDay: Date;
}
export default function WeekTable(
  { data: { names, dates, table, startDay } }: { data: WeekTableData },
) {
  return (
    <>
      <h1>{startDay.toISOString().slice(0, 10)}</h1>
      <Table
        columns={["Name", "Π", ...dates, "⏱️"]}
        rows={names.map((
          name,
          i,
        ) => [name, table[i][0], ...table[i].slice(2), timerTime(table[i][1])])}
      >
      </Table>
    </>
  );
}
