/* ============ spawner.js — oleadas, jefes y shinies ============
 * Los enemigos aparecen en un anillo justo fuera de la vista, así que nunca
 * se materializan en pantalla. Cada ~45 s hay una "marea": una avalancha
 * concentrada desde un lado concreto, para romper el ritmo.
 *
 * Cada enemigo tiene 1/4096 de salir shiny (como en los juegos clásicos).
 * Una run mata 1.500–4.000, así que sale uno cada 1–3 partidas.
 *
 * Cooperativo (sólo en el anfitrión): aparecen alrededor de un jugador vivo
 * al azar, fuera de la vista de TODOS, y hay más y más fuertes según cuántos
 * jugáis (ver G.Coop.scaleRate / scaleHp).
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

  let players = [];

  /** ¿Lo vería algún jugador? (para no aparecer delante de nadie) */
  function seenByAnyone(x, y) {
    const r = G.Camera.outerRadius() - 30;
    return players.some(o => G.U.dist2(o.x, o.y, x, y) < r * r);
  }

  /** Punto del anillo donde quepa: no dentro de paredes ni en el agua. */
  function freePoint(pl, angle, flying) {
    for (let i = 0; i < 8; i++) {
      const a = angle + (i === 0 ? 0 : G.U.rand(-0.9, 0.9));
      const [x, y] = ringPoint(pl, a);
      if (players.length > 1 && seenByAnyone(x, y)) continue;
      if (flying || G.World.isFree(x, y, 14)) return [x, y];
    }
    return null;
  }

  /** Jugador alrededor del que sale el siguiente enemigo. */
  function anchor() {
    const alive = players.filter(o => !o.dead);
    return alive.length ? G.U.pick(alive) : players[0];
  }

  function scaled(sc, k) { return k === 1 ? sc : Object.assign({}, sc, { hp: sc.hp * k }); }

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
    const shiny = rollShiny(def.dex);
    const e = new G.Enemy(def, pt[0], pt[1], scaled(G.Enemies.scale(t), G.Coop.scaleHp(players.length)));
    if (shiny) e.makeShiny();
    G.EnemyMgr.add(e);
    if (shiny) {
      say('¡Un ' + e.name + ' shiny anda cerca!', 3.4);
      G.Audio.sfx('shiny');
    }
    return e;
  }

  function spawnBoss(pl, t, b) {
    const [x, y] = ringPoint(pl, Math.random() * 6.2832);
    const e = new G.Enemy(b, x, y, scaled(G.Enemies.bossScale(t), G.Coop.scaleHp(players.length) * (players.length > 1 ? 1.4 : 1)), true);
    if (rollShiny(b.dex)) e.makeShiny();
    G.EnemyMgr.add(e);
    say('¡' + e.name + (e.shiny ? ' shiny' : '') + ' salvaje apareció!', 3.2);
    G.Camera.kick(1.1);
    G.Audio.sfx('boss');
    return e;
  }

  /** @param who  el jugador o la lista de jugadores (cooperativo) */
  function update(dt, who, t) {
    players = Array.isArray(who) ? who : [who];
    if (announceT > 0) announceT -= dt;

    // Precarga lo que va a salir en el próximo minuto.
    preloadT -= dt;
    if (preloadT <= 0) { preloadT = 10; G.Sprites.preload(G.Enemies.upcomingDex(t, 60)); }

    // --- jefes ---
    const b = G.Enemies.BOSSES[bossIdx];
    if (b && t >= b.at) { spawnBoss(anchor(), t, b); bossIdx++; }

    // Combate de jefe: las oleadas bajan al 25% y no hay mareas, para que el
    // jefe sea un momento propio y se le pueda apuntar entre la multitud.
    const bossFight = G.EnemyMgr.bossAlive();

    // --- goteo normal ---
    if (G.EnemyMgr.count < CAP) {
      acc += rate(t) * G.Coop.scaleRate(players.length) * (bossFight ? 0.25 : 1) * dt;
      let n = Math.floor(acc);
      acc -= n;
      while (n-- > 0 && G.EnemyMgr.count < CAP) spawnOne(anchor(), t);
    }

    // --- marea ---
    if (!bossFight) surgeT -= dt;
    if (surgeT <= 0) {
      surgeT = G.U.rand(38, 56);
      const base = Math.random() * 6.2832;
      const target = anchor();
      const n = Math.min(CAP - G.EnemyMgr.count, Math.round((14 + Math.floor(t / 22)) * G.Coop.scaleRate(players.length)));
      for (let i = 0; i < n; i++) spawnOne(target, t, base + G.U.rand(-0.55, 0.55));
      say('¡Marea de Pokémon!', 2.2);
      G.Audio.sfx('surge');
    }
  }

  /** Aviso grande en pantalla (también lo usan el bioma y los shinies). */
  function say(text, secs = 2.6) {
    announce = text; announceT = secs;
    if (G.Coop.isHost) G.Coop.say(text, secs);
  }

  function banner() { return announceT > 0 ? { text: announce, t: announceT } : null; }

  /** Invitado en cooperativo: sólo corre el reloj del aviso. */
  function tickBanner(dt) { if (announceT > 0) announceT -= dt; }

  return { reset, update, tickBanner, banner, say, rate, SHINY_RATE,
           debugForceShiny(n = 1) { forceShiny = n; } };
})();
