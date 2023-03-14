import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  async POST(_, ctx) {
    const id = parseInt(ctx.params.message_id);
    await ctx.state.connection.queryArray`
        DELETE FROM
            messages
        WHERE
            id = ${id}
    `;
    return new Response("", {
      status: 303,
      headers: { location: "/messages" },
    });
  },
};
