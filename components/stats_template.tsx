import ReidleTemplate from "@/components/reidle_template.tsx";
import { ComponentChildren } from "preact";
export default function StatsTemplate(
  { children }: { children?: ComponentChildren },
) {
  return (
    <ReidleTemplate title="Stats">
      <h1 class="text-3xl">Stats</h1>
      <div class="inline">
        <a
          class="text-sm underline mx-3 hover:text-blue-700 hover:font-bold"
          href="/stats/today"
        >
          Today
        </a>
        <a
          class="text-sm underline mx-3 hover:text-blue-700 hover:font-bold"
          href="/stats/this_week"
        >
          This Week
        </a>
        <a
          class="text-sm underline mx-3 hover:text-blue-700 hover:font-bold"
          href="/stats/last_week"
        >
          Last Week
        </a>
        <a
          class="text-sm underline mx-3 hover:text-blue-700 hover:font-bold"
          href="/stats/previous_winners"
        >
          Previous Winners
        </a>
      </div>
      {children}
    </ReidleTemplate>
  );
}
