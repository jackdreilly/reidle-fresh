import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  async GET(_, ctx) {
    const name = ctx.state.name;
    return new Response(
      await ctx.state.connection.queryObject<{ played: string }>`
    select
        LOWER((count(*) > 0)::TEXT) as played
    from
        submissions
    where
        CURRENT_DATE = day
    and
        name = ${name}
`.then((x) => x.rows[0].played),
      { headers: { "Content-Type": "application/json" } },
    );
  },
};
