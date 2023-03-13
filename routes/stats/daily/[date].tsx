import { Handlers, PageProps } from "$fresh/server.ts";
import { DailyTable, DailyTableData } from "@/components/daily_table.tsx";
import StatsTemplate from "@/components/stats_template.tsx";
import { fetchDay } from "@/utils/daily.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
export const handler: Handlers<DailyTableData, WithSession> = {
  async GET(_, ctx) {
    return ctx.render(
      await fetchDay(new Date(ctx.params["date"])),
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
