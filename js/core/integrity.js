/* ============ integrity.js — anti-trampas de consola ============
 * El navegador es del jugador: nada de esto es infalible. El objetivo es que
 * tocar la partida desde la consola (F12) ya no sirva de nada y que, si se
 * intenta, la partida deje de contar para el ranking. Nunca se rompe el juego
 * ni se pierde nada de lo guardado.
 *
 *   1. El paquete publicado (js/app.min.js) va dentro de una función y G ya no
 *      es global (tools/build.js): desde la consola no se alcanza el jugador.
 *   2. Si aun así se llega a él (otro camino, o dev.html, que sí deja G a la
 *      vista), los stats de G.Player son de sólo lectura y se calculan a partir
 *      de sus fuentes (mejoras, cartas, objeto, altar): escribir en uno no hace
 *      nada y marca la partida (flag).
 *   3. Una partida marcada no sube al ranking, no bate récords ni da logros.
 *      Las monedas se limitan a lo posible (el servidor marcaría la cuenta).
 *   4. El servidor (firestore.rules) rechaza marcas imposibles igualmente.
 */
G.Integrity = (() => {
  // Con G global (dev.html) cualquiera puede tocar la partida: no sube marcas.
  // En local (pruebas del dueño) sí, para poder probar el ranking.
  const LOCAL = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const EXPOSED = window.G === G && !LOCAL;

  // Lo posible en una partida (mismos números que validEntry en firestore.rules;
  // si cambias uno, cambia el otro).
  const MAX_T = 2700;                       // minuto 45: la Sentencia de Arceus (minuto 30) dobla su fuerza cada 5 s
  const maxLv = t => 10 + t / 4;
  const maxKills = t => 100 + t * 12;
  const maxCoins = t => 4000 + t * 40;      // pago de la partida (monedas); ver possibleSave

  const why = new Set();
  let told = false;

  /** Nueva partida: limpia las marcas de la anterior. */
  function begin() {
    why.clear(); told = false;
  }

  /** Alguien ha tocado lo que no debía. Una partida marcada no cuenta. */
  function flag(reason) {
    if (why.has(reason)) return;
    why.add(reason);
    if (EXPOSED) return;
    if (window.G === G) console.warn('[Integridad] partida marcada:', reason);
    if (!told && G.UI && G.UI.toast) {
      told = true;
      G.UI.toast('Se han detectado cambios en la partida: no contará para el ranking', 4200);
    }
  }

  /** ¿Puede esta partida subir al ranking? */
  const rankable = () => !EXPOSED && !why.size;
  /** ¿Cuenta para récords, logros y estadísticas? (dev.html sí: sólo no sube al ranking) */
  const trusted = () => !why.size;

  /**
   * Lo que se anuncia al acabar tiene que ser posible en ese tiempo. Si no, se
   * marca la partida (como si se hubiera tocado algo).
   * @param r  { t, lv, kills, coins }  (coins: el pago de la partida)
   */
  function check(r) {
    if (!(r.lv <= maxLv(r.t))) flag('nivel');
    else if (!(r.kills <= maxKills(r.t))) flag('derrotados');
    else if (!(r.coins <= maxCoins(r.t))) flag('monedas');
    return !why.size;
  }

  return { begin, flag, check, rankable, trusted, maxCoins, MAX_T, get reasons() { return [...why]; } };
})();
