/* Super-Agent service worker: offline app shell, never caches APIs or auth. */
const CACHE = "spa-shell-v1";
const SHELL = ["/", "/app/", "/index.html", "/app/index.html", "/styles.css", "/manifest.webmanifest"];
const STATIC_RE = /\.(?:js|css|png|svg|woff2?)$/;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).catch(() => {})
      .then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Never touch APIs, auth, workers, or cross-origin dynamic calls.
  if (url.pathname.startsWith("/__workers/")) return;
  if (url.origin !== self.location.origin && !/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) return;
  if (/js\.puter\.com/.test(url.hostname)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Navigations: network first, fall back to cached shell offline.
    if (e.request.mode === "navigate") {
      try {
        const fresh = await fetch(e.request);
        if (fresh.ok) cache.put(e.request, fresh.clone());
        return fresh;
      } catch {
        return (await cache.match(url.pathname.startsWith("/app") ? "/app/index.html" : "/index.html"))
          || (await cache.match("/"));
      }
    }
    // Versioned/bundled statics: cache first.
    if (STATIC_RE.test(url.pathname) || /cdn|fonts/.test(url.hostname)) {
      const hit = await cache.match(e.request);
      if (hit) return hit;
      try {
        const fresh = await fetch(e.request);
        if (fresh.ok) cache.put(e.request, fresh.clone());
        return fresh;
      } catch {
        return hit || Response.error();
      }
    }
  })());
});
