import type { ComponentType } from "preact";
import { useEffect, useState } from "preact/hooks";
import { notFound, routes, type Route } from "./routes";
import { signedIn } from "./boot";

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
export function prefetch(href: string) {
  const url = new URL(href, location.origin);
  const m = match(url.pathname);
  if (!m || m.route.redirect) return;
  void m.route.page?.();
  const key = url.pathname + url.search;
  const hit = warm.get(key);
  if (m.route.prefetchData && (!hit || Date.now() - hit.at > 10_000)) {
    const data = m.route.load?.(m.params, url.searchParams) ?? Promise.resolve();
    data.catch(() => warm.delete(key));
    warm.set(key, { at: Date.now(), data });
  }
}

export async function navigate(href: string, opts: { replace?: boolean; pop?: boolean } = {}): Promise<void> {
  const id = ++navId;
  const url = new URL(href, location.origin);
  const hit = match(url.pathname);
  const timer = setTimeout(() => { if (id === navId) { progress = true; emit(); } }, 120);
  try {
    if (!hit) {
      return finish(id, opts, url, { route: notFound, Page: (await notFound.page!()).default, params: {}, query: url.searchParams, data: null, key: url.href });
    }
    const { route, params } = hit;
    if (!route.public && !signedIn()) {
      return void navigate(`/sign-in?redirect=${encodeURIComponent(url.pathname + url.search)}`, { replace: true });
    }
    if (route.redirect) {
      return void navigate(await route.redirect(params, url.searchParams), { replace: true });
    }
    const key = url.pathname + url.search;
    const cached = warm.get(key);
    warm.delete(key);
    const fresh = cached && Date.now() - cached.at < 10_000 ? cached.data : route.load?.(params, url.searchParams);
    const [mod, data] = await Promise.all([route.page!(), fresh]);
    finish(id, opts, url, { route, Page: mod.default, params, query: url.searchParams, data, key: url.href });
  } catch (e) {
    // superseded by a newer navigation, or the page is going away: nothing to report
    if (id !== navId || (e as { code?: string }).code === "unloading") return;
    if (e instanceof Redirect) return void navigate(e.to, { replace: true });
    // A deploy replaced the hashed chunks this (old) page wants: reload once to pick up the new build.
    if (/dynamically imported module|importing a module script failed/i.test((e as Error)?.message ?? "")) {
      let last = 0;
      try { last = Number(sessionStorage.getItem("reidle:chunk-reload") ?? 0); } catch { /* ignore */ }
      if (Date.now() - last > 60_000) {
        try { sessionStorage.setItem("reidle:chunk-reload", String(Date.now())); } catch { /* ignore */ }
        return void location.assign(url.pathname + url.search);
      }
    }
    if ((e as { message?: string }).message === "not signed in") {
      return void navigate(`/sign-in?redirect=${encodeURIComponent(url.pathname + url.search)}`, { replace: true });
    }
    console.error(e);
    if (id === navId) { progress = false; emit(); }
  } finally {
    clearTimeout(timer);
  }
}

function finish(id: number, opts: { replace?: boolean; pop?: boolean }, url: URL, next: Current) {
  if (id !== navId) return;
  if (!opts.pop) history[opts.replace ? "replaceState" : "pushState"](null, "", url.pathname + url.search);
  current = next;
  progress = false;
  document.title = next.route.layout ? next.route.layout.title : "Reidle";
  if (!opts.pop) window.scrollTo(0, 0);
  emit();
}

export function startRouter() {
  addEventListener("popstate", () => void navigate(location.pathname + location.search, { pop: true, replace: true }));
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest?.("a");
    if (!a || a.target || a.hasAttribute("download") || a.origin !== location.origin) return;
    e.preventDefault();
    void navigate(a.pathname + a.search);
  });
  const hover = (e: Event) => {
    const a = (e.target as Element).closest?.("a");
    if (a && a.origin === location.origin) prefetch(a.href);
  };
  document.addEventListener("pointerover", hover, { passive: true });
  document.addEventListener("touchstart", hover, { passive: true });
  return navigate(location.pathname + location.search, { replace: true });
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
