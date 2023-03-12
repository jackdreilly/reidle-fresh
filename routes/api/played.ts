import { getName, SessionHandler } from "@/utils/utils.ts";
import run from "../../utils/db.ts";

const jsonHeaders = { headers: { "Content-Type": "application/json" } };

export const handler: SessionHandler<null> = {
  async GET(req, ctx) {
    const count = await run(async (cxn) => {
      const response = await cxn.queryObject<{ name: string; count: number }>`
            select
                count(*) as count
            from
                submissions
            where
                CURRENT_DATE = day
            and
                name = ${getName(ctx)}
        `;
      return response.rows[0].count;
    }) ?? 0;
    return new Response(JSON.stringify(count > 0), jsonHeaders);
  },
};
