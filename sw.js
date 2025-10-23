/* SpeedRead Pro — Service Worker */
const REPO_PATH = '/'; // np. '/SpeedRead-Pro/' lub '/' dla user pages
const VERSION = 'v1.0.0';
const STATIC_CACHE = `sr-static-${VERSION}`;
const RUNTIME_CACHE = `sr-runtime-${VERSION}`;

const PRECACHE_URLS = [
  `${REPO_PATH}`,
  `${REPO_PATH}index.html`,
  `${REPO_PATH}offline.html`,
  `${REPO_PATH}manifest.webmanifest`,
  `${REPO_PATH}icon-192.png`,
  `${REPO_PATH}icon-512.png`,
  `${REPO_PATH}apple-touch-icon-180.png`
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Pomocniczo: czy to jest żądanie nawigacji (przejście do strony)?
function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Navigation fallback -> offline.html
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return cache.match(`${REPO_PATH}offline.html`);
      })
    );
    return;
  }

  // Tylko same origin (GitHub Pages) z runtime caching
  const sameOrigin = new URL(request.url).origin === self.location.origin;

  if (sameOrigin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            return res;
          })
          .catch(() => cached); // offline: zwróć cache jeśli jest
        return cached || fetchPromise;
      })
    );
  }
  // CDN (font-awesome itp.) – zostaw domyślne zachowanie (bez narzucania CORS)
});
