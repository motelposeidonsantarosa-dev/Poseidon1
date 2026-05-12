// Service Worker mínimo para habilitar la instalación PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Solo passthrough para permitir que la app funcione normalmente
  event.respondWith(fetch(event.request));
});
