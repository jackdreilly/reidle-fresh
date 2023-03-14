import { PageProps } from "$fresh/server.ts";
import StatsTemplate from "@/components/stats_template.tsx";
import WeekTablePage, { WeekTableData } from "@/components/week_table.tsx";
import { getName, SessionHandler } from "@/utils/utils.ts";
import { fetchWeek } from "@/utils/week.ts";
export const handler: SessionHandler<WeekTableData> = {
  async GET(_, ctx) {
    const startDay = new Date(ctx.params["startDay"]);
    startDay.setDate(startDay.getDate() - (startDay.getDay() + 6) % 7);
    return ctx.render({
      ...await fetchWeek(startDay, ctx.state.connection),
      name: getName(ctx),
    });
  },
};

export default function Page(
  { data }: PageProps<WeekTableData>,
) {
  return (
    <StatsTemplate route="this_week">
      <WeekTablePage data={data} />
    </StatsTemplate>
  );
}
