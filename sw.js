/*
 * 49Peak service worker — deployment scaffolding only, no app logic lives
 * here. Its two jobs:
 *   1. Satisfy Android's "installable PWA" criteria (a registered service
 *      worker is one of Chrome's install requirements), so "Add to Home
 *      Screen" creates a real installed app (WebAPK) instead of a fragile
 *      bookmark shortcut that Samsung's cleanup can quietly remove.
 *   2. Cache the app shell so it still loads with zero connectivity,
 *      reinforcing the offline-only design at the platform layer too —
 *      the app already works offline via localStorage/Firestore's own
 *      offline cache; this just makes the page load itself resilient too.
 *
 * Everything the app actually does (calculations, storage, UI, cloud sync)
 * stays in index.html exactly as before. This file never fetches anything
 * from a network origin beyond the app's own files.
 */

const CACHE_PREFIX = "49peak-shell-";
const CACHE_NAME = CACHE_PREFIX + "v8";
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
      // Only ever touch this app's own cache generations — other apps on the
      // same origin (reevesy12.github.io) have their own differently-prefixed
      // cache names and must never be deleted by this activate handler.
      Promise.all(
        keys
          .filter((k) => k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Network-first: always try to get the latest version when online, so
// code updates (like this Firebase migration) actually reach the installed
// app instead of being masked by a stale cached copy. Falls back to the
// cached shell only when the network request fails (offline).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
