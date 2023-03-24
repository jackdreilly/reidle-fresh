import { guardLogin, SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  GET(_req, ctx) {
    return guardLogin(ctx) ??
      new Response("Go to stats", {
        status: 307,
        headers: { location: "/stats/today" },
      });
  },
};
