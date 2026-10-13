/* Offline support: precache the app, then serve from cache and refresh in the background. */
const VERSION = 'lexi990-v2';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/app.css',
  'assets/js/util.js',
  'assets/js/store.js',
  'assets/js/sync.js',
  'assets/js/srs.js',
  'assets/js/lexicon.js',
  'assets/js/speech.js',
  'assets/js/quiz.js',
  'assets/js/ui.js',
  'assets/js/view-today.js',
  'assets/js/view-library.js',
  'assets/js/view-study.js',
  'assets/js/view-practice.js',
  'assets/js/view-test.js',
  'assets/js/view-dict.js',
  'assets/js/view-settings.js',
  'assets/js/app.js',
  'data/words-1500.js',
  'data/words-600.js',
  'data/words-book.js',
  'data/test.js',
  'assets/img/icon.svg',
  'assets/img/icon-192.png',
  'assets/img/icon-512.png',
  'assets/img/icon-maskable-512.png',
].concat(Array.from({ length: 10 }, (_, i) => 'assets/img/test/p1-' + String(i + 1).padStart(2, '0') + '.jpg'));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !fonts) return; // GitHub API calls (sync) always go to the network

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: sameOrigin });
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
