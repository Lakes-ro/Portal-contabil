// =====================================================
// ARF – Service Worker  |  sw.js  |  v1.1.0
// Navegação, index.html, app.js e manifest: network-first (sempre a versão nova online).
// Demais assets (ícones etc.): cache-first. Supabase e CDNs: nunca interceptados.
// Para publicar uma versão nova, incremente CACHE_NAME.
// =====================================================

const CACHE_NAME   = 'arf-v1.1.0';
const OFFLINE_PAGE = './index.html';

const STATIC_ASSETS = [
  './', './index.html', './app.js', './manifest.json',
  './icons/icon-72.png', './icons/icon-96.png', './icons/icon-128.png', './icons/icon-144.png',
  './icons/icon-152.png', './icons/icon-192.png', './icons/icon-384.png', './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // um arquivo ausente não pode derrubar a instalação inteira
      Promise.all(STATIC_ASSETS.map(u => cache.add(u).catch(err => console.warn('[SW] sem cache:', u, err))))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // Supabase/CDNs passam direto

  const p = url.pathname;
  const critical = req.mode === 'navigate' || p.endsWith('/app.js') || p.endsWith('/index.html')
                || p.endsWith('/manifest.json') || p.endsWith('/sw.js') || p.endsWith('/');

  if (critical) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match(OFFLINE_PAGE)))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => Response.error()))
  );
});

self.addEventListener('sync', event => {
  if (event.tag === 'arf-sync-queue') {
    event.waitUntil(
      self.clients.matchAll().then(clients => clients.forEach(c => c.postMessage({ type: 'SYNC_COMPLETE' })))
    );
  }
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'ARF', {
      body:    data.body ?? 'Você tem uma nova notificação.',
      icon:    './icons/icon-192.png',
      badge:   './icons/icon-72.png',
      vibrate: [200, 100, 200],
      tag:     data.tag ?? 'arf-default',
      data:    { url: data.url ?? './' },
      actions: [{ action: 'open', title: 'Abrir' }, { action: 'dismiss', title: 'Dispensar' }],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action !== 'dismiss') {
    event.waitUntil(clients.openWindow(event.notification.data?.url ?? './'));
  }
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
