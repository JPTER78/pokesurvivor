/* ============ guard.js — vigilancia anti-trampas ============
 * Un juego del navegador no se puede blindar del todo (el código está en tu
 * ordenador), pero sí se puede hacer que las trampas más fáciles no sirvan
 * para el ranking. Durante la partida se mira una vez por segundo:
 *
 *   reloj       el tiempo de juego no puede ir más deprisa que el real
 *   vida        vida por encima del máximo, o un máximo imposible
 *   velocidad / ataque / nivel   valores que no se pueden alcanzar jugando
 *   derrotados / monedas         subidas imposibles de un segundo a otro
 *   debug       se han usado las herramientas de pruebas o de vídeo
 *
 * Si salta algo, la partida no cuenta para el ranking ni para tus récords
 * (las monedas y lo demás sí, para no castigar un falso positivo). Además,
 * el servidor rechaza marcas imposibles (firestore.rules, validEntry).
 */
G.Guard = (() => {
  let run = null;       // { t0, flags, prev, checkT, coop }

  function start(coop = false) {
    run = { t0: performance.now(), flags: new Set(), prev: null, checkT: 1, coop };
  }

  function flag(why) {
    if (!run || run.flags.has(why)) return;
    run.flags.add(why);
    console.warn('[PokéSurvivor] partida no válida para el ranking:', why);
  }

  /** Una vez por segundo de juego. */
  function tick(dt, time, p) {
    if (!run || !p) return;
    run.checkT -= dt;
    if (run.checkT > 0) return;
    run.checkT = 1;
    const real = (performance.now() - run.t0) / 1000;
    if (time > real + 5) flag('reloj');
    if (!isFinite(p.hp) || p.hp > p.maxHp + 1 || p.maxHp > 6000) flag('vida');
    if (p.spd > 700) flag('velocidad');
    if (p.atk > 60) flag('ataque');
    if (p.level > 10 + time / 4) flag('nivel');
    // En grupo los derrotados y las monedas los reparte el anfitrión: sólo en solitario.
    if (run.prev && !run.coop) {
      const d = Math.max(1, time - run.prev.time);
      if (p.kills - run.prev.kills > 50 + 60 * d) flag('derrotados');
      if (p.coins - run.prev.coins > 200 + 400 * d) flag('monedas');
    }
    run.prev = { time, kills: p.kills, coins: p.coins };
  }

  /** Al terminar: true si la partida es limpia. */
  function end() {
    const ok = !!run && run.flags.size === 0;
    run = null;
    return ok;
  }

  return { start, flag, tick, end, get flags() { return run ? [...run.flags] : []; } };
})();
