import { runSql } from "@/utils/sql_files.ts";
import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  async POST(req, ctx) {
    const { params: { battle_id: bidString }, state: { connection } } = ctx;
    const battle_id = parseInt(bidString);
    await runSql({ file: "reset_battle", args: { battle_id }, connection });
    return new Response("ok");
  },
};
