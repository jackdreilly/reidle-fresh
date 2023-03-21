import { PageProps } from "$fresh/server.ts";
import { DailyTable, DailyTableData } from "@/components/daily_table.tsx";
import StatsTemplate from "@/components/stats_template.tsx";
import { fetchDay } from "@/utils/daily.ts";
import { SessionHandler } from "../../../utils/utils.ts";
interface Data {
  submissions: DailyTableData;
  name: string;
}
export const handler: SessionHandler<Data> = {
  async GET(_, ctx) {
    return ctx.render(
      {
        submissions: await fetchDay(
          new Date(ctx.params["date"]),
          ctx.state.connection,
        ),
        name: ctx.state.name,
      },
    );
  },
};

export default function Page(
  { data: { submissions, name } }: PageProps<Data>,
) {
  return (
    <StatsTemplate route="today">
      <DailyTable name={name} submissions={submissions} />
    </StatsTemplate>
  );
}
