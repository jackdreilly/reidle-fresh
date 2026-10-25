import { rpc } from "./supabase";
import { onShown, shown, type Shown } from "../router";

// Usage + error reporting for the owner dashboard (/admin). Loaded at idle after the first page (main.tsx), so it
// costs the first load nothing; errors from before that wait in window.__errs (index.html).
//
// Visits: a visit is this tab until it sits hidden for 30 minutes. Each page shown (route pattern, no ids or
// query) is sent with the time it was on screen, a few seconds after each page change, every minute, and when the
// tab is hidden (log_visit).

/* ---------- errors ---------- */

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

/* ---------- visits ---------- */

type View = { p: string; t: number; ms: number; lms?: number; k?: string };
const IDLE = 30 * 60_000;
const SID = "reidle:sid";

/** /players/ann -> /players/:name, /stats/daily/2026-10-24 -> /stats/daily/:date, /battles/12 -> /battles/:id */
export const pattern = (path: string) =>
  path.replace(/^\/players\/[^/]+/, "/players/:name").replace(/^\/join\/[^/]+/, "/join/:code")
    .replace(/\/\d{4}-\d{2}-\d{2}(?=\/|$)/g, "/:date").replace(/\/\d+(?=\/|$)/g, "/:id");

function device() {
  const ua = navigator.userAgent;
  return /iphone|ipad/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" : /macintosh/i.test(ua)
    ? (navigator.maxTouchPoints > 1 ? "iOS" : "Mac") : /windows/i.test(ua) ? "Windows" : /linux|cros/i.test(ua) ? "Linux" : "other";
}

function newSid() {
  const id = crypto.randomUUID();
  try { sessionStorage.setItem(SID, id); } catch { /* ignore */ }
  return id;
}

let sid = (() => { try { return sessionStorage.getItem(SID); } catch { return null; } })() ?? newSid();
let views: View[] = [];
// this module loads after the first page is up: that page has been on screen since the document started
const opened = Math.round(performance.timeOrigin);
let cur: View = { p: pattern(location.pathname), t: opened, ms: 0 };
let shownAt = document.visibilityState === "visible" ? opened : 0;
let hiddenAt = 0;
let dirty = new Set<View>([cur]);
let entry = cur.p;

function meta() {
  let ref: string | undefined;
  try { ref = document.referrer && new URL(document.referrer).host !== location.host ? new URL(document.referrer).host : undefined; }
  catch { /* ignore */ }
  return {
    device: device(), entry, ref, theme: document.documentElement.dataset.theme,
    pwa: matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
  };
}

/** Banks the on-screen time of the current page. */
function tick() {
  if (shownAt) { cur.ms += Date.now() - shownAt; shownAt = Date.now(); dirty.add(cur); }
}

function flush(keepalive = false) {
  tick();
  const batch = [...dirty].filter((v) => v.ms > 0 || v === cur).map((v) => ({ p: v.p, t: v.t, ms: Math.round(v.ms), lms: v.lms, k: v.k }));
  dirty = new Set();
  if (batch.length) void rpc("log_visit", { p_sid: sid, p_views: batch, p_meta: meta() }, { keepalive }).catch(() => {});
}

let soon = 0;
function show(path: string, replace: boolean) {
  const p = pattern(path);
  if (p === cur.p) return;
  tick();
  // report page changes promptly (batched), so the dashboard sees who is on now
  soon ||= window.setTimeout(() => { soon = 0; flush(); }, 3000);
  // a redirect right after a page opened renames it rather than counting a page nobody saw
  if (replace && cur.ms < 3000) { cur.p = p; if (views.length <= 1) entry = p; dirty.add(cur); return; }
  views.push(cur);
  cur = { p, t: Date.now(), ms: 0 };
  dirty.add(cur);
}
views.push(cur);

// page-show times (router.tsx): the ones from before this module loaded, then each as it happens
function timed(s: Shown) {
  const v = [cur, ...views].find((x) => x.p === pattern(s.path) && x.lms === undefined);
  if (!v) return;
  v.lms = s.ms;
  v.k = s.kind;
  dirty.add(v);
}
shown.forEach(timed);
onShown.cb = timed;

for (const m of ["pushState", "replaceState"] as const) {
  const orig = history[m].bind(history);
  history[m] = (data: unknown, unused: string, url?: string | URL | null) => {
    orig(data, unused, url);
    show(location.pathname, m === "replaceState");
  };
}
addEventListener("popstate", () => show(location.pathname, false));

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flush(true);
    shownAt = 0;
    hiddenAt = Date.now();
    return;
  }
  if (hiddenAt && Date.now() - hiddenAt > IDLE) {
    // back after a long break: a new visit, starting on this page
    sid = newSid();
    views = [];
    cur = { p: pattern(location.pathname), t: Date.now(), ms: 0 };
    entry = cur.p;
    views.push(cur);
    dirty = new Set([cur]);
  }
  shownAt = Date.now();
});
addEventListener("pagehide", () => flush(true));
setInterval(() => document.visibilityState === "visible" && flush(), 60_000);
flush();
