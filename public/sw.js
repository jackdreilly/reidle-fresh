// App-shell service worker. Only the build itself is cached, never game data:
// - install precaches every hashed asset of this build (injected at build time, see vite.config.ts)
//   plus the HTML shell, so the installed app opens instantly and Practice works offline;
// - hashed assets are cache-first (immutable); old builds' assets are pruned on activate;
// - navigations are network-first (a new deploy shows up immediately), falling back to the cached
//   shell only when offline or slow. Supabase calls (another origin) are never touched.
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
    const shell = await fetch(SHELL, { cache: "no-cache" }).catch(() => null);
    if (shell?.ok) await c.put(SHELL, shell);
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
    e.respondWith(caches.open(CACHE).then(async (c) =>
      (await c.match(request)) ?? fetch(request).then((r) => (r.ok && c.put(request, r.clone()), r))));
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
