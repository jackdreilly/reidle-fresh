import { Handlers, PageProps } from "$fresh/server.ts";
import StatsTemplate from "@/components/stats_template.tsx";
import WeekTablePage, { WeekTableData } from "@/components/week_table.tsx";
import { getName } from "@/utils/utils.ts";
import { fetchWeek } from "@/utils/week.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
export const handler: Handlers<WeekTableData, WithSession> = {
  async GET(_, ctx) {
    return ctx.render({ ...await fetchWeek(true), name: getName(ctx) });
  },
};

export default function Page(
  { data }: PageProps<WeekTableData>,
) {
  return (
    <StatsTemplate>
      <h2>This Week</h2>
      <WeekTablePage data={data} />
    </StatsTemplate>
  );
}