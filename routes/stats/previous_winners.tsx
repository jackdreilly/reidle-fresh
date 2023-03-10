import { Handlers, PageProps } from "$fresh/server.ts";
import StatsTemplate from "@/components/stats_template.tsx";
import runDb from "@/utils/db.ts";
import { getName } from "@/utils/utils.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
import getWinner from "../../utils/get_winner.ts";
interface Submission {
  name: string;
  week: Date;
}
interface Data {
  submissions: Submission[];
  name: string;
}

export const handler: Handlers<Data, WithSession> = {
  async GET(req, ctx) {
    const name = getName(ctx);
    await getWinner();
    const submissions = await runDb((connection) =>
      connection.queryObject`
      SELECT
        name,
        week
      FROM
        winners
      ORDER BY
        week DESC
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
      <h2 class="text-2xl">Past Winners</h2>
      <table class="table-auto">
        <thead>
          <tr class="text-xs">
            <th>Name</th>
            <th>Week</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((
            { name, week },
            i,
          ) => (
            <tr key={i}>
              <td
                class="px-2"
                style={name === myName ? { fontWeight: "bold" } : {}}
              >
                {name.slice(0, 13)}
              </td>
              <td class="px-2">
                {week.toISOString().slice(0, 10)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </StatsTemplate>
  );
}
