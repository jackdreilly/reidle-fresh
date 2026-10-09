// The legacy (Fresh-era) app registered /service-worker.js on this origin and cached words.csv
// forever in "fox-store". If this origin is reused for the new app, browsers re-fetch that URL:
// serve a worker that removes itself and the old cache so the new app (/sw.js) takes over.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil((async () => {
    await caches.delete("fox-store");
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);
  })()));
