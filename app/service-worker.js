const CACHE = 'tripdiary-v1.2.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './css/tokens.css',
  './css/base.css',
  './css/layout.css',
  './js/main.js',
  './js/config.js',
  './js/router.js',
  './js/shell.js',
  './js/utils.js',
  './js/db.js',
  './js/photos.js',
  './js/export.js',
  './js/pages/home.js',
  './js/pages/footprints.js',
  './js/pages/stats.js',
  './js/pages/me.js',
  './js/pages/trip-detail.js',
  './js/pages/dayout-detail.js',
  './js/pages/note-detail.js',
  './js/pages/edit-trip.js',
  './js/pages/edit-dayout.js',
  './js/pages/edit-entry.js',
  './js/pages/edit-note.js',
  './js/pages/edit-shared.js',
  './js/pages/reader.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
