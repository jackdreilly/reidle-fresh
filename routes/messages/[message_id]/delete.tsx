import { Handlers } from "$fresh/server.ts";
import { pool } from "@/utils/db.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";

export const handler: Handlers<null, WithSession> = {
  async POST(req, ctx) {
    const id = ctx.params.message_id;
    const cxn = await pool.connect();
    await cxn.queryObject<{ id: number }>`
        DELETE FROM
            messages
        WHERE
            id = ${id}
    `;
    cxn.release();
    return new Response("", {
      status: 303,
      headers: { location: "/messages" },
    });
  },
};
