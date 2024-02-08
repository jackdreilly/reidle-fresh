import { SessionHandler } from "@/utils/utils.ts";
import { runSql } from "@/utils/sql_files.ts";

export const handler: SessionHandler<null> = {
  async GET(_, ctx) {
    return Response.json(
      await runSql({ file: "rankings", connection: ctx.state.connection }),
    );
  },
};
