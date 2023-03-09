import { Handlers, PageProps } from "$fresh/server.ts";
import TimerText from "@/components/timer_text.tsx";
import runDb from "@/utils/db.ts";
import { getName } from "@/utils/utils.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
import StatsTemplate from "@/components/stats_template.tsx";
interface Submission {
  name: string;
  created_at: Date;
  id: number;
  time: number;
  penalty: number;
  score: number;
  rank: number;
  paste: number;
  playback: Record<string, unknown>[];
}
interface Data {
  submissions: Submission[];
  name: string;
}

export const handler: Handlers<Data, WithSession> = {
  async GET(req, ctx) {
    const name = getName(ctx);
    const submissions = await runDb((connection) =>
      connection.queryObject`
      SELECT
        *
      FROM
        submissions
      ORDER BY
        DATE(created_at),
        rank
      LIMIT
        100
      `.then((x) => x.rows as Submission[])
    );
    return ctx.render({
      submissions,
      name,
    });
  },
};

export default function Page(
  { data: { submissions, name: myName } }: PageProps<Data>,
) {
  return (
    <StatsTemplate>
      <h2 class="text-2xl">Today</h2>
      <table class="table-auto">
        <thead>
          <tr class="text-xs">
            <th>Name</th>
            <th>Time</th>
            <th>Pen</th>
            <th>Score</th>
            <th>Paste</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((
            { name, time, penalty, score, paste, created_at, id },
          ) => (
            <tr key={id}>
              <td
                class="px-2"
                style={name === myName ? { fontWeight: "bold" } : {}}
              >
                {name.slice(0, 13)}
              </td>
              <td class="px-2">
                <TimerText seconds={time} />
              </td>
              <td class="px-2">{penalty}</td>
              <td class="px-2">{score}</td>
              <td class="px-2 whitespace-pre-wrap text-[7px]">{paste}</td>
              <td class="px-2">
                {created_at.getUTCMonth()}/{created_at.getUTCDate()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </StatsTemplate>
  );
}
