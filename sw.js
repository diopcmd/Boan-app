// Service Worker BOANR — consultation hors-ligne basique
// Stratégie : cache-first pour les assets statiques, network-only pour l'API
var CACHE_NAME = 'boanr-v2';
var STATIC_ASSETS = ['/', '/manifest.json'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  // Ne jamais mettre en cache les appels API (données sensibles) ni les requêtes externes
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Assets statiques : network-first avec fallback cache (consultation offline)
  e.respondWith(
    fetch(e.request).then(function(response) {
      // Mettre à jour le cache si la réponse est valide
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
      }
      return response;
    }).catch(function() {
      // Réseau indisponible → retourner version cachée (mode consultation)
      return caches.match(e.request).then(function(cached) {
        return cached || new Response(
          '<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0f1a0f;color:#88aa88">'
          + '<h2>📶 Hors ligne</h2>'
          + '<p>Reconnectez-vous pour accéder à BOANR.</p>'
          + '</body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      });
    })
  );
});
