// Service worker: cachea todo lo necesario para que la app funcione sin internet.
// Si cambiás archivos de la app, subí el número de VERSION para que los celulares bajen la versión nueva.
const VERSION = 'anotador-v21';

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
  './js/nube.js',
  './js/grupo.js',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
  './iconos/icono-maskable-512.png',
  // SDK de Firebase (para el registro compartido del grupo). Va por CDN porque
  // es un paquete modular pensado justo para usarse así, sin bundler; una vez
  // cacheado acá, sigue disponible aunque no haya internet.
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => Promise.allSettled(
      ARCHIVOS.map((archivo) => cache.add(archivo).catch((err) => console.warn('No se pudo cachear', archivo, err)))
    )).then(() => self.skipWaiting())
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
  // Solo intervenimos en los recursos propios de la app y el SDK de Firebase.
  // Todo lo demás (sobre todo las llamadas en tiempo real de Firestore) pasa
  // de largo sin que el service worker las toque.
  const url = event.request.url;
  const esRecursoConocido = url.startsWith(self.location.origin) || url.startsWith('https://www.gstatic.com/firebasejs/');
  if (!esRecursoConocido) return;
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
