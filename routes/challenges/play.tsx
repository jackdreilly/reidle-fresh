import { SessionHandler } from "@/utils/utils.ts";
import { runSql } from "@/utils/sql_files.ts";

export const handler: SessionHandler<null> = {
  async GET(req, ctx) {
    const { state: { connection, name } } = ctx;
    const { challenge_id } = await runSql({
      file: "challenge_next",
      args: { name },
      connection,
      single_row: true,
    });
    return new Response("Go to next challenge", {
      status: 307,
      headers: { location: `/challenges/challenge/${challenge_id}/play` },
    });
  },
};
