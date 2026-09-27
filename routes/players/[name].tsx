import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData, SessionHandler, timerTime } from "@/utils/utils.ts";

interface PlayerSummary {
  games: number;
  active_days: number;
  podiums: number;
  median_time: number | null;
  p25_time: number | null;
  p75_time: number | null;
  first_played: string | null;
}

interface WeekActivity {
  week_start: string;
  games: number;
  median_time: number | null;
}

interface TimeBin {
  bin: number;
  count: number;
  lower_time: number | null;
  upper_time: number | null;
  total_games: number;
  included_games: number;
}

interface RankBin {
  bin: number;
  count: number;
}

interface Data {
  name: string;
  summary: PlayerSummary;
  recent: WeekActivity[];
  time_bins: TimeBin[];
  rank_bins: RankBin[];
}

export const handler: SessionHandler<Data> = {
  async GET(_, ctx) {
    const name = ctx.params.name ?? "";
    const { connection } = ctx.state;
    const summary = await connection.queryObject<PlayerSummary>`
      SELECT
        COUNT(*)::INTEGER AS games,
        COUNT(DISTINCT day)::INTEGER AS active_days,
        COUNT(*) FILTER (WHERE "rank" <= 3)::INTEGER AS podiums,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY time) AS median_time,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY time) AS p25_time,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY time) AS p75_time,
        TO_CHAR(MIN(day), 'Mon YYYY') AS first_played
      FROM submissions
      WHERE name = ${name}
        AND challenge_id IS NULL
    `.then((result) => result.rows[0]);

    const recent = await connection.queryObject<WeekActivity>`
      WITH weekly AS (
        SELECT
          DATE_TRUNC('week', day)::DATE AS week_start,
          COUNT(*)::INTEGER AS games,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY time) AS median_time
        FROM submissions
        WHERE name = ${name}
          AND challenge_id IS NULL
          AND day >= CURRENT_DATE - INTERVAL '13 weeks'
        GROUP BY 1
      ), calendar AS (
        SELECT generated_week::DATE AS week_start
        FROM GENERATE_SERIES(
          DATE_TRUNC('week', CURRENT_DATE)::DATE - INTERVAL '11 weeks',
          DATE_TRUNC('week', CURRENT_DATE)::DATE,
          INTERVAL '1 week'
        ) AS weeks(generated_week)
      )
      SELECT
        TO_CHAR(calendar.week_start, 'YYYY-MM-DD') AS week_start,
        COALESCE(weekly.games, 0)::INTEGER AS games,
        weekly.median_time
      FROM calendar
      LEFT JOIN weekly USING (week_start)
      ORDER BY calendar.week_start
    `.then((result) => result.rows);

    const timeBins = await connection.queryObject<TimeBin>`
      WITH player_times AS (
        SELECT time::DOUBLE PRECISION AS time
        FROM submissions
        WHERE name = ${name}
          AND challenge_id IS NULL
      ), bounds AS (
        SELECT
          percentile_cont(0.05) WITHIN GROUP (ORDER BY time) AS lower_time,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY time) AS upper_time,
          COUNT(*)::INTEGER AS total_games
        FROM player_times
      ), clipped AS (
        SELECT
          player_times.time,
          bounds.lower_time,
          GREATEST(bounds.upper_time, bounds.lower_time + 1) AS upper_time
        FROM player_times
        CROSS JOIN bounds
        WHERE player_times.time BETWEEN bounds.lower_time AND bounds.upper_time
      ), counts AS (
        SELECT
          LEAST(8, WIDTH_BUCKET(time, lower_time, upper_time, 8))::INTEGER AS bin,
          COUNT(*)::INTEGER AS count
        FROM clipped
        GROUP BY 1
      ), included AS (
        SELECT COUNT(*)::INTEGER AS included_games FROM clipped
      )
      SELECT
        bins.bin::INTEGER AS bin,
        COALESCE(counts.count, 0)::INTEGER AS count,
        bounds.lower_time,
        bounds.upper_time,
        bounds.total_games,
        included.included_games
      FROM GENERATE_SERIES(1, 8) AS bins(bin)
      CROSS JOIN bounds
      CROSS JOIN included
      LEFT JOIN counts USING (bin)
      ORDER BY bins.bin
    `.then((result) => result.rows);

    const rankBins = await connection.queryObject<RankBin>`
      WITH ranks AS (
        SELECT LEAST("rank", 9)::INTEGER AS bin
        FROM submissions
        WHERE name = ${name}
          AND challenge_id IS NULL
      )
      SELECT
        bins.bin::INTEGER AS bin,
        COUNT(ranks.bin)::INTEGER AS count
      FROM GENERATE_SERIES(1, 9) AS bins(bin)
      LEFT JOIN ranks USING (bin)
      GROUP BY bins.bin
      ORDER BY bins.bin
    `.then((result) => result.rows);

    return ctx.state.render(ctx, {
      name,
      summary,
      recent,
      time_bins: timeBins,
      rank_bins: rankBins,
    });
  },
};

