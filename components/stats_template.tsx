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
          href={`/stats/weekly/${new Date().toISOString().slice(0, 10)}`}
        >
          This Week
        </a>
        <a
          class="text-sm underline mx-3 hover:text-blue-700 hover:font-bold"
          href="/stats/past_winners"
        >
          Past Winners
        </a>
      </div>
      {children}
    </ReidleTemplate>
  );
}
