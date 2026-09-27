import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  async POST(_, ctx) {
    const message_id = parseInt(ctx.params.message_id);
    const name = ctx.state.name;
    await ctx.state.connection.queryArray`
        UPDATE
            messages
        SET
            likes = CASE
                WHEN likes && ARRAY[${name}] THEN likes
                ELSE likes || ARRAY[${name}]
            END
        WHERE
            message_id = ${message_id}
    `;
    return new Response("", {
      status: 303,
      headers: { location: "/messages" },
    });
  },
};
