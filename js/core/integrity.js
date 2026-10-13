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
 *   5. Cada marca del ranking lleva un resumen de la partida (summary) que sale
 *      de un libro cerrado (daño hecho, pico por segundo, daño recibido, vida
 *      máxima) y de lo que de verdad dieron las mejoras y cartas; las reglas
 *      comprueban que cuadra con ese Pokémon y esas mejoras. Ver docs/anticheat.md.
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

  // Libro de la partida: sólo se escribe desde el juego (a través de estas
  // funciones), nunca desde fuera, y de él sale el resumen del ranking.
  //   dd  daño de golpes hecho (nominal: con tipos y críticos, sin recortar al sobrante)
  //   pk  pico de daño a UN enemigo en una ventana de 1 s
  //   dt  daño recibido (el que de verdad te quitó vida)
  //   mh  vida máxima más alta que tuviste
  const led = { dd: 0, pk: 0, dt: 0, mh: 0, win: new Map(), wt: 0 };

  /** Nueva partida: limpia las marcas y el libro de la anterior. */
  function begin() {
    why.clear(); told = false;
    led.dd = led.pk = led.dt = led.mh = led.wt = 0; led.win.clear();
  }

  function dealt(e, d) {
    led.dd += d;
    led.win.set(e, (led.win.get(e) || 0) + d);
  }
  function taken(d) { led.dt += d; }
  function seenHp(v) { if (v > led.mh) led.mh = v; }
  /** Cada fotograma jugando: cierra la ventana de 1 s del pico de daño. */
  function tick(dt) {
    led.wt += dt;
    if (led.wt < 1) return;
    for (const v of led.win.values()) if (v / led.wt > led.pk) led.pk = v / led.wt;
    led.win.clear(); led.wt = 0;
  }

  /**
   * Lo que sube con la marca (campo `sm`). Todo son enteros pequeños.
   *   px  Pokémon · up  mejoras compradas (nivel de cada una) · cs  cartas de stat cogidas
   *   dd, pk, dt, mh  (el libro, ver arriba) · rid  id de la partida grabada (js/core/replay.js)
   */
  function summary(pl, rid) {
    const r = pl.record();
    const sm = { px: pl.dex, up: r.up, cs: r.cs, dd: Math.round(led.dd), pk: Math.round(led.pk), dt: Math.round(led.dt),
                 mh: Math.round(Math.max(led.mh, pl.maxHp)) };
    if (rid) sm.rid = rid;
    return sm;
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

  return { begin, flag, check, rankable, trusted, maxCoins, MAX_T, dealt, taken, seenHp, tick, summary, get reasons() { return [...why]; } };
})();
