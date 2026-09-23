// =====================================================
// ADRA – Service Worker  |  sw.js  |  v1.0.0
// Estratégia: Cache-First para assets estáticos,
//             Network-First para API Supabase.
// =====================================================

const CACHE_NAME    = 'adra-v1.0.0';
const OFFLINE_PAGE  = './index.html';

const STATIC_ASSETS = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
];

// ── Install ──────────────────────────────────────────
self.addEventListener('install', event => {
    console.log('[SW] Instalando…');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .catch(err => console.warn('[SW] Erro no cache inicial:', err))
    );
    self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────
self.addEventListener('activate', event => {
    console.log('[SW] Ativando…');
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k !== CACHE_NAME)
                    .map(k => {
                        console.log('[SW] Removendo cache antigo:', k);
                        return caches.delete(k);
                    })
            )
        )
    );
    self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);

    // Requisições não-GET, Supabase e CDNs → sempre network
    if (req.method !== 'GET') return;
    if (url.hostname.includes('supabase.co'))     return;
    if (url.hostname.includes('jsdelivr.net'))    return;
    if (url.hostname.includes('cdnjs.cloudflare')) return;
    if (url.hostname.includes('cdn.tailwindcss')) return;

    event.respondWith(
        caches.match(req).then(cached => {
            if (cached) return cached;

            return fetch(req)
                .then(response => {
                    // Clonar e armazenar respostas válidas
                    if (response && response.status === 200 && response.type !== 'opaque') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(c => c.put(req, clone));
                    }
                    return response;
                })
                .catch(() => {
                    // Offline fallback: retorna página principal para navegação
                    if (req.destination === 'document') {
                        return caches.match(OFFLINE_PAGE);
                    }
                });
        })
    );
});

// ── Background Sync ───────────────────────────────────
self.addEventListener('sync', event => {
    if (event.tag === 'adra-sync-queue') {
        event.waitUntil(
            self.clients.matchAll().then(clients =>
                clients.forEach(c => c.postMessage({ type: 'SYNC_COMPLETE' }))
            )
        );
    }
});

// ── Push Notifications ────────────────────────────────
self.addEventListener('push', event => {
    const data = event.data?.json() ?? {};
    event.waitUntil(
        self.registration.showNotification(data.title ?? 'ADRA Finanças', {
            body:    data.body    ?? 'Você tem uma nova notificação.',
            icon:    './icons/icon-192.png',
            badge:   './icons/icon-72.png',
            vibrate: [200, 100, 200],
            tag:     data.tag    ?? 'adra-default',
            data:    { url: data.url ?? './' },
            actions: [
                { action: 'open',    title: 'Abrir'     },
                { action: 'dismiss', title: 'Dispensar' },
            ],
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    if (event.action !== 'dismiss') {
        event.waitUntil(
            clients.openWindow(event.notification.data?.url ?? './')
        );
    }
});

// ── Message: força atualização do SW ─────────────────
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
