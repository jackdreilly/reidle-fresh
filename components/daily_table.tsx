import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableRowHeader,
} from "@/components/tables.tsx";
import TimerText from "@/components/timer_text.tsx";
import { DailySubmission } from "@/routes/stats/daily/[date].tsx";
import IconCake from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/cake.tsx";

function isBirthday(name: string) {
  const birthday = {
    jack: [7, 28],
    chris: [7, 28],
    olga: [4, 12],
    ioanna: [3, 27],
    jimbo: [5, 8],
    natnat: [6, 22],
    tracy: [1, 5],
    ian: [7, 28],
    ahmad: [8, 23],
  }[name];
  if (!birthday) {
    return false;
  }
  const now = new Date();
  return [-1, 0, 1].filter((y) =>
    Math.abs(
      now.getTime() -
        new Date(now.getUTCFullYear() + y, birthday[0] - 1, birthday[1])
          .getTime(),
    ) < (1000 * 60 * 60 * 24 * 5)
  ).length > 0;
}

export function Birthday({ name }: { name: string }) {
  if (isBirthday(name)) {
    return <IconCake class="w-6 h-6 ml-1" />;
  }
  return null;
}

export function Name({ name }: { name: string }) {
  return (
    <div class="inline-block">
      <a
        href={`/players/${name}`}
        class="flex items-center whitespace-nowrap text-blue-600 dark:text-blue-500 hover:underline"
      >
        {name.toLowerCase().trim().substring(0, 13)}
        <Birthday name={name} />
      </a>
    </div>
  );
}

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
              <Name name={name} />
            </TableRowHeader>
            <TableCell>
              <TimerText seconds={time} />
            </TableCell>
            <TableCell>
              {penalty >= 60 ? <TimerText seconds={penalty} /> : penalty}
            </TableCell>
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