export default function Page(
  { data: { name, playedToday, summary, recent, time_bins, rank_bins } }: PageProps<
    Data & SessionData
  >,
) {
  const typicalRange = summary.p25_time !== null && summary.p75_time !== null
    ? `${timerTime(summary.p25_time)}–${timerTime(summary.p75_time)}`
    : "—";
  const podiumRate = summary.games
    ? Math.round((summary.podiums / summary.games) * 100)
    : 0;
  const usualWeek = percentile(recent.map((week) => week.games), 0.9) || 1;

  return (
    <ReidleTemplate playedToday={playedToday} route="/players" title={name}>
      <div class="mx-auto w-full max-w-4xl">
        <header class="flex items-center gap-4 border-b border-gray-200 py-5 sm:py-7">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white"
            style={{ backgroundColor: "#0f766e" }}
            aria-hidden="true"
          >
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div class="min-w-0">
            <div class="text-[11px] font-bold uppercase text-gray-500">
              Player profile
            </div>
            <h1 class="truncate text-2xl font-black text-gray-900">{name}</h1>
            <p class="text-xs text-gray-500">
              {summary.first_played
                ? `Playing since ${summary.first_played}`
                : "No daily games recorded"}
            </p>
          </div>
        </header>

        {summary.games === 0
          ? (
            <div class="py-10 text-sm text-gray-500">
              No daily play history yet.
            </div>
          )
          : (
            <>
              <section
                class="grid grid-cols-2 gap-x-5 gap-y-4 border-b border-gray-200 py-4 sm:grid-cols-4 sm:gap-4"
                aria-label="Player summary"
              >
                <Metric label="Games" value={summary.games.toLocaleString()} />
                <Metric
                  label="Active days"
                  value={summary.active_days.toLocaleString()}
                />
                <Metric
                  label="Median solve"
                  value={timerTime(summary.median_time ?? 0)}
                />
                <Metric
                  label="Top-three rate"
                  value={`${podiumRate}%`}
                  detail={`${summary.podiums.toLocaleString()} finishes`}
                />
              </section>

              <section class="grid gap-7 border-b border-gray-200 py-6 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,0.9fr)] sm:items-center">
                <div>
                  <h2 class="text-sm font-bold text-gray-900">
                    Typical solve window
                  </h2>
                  <p class="mt-1 text-xs text-gray-500">
                    Middle half of finishes
                  </p>
                  <p class="mt-3 font-mono text-2xl font-bold text-gray-900">
                    {typicalRange}
                  </p>
                </div>
                <div>
                  <div class="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <h2 class="text-sm font-bold text-gray-900">
                        Recent rhythm
                      </h2>
                      <p class="text-xs text-gray-500">Games per week · 12 weeks</p>
                    </div>
                    <span class="font-mono text-xs text-gray-500">
                      {recent.reduce((sum, week) => sum + week.games, 0)} games
                    </span>
                  </div>
                  <div class="grid grid-cols-12 gap-1">
                    {recent.map((week, index) => {
                      const height = week.games === 0
                        ? 4
                        : Math.max(12, Math.min(100, (week.games / usualWeek) * 72));
                      const label = new Date(`${week.week_start}T00:00:00Z`)
                        .toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        });
                      const median = week.median_time === null
                        ? "no games"
                        : `median ${timerTime(week.median_time)}`;
                      return (
                        <div
                          key={week.week_start}
                          class="grid h-[3.25rem] min-w-0 grid-rows-[2.5rem_0.75rem]"
                          title={`${label}: ${week.games} games, ${median}`}
                          aria-label={`${label}: ${week.games} games, ${median}`}
                        >
                          <div class="flex h-10 items-end">
                            <div
                              class="w-full rounded-t-sm"
                              style={{
                                height: `${height}%`,
                                backgroundColor: week.games ? "#0f766e" : "#e5e7eb",
                              }}
                            />
                          </div>
                          <span class="h-3 text-center text-[9px] leading-3 text-gray-400">
                            {index % 3 === 0 ? label.split(" ")[0] : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section class="grid gap-6 border-b border-gray-200 py-6 sm:grid-cols-2">
                <Histogram
                  title="Solve-time distribution"
                  subtitle="Central 90% · relative count scale"
                  bins={time_bins.map(({ count }) => count)}
                  labels={time_bins.map(({ bin }) => {
                    const lower = Number(time_bins[0]?.lower_time);
                    const upper = Number(time_bins[0]?.upper_time);
                    if (lower === null || lower === undefined || upper === null || upper === undefined) return "No games";
                    const width = (Math.max(upper, lower + 1) - lower) / 8;
                    return `${timerTime(lower + (bin - 1) * width)}–${timerTime(lower + bin * width)}`;
                  })}
                  note={time_bins[0]
                    ? `${time_bins[0].total_games - time_bins[0].included_games} extreme finishes omitted`
                    : undefined}
                />
                <Histogram
                  title="Finish rank"
                  subtitle="Daily position · 9 is 9th or lower · relative count scale"
                  bins={rank_bins.map(({ count }) => count)}
                  labels={rank_bins.map(({ bin }) => bin === 9 ? "9+" : `${bin}`)}
                />
              </section>
            </>
          )}
      </div>
    </ReidleTemplate>
  );
}

function Histogram(
  { title, subtitle, bins, labels, note }: {
    title: string;
    subtitle: string;
    bins: number[];
    labels: string[];
    note?: string;
  },
) {
  const maxCount = Math.max(1, ...bins);
  const minCount = Math.min(...bins.filter((count) => count > 0), maxCount);
  return (
    <section class="min-w-0" aria-label={title}>
      <div class="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 class="text-sm font-bold text-gray-900">{title}</h2>
          <p class="text-xs text-gray-500">{subtitle}</p>
        </div>
        {note && <span class="text-right text-[10px] text-gray-400">{note}</span>}
      </div>
      <div
        class="grid h-16 items-end gap-1"
        style={{ gridTemplateColumns: `repeat(${bins.length}, minmax(0, 1fr))` }}
      >
        {bins.map((count, index) => (
          <div
            key={index}
            class="w-full rounded-t-sm"
            title={`${labels[index]}: ${count} games`}
            style={{
              height: `${count
                ? maxCount === minCount
                  ? 72
                  : 22 + ((count - minCount) / (maxCount - minCount)) * 78
                : 2}%`,
              backgroundColor: count ? "#0f766e" : "#e5e7eb",
            }}
          />
        ))}
      </div>
      <div class="mt-1 flex justify-between text-[9px] text-gray-400">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </section>
  );
}

function Metric(
  { label, value, detail }: { label: string; value: string; detail?: string },
) {
  return (
    <div class="min-w-0">
      <div class="text-[10px] font-bold uppercase text-gray-500">{label}</div>
      <div class="mt-1 truncate text-xl font-black tabular-nums text-gray-900">
        {value}
      </div>
      {detail && <div class="text-[10px] text-gray-500">{detail}</div>}
    </div>
  );
}

function percentile(values: number[], percentile: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}