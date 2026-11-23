// Batch Card Tracker service worker.
// The app shell is cached so the app opens offline and at once; photos and
// signatures from Google's image servers are kept as they are seen
// (cache-first, newest 800), so a card opened once opens instantly after.
// API requests are never cached.
const CACHE_PREFIX = 'bct-shell-';
const CACHE_VERSION = CACHE_PREFIX + 'v13';
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

// ---- Notifications (1.4) ----
// The server sends an empty push (nothing to decrypt); this worker then asks
// the server (whose address the page keeps in PUSH_CACHE) for the newest
// unread notification, naming this device by its push address, and shows it.
// If that fails, a plain line shows instead. Open pages are told, so their
// bell catches up.
const PUSH_CACHE = 'calgas-bct-push';
const ICON = 'https://calgas.github.io/Stock-Management/logo/icon-192.png';

async function latestNotification() {
  const cache = await caches.open(PUSH_CACHE);
  const saved = await cache.match(new URL('__push_session', self.registration.scope).href);
  if (!saved) return null;
  const cfg = await saved.json();
  const sub = await self.registration.pushManager.getSubscription();
  if (!cfg || !cfg.url || !sub) return null;
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'pushPeek', endpoint: sub.endpoint })
  });
  const json = await res.json();
  return json && json.success ? json.data : null;
}

self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let title = 'Batch Card Tracker', options = { body: 'Something needs your attention. Open the app to see it.', icon: ICON, badge: ICON, tag: 'bct-notification', data: {} };
    try {
      const d = await latestNotification();
      const n = d && d.items && d.items[0];
      if (n) {
        title = n.Title;
        options = {
          body: n.Body + (d.unread > 1 ? '\n(' + (d.unread - 1) + ' more unread)' : ''),
          icon: ICON, badge: ICON, tag: n.ID, timestamp: Number(n.Created_At) || Date.now(),
          data: { link: n.Link || '', id: n.ID }
        };
        if (self.navigator && self.navigator.setAppBadge) self.navigator.setAppBadge(d.unread).catch(() => {});
      }
    } catch (err) { /* show the plain line */ }
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    open.filter((c) => c.url.indexOf(self.registration.scope) === 0).forEach((c) => c.postMessage({ type: 'notif' }));
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const here = open.filter((c) => c.url.indexOf(self.registration.scope) === 0)[0];
    if (here) {
      await here.focus();
      if (data.link) here.postMessage({ type: 'open-notif', link: data.link, id: data.id });
      return;
    }
    const url = new URL('./', self.registration.scope);
    if (data.link) url.hash = 'notif=' + encodeURIComponent(data.link) + '&id=' + encodeURIComponent(data.id || '');
    await self.clients.openWindow(url.href);
  })());
});
