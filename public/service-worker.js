const CACHE_NAME = "mesa-arcana-v84";
const APP_SHELL = [
  "./",
  "./index.html",
  "./assets/app.css",
  "./assets/app.js",
  "./assets/theme.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("mesa-arcana-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Cloud requests must always reach the server, never the offline cache.
  if (url.origin !== self.location.origin) return;
  const shellUrls = APP_SHELL.map(file => new URL(file, self.registration.scope).href);
  if (!shellUrls.includes(url.href)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(event.request, { cache: "no-store" });
        if (response.ok && response.type !== "opaque") await cache.put(event.request, response.clone());
        return response;
      } catch (error) {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        throw error;
      }
    })()
  );
});
