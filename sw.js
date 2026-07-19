// OdontoFeed Service Worker v3.0
// v3: HTML NUNCA sai do cache quando há rede (e nunca é gravado no cache em
// runtime) — elimina o "página antiga aparece primeiro". O precache guarda um
// snapshot de '/' apenas como fallback OFFLINE.
const CACHE_NAME = 'odontofeed-v3';
const STATIC_ASSETS = [
  '/',
  '/manifest.json'
];

// Install: cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[SW] Static assets cached');
      return self.skipWaiting();
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip external requests (APIs, PubMed, etc.)
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Skip Netlify function calls — never cache API responses (privacy)
  if (event.request.url.includes('/.netlify/functions/')) return;

  // Navegações (HTML): SEMPRE rede, sem tocar no cache HTTP nem no do SW —
  // garante que cada deploy aparece de imediato. Cache só como fallback offline.
  const isNav = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  event.respondWith(
    (isNav ? fetch(event.request, { cache: 'no-store' }) : fetch(event.request))
      .then(response => {
        // Cache runtime apenas para assets (nunca HTML — evita versão velha)
        if (response.ok && !isNav) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});

// Push notifications
self.addEventListener('push', event => {
  console.log('[SW] Push received');
  
  let data = {
    title: '📚 OdontoFeed - Artigo do Dia',
    body: 'Seu artigo científico diário chegou! Toque para ler.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    tag: 'daily-article',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch(e) {
      data.body = event.data.text() || data.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      renotify: data.renotify,
      requireInteraction: data.requireInteraction,
      vibrate: data.vibrate,
      data: { url: data.url || '/' }
    })
  );
});

// Notification click
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked');
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Background sync (future use)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-preferences') {
    console.log('[SW] Background sync: preferences');
  }
});

console.log('[SW] Service Worker loaded - OdontoFeed v2.0');
