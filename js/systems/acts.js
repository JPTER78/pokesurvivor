/* ============ acts.js — estructura de la partida (desde el 16-10-2026) ============
 * Sustituye a la Sentencia de Arceus. Como Megabonk o Survivor.io:
 *
 *   3 ACTOS de 10 minutos, cada uno en un bioma sorteado (sin repetir).
 *     - jefes sueltos a los 3 y a los 7 minutos del acto, y las grietas como siempre
 *     - en el minuto 10, el JEFE DE ZONA (fuerte, de los tipos del bioma). Las
 *       oleadas siguen; al vencerlo se pasa al siguiente acto. Si tardas más de
 *       3 minutos, se enfurece.
 *   El jefe del acto 3 es el JEFE FINAL: un legendario al azar, con fases.
 *   Al vencerlo se abre un PORTAL: si lo cruzas, ganas y cobras.
 *   En el rango Maestro, si no lo cruzas en 20 s, empieza el MODO INFINITO:
 *   sólo oleadas, sin jefes ni grietas, cada vez más fuertes y sin límite.
 *   El ranking sólo cuenta el tiempo aguantado en el modo infinito.
 *
 * RANGOS de cuenta (save.rank = el último desbloqueado). Se juega el que elijas
 * de los que tienes (save.rpick; si no has elegido, el último: pickOf). En
 * grupo, el que elija el anfitrión, hasta el más alto que tenga alguien del
 * grupo. Ganar desbloquea el siguiente al tuyo (uno solo, aunque el grupo
 * jugara uno más alto; ganar en uno por debajo del tuyo no desbloquea nada).
 *
 * Cooperativo: decide el anfitrión; los demás reciben el estado en cada
 * fotograma (netState / netApply) y el final de la partida con 'ov' (why: 'win').
 */
