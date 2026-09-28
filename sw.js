/* Service worker: la app entera queda en caché y funciona sin conexión.
   Al añadir o quitar archivos de APP_SHELL, sube CACHE_VERSION. */
const CACHE_VERSION = 'umbral-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/fuentes.css',
  './css/app.css',
  './js/reglas.js',
  './js/motor.js',
  './js/almacen.js',
  './js/app.js',
  './icons/favicon-64.png',
  './icons/icono-192.png',
  './icons/icono-512.png',
  './icons/icono-maskable-512.png',
  './icons/icono-apple-180.png',
  './icons/esqueleto-original.webp',
  './fonts/im-fell-english-sc-400.woff2',
  './fonts/eb-garamond-var.woff2',
  './fonts/eb-garamond-var-italic.woff2',
  './fonts/cinzel-var.woff2',
  './fonts/jetbrains-mono-var.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Primero la red: con conexión siempre se carga lo último y se refresca
   la copia; sin conexión se sirve la copia guardada. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(CACHE_VERSION).then(c => c.put(e.request, copia)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })
    .then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
