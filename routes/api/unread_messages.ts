import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  async GET(_, ctx) {
    const name = ctx.state.name;
    return new Response(
      await ctx.state.connection.queryArray`
SELECT
        COALESCE((
                     SELECT
                         "last_read"
                     FROM
                         "message_reads"
                     WHERE
                         "name" = ${name}
                 ),
                 '1970-01-01') < (
            SELECT
                MAX("created_at")
            FROM
                "messages"
        ) AS unread
`.then((x) => (x.rows[0][0] as boolean) ? "yes" : ""),
    );
  },
};
