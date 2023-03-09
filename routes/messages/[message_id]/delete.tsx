import { getName, SessionHandler } from "@/utils/utils.ts";
import runDb from "../../../utils/db.ts";

export const handler: SessionHandler<null> = {
  async POST(req, ctx) {
    const id = parseInt(ctx.params.message_id);
    const name = getName(ctx);
    await runDb(async (cxn) => {
      if (id < 0) {
        await cxn.queryObject<{ id: number; name: string }>`
          DELETE FROM
              messages
          WHERE
              id = (
                SELECT
                  id
                FROM
                  messages
                WHERE
                  name = ${name}
                ORDER BY
                  created_at DESC
                LIMIT 1
              )
      `;
      } else {
        await cxn.queryObject<{ id: number }>`
        DELETE FROM
            messages
        WHERE
            id = ${id}
    `;
      }
    });
    return new Response("", {
      status: 303,
      headers: { location: "/messages" },
    });
  },
};
