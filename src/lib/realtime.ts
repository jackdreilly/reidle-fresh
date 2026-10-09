// Realtime is only needed by battles; this module is imported solely from the battle chunk.
import { RealtimeClient } from "@supabase/realtime-js";
import { accessToken, config } from "./supabase";

export const realtime = new RealtimeClient(`${config.URL.replace(/^http/, "ws")}/realtime/v1`, {
  params: { apikey: config.KEY },
  accessToken: async () => (await accessToken()) ?? config.KEY,
});
