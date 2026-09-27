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
import IconPlayerPlay from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/player-play.tsx";

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
    return <IconCake class="w-4 h-4 ml-1 text-pink-500 inline-block animate-bounce" />;
  }
  return null;
}

export function Name(
  { name, compact = false }: { name: string; compact?: boolean },
) {
  return (
    <div class="inline-flex min-w-0 items-center gap-1">
      <a
        href={`/players/${name}`}
        title={name}
        class="min-w-0 font-bold text-gray-900 hover:text-emerald-600 transition-colors flex items-center"
      >
        <span
          class={compact
            ? "block max-w-[5rem] truncate sm:max-w-none sm:overflow-visible sm:text-clip sm:whitespace-normal"
            : ""}
        >
          {name.toLowerCase().trim().substring(0, 14)}
        </span>
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
  if (submissions.length === 0) {
    return (
      <div class="bg-white rounded-2xl border border-gray-200/80 p-8 text-center shadow-xs">
        <div class="text-3xl mb-2">⏱️</div>
        <h3 class="text-sm font-bold text-gray-900">No submissions yet</h3>
        <p class="text-xs text-gray-500 mt-1">Be the first to solve today's Reidle!</p>
        <a
          href="/play"
          class="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
        >
          <span>⚡</span>
          <span>Play Now</span>
        </a>
      </div>
    );
  }

  return (
    <Table
      tableClass="table-fixed sm:table-auto"
      columns={["Rank", "Player", "Time", "Penalty", "Guesses"]}
      columnClasses={[
        "w-10 px-1.5 sm:w-14 sm:px-4 text-center",
        "w-20 px-2 sm:w-auto sm:px-4",
        "w-16 px-1.5 sm:w-auto sm:px-4",
        "hidden sm:table-cell",
        "w-14 min-w-14 max-w-14 px-1 sm:w-14 sm:px-2",
      ]}
    >
      <TableBody>
        {submissions.map((
          { name, time, penalty, paste, submission_id },
          index,
        ) => {
          const isMe = name === myName;
          const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;

          return (
            <TableRow
              style={isMe ? { backgroundColor: "#f0fdf4" } : undefined}
              class={isMe ? "bg-emerald-50/70 hover:bg-emerald-50/90 font-semibold" : ""}
            >
              <TableCell class="w-10 px-1.5 sm:w-14 sm:px-4 font-mono font-bold text-gray-500 text-center">
                {medal ?? <span class="text-xs">{index + 1}</span>}
              </TableCell>

              <TableRowHeader class="w-20 max-w-20 px-2 sm:w-auto sm:max-w-none sm:px-4">
                <div class="flex items-center gap-2">
                  <Name name={name} compact />
                </div>
              </TableRowHeader>

              <TableCell class="w-16 px-1.5 sm:w-auto sm:px-4 font-mono font-bold text-gray-800">
                <TimerText seconds={time} />
              </TableCell>

              <TableCell class="hidden sm:table-cell">
                {penalty > 0 ? (
                  <span class="inline-flex items-center gap-0.5 px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full font-mono text-[11px] font-bold">
                    +{penalty >= 60 ? <TimerText seconds={penalty} /> : `${penalty}s`}
                  </span>
                ) : (
                  <span class="text-gray-300 font-mono text-xs">-</span>
                )}
              </TableCell>

              <TableCell
                class={`w-14 min-w-14 max-w-14 px-1 sm:px-2 ${hide ? "invisible pointer-events-none" : ""}`}
              >
                <a
                  class="group relative inline-flex h-7 w-11 items-center justify-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
                  href={`/submissions/${submission_id}/playback` +
                    (challenge ? "?challenge" : "")}
                  aria-label={`Play replay for ${name}`}
                  title="Play replay"
                >
                  <Paste paste={paste} />
                  <span
                    aria-hidden="true"
                    class="absolute right-0 top-0 flex h-3 w-3 items-center justify-center rounded-full border"
                    style={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1" }}
                  >
                    <IconPlayerPlay size={7} color="#64748b" />
                  </span>
                </a>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function Paste({ paste }: { paste: string }) {
  if (!paste) {
    return <span class="text-gray-300 text-xs">-</span>;
  }
  const lines = paste.trim().split("\n");
  const tileHeight = Math.min(
    7,
    Math.max(0.75, (28 - (lines.length - 1)) / lines.length),
  );
  return (
    <div
      class="flex h-7 w-11 flex-col items-center justify-center overflow-hidden"
      style={{ gap: "1px" }}
    >
      {lines.map((line) => (
        <div class="flex w-full justify-center" style={{ gap: "1px" }}>
          {Array.from(line).map((char) => (
            <div
              style={{
                width: "5px",
                height: `${tileHeight}px`,
                borderRadius: "1px",
                flex: "0 0 auto",
                backgroundColor: bg(char),
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function bg(s: string): string {
  return { "🟩": "#16a34a", "⬜": "#cbd5e1", "🟨": "#ca8a04" }[s] ?? "#cbd5e1";
}
