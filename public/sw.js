/**
 * Service worker for Apex Reps PWA.
 *
 * Strategy:
 *  - install: precache the app shell ("/" and "/index.html") so the SPA loads offline.
 *  - fetch: navigation requests are network-first with a cached-shell fallback (offline SPA).
 *            other assets are cache-first-then-network.
 *
 * Data (food search results, custom foods) is handled separately by the IndexedDB
 * cache (`useFoodCache`) and the sync queue (`useSyncQueue`), not here.
 */

const CACHE_NAME = "apex-reps-v1";
const SHELL_ASSETS = ["/", "/index.html"];
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Navigation requests (HTML shell): network-first, fall back to cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  // Other assets: cache-first, then network.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
