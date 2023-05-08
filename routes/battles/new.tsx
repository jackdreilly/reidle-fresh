import { SessionHandler } from "@/utils/utils.ts";
import { runSql } from "@/utils/sql_files.ts";

export const handler: SessionHandler<undefined> = {
  async GET(request, context) {
    const { state: { name, connection } } = context;
    const battle_id = (await runSql({
      file: "new_battle",
      single_row: true,
      connection,
      args: { name },
    })).battle_id;
    return new Response("new battle", {
      status: 307,
      headers: { Location: `/battles/${battle_id}` },
    });
  },
};
