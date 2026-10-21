/* ============ sw.js — para poder instalar el juego como app ============
 * - Código con huella (?v=..., la pone tools/build.js: app.min.js, style.css,
 *   locales.js y los diccionarios): esa dirección no cambia nunca de contenido,
 *   así que se sirve de la caché sin preguntar al servidor. Una versión nueva
 *   trae otra huella (otra dirección): se descarga y se borra la anterior.
 * - El resto del código (html, scripts sin huella): primero la red, así cada
 *   actualización llega al momento; si no hay conexión, la última copia guardada.
 * - Sprites, iconos y fuente: no cambian nunca, se sirven de la caché
 *   (se van guardando según se usan: no se descarga todo de golpe).
 * - version.json y lo pedido sin caché (no-store): sólo la red, no se guarda.
 * - Firebase y demás servicios de fuera no se tocan.
 *
 * 22-10-2026: hasta ahora se guardaba cada respuesta con su dirección entera y
 * nunca se borraba nada: cada version.json?t=... (cada 5 min) y cada
 * app.min.js?v=... de cada actualización (87 desde el 9-10, ~1,2 MB cada uno)
 * se quedaban en el aparato. La caché nueva (ps-code-v2) borra la vieja al activarse.
 */
const CODE = 'ps-code-v2', ART = 'ps-art-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CODE).then(c => c.addAll(['./', './index.html', './manifest.webmanifest'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CODE && k !== ART).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/** Guarda una versión de un archivo y borra las otras del mismo archivo (otras huellas). */
async function keepOnly(c, req, res) {
  const path = new URL(req.url).pathname;
  for (const k of await c.keys()) if (new URL(k.url).pathname === path && k.url !== req.url) await c.delete(k);
  await c.put(req, res);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Avisos de versión (?t=...) y lo que se pide expresamente sin caché: tal cual, sin guardar.
  if (req.cache === 'no-store' || url.pathname.endsWith('/version.json')) return;
  const art = /\/assets\/(pokemon|icons|fonts)\//.test(url.pathname);
  if (art) {
    // (Sin el ?r=... de los reintentos de sprites.js: es la misma imagen.)
    const key = url.origin + url.pathname;
    e.respondWith(caches.open(ART).then(async c => {
      const hit = await c.match(key);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(key, res.clone());
      return res;
    }));
    return;
  }
  if (url.searchParams.has('v')) {
    e.respondWith(caches.open(CODE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) keepOnly(c, req, res.clone()).catch(() => {});
      return res;
    }));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    // Sólo direcciones sin parámetros: con ellos cada una sería una copia más que nunca se borra.
    if (res.ok && !url.search) { const copy = res.clone(); caches.open(CODE).then(c => c.put(req, copy)); }
    return res;
  }).catch(async () => {
    // Sin red: la copia guardada. La página de inicio sólo sirve de respaldo
    // al abrir la web (nunca en lugar de un script o una imagen).
    const hit = await caches.match(req);
    if (hit) return hit;
    if (req.mode === 'navigate') return (await caches.match('./index.html')) || Response.error();
    return Response.error();
  }));
});
