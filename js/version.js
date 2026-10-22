// The release version. Bump it with `python tools/bump_version.py X.Y.Z`, which also
// updates the ?v= cache-busting query strings in index.html. The service worker
// is registered as sw.js?v=VERSION, so every release gets a fresh offline cache.
window.BB = window.BB || {};
BB.VERSION = '1.1.0';
