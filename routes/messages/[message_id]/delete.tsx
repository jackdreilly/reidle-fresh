import { SessionHandler } from "@/utils/utils.ts";
import run from "@/utils/db.ts";

export const handler: SessionHandler<null> = {
  async POST(_, ctx) {
    const id = parseInt(ctx.params.message_id);
    await run((cxn) =>
      cxn.queryArray`
        DELETE FROM
            messages
        WHERE
            id = ${id}
    `
    );
    return new Response("", {
      status: 303,
      headers: { location: "/messages" },
    });
  },
};
