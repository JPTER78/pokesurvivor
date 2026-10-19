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
  // Tope de enemigos a la vez (antes 420: con tantos se ralentizaba). Cuando
  // se llega al tope, los que siguen saliendo son "élite" (más vida, daño y
  // experiencia), así la dificultad no baja.
  const CAP = 64, ELITE_FROM = 0.85;
  // Menos Pokémon pero más fuertes (la pantalla no se satura): salen ~24% de
  // los de antes, cada uno con más vida, daño y experiencia.
  const DENSITY = 0.24, DMG_K = 2.4, XP_K = 5.6;
  // La resistencia extra crece con la run: al principio ×3,3 y hasta ×5
  // hacia el minuto 6, cuando ya tienes ataques para tumbarlos.
  const hpK = t => 3.3 + Math.min(1.7, t / 210);
  const SHINY_RATE = 1 / 4096;
  let acc = 0, surgeT = 32, announce = null, announceT = 0, preloadT = 0;
  let forceShiny = 0;           // para pruebas: los N próximos salen shiny

  function reset() {
    acc = 0; surgeT = 32; announce = null; announceT = 0; preloadT = 0;
    G.Enemies.rollRun();
    G.Sprites.preload(G.Enemies.upcomingDex(0, 80));
  }

  /** Enemigos por segundo según el minuto de la run. */
  function rate(t) {
    return (1.6 + t * 0.028 + Math.pow(t / 60, 1.6) * 0.5) * DENSITY;
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

  function isFlyer(def) { return G.Sprites.hovers(def.dex); }

  /** @param k  multiplicador (brote masivo: más probabilidad para su especie) */
  function rollShiny(dex, k = 1) {
    if (!G.Sprites.hasShiny(dex)) return false;
    if (forceShiny > 0) { forceShiny--; return true; }
    return Math.random() < SHINY_RATE * k;
  }

  function spawnOne(pl, t, angle) {
    const def = G.U.pick(G.Enemies.bagAt(t));
    const pt = freePoint(pl, angle == null ? Math.random() * 6.2832 : angle, isFlyer(def));
    if (!pt) return null;
    const shiny = rollShiny(def.dex, G.Events.shinyBoost(def.dex));
    // Rango de la partida y modo infinito (systems/acts.js): más vida y daño.
    const e = new G.Enemy(def, pt[0], pt[1], scaled(G.Enemies.scale(t), G.Coop.scaleHp(players.length) * hpK(t) * G.Acts.hpMul()));
    e.dmg *= DMG_K * G.Acts.dmgMul(); e.xp = Math.round(e.xp * XP_K);
    // Torre Lavanda: los fantasmas atraviesan las paredes.
    if (G.World.biomeKey === 'tower' && e.types.includes('ghost')) e.flying = true;
    // Apagón (events.js): lo que sale en la oscuridad da más experiencia.
    if (G.Events.current === 'blackout') e.xp = Math.round(e.xp * 1.5);
    if (G.EnemyMgr.count >= CAP * ELITE_FROM) { e.maxHp = e.hp = Math.round(e.maxHp * 1.6); e.dmg *= 1.25; e.xp = Math.round(e.xp * 1.6); }
    if (shiny) e.makeShiny();
    if (G.Events.golden) e.makeGolden();
    G.EnemyMgr.add(e);
    if (shiny) {
      say('¡Un ' + e.name + ' shiny anda cerca!', 3.4);
      G.Audio.sfx('shiny');
    }
    return e;
  }

  function spawnBoss(pl, t, b) {
    const [x, y] = ringPoint(pl, Math.random() * 6.2832);
    const sc = G.Enemies.bossScale(t);
    const e = new G.Enemy(b, x, y, Object.assign({}, sc, { hp: sc.hp * G.Coop.scaleHp(players.length) * (players.length > 1 ? 1.4 : 1) * G.Acts.hpMul(),
                                                       dmg: sc.dmg * G.Acts.dmgMul() }), true);
    if (rollShiny(b.dex)) e.makeShiny();
    // A veces, Alfa o Dominante (más fuerte y con más premio).
    special(e);
    G.EnemyMgr.add(e);
    say('¡' + e.name + (e.shiny ? ' shiny' : '') + ' salvaje apareció!', 3.2);
    G.Camera.kick(1.1);
    G.Audio.sfx('boss');
    return e;
  }

  /** Jefes Alfa o Dominante: 1 de cada 5 jefes sueltos y legendarios de grieta. */
  const SPECIAL_RATE = 0.2;
  function special(e) {
    if (Math.random() < SPECIAL_RATE) e.makeSpecial(Math.random() < 0.5 ? 'alpha' : 'totem');
  }

  /** Dominante: `n` ayudantes alrededor del jefe, de los que salen ahora. */
  function helpers(boss, n) {
    const t = G.Game.st.time;
    for (let i = 0; i < n && G.EnemyMgr.count < CAP + 6; i++) {
      const a = Math.random() * 6.2832, d = boss.r + G.U.rand(30, 70);
      const x = boss.x + Math.cos(a) * d, y = boss.y + Math.sin(a) * d * 0.8;
      if (!G.World.isFree(x, y, 12)) continue;
      const def = G.U.pick(G.Enemies.bagAt(t));
      const e = new G.Enemy(def, x, y, scaled(G.Enemies.scale(t), G.Coop.scaleHp(players.length) * hpK(t) * G.Acts.hpMul()));
      e.dmg *= DMG_K * G.Acts.dmgMul(); e.xp = Math.round(e.xp * XP_K);
      G.EnemyMgr.add(e);
      G.FX.ring(x, y, 4, 30, '#ffd23f', 0.4, 3);
    }
    say('¡' + boss.name + ' llama a sus ayudantes!', 2.2);
  }

  /** Jefe suelto número `i` de la partida (los manda acts.js: 2 por acto). */
  function spawnLoose(i, t) {
    const b = G.Enemies.BOSSES[i];
    if (b && players.length) return spawnBoss(anchor(), t, b);
    return null;
  }

  /** Jefe de zona o final (acts.js): su definición ya trae vida y daño. */
  function spawnBossDef(def, msg) {
    if (!players.length) players = G.Game.everyone();
    const [x, y] = ringPoint(anchor(), Math.random() * 6.2832);
    const e = new G.Enemy(def, x, y, { hp: 1, spd: 1, dmg: 1 }, true);
    if (rollShiny(def.dex)) e.makeShiny();
    G.EnemyMgr.add(e);
    say(msg, 3.6);
    G.Camera.kick(1.2);
    G.Audio.sfx('boss');
    return e;
  }

  /** @param who  el jugador o la lista de jugadores (cooperativo) */
  function update(dt, who, t) {
    players = Array.isArray(who) ? who : [who];
    if (announceT > 0) announceT -= dt;
    // En la arena de la grieta no sale nada más; tras vencer al jefe final
    // tampoco (salvo en el modo infinito). Los jefes los manda acts.js.
    if (G.Rift.inArena || !G.Acts.spawning()) return;

    // Precarga lo que va a salir en el próximo minuto.
    preloadT -= dt;
    if (preloadT <= 0) { preloadT = 10; G.Sprites.preload(G.Enemies.upcomingDex(t, 60)); }

    // Combate de jefe: las oleadas bajan al 25% y no hay mareas, para que el
    // jefe sea un momento propio y se le pueda apuntar entre la multitud.
    const bossFight = G.EnemyMgr.bossAlive();

    // --- goteo normal ---
    if (G.EnemyMgr.count < CAP) {
      acc += rate(t) * G.Coop.scaleRate(players.length) * G.Acts.rateMul() * (bossFight ? 0.25 : 1) * dt;
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
      const n = Math.min(CAP - G.EnemyMgr.count, Math.round((14 + Math.floor(t / 22)) * G.Coop.scaleRate(players.length) * 0.4));
      for (let i = 0; i < n; i++) spawnOne(target, t, base + G.U.rand(-0.55, 0.55));
      say('¡Marea de Pokémon!', 2.2);
      G.Audio.sfx('surge');
    }
  }

  /** Unos cuantos de golpe desde un lado (al empezar una horda). */
  function burst(n) {
    const base = Math.random() * 6.2832, target = anchor() || G.Game.player, t = G.Game.st.time;
    for (let i = 0; i < n && G.EnemyMgr.count < CAP + 10; i++) spawnOne(target, t, base + G.U.rand(-0.6, 0.6));
  }

  /**
   * Un rezagado vuelve a salir por delante del jugador (hacia donde corre),
   * fuera de la vista. Devuelve false si no hay sitio (entonces se quita).
   */
  function ahead(e, pl) {
    if (!players.length) players = [pl];
    const sp = Math.hypot(pl._vx || 0, pl._vy || 0);
    const a0 = sp > 20 ? Math.atan2(pl._vy, pl._vx) : Math.random() * 6.2832;
    const pt = freePoint(pl, a0 + G.U.rand(-0.9, 0.9), e.flying);
    if (!pt) return false;
    e.x = pt[0]; e.y = pt[1]; e.kx = e.ky = 0;
    e.phase = 'walk'; e.pt = 0; e.jump = null; e.jumpLift = 0;
    return true;
  }

  /** Aviso grande en pantalla (también lo usan el bioma y los shinies). */
  /** @param local  sólo en este ordenador (no se manda a los compañeros) */
  function say(text, secs = 2.6, local = false) {
    announce = text; announceT = secs;
    if (G.Coop.isHost && !local) G.Coop.say(text, secs);
  }

  function banner() { return announceT > 0 ? { text: announce, t: announceT } : null; }

  /** Invitado en cooperativo: sólo corre el reloj del aviso. */
  function tickBanner(dt) { if (announceT > 0) announceT -= dt; }

  return { reset, update, ahead, burst, tickBanner, banner, say, rate, spawnLoose, spawnBossDef, special, helpers, SHINY_RATE, CAP,
           debugForceShiny(n = 1) { forceShiny = n; } };
})();
