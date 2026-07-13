/*
 * 49Peak service worker — deployment scaffolding only, no app logic lives
 * here. Its two jobs:
 *   1. Satisfy Android's "installable PWA" criteria (a registered service
 *      worker is one of Chrome's install requirements), so "Add to Home
 *      Screen" creates a real installed app (WebAPK) instead of a fragile
 *      bookmark shortcut that Samsung's cleanup can quietly remove.
 *   2. Cache the app shell so it still loads with zero connectivity,
 *      reinforcing the offline-only design at the platform layer too —
 *      the app already works offline via localStorage; this just makes
 *      the page load itself resilient as well.
 *
 * Everything the app actually does (calculations, storage, UI) stays in
 * index.html exactly as before. This file never fetches anything from a
 * network origin beyond the app's own files.
 */

const CACHE_NAME = "49peak-shell-v2";
const SHELL_FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for the app shell, with a network attempt kept only as a
// fallback (e.g. the very first load). Everything the app needs after
// that first load is already in localStorage, not fetched.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
