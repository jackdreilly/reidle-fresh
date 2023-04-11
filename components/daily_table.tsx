import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableRowHeader,
} from "@/components/tables.tsx";
import TimerText from "@/components/timer_text.tsx";
import { DailySubmission } from "@/routes/stats/daily/[date].tsx";

export type DailyTableData = DailySubmission[];
export function DailyTable(
  { submissions, hide, name: myName, challenge }: {
    submissions: DailyTableData;
    hide?: boolean;
    name: string;
    challenge?: boolean;
  },
) {
  return (
    <Table
      columns={["Name", "Time", "Pen", "Paste", "Watch"]}
    >
      <TableBody>
        {submissions.map((
          { name, time, penalty, paste, id },
        ) => (
          <TableRow class={name === myName ? "bg-yellow-100" : ""}>
            <TableRowHeader>
              <a
                class="text-blue-600 dark:text-blue-500 hover:underline"
                href={`/players/${name}`}
              >
                {name.slice(0, 13)}
              </a>
            </TableRowHeader>
            <TableCell>
              <TimerText seconds={time} />
            </TableCell>
            <TableCell>{penalty}</TableCell>
            <TableCell
              class={"whitespace-pre-wrap text-[7px] leading-[4px]" +
                (hide ? " invisible" : "")}
            >
              {paste}
            </TableCell>
            <TableCell>
              <a
                class={"text-2xl" + (hide ? " invisible" : "")}
                href={`/submissions/${id}/playback` +
                  (challenge ? "?challenge" : "")}
              >
                ▶️
              </a>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
