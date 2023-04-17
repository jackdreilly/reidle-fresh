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
          { name, time, penalty, paste, submission_id },
        ) => (
          <TableRow class={name === myName ? "bg-yellow-100" : ""}>
            <TableRowHeader>
              <a
                class="text-blue-600 dark:text-blue-500 hover:underline"
                href={`/players/${name}`}
              >
                {name.slice(0, 13) +
                  (name.toLowerCase() === "olga" ? "🎂" : "")}
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
                class={hide ? " invisible" : ""}
                href={`/submissions/${submission_id}/playback` +
                  (challenge ? "?challenge" : "")}
              >
                <svg
                  class="w-6 h-6 hover:bg-gray-200"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </a>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
