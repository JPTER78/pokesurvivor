/* ============ spawner.js — oleadas, jefes y shinies ============
 * Los enemigos aparecen en un anillo justo fuera de la vista, así que nunca
 * se materializan en pantalla. Cada ~45 s hay una "marea": una avalancha
 * concentrada desde un lado concreto, para romper el ritmo.
 *
 * Cada enemigo tiene 1/4096 de salir shiny (como en los juegos clásicos).
 * Una run mata 1.500–4.000, así que sale uno cada 1–3 partidas.
 */
G.Spawner = (() => {
  const CAP = 420;
  const SHINY_RATE = 1 / 4096;
  let acc = 0, bossIdx = 0, surgeT = 32, announce = null, announceT = 0, preloadT = 0;
  let forceShiny = 0;           // para pruebas: los N próximos salen shiny

  function reset() {
    acc = 0; bossIdx = 0; surgeT = 32; announce = null; announceT = 0; preloadT = 0;
    G.Enemies.rollRun();
    G.Sprites.preload(G.Enemies.upcomingDex(0, 80));
  }

  /** Enemigos por segundo según el minuto de la run. */
  function rate(t) {
    return 1.6 + t * 0.028 + Math.pow(t / 60, 1.6) * 0.5;
  }

  function ringPoint(pl, angle) {
    const d = G.Camera.outerRadius() + G.U.rand(10, 70);
    return [pl.x + Math.cos(angle) * d, pl.y + Math.sin(angle) * d * 0.9];
  }

  /** Punto del anillo donde quepa: no dentro de paredes ni en el agua. */
  function freePoint(pl, angle, flying) {
    for (let i = 0; i < 8; i++) {
      const a = angle + (i === 0 ? 0 : G.U.rand(-0.9, 0.9));
      const [x, y] = ringPoint(pl, a);
      if (flying || G.World.isFree(x, y, 14)) return [x, y];
    }
    return null;
  }

  function isFlyer(def) {
    const d = G.DEX_BY[def.dex];
    return !!d && (d.types.includes('flying') || d.types.includes('ghost'));
  }

  function rollShiny(dex) {
    if (!G.Sprites.hasShiny(dex)) return false;
    if (forceShiny > 0) { forceShiny--; return true; }
    return Math.random() < SHINY_RATE;
  }

  function spawnOne(pl, t, angle) {
    const def = G.U.pick(G.Enemies.bagAt(t));
    const pt = freePoint(pl, angle == null ? Math.random() * 6.2832 : angle, isFlyer(def));
    if (!pt) return null;
    const e = G.EnemyMgr.add(new G.Enemy(def, pt[0], pt[1], G.Enemies.scale(t)));
    if (rollShiny(def.dex)) {
      e.makeShiny();
      say('¡Un ' + e.name + ' shiny anda cerca!', 3.4);
      G.Audio.sfx('shiny');
    }
    return e;
  }

  function spawnBoss(pl, t, b) {
    const [x, y] = ringPoint(pl, Math.random() * 6.2832);
    const e = G.EnemyMgr.add(new G.Enemy(b, x, y, G.Enemies.bossScale(t), true));
    if (rollShiny(b.dex)) e.makeShiny();
    say('¡' + e.name + (e.shiny ? ' shiny' : '') + ' salvaje apareció!', 3.2);
    G.Camera.kick(1.1);
    G.Audio.sfx('boss');
    return e;
  }

  function update(dt, pl, t) {
    if (announceT > 0) announceT -= dt;

    // Precarga lo que va a salir en el próximo minuto.
    preloadT -= dt;
    if (preloadT <= 0) { preloadT = 10; G.Sprites.preload(G.Enemies.upcomingDex(t, 60)); }

    // --- jefes ---
    const b = G.Enemies.BOSSES[bossIdx];
    if (b && t >= b.at) { spawnBoss(pl, t, b); bossIdx++; }

    // Combate de jefe: las oleadas bajan al 25% y no hay mareas, para que el
    // jefe sea un momento propio y se le pueda apuntar entre la multitud.
    const bossFight = G.EnemyMgr.bossAlive();

    // --- goteo normal ---
    if (G.EnemyMgr.count < CAP) {
      acc += rate(t) * (bossFight ? 0.25 : 1) * dt;
      let n = Math.floor(acc);
      acc -= n;
      while (n-- > 0 && G.EnemyMgr.count < CAP) spawnOne(pl, t);
    }

    // --- marea ---
    if (!bossFight) surgeT -= dt;
    if (surgeT <= 0) {
      surgeT = G.U.rand(38, 56);
      const base = Math.random() * 6.2832;
      const n = Math.min(CAP - G.EnemyMgr.count, 14 + Math.floor(t / 22));
      for (let i = 0; i < n; i++) spawnOne(pl, t, base + G.U.rand(-0.55, 0.55));
      say('¡Marea de Pokémon!', 2.2);
      G.Audio.sfx('surge');
    }
  }

  /** Aviso grande en pantalla (también lo usan el bioma y los shinies). */
  function say(text, secs = 2.6) { announce = text; announceT = secs; }

  function banner() { return announceT > 0 ? { text: announce, t: announceT } : null; }

  return { reset, update, banner, say, rate, SHINY_RATE,
           debugForceShiny(n = 1) { forceShiny = n; } };
})();
