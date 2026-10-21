/* ============ updater.js — actualizaciones automáticas ============
 * Al publicar una versión nueva (node tools/build.js escribe version.json con
 * la huella de js/app.min.js), todos los jugadores la reciben sin perder nada:
 *
 *   - Cada 5 min (y al volver a la pestaña) se mira version.json (lo sirve
 *     GitHub Pages: no cuesta nada). Con la pestaña oculta no se mira (22-10-2026:
 *     eran 12 consultas por hora de cada pestaña olvidada en segundo plano);
 *     al volver a ella se mira en el momento.
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
 *   - Versión OBLIGATORIA (node tools/build.js --forzar escribe force:true en
 *     version.json): quien esté en partida ve un aviso de 10 s y la partida
 *     se termina como al abandonarla (se guardan monedas, tickets, récords y
 *     ranking), sube a la nube y se recarga. Sólo la entienden los jugadores
 *     que ya tengan este updater.js (desde el 15-10-2026).
 * Sólo funciona en la web publicada (con app.min.js); en dev.html o con
 * doble clic (file://) no hace nada.
 */
G.Updater = (() => {
  const EVERY = 5 * 60 * 1000, COUNTDOWN = 5, FORCED = 10;
  const tag = document.querySelector('script[src*="app.min.js?v="]');
  const mine = tag ? (tag.getAttribute('src').match(/v=([0-9a-f]+)/) || [])[1] : null;
  let pending = false, forced = false, lastCheck = 0, timer = 0, counting = false;

  async function check() {
    if (!mine || pending) return;
    lastCheck = Date.now();
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (j && j.v && j.v !== mine) { pending = true; forced = !!j.force; console.log('[Actualizar] versión nueva', j.v, '(esta es', mine + ')', forced ? 'OBLIGATORIA' : ''); }
    } catch (e) { /* sin red: se mira la próxima vez */ }
  }

  /** ¿Se puede recargar ahora sin cortar nada? */
  function safe() {
    if (!G.Game || G.Game.state !== 'ui') return false;                   // en partida o en el resumen
    if (['scr-gacha', 'scr-upgrades', 'scr-settings'].some(id => document.getElementById(id) && G.UI.isOpen(id))) return false;
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

  /** ¿Está jugando una partida (que una versión obligatoria debe cerrar)? */
  function inRun() { return G.Game && G.Game.state !== 'ui' && G.Game.state !== 'over'; }

  /** Versión obligatoria en partida: aviso, se termina la partida (se guarda todo) y se recarga. */
  function forceEnd() {
    counting = true;
    let n = FORCED;
    const tick = () => {
      if (!inRun()) { reload(); return; }                                 // la ha acabado él mismo
      if (n <= 0) {
        G.Game.quit();                                                    // como abandonar: se guarda lo ganado
        setTimeout(reload, 4000);                                         // deja salir récord y ranking
        return;
      }
      G.UI.toast('Actualización obligatoria: tu partida se guarda y el juego se recarga en ' + n + ' s…', 1500);
      n--;
      setTimeout(tick, 1000);
    };
    tick();
  }

  function loop() {
    if (pending && forced && !counting && inRun()) { forceEnd(); return; }
    if (pending && forced && !counting && G.Game && G.Game.state === 'over') { reload(); return; }   // resumen: ya está guardado
    if (pending && !counting && safe()) countdown();
    if (!pending && !document.hidden && Date.now() - lastCheck > EVERY) check();
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
