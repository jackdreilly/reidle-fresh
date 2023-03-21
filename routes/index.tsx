import { PageProps } from "$fresh/server.ts";
import { DailyTable } from "@/components/daily_table.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { DailySubmission, fetchDay } from "@/utils/daily.ts";
import getWinner from "@/utils/get_winner.ts";
import { guardLogin, SessionHandler } from "@/utils/utils.ts";
import { played } from "@/routes/api/played.ts";

interface Data {
  name: string;
  winner: string;
  submissions: DailySubmission[];
  played: boolean;
}

export const handler: SessionHandler<Data> = {
  async GET(_req, ctx) {
    return guardLogin(ctx) ?? ctx.render({
      submissions: await fetchDay(new Date(), ctx.state.connection),
      winner: await getWinner(ctx.state.connection),
      name: ctx.state.name,
      played: await played(ctx),
    });
  },
};

export default function Home(
  { data: { name, winner, submissions, played } }: PageProps<Data>,
) {
  return (
    <ReidleTemplate title="Reidle" route="/">
      Welcome to Reidle, {name}!
      <p>
        Last week's winner:{" "}
        <a
          href={`/players/${winner}`}
          class="text-blue-600 dark:text-blue-500 hover:underline"
        >
          {winner}
        </a>
      </p>
      <div>
        <h2 class="m-4">Today</h2>
        <DailyTable name={name} hide={!played} submissions={submissions} />
      </div>
    </ReidleTemplate>
  );
}
