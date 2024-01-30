import { SessionHandler } from "@/utils/utils.ts";
import { runSql } from "@/utils/sql_files.ts";

export const handler: SessionHandler<null> = {
  async POST(req, ctx) {
    const json = await req.json();
    const name = ctx.state.name;
    const args = {
      penalty: json.penalties,
      history: JSON.stringify(json.history),
      name,
    };
    await runSql({
      file: "checkpoint",
      args,
      connection: ctx.state.connection,
    });
    return new Response();
  },
};
