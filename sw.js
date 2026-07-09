// Service worker: cachea todo lo necesario para que la app funcione sin internet.
// Si cambiás archivos de la app, subí el número de VERSION para que los celulares bajen la versión nueva.
const VERSION = 'anotador-v8';

const ARCHIVOS = [
  './',
  './index.html',
  './manifest.json',
  './css/estilos.css',
  './css/fuentes/PatrickHand-Regular.woff2',
  './js/app.js',
  './js/ui.js',
  './js/storage.js',
  './js/truco.js',
  './js/podrida.js',
  './js/historial.js',
  './js/personas.js',
  './js/selector-personas.js',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
  './iconos/icono-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(ARCHIVOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((claves) => Promise.all(
      claves.filter((clave) => clave !== VERSION).map((clave) => caches.delete(clave))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((respuestaCache) => {
      const buscarEnRed = fetch(event.request).then((respuestaRed) => {
        if (respuestaRed && respuestaRed.status === 200) {
          const copia = respuestaRed.clone();
          caches.open(VERSION).then((cache) => cache.put(event.request, copia));
        }
        return respuestaRed;
      }).catch(() => respuestaCache);
      return respuestaCache || buscarEnRed;
    })
  );
});
