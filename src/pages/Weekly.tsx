import type { PageProps } from "@/router";
import StatsTabs, { prettyDay, RankBadge } from "@/components/StatsTabs";
import { Name } from "@/components/DailyTable";
import { useSession } from "@/lib/session";
import { isoDay, timerTime, utcToday } from "@/lib/time";
import type { WeekOutput } from "@/lib/types";

type Chip = [bg: string, fg: string];
const GRAY: Chip = ["#f3f4f6", "#c4c8cf"];
const GREEN: Chip = ["#bbf7d0", "#14532d"];
const YELLOW: Chip = ["#fef08a", "#713f12"];
const ORANGE: Chip = ["#fed7aa", "#7c2d12"];
// Lower finishes fade from peach to rose.
const rose = (i: number): Chip => [`hsl(${20 - i * 4}deg 95% ${90 - i * 2}%)`, "#881337"];

/** Legacy weeks: daily rank (1 best), 10 = no-show. */
function legacyColor(v: number): Chip {
  if (v === 1) return GREEN;
  if (v === 2) return YELLOW;
  if (v === 3) return ORANGE;
  if (v >= 4 && v <= 9) return rose(v - 4);
  return GRAY;
}

/** Additive weeks: daily points (40/20/10, then 7..1), 0 = no-show. */
function pointsColor(v: number): Chip {
  if (v >= 40) return GREEN;
  if (v >= 20) return YELLOW;
  if (v >= 10) return ORANGE;
  if (v <= 0) return GRAY;
  return rose(Math.max(0, 7 - v));
}

function compact(score: number) {
  return score < 1000 ? `${score}` : score.toString().slice(0, 1) + "e" + Math.floor(Math.log10(score));
}

export default function Weekly({ params, data: { players, additive } }: PageProps<{ players: WeekOutput; additive: boolean }>) {
  const { name: myName, played_today } = useSession();
  const isNewWeek = additive; // fixed cutover (server-side): weeks from 2026-10-05 use additive points
  const getColor = isNewWeek ? pointsColor : legacyColor;
  const today = utcToday();
  const monday = new Date(params.date.slice(0, 10) + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return (
    <StatsTabs route="this_week">
      <header class="mb-3 px-1">
        <h1 class="text-lg font-semibold text-gray-900">Week of {prettyDay(isoDay(monday), { month: "short", day: "numeric" })}</h1>
      </header>
      {players.length
        ? (
          <div class="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table class="w-full text-sm">
              <thead class="border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                <tr>
                  <th scope="col" class="sticky left-0 z-10 bg-white py-2 pl-3 pr-1 text-left">Player</th>
                  {players[0].results.days.map(({ day }) => {
                    const iso = isoDay(new Date(day));
                    return (
                      <th scope="col" class="px-px py-1 text-center">
                        <a
                          class={"mx-auto flex w-6 sm:w-7 flex-col items-center rounded-md py-0.5 leading-tight hover:bg-gray-100 " +
                            (iso === today ? "bg-gray-900 text-white hover:bg-gray-700" : "")}
                          href={`/stats/daily/${iso}`}
                        >
                          {"MTWRFSU"[(new Date(day).getUTCDay() + 6) % 7]}
                          <span class="text-[10px] font-normal normal-case tracking-normal opacity-70">{new Date(day).getUTCDate()}</span>
                        </a>
                      </th>
                    );
                  })}
                  <th scope="col" class="py-2 pl-2 pr-3 text-right text-gray-500">{isNewWeek ? "Σ" : "Π"}</th>
                </tr>
              </thead>
              <tbody>
                {players.map(({ name, results: { days, totals: { score, time } } }, i) => {
                  const me = name === myName;
                  const rowBg = me ? "bg-amber-50" : "bg-white";
                  return (
                    <tr class={"border-b border-gray-100 last:border-0 " + rowBg}>
                      <th
                        scope="row"
                        class={"sticky left-0 z-10 py-1.5 pl-3 pr-1 text-left font-medium " + rowBg +
                          (me ? " shadow-[inset_3px_0_0_var(--color-amber-400)]" : "")}
                      >
                        <div class="flex items-center gap-1.5">
                          <RankBadge rank={i + 1} />
                          <div class="leading-tight">
                            <Name name={name} class="text-gray-900 hover:text-blue-600" />
                            <div class="text-[11px] font-normal tabular-nums text-gray-400" title="Total time">⏱ {timerTime(time)}</div>
                          </div>
                        </div>
                      </th>
                      {days.map(({ score, submission_id, day }) => {
                        const [bg, fg] = getColor(score);
                        const chip = "mx-auto flex h-8 w-6 sm:w-7 items-center justify-center rounded-md text-xs font-semibold tabular-nums";
                        return (
                          <td class="px-px py-1.5 text-center">
                            {!submission_id
                              ? <span class={chip} style={{ backgroundColor: bg, color: fg }}>{score}</span>
                              : (
                                <a
                                  class={chip + " transition-transform hover:scale-110"}
                                  style={{ backgroundColor: bg, color: fg }}
                                  href={!played_today && day === today ? undefined : `/submissions/${submission_id}/playback`}
                                >
                                  {score}
                                </a>
                              )}
                          </td>
                        );
                      })}
                      <td class="py-1.5 pl-2 pr-3 text-right font-bold tabular-nums text-gray-900">
                        {isNewWeek ? score : <span title={`${score}`}>{compact(score)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
        : (
          <div class="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
            No data for this week yet. Check back later!
          </div>
        )}
    </StatsTabs>
  );
}
