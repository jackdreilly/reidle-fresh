import { getName, SessionHandler } from "@/utils/utils.ts";
import run from "@/utils/db.ts";

const jsonHeaders = { headers: { "Content-Type": "application/json" } };

export const handler: SessionHandler<null> = {
  async GET(_, ctx) {
    const name = getName(ctx);
    const count = await run((cxn) =>
      cxn.queryArray`
            select
                count(*)
            from
                submissions
            where
                CURRENT_DATE = day
            and
                name = ${name}
        `.then((x) => x.rows[0][0])
    ) ?? 0;
    return new Response(JSON.stringify(count > 0), jsonHeaders);
  },
};
