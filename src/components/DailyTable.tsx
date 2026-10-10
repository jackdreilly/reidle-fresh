import { RankBadge } from "@/components/StatsTabs";
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

export function Name({ name, class: cls }: { name: string; class?: string }) {
  return (
    <div class="inline-block">
      <a
        href={`/players/${name}`}
        class={"flex items-center whitespace-nowrap hover:underline " + (cls ?? "text-blue-600 dark:text-blue-500")}
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
  if (!submissions.length) {
    return (
      <div class="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
        No games yet. Be the first!
      </div>
    );
  }
  return (
    <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          <tr>
            <th scope="col" class="py-2 pl-3 pr-2">Player</th>
            <th scope="col" class="px-2 py-2 text-right">Time</th>
            <th scope="col" class="px-2 py-2 text-right">Pen</th>
            <th scope="col" class="py-2 pl-2 pr-3 text-right">Paste</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map(({ name, time, penalty, paste, submission_id }, i) => {
            const me = name === myName;
            return (
              <tr class={"border-b border-gray-100 last:border-0 " + (me ? "bg-amber-50" : "")}>
                <th scope="row" class={"py-2 pl-3 pr-2 font-medium " + (me ? "shadow-[inset_3px_0_0_var(--color-amber-400)]" : "")}>
                  <div class="flex items-center gap-2">
                    <RankBadge rank={i + 1} />
                    <Name name={name} class="text-gray-900 hover:text-blue-600" />
                  </div>
                </th>
                <td class="px-2 py-2 text-right font-semibold tabular-nums text-gray-900">
                  <TimerText seconds={time} />
                </td>
                <td class={"px-2 py-2 text-right tabular-nums " + (penalty ? "text-rose-500" : "text-gray-300")}>
                  {penalty >= 60 ? <TimerText seconds={penalty} /> : penalty}
                </td>
                <td class={"py-1.5 pl-2 pr-3 text-right " + (hide ? "invisible" : "")}>
                  <a
                    class="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-gray-100"
                    href={`/submissions/${submission_id}/playback` +
                      (challenge ? "?challenge" : "")}
                    title="Watch replay"
                    aria-label={`Watch ${name}'s replay`}
                  >
                    <Paste paste={paste} />
                    <svg
                      class="h-3 w-3 shrink-0 text-gray-300 transition-colors group-hover:text-gray-700"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Paste({ paste }: { paste: string }) {
  if (paste === "") {
    return <span class="text-xs text-gray-400">No paste</span>;
  }
  return (
    // Just for fun, not to scale: short, wide cells keep table rows compact.
    <div class="flex w-11 flex-col gap-px">
      {paste.split("\n").slice(0, 12).map((line) => (
        <div class="grid h-1 grid-cols-5 gap-px">
          {Array.from(line).map((char) => (
            <div
              style={{
                borderRadius: "1px",
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
  return { "🟩": "#16a34a", "⬜": "#e5e7eb", "🟨": "#eab308" }[s] ?? "white";
}
