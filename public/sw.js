// Caches the app shell (the built JS/CSS bundle + icon) the first time it's
// loaded with a signal, so it can still open with no signal after that —
// the whole point being a coach's phone at a pitch with patchy reception.
// Deliberately simple: cache-first for the app's own built assets, network
// for everything else (Firebase/Firestore calls are never touched here —
// those go straight to the network, same as always).
const CACHE_NAME = "bench-buddy-shell-v1";
const SHELL_URLS = ["/", "/manifest.json", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only ever handle this app's own same-origin GETs — everything else
  // (Firestore, Auth, reCAPTCHA, fonts) passes straight through untouched.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => cached); // offline: fall back to whatever's cached, if anything
      return cached || network;
    })
  );
});
