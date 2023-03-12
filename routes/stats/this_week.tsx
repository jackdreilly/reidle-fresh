import { Handlers } from "$fresh/server.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";

export const handler: Handlers<unknown, WithSession> = {
  GET() {
    return new Response("", {
      status: 307,
      headers: {
        location: `/stats/weekly/${new Date().toISOString().slice(0, 10)}`,
      },
    });
  },
};
