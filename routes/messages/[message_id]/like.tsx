import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  async POST(_, ctx) {
    const message_id = Number(ctx.params.message_id);
    if (!Number.isSafeInteger(message_id)) {
      return new Response("Invalid message ID", { status: 400 });
    }
    const name = ctx.state.name;
    const result = await ctx.state.connection.queryArray`
        UPDATE
            messages
        SET
            likes = CASE
                WHEN COALESCE(likes, '{}'::varchar[]) @> ARRAY[${name}]::varchar[]
                    THEN COALESCE(likes, '{}'::varchar[])
                ELSE array_append(COALESCE(likes, '{}'::varchar[]), ${name})
            END
        WHERE
            message_id = ${message_id}
        RETURNING message_id
    `;
    if (result.rowCount !== 1) {
      return new Response("Message not found", { status: 404 });
    }
    return new Response("", {
      status: 303,
      headers: { location: "/messages" },
    });
  },
};
