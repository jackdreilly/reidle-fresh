import type { ComponentChildren } from "preact";

const TABS = [["Today", "today"], ["Week", "this_week"], ["Past", "past_winners"]];

export default function StatsTabs(
  { children, route }: { children?: ComponentChildren; route?: "today" | "this_week" | "past_winners" },
) {
  return (
    <div class="mx-auto w-full max-w-xl">
      <nav class="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 text-sm font-medium">
        {TABS.map(([text, link]) => (
          <a
            class={"rounded-lg py-2 text-center transition-colors " +
              (route === link ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800")}
            aria-current={route === link ? "page" : undefined}
            href={`/stats/${link}`}
          >
            {text}
          </a>
        ))}
      </nav>
      {children}
    </div>
  );
}

/** Small rounded rank marker: medal colours for the podium, plain number after that. */
export function RankBadge({ rank }: { rank: number }) {
  const podium = ["bg-amber-300 text-amber-900", "bg-gray-200 text-gray-700", "bg-orange-200 text-orange-900"][rank - 1];
  return (
    <span
      class={"inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums " +
        (podium ?? "text-gray-400")}
    >
      {rank}
    </span>
  );
}

/** "Sat, Oct 10" for an ISO day, read in UTC (days are UTC in Reidle). */
export function prettyDay(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(iso.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}
