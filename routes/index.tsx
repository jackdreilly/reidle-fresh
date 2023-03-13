import { Handlers, PageProps } from "$fresh/server.ts";
import { DailyTable } from "@/components/daily_table.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { DailySubmission, fetchDay } from "@/utils/daily.ts";
import run from "@/utils/db.ts";
import getWinner from "@/utils/get_winner.ts";
import { getName } from "@/utils/utils.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";

interface Data {
  name: string;
  winner: string;
  submissions: DailySubmission[];
}

export const handler: Handlers<
  Data,
  WithSession
> = {
  async GET(_req, ctx) {
    const name = getName(ctx);
    if (!name) {
      return new Response("", {
        status: 307,
        headers: { Location: "/set-name" },
      });
    }
    const result = await run(async (cxn) => {
      return {
        winner: await getWinner(cxn),
        submissions: await fetchDay(new Date(), cxn),
      };
    });
    const { winner, submissions } = result ??
      { winner: "...", submissions: [] };
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
        Last week's winner: <strong class="text-purple-900">{winner}</strong>
      </p>
      <div>
        <h2 class="m-4">Today</h2>
        <DailyTable submissions={submissions} />
      </div>
    </ReidleTemplate>
  );
}
