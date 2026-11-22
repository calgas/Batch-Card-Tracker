// Batch Card Tracker service worker.
// The app shell is cached so the app opens offline and at once; photos and
// signatures from Google's image servers are kept as they are seen
// (cache-first, newest 800), so a card opened once opens instantly after.
// API requests are never cached.
const CACHE_PREFIX = 'bct-shell-';
const CACHE_VERSION = CACHE_PREFIX + 'v3';
const MEDIA_CACHE = 'bct-media-img-v1';
const SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_VERSION)
    .map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trimMedia() {
  const c = await caches.open(MEDIA_CACHE);
  const keys = await c.keys();
  if (keys.length > 800) await Promise.all(keys.slice(0, keys.length - 800).map(k => c.delete(k)));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'lh3.googleusercontent.com' || (url.hostname === 'drive.google.com' && url.pathname === '/thumbnail')) {
    e.respondWith(caches.open(MEDIA_CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trimMedia(); }
      return res;
    }));
    return;
  }
  if (url.origin === location.origin) {
    // Network first for the page (so a new version arrives), cache as fallback.
    e.respondWith(fetch(req).then(res => {
      if (res.ok) caches.open(CACHE_VERSION).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  }
});
