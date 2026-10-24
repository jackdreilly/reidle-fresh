import { rpc } from "./supabase";

// Browser errors -> the activity log (log_error): window errors, unhandled rejections and pages that failed to
// load (the router rethrows those). index.html queues errors in window.__errs until this chunk loads after the
// first page, so it costs the first load nothing. Once per message per page load; never throws.
const sent = new Set<string>();

function report(e: unknown) {
  const message = String((e as Error)?.message ?? e).slice(0, 500);
  // ResizeObserver loop notices are harmless browser noise
  if (sent.has(message) || sent.size > 20 || /^ResizeObserver loop/.test(message)) return;
  sent.add(message);
  rpc("log_error", { p_message: message, p_data: { path: location.pathname } }).catch(() => {});
}

const w = window as unknown as { __errs?: unknown[] };
w.__errs?.forEach(report);
w.__errs = { push: report } as unknown as unknown[];
