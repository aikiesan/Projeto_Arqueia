/* global Response, URL, caches, fetch, self */

const STATIC_CACHE = 'arqueia-static-v4';
const OFFLINE_CACHE = 'arqueia-offline-v1';

// Arquivo estatico: nao passa pelo build do Next, entao nao ha NEXT_PUBLIC_*.
// O prefixo vem da propria URL do script ('/arqueia/sw.js' -> '/arqueia').
const SCOPE_PATH = new URL('./', self.location).pathname.replace(/\/$/, '');
const scoped = (path) => `${SCOPE_PATH}${path}`;

const STATIC_PATHS = [
  scoped('/icons/arqueia.svg'),
  scoped('/icons/arqueia-maskable.svg'),
  scoped('/brand/cp2b-avatar.svg'),
  scoped('/manifest.webmanifest'),
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sem Conexão · Arqueia</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f4f6f3;
      color: #123f34;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1.5rem;
      box-sizing: border-box;
    }
    .card {
      background: #ffffff;
      border: 1px solid #d4ddd6;
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
      max-width: 420px;
      padding: 2rem;
      text-align: center;
    }
    h1 { font-size: 1.25rem; font-weight: 800; margin: 0.75rem 0 0.5rem; }
    p { font-size: 0.9rem; line-height: 1.5; color: #4a5d54; margin: 0 0 1.5rem; }
    button {
      background: #123f34;
      border: 0;
      border-radius: 8px;
      color: #ffffff;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 700;
      min-height: 44px;
      padding: 0.6rem 1.5rem;
    }
    button:hover { background: #0b2922; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 2.5rem;">📶</div>
    <h1>Você está offline</h1>
    <p>O Arqueia requer conexão para sincronizar dados e garantir a integridade do livro-razão e agenda.</p>
    <button onclick="window.location.reload()">Tentar novamente</button>
  </div>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_PATHS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              (key.startsWith('arqueia-static-') && key !== STATIC_CACHE) ||
              (key.startsWith('arqueia-offline-') && key !== OFFLINE_CACHE),
          )
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Never cache API or non-GET requests to preserve ledger and audit security
  if (event.request.method !== 'GET') return;
  if (requestUrl.pathname.startsWith(scoped('/api/'))) return;

  const isStaticAsset =
    requestUrl.origin === self.location.origin &&
    (requestUrl.pathname.startsWith(scoped('/icons/')) ||
      requestUrl.pathname.startsWith(scoped('/brand/')) ||
      requestUrl.pathname === scoped('/manifest.webmanifest'));

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ??
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // For HTML navigation requests, implement network-first with graceful offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(OFFLINE_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
          status: 503,
          statusText: 'Service Unavailable',
        }),
      ),
    );
  }
});
