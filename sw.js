const CACHE_NAME = 'vasp-camonica-offline-v3';

// Risorse fondamentali dell'app da salvare in cache permanente al primo avvio
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@turf/turf@6.5.0/turf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_URLS.map(url => 
          fetch(url).then(response => {
            if (response.ok || response.type === 'opaque') {
              return cache.put(url, response);
            }
          }).catch(err => console.warn('Cache skip:', url, err))
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // NON intercettare le tessere delle mappe esterne: lascia che il browser le scarichi nativamente senza blocchi CORS/Referer
  if (
    url.hostname.includes('openstreetmap.org') ||
    url.hostname.includes('opentopomap.org') ||
    url.hostname.includes('arcgisonline.com') ||
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('servizirl.it') ||
    url.hostname.includes('minambiente.it')
  ) {
    return;
  }

  // Per l'app, i font e le librerie JS/CSS: prima cerca in cache (avvio istantaneo offline)
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
