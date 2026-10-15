/* ============ signups.js — tope de cuentas del mes ============
 *
 * Firebase da 50.000 usuarios con cuenta activos al mes gratis; a partir de
 * ahí cobra cada uno. El Worker de Cloudflare (cloudflare/turn-worker.js, /mau)
 * lleva la cuenta del mes:
 *   - report(): la primera vez que una cuenta entra en el mes, avisa (con su
 *     token de Firebase; una vez al mes por cuenta y navegador). Las cuentas
 *     recién creadas no avisan: ya las apuntó el portero (functions/index.js).
 *   - check(): ¿quedan plazas para cuentas nuevas? Sólo se pregunta al ir a
 *     "Crear cuenta" y la respuesta se guarda 30 min (también entre sesiones).
 *     Si no (48.000), se quita "Crear cuenta" y se propone jugar como invitado
 *     hasta el mes siguiente. Quien ya tiene cuenta entra siempre.
 * El plan gratis de Workers da 100.000 llamadas al día para todo (también las
 * claves TURN del cooperativo y el portero): cada llamada cuenta. Por eso el
 * token va en el cuerpo como texto (así el navegador no hace la consulta
 * previa OPTIONS, que también contaría).
 * Si el Worker no responde, no se bloquea nada.
 *
 * APAGADO desde el 11-10-2026: se aceptan todas las cuentas (sin tope) y así no
 * se gastan llamadas al Worker. Para volver a encenderlo: OFF = false, un
 * LIMIT en cloudflare/turn-worker.js y volver a activar el portero.
 */
G.Signups = (() => {
  const URL = 'https://turn.pokesurvivor.com/mau';
  const CACHE = 30 * 60 * 1000, K_OPEN = 'ps.mau.open';
  let open = true, checkedAt = 0;
  try {
    const c = JSON.parse(localStorage.getItem(K_OPEN) || 'null');
    if (c && typeof c.open === 'boolean') { open = c.open; checkedAt = c.t || 0; }
  } catch (e) { /* nada */ }

  const month = () => new Date(Date.now() - 8 * 3600e3).toISOString().slice(0, 7);
  const OFF = true;
  const enabled = () => !OFF && /^https?:$/.test(location.protocol) && !(G.FIREBASE_CONFIG || {}).emulator;
  const reportedKey = uid => 'ps.mau.' + uid + '.' + month();

  function remember(j) {
    if (typeof j.open !== 'boolean') return;
    open = j.open; checkedAt = Date.now();
    try { localStorage.setItem(K_OPEN, JSON.stringify({ open, t: checkedAt })); } catch (e) { /* nada */ }
  }

  /** ¿Se pueden crear cuentas nuevas este mes? */
  async function check() {
    if (!enabled()) return true;
    if (Date.now() - checkedAt < CACHE) return open;
    try { remember(await (await fetch(URL)).json()); } catch (e) { /* sin respuesta: no se bloquea */ }
    return open;
  }

  /** Cuenta recién creada: el portero ya la ha apuntado, no hace falta avisar. */
  function markNew(uid) {
    try { localStorage.setItem(reportedKey(uid), '1'); } catch (e) { /* nada */ }
  }

  /** Esta cuenta ha entrado: se apunta una vez al mes. */
  async function report(user) {
    if (!enabled() || !user) return;
    const key = reportedKey(user.uid);
    try { if (localStorage.getItem(key)) return; } catch (e) { /* nada */ }
    try {
      const tok = await user.getIdToken();
      const r = await fetch(URL, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: tok });
      if (r.ok) {
        remember(await r.json());
        try { localStorage.setItem(key, '1'); } catch (e) { /* nada */ }
      }
    } catch (e) { /* se reintenta la próxima vez */ }
  }

  /** Nombre del mes siguiente (para el aviso). */
  function nextMonthName() {
    const d = new Date(); d.setMonth(d.getMonth() + 1, 1);
    return d.toLocaleString(G.I18n.locale, { month: 'long' });
  }

  return { check, report, markNew, nextMonthName, get closed() { return !open; } };
})();
