import { Handlers } from "https://deno.land/x/fresh@1.1.3/server.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
import { db } from "../../../db.ts";
import { getName } from "../../../utils.ts";

export const handler: Handlers<unknown, WithSession> = {
  POST(req, ctx) {
    const message_id = parseInt(ctx.params.message_id);
    const name = getName(ctx);
    const query = db.prepareQuery<
      [string],
      { name: string },
      { message_id: number }
    >(`
            SELECT
                name
            FROM
                messages
            WHERE
                id = :message_id
            LIMIT
                1;
                `);
    const messageName = query.firstEntry({ message_id })?.name;
    query.finalize();
    if (messageName == name) {
      // deno-lint-ignore ban-types
      const query = db.prepareQuery<[], {}, { message_id: number }>(`
            DELETE FROM
                messages
            WHERE
                id = :message_id;
        `);
      query.execute({ message_id });
      query.finalize();
    }
    return new Response("", {
      status: 303,
      headers: { Location: "/messages" },
    });
  },
};
