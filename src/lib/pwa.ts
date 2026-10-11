import { useEffect, useState } from "preact/hooks";

/** Installed-app plumbing: service worker, install prompt, foreground refresh, online state, badge. */

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /mac/i.test(navigator.platform));

/** Call once at startup (before the browser fires beforeinstallprompt). */
export function initPwa(onResume: (prevDay: string, today: string) => void, today: () => string) {
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallPrompt; emit(); });
  addEventListener("appinstalled", () => { deferred = null; emit(); });
  addEventListener("online", emit);
  addEventListener("offline", emit);

  // An installed app is rarely reloaded: it sleeps in the background and resumes, possibly the next day.
  let hiddenAt = 0;
  let day = today();
  const resume = () => {
    const prev = day;
    day = today();
    if (Date.now() - hiddenAt < 60_000 && prev === day) return;
    onResume(prev, day);
    void navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else resume();
  });
  addEventListener("pageshow", (e) => { if (e.persisted) resume(); });

  if (!import.meta.hot && "serviceWorker" in navigator) { // any build, never the dev server
    // after load, so precaching the build never competes with the first page
    const register = () => void navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else addEventListener("load", register, { once: true });
  }
}

export type Install = { kind: "prompt"; install: () => Promise<void> } | { kind: "ios" } | null;

export function useInstall(): Install {
  useSubscribe();
  if (isStandalone()) return null;
  if (deferred) {
    const d = deferred;
    return { kind: "prompt", install: async () => { await d.prompt(); await d.userChoice; deferred = null; emit(); } };
  }
  return isIos() ? { kind: "ios" } : null;
}

export function useOnline() {
  useSubscribe();
  return navigator.onLine;
}

/** App icon badge (installed apps only; a no-op elsewhere). */
export function setBadge(on: boolean) {
  const n = navigator as { setAppBadge?: () => Promise<void>; clearAppBadge?: () => Promise<void> };
  (on ? n.setAppBadge?.() : n.clearAppBadge?.())?.catch(() => {});
}

function useSubscribe() {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
}
