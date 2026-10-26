import type { ComponentType } from "preact";
import { useEffect, useState } from "preact/hooks";
import { notFound, routes, type Route } from "./routes";
import { signedIn } from "./boot";
import { leagueId } from "./lib/league";
import { switchLeague } from "./lib/session";
import { clearPages, readPage, writePage } from "./lib/pagecache";

export class Redirect extends Error {
  constructor(public to: string) { super("redirect " + to); }
}

export type Params = Record<string, string>;
export type PageProps<D = unknown> = { params: Params; query: URLSearchParams; data: D };

type Current = { route: Route; Page: ComponentType<PageProps<any>>; params: Params; query: URLSearchParams; data: unknown; key: string };

let current: Current | null = null;
let progress = false;
let navId = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function match(pathname: string): { route: Route; params: Params } | null {
  for (const route of routes) {
    const names: string[] = [];
    const re = new RegExp("^" + route.path.replace(/:(\w+)/g, (_, n) => (names.push(n), "([^/]+)")) + "/?$");
    const m = pathname.match(re);
    if (m) return { route, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

// Warm chunk + data on hover/touch so the click is (nearly) instant.
const warm = new Map<string, { at: number; data: Promise<unknown> }>();
/** Drop prefetched page data, e.g. after a write that changes what pages show. */
export const clearPrefetch = () => { warm.clear(); clearPages(); };
export function prefetch(href: string) {
  const url = new URL(href, location.origin);
  const m = match(url.pathname);
  if (!m || m.route.redirect) return;
  void m.route.page?.();
  const key = leagueId() + url.pathname + url.search; // page data depends on the league (x-league header)
  const hit = warm.get(key);
  if (m.route.prefetchData && (!hit || Date.now() - hit.at > 10_000)) {
    const data = m.route.load?.(m.params, url.searchParams) ?? Promise.resolve();
    data.catch(() => warm.delete(key));
    warm.set(key, { at: Date.now(), data });
  }
}

type NavOpts = { replace?: boolean; pop?: boolean; refresh?: boolean; keepScroll?: boolean; first?: boolean };

/** How long each page took to show (tap, or document request for the first page, until painted). Read by telemetry. */
export type Shown = { path: string; ms: number; kind: "cold" | "warm" | "nav" | "cache" };
export const shown: Shown[] = [];
export const onShown = { cb: (_: Shown) => {} };
function measure(t0: number, kind: Shown["kind"]) {
  const path = location.pathname;
  requestAnimationFrame(() => setTimeout(() => {
    const s = { path, ms: Math.round(performance.now() - t0), kind };
    if (shown.push(s) > 50) shown.shift();
    onShown.cb(s);
  }));
}

export async function navigate(href: string, opts: NavOpts = {}): Promise<void> {
  const id = ++navId;
  const t0 = opts.first ? 0 : performance.now();
  const url = new URL(href, location.origin);
  // ?league=N (notification links, shared links) switches league first
  const lq = Number(url.searchParams.get("league"));
  if (url.searchParams.has("league")) url.searchParams.delete("league");
  if (lq && signedIn() && lq !== leagueId()) {
    warm.clear();
    await switchLeague(lq).catch(() => {});
    if (id !== navId) return;
  }
  const hit = match(url.pathname);
  const timer = setTimeout(() => { if (id === navId) { progress = true; emit(); } }, 120);
  try {
    if (!hit) {
      return finish(id, opts, url, { route: notFound, Page: (await notFound.page!()).default, params: {}, query: url.searchParams, data: null, key: url.href });
    }
    const { route, params } = hit;
    if (!route.public && !signedIn()) {
      return void navigate(`/sign-in?redirect=${encodeURIComponent(url.pathname + url.search)}`, { replace: true, first: opts.first });
    }
    if (route.redirect) {
      return void navigate(await route.redirect(params, url.searchParams), { replace: true, first: opts.first });
    }
    const key = leagueId() + url.pathname + url.search;
    const cached = warm.get(key);
    warm.delete(key);
    const fresh = cached && Date.now() - cached.at < 10_000 ? cached.data : route.load?.(params, url.searchParams);
    // seen before on this device: show that now, swap in the fresh data when it lands (a refresh waits for it)
    const kept = route.instant ? readPage(key) : undefined;
    if (kept !== undefined && !opts.refresh) {
      const mod = await route.page!();
      finish(id, opts, url, { route, Page: mod.default, params, query: url.searchParams, data: JSON.parse(kept), key: url.href });
      if (id === navId) measure(t0, "cache");
      return void Promise.resolve(fresh).then((data) => {
        writePage(key, data);
        if (id === navId && current && JSON.stringify(data) !== kept) { current = { ...current, data }; emit(); }
      }, () => {
        // whatever the page would have shown (a redirect, an error): load it the normal way
        if (id === navId) void navigate(url.pathname + url.search, { replace: true, pop: true, refresh: true, keepScroll: true });
      });
    }
    const [mod, data] = await Promise.all([route.page!(), fresh]);
    if (route.instant) writePage(key, data);
    // a refresh remounts the page so state derived from the old data (and realtime channels) restart
    finish(id, opts, url, { route, Page: mod.default, params, query: url.searchParams, data, key: url.href + (opts.refresh ? "#" + id : "") });
    if (id === navId && !opts.refresh) measure(t0, opts.first ? (navigator.serviceWorker?.controller ? "warm" : "cold") : "nav");
  } catch (e) {
    // superseded by a newer navigation, or the page is going away: nothing to report
    if (id !== navId || (e as { code?: string }).code === "unloading") return;
    if (e instanceof Redirect) return void navigate(e.to, { replace: true, first: opts.first });
    // A deploy replaced the hashed chunks this (old) page wants: reload once to pick up the new build.
    if (/dynamically imported module|importing a module script failed/i.test((e as Error)?.message ?? "")) {
      let last = 0;
      try { last = Number(sessionStorage.getItem("reidle:chunk-reload") ?? 0); } catch { /* ignore */ }
      if (Date.now() - last > 60_000) {
        try { sessionStorage.setItem("reidle:chunk-reload", String(Date.now())); } catch { /* ignore */ }
        return void location.assign(url.pathname + url.search);
      }
    }
    if ((e as { message?: string }).message === "not in a league") return void navigate("/welcome", { replace: true });
    if ((e as { message?: string }).message === "not signed in") {
      return void navigate(`/sign-in?redirect=${encodeURIComponent(url.pathname + url.search)}`, { replace: true });
    }
    // rethrown outside the router: the console shows it and src/lib/report.ts logs it
    setTimeout(() => { throw e; });
    if (id === navId) { progress = false; emit(); }
  } finally {
    clearTimeout(timer);
  }
}

function finish(id: number, opts: NavOpts, url: URL, next: Current) {
  if (id !== navId) return;
  if (!opts.pop) history[opts.replace ? "replaceState" : "pushState"](null, "", url.pathname + url.search);
  current = next;
  progress = false;
  document.title = next.route.layout ? next.route.layout.title : "Reidle";
  if (!opts.pop && !opts.keepScroll) window.scrollTo(0, 0);
  emit();
}

const isFile = (path: string) => /\.[a-z0-9]+$/i.test(path);

export function startRouter() {
  addEventListener("popstate", () => void navigate(location.pathname + location.search, { pop: true, replace: true }));
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest?.("a");
    if (!a || a.target || a.hasAttribute("download") || a.origin !== location.origin) return;
    if (isFile(a.pathname)) return; // /static/promo.mp4, /privacy.html: real files, not app routes
    e.preventDefault();
    void navigate(a.pathname + a.search);
  });
  const hover = (e: Event) => {
    const a = (e.target as Element).closest?.("a");
    if (a && a.origin === location.origin && !isFile(a.pathname)) prefetch(a.href);
  };
  document.addEventListener("pointerover", hover, { passive: true });
  document.addEventListener("touchstart", hover, { passive: true });
  return navigate(location.pathname + location.search, { replace: true, first: true });
}

/**
 * Re-load the current page's data in place, e.g. when an installed app comes back to the foreground
 * hours later (there is no reload button or pull-to-refresh in standalone mode). Pages pinned to
 * "today" move on to the new day. Game pages (fullPage) are left alone so a running game is never reset.
 */
export function refresh(prevDay: string, today: string) {
  if (!current || current.route.layout?.fullPage || progress) return;
  let href = location.pathname + location.search;
  if (prevDay !== today) {
    if (href === `/stats/daily/${prevDay}`) href = "/stats/today";
    else if (href === `/stats/weekly/${prevDay}`) href = "/stats/this_week";
  }
  warm.clear();
  return navigate(href, { replace: true, pop: href === location.pathname + location.search, refresh: true });
}

export function useRouter() {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    l(); // re-sync: navigation may have finished before this effect subscribed
    return () => void listeners.delete(l);
  }, []);
  return { current, progress };
}
