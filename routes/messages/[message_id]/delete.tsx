import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  async POST(_, ctx) {
    const message_id = parseInt(ctx.params.message_id);
    await ctx.state.connection.queryArray`
        DELETE FROM
            messages
        WHERE
            message_id = ${message_id}
    `;
    return new Response("", {
      status: 303,
      headers: { location: "/messages" },
    });
  },
};
