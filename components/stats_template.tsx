import ReidleTemplate from "@/components/reidle_template.tsx";
import { ComponentChildren } from "preact";

export default function StatsTemplate(
  { children, route, playedToday }: {
    children?: ComponentChildren;
    route?: "today" | "this_week" | "past_winners";
    playedToday: boolean;
  },
) {
  const tabs = [
    { label: "Today", id: "today", href: "/stats/today", icon: "☀️" },
    { label: "This Week", id: "this_week", href: "/stats/this_week", icon: "📅" },
    { label: "Past Winners", id: "past_winners", href: "/stats/past_winners", icon: "🏆" },
  ];

  return (
    <ReidleTemplate playedToday={playedToday} route="/stats" title="Leaderboard">
      <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-black tracking-tight text-gray-900">
            Leaderboard
          </h1>
          <p class="text-xs text-gray-500 mt-0.5">
            Daily times, penalties, and historical champions
          </p>
        </div>

        {/* Modern Segmented Control */}
        <div class="bg-gray-100 p-1 rounded-xl inline-flex self-start sm:self-auto border border-gray-200/80 shadow-2xs">
          {tabs.map(({ label, id, href, icon }) => {
            const isActive = route === id;
            return (
              <a
                key={id}
                href={href}
                class={[
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all",
                  isActive
                    ? "bg-white text-gray-900 font-bold shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 font-medium",
                ].join(" ")}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </a>
            );
          })}
        </div>
      </div>

      <div class="space-y-4">
        {children}
      </div>
    </ReidleTemplate>
  );
}
