// Caches the app shell (the built JS/CSS bundle + icon) the first time it's
// loaded with a signal, so it can still open with no signal after that —
// the whole point being a coach's phone at a pitch with patchy reception.
// Deliberately simple: cache-first for the app's own built assets, network
// for everything else (Firebase/Firestore calls are never touched here —
// those go straight to the network, same as always).
const CACHE_NAME = "bench-buddy-shell-v2";
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

  // Real-use feedback: the entry document (every navigation — opening the
  // installed home-screen app, or a plain reload) used to be cache-first
  // same as everything else, which meant a phone that installed this as a
  // PWA could get stuck showing whatever version happened to be cached
  // from its last good-signal open — a real fix (a new build's index.html,
  // pointing at a new hashed JS bundle) never actually reaches the coach
  // until some later open both has a connection AND revalidates in time.
  // Network-first here instead: try the real network first, and only fall
  // back to cache (this exact URL, or the shell's own "/" as a last
  // resort) when that fails — which is still the same patchy-reception
  // safety net as before, just no longer the *default* path when a
  // connection is actually available.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Everything else — the hashed JS/CSS bundle, icons, manifest — stays
  // cache-first. These are either content-hashed (a new deploy is a new
  // URL, so serving an old cached one is impossible, not just unlikely)
  // or near-static, so instant-from-cache is the right tradeoff here.
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
