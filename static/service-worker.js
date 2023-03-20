self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open('fox-store').then((cache) => cache.addAll([
            '/words.csv',
            '/answers.csv',
            '/android-chrome-192x192.png',
            '/android-chrome-384x384.png',
            '/android-chrome-512x512.png',
            '/apple-touch-icon.png',
            '/favicon.ico',
            '/mask.png',
            '/register.js',
        ])),
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request)),
    );
});