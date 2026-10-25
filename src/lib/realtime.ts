// Realtime is only needed by battles; this module is imported solely from the battle chunk.
import { RealtimeClient } from "@supabase/realtime-js";
import { accessToken, config, fail, request } from "./supabase";

export const realtime = new RealtimeClient(`${config.URL.replace(/^http/, "ws")}/realtime/v1`, {
  params: { apikey: config.KEY },
  accessToken: async () => (await accessToken()) ?? config.KEY,
});

/** Direct row update (only `battles` is writable by clients; RLS enforces it). */
export async function patchRow(table: string, match: Record<string, string | number>, patch: unknown): Promise<void> {
  const token = await accessToken();
  const qs = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join("&");
  const res = await request(`${config.URL}/rest/v1/${table}?${qs}`, {
    method: "PATCH",
    headers: { apikey: config.KEY, authorization: `Bearer ${token ?? config.KEY}`, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) await fail(res);
}

