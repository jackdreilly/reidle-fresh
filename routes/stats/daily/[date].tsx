import { PageProps } from "$fresh/server.ts";
import { DailyTable, DailyTableData } from "@/components/daily_table.tsx";
import StatsTemplate from "@/components/stats_template.tsx";
import getWinner from "@/utils/get_winner.ts";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import { equal } from "https://deno.land/std@0.224.0/assert/equal.ts";

interface Data {
  submissions: DailyTableData;
  name: string;
  winner?: string;
  isToday: boolean;
  date: string;
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
      date,
    });
  },
};

export default function Page(
  { data: { submissions, name, winner, playedToday, isToday, date } }: PageProps<
    Data & SessionData
  >,
) {
  return (
    <StatsTemplate playedToday={playedToday} route="today">
      {/* Date Header & Countdown Card */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/80 border border-gray-200/80 rounded-2xl p-4 shadow-2xs">
        <div>
          <div class="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            {isToday ? "Today's Challenge" : "Challenge Date"}
          </div>
          <div class="text-lg font-black text-gray-900 mt-0.5">
            {date}
          </div>
        </div>

        <div class="flex items-center gap-3">
          {winner && (
            <div class="text-xs bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-amber-900 font-medium flex items-center gap-1.5">
              <span>👑 Champion:</span>
              <a class="font-bold underline hover:text-amber-700" href={`/players/${winner}`}>
                {winner}
              </a>
            </div>
          )}

          {isToday && <TimeRemaining />}
        </div>
      </div>

      {!playedToday && isToday && (
        <div class="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-900 text-xs">
          <div class="flex items-center gap-2">
            <span>🔒</span>
            <span>Guesses and replays are hidden until you solve today's Reidle to prevent spoilers!</span>
          </div>
          <a
            href="/play"
            class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors shrink-0"
          >
            Play Now →
          </a>
        </div>
      )}

      {/* Submissions Table */}
      <DailyTable
        name={name}
        submissions={submissions}
        hide={!playedToday && isToday}
      />
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
    <div class="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-xl shadow-2xs">
      <span class="font-mono font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded-md">
        {hours.toString().padStart(2, "0")}h
      </span>
      <span>remaining</span>
    </div>
  );
}
