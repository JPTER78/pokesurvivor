/* DESACTIVADO desde el 11-10-2026: se aceptan todas las cuentas (sin tope). El
 * activador se quitó de Firebase; OJO: `firebase deploy --only functions` lo
 * volvería a poner. Ver js/net/signups.js y cloudflare/turn-worker.js (LIMIT).
 * firebase.json ya NO declara "functions": así un `firebase deploy` normal no
 * puede activar Identity Platform (funciones de bloqueo = se cobra por usuario).
 * Esta carpeta se queda sólo como referencia. */
/* ============ functions/index.js — "portero" de cuentas nuevas ============
 *
 * Firebase (Identity Platform) cobra a partir de 50.000 usuarios con cuenta al
 * mes. Esta función se ejecuta ANTES de crear cualquier cuenta (desde el juego,
 * con Google o llamando directamente a Firebase: no hay forma de saltársela).
 * Pregunta al Worker de Cloudflare (cloudflare/turn-worker.js, /mau/new), que
 * lleva la cuenta del mes y la apunta; si se ha llegado al tope (48.000), la
 * cuenta no se crea hasta el día 1.
 *
 * Coste: sólo se ejecuta al crear cuentas (2 millones de ejecuciones gratis al
 * mes). Si el Worker no responde, NO se bloquea a nadie.
 * Los nombres que empiezan por "zzcerrado" se rechazan siempre: es para probar
 * que el rechazo funciona sin cerrar los registros de verdad.
 */
// 1.ª generación: con la 2.ª, Google llama a la función con una dirección
// (cloudfunctions.net) y la librería espera otra (run.app), y rechazaba TODAS
// las cuentas (pasó el 11-10-2026 durante 5 minutos).
const functions = require('firebase-functions/v1');

const URL = 'https://turn.pokesurvivor.com/mau/new';
const MSG = 'Este mes ya no quedan plazas para cuentas nuevas. Mientras, puedes jugar como invitado.';
// "zzcerrado" en el formato de nombre interno del juego (hexadecimal del nombre en minúsculas).
const TEST_PREFIX = Buffer.from('zzcerrado').toString('hex');

exports.portero = functions.region('europe-west1')
  .runWith({ secrets: ['MAU_SECRET'], memory: '256MB', timeoutSeconds: 10, maxInstances: 10 })
  .auth.user().beforeCreate(async user => {
    if ((user.email || '').startsWith(TEST_PREFIX)) throw new functions.auth.HttpsError('resource-exhausted', MSG);
    let j = null;
    try {
      const r = await fetch(URL + '?uid=' + encodeURIComponent(user.uid), { method: 'POST', headers: { 'X-PS-Secret': process.env.MAU_SECRET } });
      if (r.ok) j = await r.json();
    } catch (e) { console.warn('[portero] el Worker no responde:', e.message); }
    if (j && j.open === false) throw new functions.auth.HttpsError('resource-exhausted', MSG);
  });
