import { PageProps } from "$fresh/server.ts";
import { DailyTable, DailyTableData } from "@/components/daily_table.tsx";
import StatsTemplate from "@/components/stats_template.tsx";
import getWinner from "@/utils/get_winner.ts";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import { equal } from "https://deno.land/x/equal@v1.5.0/mod.ts";
interface Data {
  submissions: DailyTableData;
  name: string;
  winner?: string;
  isToday: boolean;
}
export const handler: SessionHandler<Data> = {
  async GET(_, ctx) {
    const { state: { name, connection, render }, params: { date } } = ctx;
    const today = new Date();
    const isToday = equal(date.split("-").map((x) => parseInt(x)), [
      today.getUTCFullYear(),
      today.getUTCMonth() + 1,
      today.getUTCDate(),
    ]);
    const winner = isToday ? await getWinner(connection) : undefined;
    const submissions = await connection.queryObject<
      DailySubmission
    >`
            SELECT
              submission_id, name, time, penalty, paste
            FROM
              submissions
            WHERE
              day = ${date}
            AND
              challenge_id IS NULL
            ORDER BY
              "rank"
          `.then((x) => x.rows);
    return render(ctx, {
      submissions,
      name,
      winner,
      isToday,
    });
  },
};

export default function Page(
  { data: { submissions, name, winner, playedToday, isToday } }: PageProps<
    Data & SessionData
  >,
) {
  return (
    <StatsTemplate playedToday={playedToday} route="today">
      {isToday && (
        <a
          class="font-bold h-64 text-[16px] text-green-600 hover:underline"
          href="/wrapped"
        >
          ✨🎁 Reidle Wrapped 2023 is here! 🎁✨
        </a>
      )}
      <DailyTable
        name={name}
        submissions={submissions}
        hide={!playedToday && isToday}
      />
      {winner && (
        <h2 class="m-4 text-xl">
          Last Week's Winner:{" "}
          <a class="text-blue-800 underline" href={`/players/${winner}`}>
            {winner}
          </a>
        </h2>
      )}
      {winner && <TimeRemaining />}
    </StatsTemplate>
  );
}

export interface DailySubmission {
  name: string;
  time: number;
  penalty: number;
  paste: string;
  submission_id: number;
}

function TimeRemaining() {
  const tomorrowUtc = new Date();
  tomorrowUtc.setUTCDate(tomorrowUtc.getUTCDate() + 1);
  tomorrowUtc.setUTCHours(0, 0, 0, 0);
  const tomorrowTimestamp = tomorrowUtc.getTime();
  const now = Date.now();
  const diff = tomorrowTimestamp - now;
  const hours = Math.floor(diff / 1000 / 60 / 60);
  return (
    <div class="m-2 p-2">
      <span class="font-bold rounded m-1 p-1 bg-gray-200">
        {hours.toString().padStart(2, "0")}
      </span>{" "}
      hours remaining to play today's challenge
    </div>
  );
}