G.Acts = (() => {
  const ACT = 600, ACTS = 3, ENRAGE = 180, STAY = 20;
  const RANKS = [
    { id: 'normal',  name: 'Normal',  color: '#c9d6ff', hp: 1,    dmg: 1,    reward: 1 },
    { id: 'bronce',  name: 'Bronce',  color: '#d9925a', hp: 1.35, dmg: 1.2,  reward: 1.25 },
    { id: 'plata',   name: 'Plata',   color: '#cfd8e4', hp: 1.8,  dmg: 1.4,  reward: 1.5 },
    { id: 'oro',     name: 'Oro',     color: '#ffd23f', hp: 2.4,  dmg: 1.65, reward: 1.8 },
    { id: 'maestro', name: 'Maestro', color: '#c47bff', hp: 3.2,  dmg: 1.9,  reward: 2.2 }
  ];
  const MAX_RANK = RANKS.length - 1;
  const LOOSE = [180, 420];                       // jefes sueltos (segundo del acto)
  const ZONE = [{ hp: 12000, dmg: 50, xp: 1500 }, { hp: 40000, dmg: 65, xp: 3000 }];
  const FINAL = { hp: 120000, dmg: 80, xp: 6000 };

  let rank = 0, act = 0, actT = 0, phase = 'act', biomes = [0, 1, 2], looseIdx = 0;
  let bossId = 0, bossT = 0, enraged = false, finalPh = 0, warned = false, next = null;
  let portal = null, stayT = 0, infT = 0, won = false;
  const authority = () => !G.Coop.active || G.Coop.isHost;
  const say = (t, s = 3, local = false) => G.Spawner.say(t, s, local);
  const biomeName = i => G.Tiles.BIOMES[i].name;

  /** Rango que te toca (el último desbloqueado). */
  function rankOf(s) { return Math.max(0, Math.min(MAX_RANK, (s && s.rank) | 0)); }
  /** El rango que juegas en solitario: el elegido (save.rpick) o, si no, el último desbloqueado. */
  function pickOf(s) { const top = rankOf(s); return s && Number.isInteger(s.rpick) ? Math.max(0, Math.min(top, s.rpick)) : top; }

  /** Biomas de los 3 actos, sorteados con la semilla del mundo (igual para todo el grupo). */
  function pickBiomes(seed) {
    const list = [...Array(G.Tiles.NORMAL).keys()];
    list.sort((a, b) => G.U.hash(a, seed, 71) - G.U.hash(b, seed, 71));
    return list.slice(0, ACTS);
  }

  function reset(r = 0, seed = 1) {
    rank = Math.max(0, Math.min(MAX_RANK, r | 0));
    act = 0; actT = 0; phase = 'act'; looseIdx = 0;
    bossId = 0; bossT = 0; enraged = false; finalPh = 0; warned = false; next = null;
    portal = null; stayT = 0; infT = 0; won = false;
    biomes = pickBiomes(seed);
  }

  /** Al empezar la partida: bioma del primer acto. */
  function start() {
    enterBiome(biomes[0], true);
    say('Rango ' + RANKS[rank].name + ' · Acto 1: ' + biomeName(biomes[0]), 3.6, true);
  }

  function enterBiome(b, instant) {
    G.World.setBiome(b, instant);
    G.Enemies.setBiome(b);
  }

  // ---------------- cada fotograma ----------------

  function update(dt, pl, time) {
    if (G.Rift.inArena) return;
    if (phase === 'infinite') { infT += dt; return; }
    if (phase === 'portal') { portalTick(dt); return; }
    if (!authority()) { if (phase === 'act') actT += dt; return; }

    if (phase === 'act') {
      actT += dt;
      if (looseIdx < LOOSE.length && actT >= LOOSE[looseIdx]) {
        G.Spawner.spawnLoose(act * LOOSE.length + looseIdx, time);
        looseIdx++;
      }
      if (!warned && actT >= ACT - 20) {
        warned = true;
        // Se elige ya, para que su sprite esté cargado cuando salga.
        next = act >= ACTS - 1 ? G.Enemies.finalBoss() : G.Enemies.zoneBoss(biomes[act]);
        G.Sprites.preload([next.dex], 4000);
        say(act < ACTS - 1 ? '¡El jefe de zona se acerca!' : '¡Algo enorme se acerca…!', 3);
      }
      if (actT >= ACT) spawnBoss();
      return;
    }
    // Jefe de zona o jefe final.
    const e = G.EnemyMgr.get(bossId);
    if (!e || e.dead) { if (phase === 'zone') nextAct(); else victory(); return; }
    bossT += dt;
    if (phase === 'zone' && !enraged && bossT > ENRAGE) {
      enraged = true;
      e._dmg *= 1.5; e.spd *= 1.25;          // (_dmg: con dmg, un Gruñido activo se quedaba para siempre)
      if (G.Coop.isHost) G.Coop.broadcast(['edm', e.id, e._dmg]);
      say('¡' + e.name + ' se impacienta! Pega más fuerte', 2.8);
      G.FX.ring(e.x, e.y, e.r, e.r * 6, '#ff4a4a', 0.7, 5);
    }
    if (phase === 'final') finalPhases(e);
  }

  /** Jefe de zona (actos 1 y 2) o jefe final (acto 3). */
  function spawnBoss() {
    const final = act >= ACTS - 1;
    const base = final ? FINAL : ZONE[act];
    const p = next || (final ? G.Enemies.finalBoss() : G.Enemies.zoneBoss(biomes[act]));
    next = null;
    const n = G.Game.everyone().length;
    const R = RANKS[rank];
    const def = {
      dex: p.dex, name: p.name,
      hp: Math.round(base.hp * R.hp * G.Coop.scaleHp(n) * (n > 1 ? 1.4 : 1)),
      spd: Math.round(G.U.clamp(46 + (p.spd - 78) * 0.55, 46, 100)),
      dmg: Math.round(base.dmg * R.dmg), xp: base.xp,
      behavior: p.types.some(x => ['psychic', 'electric', 'ghost', 'fairy', 'fire', 'water', 'ice', 'dragon'].includes(x)) ? 'ranged' : 'charger',
      shotDmg: Math.round(base.dmg * R.dmg * 0.5), shotCd: final ? 0.85 : 1, range: 290
    };
    const e = G.Spawner.spawnBossDef(def, final ? '¡' + p.name + ' aparece! ¡Jefe final!' : '¡Jefe de zona: ' + p.name + '!');
    if (!e) return;
    if (final) { e.legend = true; e.final = true; } else e.zone = true;
    bossId = e.id; bossT = 0; enraged = false; finalPh = 0;
    phase = final ? 'final' : 'zone';
  }

  function finalPhases(e) {
    if (finalPh === 0 && e.hp < e.maxHp * 0.66) {
      finalPh = 1;
      G.Spawner.burst(10);
      e.shield = Math.round(e.maxHp * 0.05);
      say('¡' + e.name + ' llama a sus aliados!', 2.6);
    } else if (finalPh === 1 && e.hp < e.maxHp * 0.33) {
      finalPh = 2;
      G.Spawner.burst(14);
      e._dmg *= 1.2; e.spd *= 1.1;
      if (G.Coop.isHost) G.Coop.broadcast(['edm', e.id, e._dmg]);
      say('¡' + e.name + ' lo da todo!', 2.6);
    } else return;
    G.Camera.kick(0.8);
    G.FX.ring(e.x, e.y, e.r, e.r * 7, '#ffd23f', 0.7, 6);
    G.Audio.sfx('boss');
  }

  function nextAct() {
    act++; actT = 0; phase = 'act'; looseIdx = 0; warned = false; bossId = 0;
    G.Progress.event('zoneBoss', { act });
    changedAct();
  }

  /** En cada ordenador: el acto ha cambiado. */
  function changedAct() {
    enterBiome(biomes[act], false);
    G.Audio.sfx('biome');
    say('— Acto ' + (act + 1) + ': ' + biomeName(biomes[act]) + ' —', 3.4, true);
    const pl = G.Game.player;
    if (pl) G.FX.ring(pl.x, pl.y, 10, G.Camera.outerRadius(), '#ffffff', 0.7, 6);
  }

  // ---------------- victoria, portal y modo infinito ----------------

  function victory() {
    won = true;
    phase = 'portal';
    stayT = rank === MAX_RANK ? STAY : 0;
    const alive = G.Game.everyone().filter(p => !p.dead);
    const near = alive[0] || G.Game.player;
    // Si no hay sitio libre cerca, donde estás (antes podía quedar en un muro o en la lava).
    portal = { x: near.x, y: near.y, t: 0 };
    find: for (const k of [1, 0.6, 0.3]) {
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * 6.2832, x = near.x + Math.cos(a) * 130 * k, y = near.y + Math.sin(a) * 110 * k;
        if (G.World.isFree(x, y, 20)) { portal.x = x; portal.y = y; break find; }
      }
    }
    G.Pickups.pullAll();
    announceWin();
  }

  function announceWin() {
    G.Audio.sfx('legend');
    say(rank === MAX_RANK ? '¡Victoria! Cruza el portal para salir… o quédate: el modo infinito empieza en 20 s'
                          : '¡Victoria! Cruza el portal para salir y cobrar', 5, true);
  }

  function portalTick(dt) {
    portal.t += dt;
    if (!authority()) return;
    // Quien manda mira si alguien lo cruza (en grupo, cualquiera: salís todos).
    for (const p of G.Game.everyone()) {
      if (!p.dead && G.U.dist2(p.x, p.y, portal.x, portal.y - 10) < 30 * 30) { G.Game.winRun(); return; }
    }
    if (stayT > 0 && (stayT -= dt) <= 0) startInfinite();
  }

  function startInfinite() {
    phase = 'infinite'; infT = 0; portal = null; stayT = 0;
    say('¡MODO INFINITO! Aguanta todo lo que puedas', 4, true);
    G.Audio.sfx('boss');
    G.Camera.kick(0.8);
  }

  // ---------------- lo que preguntan los demás módulos ----------------

  const inf = () => phase === 'infinite';
  /** ¿Siguen saliendo enemigos? (tras la victoria no, salvo en el modo infinito) */
  const spawning = () => phase !== 'portal';
  /** Grietas: sólo durante los actos, y no justo antes del jefe final. */
  const riftsAllowed = () => phase === 'act' && actT < ACT - 60 && !(act === ACTS - 1 && actT > ACT - 120);
  /** Eventos y climas al azar: sólo durante los actos. */
  const eventsAllowed = () => phase === 'act';
  const hpMul = () => RANKS[rank].hp * (inf() ? 1 + infT / 60 * 0.45 : 1);
  const dmgMul = () => RANKS[rank].dmg * (inf() ? 1 + infT / 60 * 0.2 : 1);
  const rateMul = () => (inf() ? 1.6 + infT / 120 : 1);

  /** Línea del HUD bajo el reloj. */
  function hudLine() {
    if (phase === 'infinite') return 'MODO INFINITO · ' + G.U.mmss(infT);
    if (phase === 'portal') return stayT > 0 ? '¡VICTORIA! · INFINITO EN ' + Math.ceil(stayT) : '¡VICTORIA! · CRUZA EL PORTAL';
    if (phase === 'final') return 'JEFE FINAL · ' + biomeName(biomes[act]).toUpperCase();
    if (phase === 'zone') return 'JEFE DE ZONA · ACTO ' + (act + 1) + '/' + ACTS;
    return 'ACTO ' + (act + 1) + '/' + ACTS + ' · ' + biomeName(biomes[act]).toUpperCase();
  }

  function summary() {
    return { rank, act: act + 1, won, inf: inf(), infT: Math.floor(infT) };
  }

  // ---------------- dibujo del portal ----------------

  function drawable() {
    if (!portal) return null;
    return {
      y: portal.y,
      draw(ctx) {
        const P = G.Sprites.PX, t = portal.t;
        const img = G.Tiles.propSprite(0, 'rift', Math.floor(t * 8) % 4);
        const w = img.width * P, h = img.height * P;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.ellipse(portal.x, portal.y, 36 + Math.sin(t * 4) * 3, 13, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = Math.min(1, t * 2);
        ctx.filter = 'hue-rotate(160deg) saturate(1.6) brightness(1.2)';
        ctx.drawImage(img, Math.round(portal.x - w / 2), Math.round(portal.y - h + 4), w, h);
        ctx.restore();
        if (Math.random() < 0.4) G.FX.px(portal.x + G.U.rand(-14, 14), portal.y - G.U.rand(10, 80), '#fff1a0', { vy: -50, life: 0.6 });
      }
    };
  }

  // ---------------- red ----------------

  const PH = ['act', 'zone', 'final', 'portal', 'infinite'];
  function netState() {
    return [act, Math.round(actT), PH.indexOf(phase), portal ? [Math.round(portal.x), Math.round(portal.y)] : 0,
            Math.round(infT), Math.ceil(stayT), won ? 1 : 0];
  }
  function netApply(a) {
    if (!Array.isArray(a)) return;
    const [na, at, ph, pt, it, st, w] = a;
    if (na !== act && na >= 0 && na < ACTS) {
      if (na > act) G.Progress.event('zoneBoss', { act: na });   // el jefe de zona lo vence el grupo
      act = na; changedAct();
    }
    actT = at;
    const np = PH[ph] || 'act';
    if (np === 'portal' && phase !== 'portal') { won = true; announceWin(); }
    if (np === 'infinite' && phase !== 'infinite') startInfinite();
    phase = np;
    portal = pt ? Object.assign(portal || { t: 0 }, { x: pt[0], y: pt[1] }) : null;
    infT = it; stayT = st; won = won || !!w;
  }

  return {
    RANKS, MAX_RANK, ACT, rankOf, pickOf, reset, start, update, spawning, riftsAllowed, eventsAllowed,
    hpMul, dmgMul, rateMul, hudLine, summary, drawable, netState, netApply,
    get rank() { return rank; }, get act() { return act; }, get phase() { return phase; },
    get infinite() { return inf(); }, get won() { return won; },
    /** Para pruebas: salta al minuto 10 del acto (sale su jefe). */
    debugSkip() { if (phase === 'act') actT = ACT - 1; },
    debugInfinite() { won = true; startInfinite(); }
  };
})();
