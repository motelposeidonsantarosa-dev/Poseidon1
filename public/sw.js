// Service Worker mínimo modificado para asegurar actualizaciones y prevenir problemas de caché
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
           return caches.delete(cacheName);
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Service Worker passthrough: no interceptamos NINGUNA petición para evitar problemas con Firebase o actualizaciones.
  // El navegador manejará todas las peticiones (y el caché) de forma nativa basándose en los headers de Netlify.
  return;
});
