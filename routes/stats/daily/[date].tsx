import { PageProps } from "$fresh/server.ts";
import { DailyTable, DailyTableData } from "@/components/daily_table.tsx";
import StatsTemplate from "@/components/stats_template.tsx";
import { fetchDay } from "@/utils/daily.ts";
import { SessionHandler } from "../../../utils/utils.ts";
export const handler: SessionHandler<DailyTableData> = {
  async GET(_, ctx) {
    return ctx.render(
      await fetchDay(new Date(ctx.params["date"]), ctx.state.connection),
    );
  },
};

export default function Page(
  { data: submissions }: PageProps<DailyTableData>,
) {
  return (
    <StatsTemplate route="today">
      <DailyTable submissions={submissions} />
    </StatsTemplate>
  );
}
