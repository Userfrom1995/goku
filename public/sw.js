/**
 * Goku Service Worker
 *
 * GitHub Pages cannot set custom HTTP headers.
 * We inject Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy
 * on every response so the page becomes "cross-origin isolated".
 * This enables SharedArrayBuffer (needed for multi-threaded WASM).
 */

const SW_VERSION = '1.0.0';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only intercept same-origin requests
  if (!url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
        newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      })
      .catch(() => new Response('Service Worker fetch error', { status: 500 }))
  );
});
