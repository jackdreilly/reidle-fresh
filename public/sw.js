// App-shell service worker: hashed assets are immutable (cache-first); the HTML shell is
// network-first with an offline fallback. Supabase calls are never cached.
const CACHE = "reidle-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
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
    // Network-first so a new deploy is picked up immediately (hashed chunks of old builds are gone);
    // fall back to the cached shell only when offline/slow.
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const r = await Promise.race([
          fetch("/index.html"),
          new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), 3000)),
        ]);
        if (r.ok) c.put("/index.html", r.clone());
        return r;
      } catch {
        return (await c.match("/index.html")) ?? Response.error();
      }
    })());
  }
});
