import { SessionHandler } from "@/utils/utils.ts";
import { runSql } from "@/utils/sql_files.ts";

export const handler: SessionHandler<undefined> = {
  async GET(request, context) {
    return new Response("Party battle", {
      status: 307,
      headers: { Location: `/battles/7` },
    });
  },
};
