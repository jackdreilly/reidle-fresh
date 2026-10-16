import { useEffect, useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { DailyTable } from "@/components/DailyTable";
import StatsTabs, { prettyDay } from "@/components/StatsTabs";
import { useSession } from "@/lib/session";
import type { DailySubmission } from "@/lib/types";
import { resetClock } from "@/lib/time";

type Data = { submissions: DailySubmission[]; is_today: boolean; winner?: string };

export default function Daily({ params, data: { submissions, is_today, winner } }: PageProps<Data>) {
  const { name, played_today } = useSession();
  return (
    <StatsTabs route="today">
      <header class="mb-3 flex items-baseline justify-between px-1">
        <h1 class="text-lg font-semibold text-gray-900">
          {prettyDay(params.date, { weekday: "long", month: "short", day: "numeric" })}
        </h1>
        <span class="text-xs text-gray-400">
          {submissions.length} {submissions.length === 1 ? "player" : "players"}
        </span>
      </header>
      <DailyTable name={name ?? ""} submissions={submissions} hide={!played_today && is_today} />
      {winner && (
        <div class="mt-4 grid grid-cols-2 gap-3">
          <a
            class="block rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-100 p-3 transition-shadow hover:shadow-md"
            href={`/players/${winner}`}
          >
            <div class="text-[11px] font-semibold uppercase tracking-wider text-amber-700">🏆 Last week's winner</div>
            <div class="mt-1 truncate text-lg font-bold text-amber-950">{winner}</div>
          </a>
          <TimeRemaining />
        </div>
      )}
    </StatsTabs>
  );
}

function TimeRemaining() {
  // ticks each minute while open; the app also reloads the page when it comes back to the foreground
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.ceil((tomorrow.getTime() - now) / 60_000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return (
    <div class="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100 p-3">
      <div class="text-[11px] font-semibold uppercase tracking-wider text-sky-700">⏳ Today's game</div>
      <div class="mt-1 text-sky-950">
        <span class="text-lg font-bold tabular-nums">{h ? `${h}h ${m}m` : `${m}m`}</span>{" "}
        <span class="text-xs">left</span>
      </div>
      <div class="text-xs text-sky-800">New word at {resetClock()}</div>
    </div>
  );
}
