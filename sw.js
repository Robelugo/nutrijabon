/* NutriJabón · service worker: funciona sin internet y se actualiza solo en segundo plano. */
var CACHE = 'nutrijabon-v13';
var FONT_CACHE = 'nutrijabon-fonts-v1';
var FILES_CACHE = 'nutrijabon-files'; // archivos que arma la app (recordatorios .ics)
var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
var ASSETS = [
  './', './index.html', './styles.css', './data.js', './app.js', './manifest.webmanifest',
  './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  // cache: 'reload' evita que el caché HTTP del navegador entregue archivos viejos al instalar una versión nueva
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== FONT_CACHE && k !== FILES_CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Tipografías de Google Fonts: se guardan la primera vez para usarlas sin internet
  if (FONT_HOSTS.indexOf(url.hostname) !== -1) {
    e.respondWith(caches.open(FONT_CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
          return res;
        });
      });
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Revalida siempre con el servidor (petición condicional, barata) en lugar del caché HTTP
  var fresh = req.mode === 'navigate'
    ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })
    : new Request(req, { cache: 'no-cache' });
  var network = fetch(fresh).then(function (res) {
    if (!res || !res.ok) return res;
    var copy = res.clone();
    return caches.open(CACHE).then(function (c) { return c.put(req, copy); }).then(function () { return res; });
  }).catch(function () { return null; });
  e.waitUntil(network.then(function () {}));

  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (cached) {
    if (cached) return cached;
    return network.then(function (res) {
      if (res) return res;
      if (req.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    });
  }));
});
