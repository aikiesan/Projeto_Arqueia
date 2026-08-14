/* global URL, caches, fetch, self */

const STATIC_CACHE = 'arqueia-static-v2';
const STATIC_PATHS = ['/icons/arqueia.svg', '/icons/arqueia-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_PATHS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('arqueia-static-') && key !== STATIC_CACHE).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  // Runtime bundles are content-addressed in production, but their URLs are
  // reused by the development server. Keep only stable public icons here so
  // hot reload and native production deployments never serve stale code.
  const isStaticAsset = requestUrl.origin === self.location.origin
    && requestUrl.pathname.startsWith('/icons/');

  if (event.request.method !== 'GET' || !isStaticAsset) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    })),
  );
});
