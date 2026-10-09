import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableRowHeader,
} from "@/components/Tables";
import TimerText from "@/components/TimerText";
import type { DailySubmission } from "@/lib/types";

function isBirthday(name: string) {
  const birthday = {
    jack: [7, 28],
    cbo: [7, 28],
    olga: [4, 12],
    ioanna: [3, 27],
    jimbo: [5, 8],
    natnat: [6, 22],
    tracy: [1, 5],
    ian: [7, 28],
    ahmad: [8, 23],
    natalief: [10, 18],
    sabrina: [3, 14],
    peterstamos: [7, 1],
    joey: [8, 25],
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
    return (
      <svg class="w-6 h-6 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 20h18v-8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8zm0-3a2.4 2 0 0 0 3 0a2.4 2 0 0 1 3 0a2.4 2 0 0 0 3 0a2.4 2 0 0 1 3 0a2.4 2 0 0 0 3 0M12 9V7m0-4v1" />
      </svg>
    );
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
              <Paste paste={paste} />
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

function Paste({ paste }: { paste: string }) {
  if (paste === "") {
    return <span class="text-gray-400">No paste</span>;
  }
  return (
    <div
      class="grid"
      style={{ gridTemplateRows: `repeat(${Math.min(12, paste.split("\n").length)}, minmax(0, 1fr))` }}
    >
      {paste.split("\n").map((line) => (
        <div class="h-1 grid grid-cols-5">
          {Array.from(line).map((char) => (
            <div
              style={{
                borderRadius: "1px",
                backgroundColor: bg(char),
                margin: "0.15px",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function bg(s: string): string {
  return { "🟩": "#049404", "⬜": "#dddddd", "🟨": "#e9e51b" }[s] ?? "white";
}
