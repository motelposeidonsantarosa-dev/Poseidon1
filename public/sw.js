// Service Worker mínimo modificado para asegurar actualizaciones y prevenir problemas de caché
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      self.registration.unregister();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Pass through all
  return;
});
