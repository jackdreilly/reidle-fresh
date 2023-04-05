import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  GET() {
    return new Response("Go to stats", {
      status: 307,
      headers: { location: "/stats/today" },
    });
  },
};
