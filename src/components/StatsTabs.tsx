import type { ComponentChildren } from "preact";

const TABS = [["Today", "today"], ["Week", "this_week"], ["Past", "past_winners"]];

export default function StatsTabs(
  { children, route }: { children?: ComponentChildren; route?: "today" | "this_week" | "past_winners" },
) {
  return (
    <>
      <div class="my-4">
        {TABS.map(([text, link]) => (
          <a
            class={"text-blue-600 dark:text-blue-500 hover:underline m-3 p-3 " + (route === link ? "text-blue-900" : "")}
            href={`/stats/${link}`}
          >
            {text}
          </a>
        ))}
      </div>
      {children}
    </>
  );
}
