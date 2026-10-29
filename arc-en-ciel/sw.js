/* Coque hors ligne : seules les ressources statiques sont mises en cache. Les données (API) ne le sont jamais. */
const V = "arc-v2", COQUE = ["./", "index.html", "modules.css", "marque.js", "ui-engine.js", "demo-engine.js", "api-engine.js", "arc-engine.js", "config.js", "vendor/supabase-js-2.45.4.js", "icons/arc-192.png", "manifest.webmanifest"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(COQUE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
