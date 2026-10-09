// App-shell service worker: hashed assets are immutable (cache-first); the HTML shell is
// stale-while-revalidate so repeat visits paint instantly. Supabase calls are never cached.
const CACHE = "reidle-v1";

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
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const cached = await c.match("/index.html");
      const network = fetch("/index.html").then((r) => (r.ok && c.put("/index.html", r.clone()), r));
      return cached ?? network;
    }));
  }
});
