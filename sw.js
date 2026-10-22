// Offline support for Brownie Baker.
//
// The cache name comes from the version in the registration URL (sw.js?v=1.1.0),
// so each release gets its own cache and old ones are deleted on activate.
// The game's own files are fetched network-first, so an update shows up on the
// next load; the cache is only used when the network is down (or too slow).
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'brownie-baker-' + VERSION;
const V = '?v=' + VERSION;
const CORE = [
  './', 'index.html', 'icon.png', 'favicon.ico', 'site.webmanifest',
  'css/style.css' + V, 'assets/spritesheet.png' + V,
  ...['version', 'atlas', 'data', 'sim', 'audio', 'render', 'ui', 'intro', 'main'].map(f => 'js/' + f + '.js' + V),
];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) e.respondWith(networkFirst(req));
  else e.respondWith(cacheFirst(req)); // Google Fonts never change
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    // no-cache: revalidate with the server instead of trusting the browser's HTTP cache
    const res = await withTimeout(fetch(req, { cache: 'no-cache' }), NETWORK_TIMEOUT_MS);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req) ||
      (req.mode === 'navigate' ? await cache.match('index.html') : null);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
