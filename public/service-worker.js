const CACHE_NAME = "mesa-arcana-v89";
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

self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json() || {}; } catch { /* Use a generic notification for invalid payloads. */ }
    await self.registration.showNotification(String(payload.sender || "Mesa Arcana"), {
      body: String(payload.body || "Você recebeu uma nova mensagem."),
      icon: new URL("./icons/icon-192.png", self.registration.scope).href,
      badge: new URL("./icons/icon-192.png", self.registration.scope).href,
      tag: `message-${payload.messageId || Date.now()}`,
      data: { tableId: payload.tableId, conversationKey: payload.conversationKey }
    });
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL(self.registration.scope);
    const details = event.notification.data || {};
    if (details.tableId && details.conversationKey) {
      url.searchParams.set("pushTable", details.tableId);
      url.searchParams.set("pushConversation", details.conversationKey);
    }
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => client.url.startsWith(self.registration.scope));
    if (existing) {
      await existing.navigate(url.href);
      await existing.focus();
    } else await self.clients.openWindow(url.href);
  })());
});
