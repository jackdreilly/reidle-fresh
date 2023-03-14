import { Handlers, PageProps } from "$fresh/server.ts";
import { DailyTable } from "@/components/daily_table.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { DailySubmission, fetchDay } from "@/utils/daily.ts";
import getWinner from "@/utils/get_winner.ts";
import { getName, SessionHandler } from "@/utils/utils.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";

interface Data {
  name: string;
  winner: string;
  submissions: DailySubmission[];
}

export const handler: SessionHandler<Data> = {
  async GET(_req, ctx) {
    const { connection } = ctx.state;
    const name = getName(ctx);
    if (!name) {
      return new Response("", {
        status: 307,
        headers: { Location: "/set-name" },
      });
    }
    const submissions = await fetchDay(new Date(), connection);
    const winner = await getWinner(connection);
    return ctx.render({ submissions, winner, name });
  },
};

export default function Home(
  { data: { name, winner, submissions } }: PageProps<Data>,
) {
  return (
    <ReidleTemplate route="/">
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
        <DailyTable submissions={submissions} />
      </div>
    </ReidleTemplate>
  );
}
