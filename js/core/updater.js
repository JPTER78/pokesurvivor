/* ============ updater.js — actualizaciones automáticas ============
 * Al publicar una versión nueva (node tools/build.js escribe version.json con
 * la huella de js/app.min.js), todos los jugadores la reciben sin perder nada:
 *
 *   - Cada 5 min (y al volver a la pestaña) se mira version.json (lo sirve
 *     GitHub Pages: no cuesta nada).
 *   - Si NO está en partida: aviso "actualizando en 5 s…" y se recarga.
 *     Si está en el gacha, la tienda de mejoras, los ajustes o escribiendo en
 *     un campo, espera a que termine. En una sala de cooperativo, se recarga
 *     igual (decisión del 12-10-2026).
 *   - Si está EN PARTIDA: no se toca. Al acabar, la run se guarda como
 *     siempre (récords, monedas, tickets, ranking) y, al volver al menú, se
 *     recarga.
 *   - Antes de recargar se espera a que la partida guardada suba a la nube
 *     (como mucho unos segundos; si no, queda en este navegador y se sube al
 *     entrar).
 * Sólo funciona en la web publicada (con app.min.js); en dev.html o con
 * doble clic (file://) no hace nada.
 */
G.Updater = (() => {
  const EVERY = 5 * 60 * 1000, COUNTDOWN = 5;
  const tag = document.querySelector('script[src*="app.min.js?v="]');
  const mine = tag ? (tag.getAttribute('src').match(/v=([0-9a-f]+)/) || [])[1] : null;
  let pending = false, lastCheck = 0, timer = 0, counting = false;

  async function check() {
    if (!mine || pending) return;
    lastCheck = Date.now();
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (j && j.v && j.v !== mine) { pending = true; console.log('[Actualizar] versión nueva', j.v, '(esta es', mine + ')'); }
    } catch (e) { /* sin red: se mira la próxima vez */ }
  }

  /** ¿Se puede recargar ahora sin cortar nada? */
  function safe() {
    if (!G.Game || G.Game.state !== 'ui') return false;                   // en partida o en el resumen
    // (También el test de personalidad y la elección de inicial: se perdían las respuestas.)
    if (['scr-gacha', 'scr-upgrades', 'scr-settings', 'scr-shop', 'scr-bag', 'scr-test', 'scr-result', 'scr-starters'].some(id => document.getElementById(id) && G.UI.isOpen(id))) return false;
    const fx = document.getElementById('pull-fx');
    if (fx && !fx.classList.contains('hidden')) return false;             // tirada del gacha en marcha
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;   // escribiendo (contraseña, apodo...)
    return true;
  }

  async function reload() {
    // Que lo guardado suba a la nube antes de recargar (como mucho 6 s).
    const dirty = G.DB.syncState && G.DB.syncState !== 'ok' && G.DB.syncState !== 'local';
    if (dirty) { try { await Promise.race([G.DB.flush(), new Promise(r => setTimeout(r, 6000))]); } catch (e) { /* queda en este navegador */ } }
    location.reload();
  }

  function countdown() {
    counting = true;
    let n = COUNTDOWN;
    const tick = () => {
      if (!safe()) { counting = false; G.UI.toast('', 1); return; }     // ha empezado una partida: se espera
      if (n <= 0) { reload(); return; }
      G.UI.toast('Hay una versión nueva del juego: actualizando en ' + n + ' s…', 1500);
      n--;
      setTimeout(tick, 1000);
    };
    tick();
  }

  function loop() {
    if (pending && !counting && safe()) countdown();
    if (!pending && Date.now() - lastCheck > EVERY) check();
  }

  function init() {
    if (!mine || !location.protocol.startsWith('http')) return;
    clearInterval(timer);
    timer = setInterval(loop, 2000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastCheck > 60000) check(); });
    setTimeout(check, 30000);
  }

  return { init, check, get pending() { return pending; }, get version() { return mine; } };
})();
