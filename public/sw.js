// App-shell service worker. Only the build itself is cached, never game data:
// - install precaches every hashed asset of this build (injected at build time, see vite.config.ts)
//   plus the HTML shell, so the installed app opens instantly and Practice works offline;
// - hashed assets are cache-first (immutable); old builds' assets are pruned on activate;
// - navigations are network-first (a new deploy shows up immediately), falling back to the cached
//   shell only when offline or slow. Supabase calls (another origin) are never touched.
// Unhashed files the shell shows (logo) or the OS asks for (icons); refreshed with each new build.
const STATIC = ["/android-chrome-96x96.webp", "/android-chrome-192x192.png", "/apple-touch-icon.png", "/manifest.webmanifest"];
const PRECACHE = self.__PRECACHE__ ?? [];
const CACHE = "reidle-" + (self.__BUILD__ ?? "dev");
const SHELL = "/index.html";

self.addEventListener("install", (e) =>
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // Reuse assets the previous build already cached (most chunks don't change between deploys).
    await Promise.all(PRECACHE.map(async (u) => {
      const hit = await caches.match(u);
      if (hit) return c.put(u, hit);
      const r = await fetch(u);
      if (r.ok) await c.put(u, r);
    })).catch(() => {});
    for (const u of [SHELL, ...STATIC]) {
      const r = await fetch(u, { cache: "no-cache" }).catch(() => null);
      if (r?.ok) await c.put(u, r);
    }
    await self.skipWaiting();
  })()));

self.addEventListener("activate", (e) =>
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.registration.navigationPreload?.enable().catch(() => {});
    await self.clients.claim();
  })()));

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/assets/")) {
    // ignoreVary: hashed files never vary, and a server's `Vary: Origin` (vite preview) would otherwise make
    // the precached copy (fetched without Origin) miss for module imports (sent with Origin).
    e.respondWith(caches.open(CACHE).then(async (c) =>
      (await c.match(request, { ignoreVary: true })) ?? fetch(request).then((r) => (r.ok && c.put(request, r.clone()), r))));
  } else if (STATIC.includes(url.pathname)) {
    // network-first: the files can change in place; the cached copy is the offline fallback
    e.respondWith(fetch(request).catch(async () => (await caches.match(url.pathname)) ?? Response.error()));
  } else if (request.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const r = await Promise.race([
          e.preloadResponse.then((p) => p ?? fetch(SHELL, { cache: "no-cache" })),
          new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), 3000)),
        ]);
        // Every route is the same SPA shell; keep the latest copy for offline starts.
        if (r.ok) c.put(SHELL, r.clone());
        return r;
      } catch {
        return (await c.match(SHELL)) ?? Response.error();
      }
    })());
  }
});

// Push notifications (opt-in on the Settings page or the Messages bell; sent by supabase/functions/push).
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data?.json() ?? {}; } catch { /* not JSON: show a generic notification */ }
  e.waitUntil(self.registration.showNotification(d.title ?? "Reidle", {
    body: d.body ?? "New message",
    tag: d.tag,
    renotify: !!d.tag, // same tag (e.g. today's results) replaces the old one but still alerts
    icon: "/android-chrome-192x192.png",
    data: { url: d.url ?? "/messages" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? "/messages";
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = open.find((c) => "focus" in c);
    if (!client) return self.clients.openWindow(url);
    client.postMessage({ type: "navigate", url }); // the app routes in place (main.tsx)
    await client.focus();
  })());
});
