import ReidleTemplate from "@/components/reidle_template.tsx";
import { ComponentChildren } from "preact";
export default function StatsTemplate(
  { children, route, playedToday }: {
    children?: ComponentChildren;
    route?: "today" | "this_week" | "past_winners";
    playedToday: boolean,
  },
) {
  return (
    <ReidleTemplate playedToday={playedToday} route="/stats" title="Stats">
      <div class="my-4">
        {[["Today", "today"], ["Week", "this_week"], ["Past", "past_winners"]]
          .map(([text, link]) => (
            <a
              class={"text-blue-600 dark:text-blue-500 hover:underline m-3 p-3 " +
                (route === link ? "text-blue-900" : "")}
              href={`/stats/${link}`}
            >
              {text}
            </a>
          ))}
      </div>
      {children}
    </ReidleTemplate>
  );
}
