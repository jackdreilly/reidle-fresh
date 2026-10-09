import type { PageProps } from "@/router";
import { DailyTable } from "@/components/DailyTable";
import StatsTabs from "@/components/StatsTabs";
import { useSession } from "@/lib/session";
import type { DailySubmission } from "@/lib/types";

type Data = { submissions: DailySubmission[]; is_today: boolean; winner?: string };

export default function Daily({ data: { submissions, is_today, winner } }: PageProps<Data>) {
  const { name, played_today } = useSession();
  return (
    <StatsTabs route="today">
      <DailyTable name={name ?? ""} submissions={submissions} hide={!played_today && is_today} />
      {winner && (
        <h2 class="m-4 text-xl">
          Last Week's Winner:{" "}
          <a class="text-blue-800 underline" href={`/players/${winner}`}>{winner}</a>
        </h2>
      )}
      {winner && <TimeRemaining />}
    </StatsTabs>
  );
}

function TimeRemaining() {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const hours = Math.floor((tomorrow.getTime() - Date.now()) / 3_600_000);
  return (
    <div class="m-2 p-2">
      <span class="font-bold rounded m-1 p-1 bg-gray-200">{hours.toString().padStart(2, "0")}</span>{" "}
      hours remaining to play today's challenge
    </div>
  );
}
