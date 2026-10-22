// Offline support: cache the game the first time it loads, then serve it from
// the cache (refreshing in the background) so it keeps working without wifi.
const CACHE = 'brownie-baker-v1';
const CORE = [
  './', 'index.html', 'css/style.css', 'assets/spritesheet.png', 'icon.png', 'favicon.ico', 'site.webmanifest',
  'js/atlas.js', 'js/data.js', 'js/sim.js', 'js/audio.js', 'js/render.js', 'js/ui.js', 'js/intro.js', 'js/main.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Stale-while-revalidate for everything, including the Google Fonts files.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(e.request);
    const net = fetch(e.request).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(e.request, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
