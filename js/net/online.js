/* ============ online.js — cuánta gente hay en línea ahora mismo ============
 *
 * Un solo número en la Realtime Database: stats/online.
 *   - Al conectarse, cada pestaña con el juego abierto (con cuenta o como
 *     invitado) le suma 1, y deja dicho al servidor que le reste 1 cuando se
 *     desconecte (onDisconnect: lo hace el servidor aunque se cierre de golpe).
 *   - El menú lo lee cada minuto, y sólo mientras está a la vista.
 * Así cuesta unos pocos bytes por persona: nada de leer listas de jugadores ni
 * de escribir en Firestore. Las reglas (database.rules.json) sólo dejan sumar
 * o restar 1 de cada vez.
 */
G.Online = (() => {
  const POLL = 60 * 1000;
  let ref = null, count = null, started = false, pollT = 0, el = null;

  function start() {
    const fb = G.DB.fb;
    if (started || !fb || !fb.rtdb) return;
    started = true;
    const db = fb.rtdb, inc = firebase.database.ServerValue.increment;
    ref = db.ref('stats/online');
    db.goOnline();
    // Cada vez que (re)conecta: primero el "réstame 1 al irme" y luego el +1.
    db.ref('.info/connected').on('value', s => {
      if (s.val() !== true) return;
      ref.onDisconnect().set(inc(-1))
        .then(() => ref.set(inc(1)))
        .then(() => { if (el) poll(); })
        .catch(e => console.warn('[Online]', e.code || e.message));
    });
  }

  async function poll() {
    if (!ref) return;
    try {
      const v = (await ref.get()).val();
      count = typeof v === 'number' ? v : null;
    } catch (e) { /* sin conexión: se deja el último */ }
    render();
  }

  function render() {
    if (!el) return;
    if (count == null) { el.classList.add('hidden'); return; }
    const n = Math.max(1, count);                 // por lo menos tú
    const en = G.I18n && G.I18n.lang === 'en';
    const num = n.toLocaleString(en ? 'en-US' : 'es-ES');
    el.querySelector('span').textContent = en ? `${num} ${n === 1 ? 'player' : 'players'} online`
                                              : `${num} ${n === 1 ? 'jugador' : 'jugadores'} en línea`;
    el.classList.remove('hidden');
  }

  /** El menú está a la vista: enseña el número y lo va refrescando. */
  function show(target) {
    el = target;
    start();
    render();
    poll();
    clearInterval(pollT);
    pollT = setInterval(() => {
      if (!el || document.hidden || !el.offsetParent) return;   // menú oculto o pestaña en segundo plano: no se gasta
      poll();
    }, POLL);
  }

  return { start, show, get count() { return count; } };
})();
