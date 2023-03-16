import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  GET(req, ctx) {
    ctx.state.name = "";
    return new Response("signed out", {
      status: 307,
      headers: { location: "/" },
    });
  },
};
