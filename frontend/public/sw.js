const CACHE_NAME = 'rentlo-cache-v5';

const APP_SHELL = [
  '/',
  '/index.html',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Background Push Notification Listener (Triggers Native OS System Tray Alerts with Vibration)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'Rentlo Alert 🔔', body: event.data.text() };
    }
  }

  const title = data.title || 'Rentlo Alert 🔔';
  const options = {
    body: data.body || 'You have a new update on Rentlo.',
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [300, 150, 300, 150, 300], // Distinct tactile vibration pattern
    tag: data.tag || ('rentlo-alert-' + Date.now()),
    renotify: true, // Forces device to vibrate/sound for every new alert
    silent: false,
    requireInteraction: false,
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'View Details' }
    ]
  };

  // Also broadcast to open tabs to vibrate foreground devices
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    clientList.forEach((client) => {
      client.postMessage({ type: 'NOTIFICATION_PUSH_RECEIVED', data });
    });
  });

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Handler (Focuses existing window or opens link)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle GET requests and exclude APIs
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }
        if (event.request.mode === 'navigate') {
          return caches.match('/').then((fallback) => {
            return fallback || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } });
          });
        }
        return new Response('Network error occurred', { status: 480 });
      });
    })
  );
});
