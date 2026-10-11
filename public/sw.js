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

// Chat push notifications (opt-in on the Messages page; sent by supabase/functions/push).
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data?.json() ?? {}; } catch { /* not JSON: show a generic notification */ }
  e.waitUntil(self.registration.showNotification(d.title ?? "Reidle", {
    body: d.body ?? "New message",
    tag: d.tag,
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
