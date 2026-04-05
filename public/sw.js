/* eslint-disable no-restricted-globals */
/* Service Worker — Nexus Portal (PWA + Web Push)
 * Sem listener de `fetch`: interceptar tudo quebrava CORS (fonts), cache de 307 e cookies.
 * Web Push e notificações mantêm-se. “Instalar app” pode variar por browser sem fetch handler. */

self.addEventListener('push', function (event) {
  let payload = { title: 'Nexus', body: 'Nova notificação', url: '/' };
  try {
    if (event.data) {
      const text = event.data.text();
      if (text) payload = { ...payload, ...JSON.parse(text) };
    }
  } catch {
    // mantém defaults
  }

  const title = payload.title || 'Nexus';
  const openUrl = payload.url || '/';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: openUrl },
    tag: payload.tag || 'nexus-push',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const raw = event.notification.data;
  const url = raw && typeof raw === 'object' && 'url' in raw && typeof raw.url === 'string' ? raw.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
