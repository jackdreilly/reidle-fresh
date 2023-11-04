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
  if (name === "natnat") {
    return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
              class="w-6 h-6 ml-1" width="16" height="16" stroke="currentColor"
              >
      <path d="M1.5,2.09C2.4,3 3.87,3.73 5.69,4.25C7.41,2.84 9.61,2 12,2C14.39,2 16.59,2.84 18.31,4.25C20.13,3.73 21.6,3 22.5,2.09C22.47,3.72 21.65,5.21 20.28,6.4C21.37,8 22,9.92 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12C2,9.92 2.63,8 3.72,6.4C2.35,5.21 1.53,3.72 1.5,2.09M20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12M10.5,10C10.5,10.8 9.8,11.5 9,11.5C8.2,11.5 7.5,10.8 7.5,10V8.5L10.5,10M16.5,10C16.5,10.8 15.8,11.5 15,11.5C14.2,11.5 13.5,10.8 13.5,10L16.5,8.5V10M12,17.23C10.25,17.23 8.71,16.5 7.81,15.42L9.23,14C9.68,14.72 10.75,15.23 12,15.23C13.25,15.23 14.32,14.72 14.77,14L16.19,15.42C15.29,16.5 13.75,17.23 12,17.23Z"/>
    </svg>);
  }
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
      class={`grid grid-rows-${Math.min(12, paste.split("\n").length)}`}
    >
      {paste.split("\n").map((line) => (
        <div class="h-1 grid grid-cols-5">
          {Array.from(line).map((char) => (
            <div style={{ borderRadius: "1px", backgroundColor: bg(char), margin: "0.15px" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function bg(s: string): string {
  return { "🟩": "#049404", "⬜": "#dddddd", "🟨": "#e9e51b" }[s] ?? "white";
}
