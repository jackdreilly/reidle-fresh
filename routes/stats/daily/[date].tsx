import { PageProps } from "$fresh/server.ts";
import { DailyTable, DailyTableData } from "@/components/daily_table.tsx";
import StatsTemplate from "@/components/stats_template.tsx";
import { fetchDay } from "@/utils/daily.ts";
import getWinner from "@/utils/get_winner.ts";
import { SessionHandler } from "@/utils/utils.ts";
interface Data {
  submissions: DailyTableData;
  name: string;
  winner?: string;
}
export const handler: SessionHandler<Data> = {
  async GET(_, ctx) {
    const day = new Date(ctx.params["date"]);
    return ctx.render(
      {
        submissions: await fetchDay(
          day,
          ctx.state.connection,
        ),
        name: ctx.state.name,
        winner: day.toISOString().slice(0, 10) ===
            new Date().toISOString().slice(0, 10)
          ? await getWinner(ctx.state.connection)
          : undefined,
      },
    );
  },
};

export default function Page(
  { data: { submissions, name, winner } }: PageProps<Data>,
) {
  return (
    <StatsTemplate route="today">
      <DailyTable name={name} submissions={submissions} />
      {winner && (
        <h2 class="m-4 text-xl">
          Last Week's Winner: <a class="text-blue-800 underline" href={`/players/${winner}`}>{winner}</a>
        </h2>
      )}
    </StatsTemplate>
  );
}
