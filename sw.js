// Keeps every load on one consistent version of the game. The game is many small ES modules;
// left to the HTTP cache, a browser can pair a fresh module with a stale cached one right after an
// update and fail to start. This worker sends each same-origin request with cache: 'no-cache', so
// the browser always revalidates (a cheap 304 when nothing changed). Other origins (PeerJS) pass.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req, { cache: 'no-cache' }).catch(() => caches.match(req)));
});
