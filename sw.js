// Cache hors-ligne : sert le cache tout de suite, rafraîchit en arrière-plan
const CACHE = 'satisfactory-v1';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/apple-touch-icon.png',
  'js/main.js', 'js/audio.js', 'js/fx.js', 'js/util.js', 'js/data.js',
  'js/stations/pop.js', 'js/stations/film.js', 'js/stations/keys.js', 'js/stations/squish.js', 'js/stations/sand.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request);
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
