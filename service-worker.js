const CACHE_NAME = 'odjim-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/manifest.json',
  '/icon.png'
];

// Instalação — cachear assets estáticos
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Ativação — limpar caches antigos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — estratégia Network First para API, Cache First para assets
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Firebase / API — sempre rede
  if (url.hostname.includes('firebase') || url.hostname.includes('google')) {
    e.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Assets estáticos — cache first
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cachear novos assets estáticos
        if (request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
