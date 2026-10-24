import { rpc } from "./supabase";

const sent = new Set<string>();

/** Sends a browser error to the activity log (log_error; once per message per page load, never throws). */
export function reportError(e: unknown, info: Record<string, unknown> = {}) {
  const message = String((e as Error)?.message ?? e).slice(0, 500);
  if (sent.has(message) || sent.size > 20) return;
  sent.add(message);
  rpc("log_error", { p_message: message, p_data: { ...info, path: location.pathname } }).catch(() => {});
}
