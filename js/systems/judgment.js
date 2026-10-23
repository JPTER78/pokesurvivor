/* ============ judgment.js — La Sentencia de Arceus (minuto 30) ============
 *
 * Al llegar al minuto 30 se acaba la partida "normal" (como la Muerte de
 * Vampire Survivors):
 *
 *   1. Animación: la pantalla se oscurece, aparece "LA SENTENCIA DE ARCEUS"
 *      con su rueda dorada, destello y viaje a una arena enorme y arrasada
 *      (Ruinas del Juicio). Arceus baja del cielo por un pilar de luz y cae
 *      con una onda de choque. La primera vez se ve entera; después se puede
 *      saltar (en cooperativo sólo el anfitrión).
 *   2. Pelea: Arceus es INVENCIBLE. Te persigue cada vez más deprisa; tocarle
 *      quita el 40 % de la vida y lanza la Sentencia (pilares de luz), rayos en
 *      cruz y ondas, todo con aviso en el suelo. Ese daño ignora tipos y defensa.
 *      Desde el 23-10-2026 se le puede pegar (ranking de daño a Arceus): lleva
 *      una Tabla al azar en cada partida, que le da su tipo (así los ataques de
 *      Lucha no son siempre los mejores), y sólo recibe un poco (ver dmgK). Los
 *      ataques le apuntan sólo cuando no queda ningún legendario.
 *   3. Cada 5 s acude un legendario al azar, cada uno con un 25 % más de vida
 *      (y un 15 % más de daño) que el anterior (hasta el 23-10 era el doble y
 *      no había forma de tumbarlos). El primero, según el daño que hacíais antes
 *      de la Sentencia a UN enemigo (unos 3 s), para que no caiga al momento.
 *      Dan experiencia, pero nada más (ni monedas, ni tickets, ni objetos).
 *   4. En el minuto 35 Arceus rompe el objeto de todos (Banda Focus incluida).
 *
 * Mientras dura no sale nada más (ni oleadas, ni eventos, ni grietas; desde
 * el 28:00 ya no se abren grietas). Si a las 30:00 estás en una grieta o
 * eligiendo una carta, empieza al terminar.
 *
 * Cooperativo: lo decide el anfitrión. Mensajes (ver coop.js):
 *   'jd' cfg (empieza) · 'jk' (salta la animación)
 *   y en cada envío del anfitrión, ja: [x, y, animación, dirección] de Arceus.
 */
G.Judgment = (() => {
  const AT = 30 * 60;
  const ARENA_R = 24;                 // en tiles (la arena de la grieta: 11)
  const BOSS_EVERY = 5;               // sin tope: siguen saliendo mientras aguantes
  const TOUCH = 0.4;                  // vida que quita tocar a Arceus
  /*
   * Contra la huida sin fin (18-10-2026: con toda la velocidad subida se
   * aguantaba hasta el minuto 60 corriendo en círculos):
   *   - Velocidad con tope suave: lo que pase de 130 cuenta sólo un 25 %
   *     (corriendo al máximo, ~170 en vez de ~290). Antes del minuto 30 no cambia nada.
   *   - Los legendarios corren como mínimo al 80 % de vuestra velocidad.
   *   - Desde los 5 min de Sentencia Arceus acelera sin tope, y desde los 7
   *     su toque quita cada vez más, hasta el 100 % a los 10 (hacia el
   *     minuto 40). Pasar de ahí es prácticamente imposible.
   */
  const SPD_SOFT = 130, SPD_OVER = 0.25;
  const capSpd = s => (s <= SPD_SOFT ? s : SPD_SOFT + (s - SPD_SOFT) * SPD_OVER);
  const touchPct = () => Math.min(1, TOUCH + Math.max(0, arenaT - 420) / 180 * (1 - TOUCH));
  /*
   * Daño a Arceus: recibe el 5 % de lo que le hacéis, y cada vez menos (el 1 %
   * a los 10 min de Sentencia), para que el ranking no tenga números enormes.
   */
  const dmgK = () => 0.05 / (1 + arenaT / 150);
  const HP_GROW = 1.25, DMG_GROW = 1.15;      // cada legendario, respecto al anterior
  const BREAK_AT = 35 * 60, BREAK_T = 1.6;    // rompe los objetos (minuto de la partida; s de aviso)
  // Las Tablas: una al azar en cada partida le da su tipo.
  const PLATES = {
    fire: 'Tabla Llama', water: 'Tabla Linfa', electric: 'Tabla Trueno', grass: 'Tabla Pradal',
    ice: 'Tabla Helada', fighting: 'Tabla Fuerte', poison: 'Tabla Tóxica', ground: 'Tabla Terrax',
    flying: 'Tabla Cielo', psychic: 'Tabla Mental', bug: 'Tabla Bicho', rock: 'Tabla Pétrea',
    ghost: 'Tabla Terror', dragon: 'Tabla Draco', dark: 'Tabla Oscura', steel: 'Tabla Acero', fairy: 'Tabla Duende'
  };
  const ARCEUS = 493, SCALE = 1.5;
  // Línea de tiempo de la animación (segundos).
  const T_TITLE = 1.3, T_FLASH = 4.7, T_PORT = 5.1, T_DESC = 5.7, T_LAND = 7.9, T_BACK = 9.1, T_END = 10.1;
  const GOLD = '#ffd25e';
  const authority = () => !G.Coop.active || G.Coop.isHost;
  const TS = () => G.Tiles.T * G.Sprites.PX;

  let phase = null;                   // null | 'cine' | 'fight'
  let ct = 0;                         // reloj de la animación
  let cfg = null;                     // { tx, ty, q: [dex de los legendarios] }
  let ported = false, landed = false, canSkip = false, cues = {};
  let A = null;                       // Arceus
  let center = null;                  // centro de la arena (mundo)
  let arenaT = 0, bossT = 0, bossN = 0, base = 0, downs = 0;
  let dealt = 0, shielded = false, broke = false, brk = 0;
  let noBosses = false;                // para vídeos: sin legendarios (debugNoBosses)   // daño a Arceus · ¿hay legendarios? · objetos rotos
  // Daño a un solo enemigo por segundo (el que más recibe en cada segundo; con
  // ataques en área, sumar todo daría una vida enorme). Se guardan los últimos
  // 30 s y vale la media de los 6 mejores.
  let hits = new Map(), hitT = 0, samples = [];
  let embers = [];
  let cineAnim = null;

  function reset() {
    phase = null; ct = 0; cfg = null; ported = landed = canSkip = false; cues = {};
    A = null; center = null; arenaT = bossT = 0; bossN = 0; base = 0; downs = 0;
    dealt = 0; shielded = broke = false; brk = 0;
    hits = new Map(); hitT = 0; samples = []; embers = []; cam = null;
  }

  /** Daño hecho a un enemigo (lo llama Enemy.hurt en quien manda). */
  function noteDmg(d, e) { if (!phase) hits.set(e.id, (hits.get(e.id) || 0) + d); }

  function sampleDps(dt) {
    hitT += dt;
    if (hitT < 1) return;
    let best = 0;
    for (const v of hits.values()) if (v > best) best = v;
    samples.push(best / hitT);
    if (samples.length > 30) samples.shift();
    hits.clear(); hitT = 0;
  }
  function singleDps() {
    const top = samples.slice().sort((a, b) => b - a).slice(0, 6);
    return top.length ? top.reduce((a, b) => a + b, 0) / top.length : 0;
  }

  // ---------------- arranque ----------------

  /** Quien manda: elige la arena y los legendarios, y avisa a todos. */
  function start() {
    const pool = G.DEX.filter(p => p.leg && p.dex !== ARCEUS && G.SPRITE_META[p.dex]);
    const q = [];
    for (let i = 0; i < 40; i++) q.push(G.U.pick(pool).dex);
    const c = { tx: -6000 - Math.floor(Math.random() * 2000), ty: -6000 - Math.floor(Math.random() * 2000), q,
                pl: G.U.pick(Object.keys(PLATES)) };
    if (G.Coop.isHost) G.Coop.broadcast(['jd', c]);
    begin(c);
  }

  /** En cada ordenador: empieza la animación. */
  function begin(c) {
    if (phase) return;
    if (!PLATES[c.pl]) c.pl = 'fighting';
    cfg = c;
    phase = 'cine'; ct = 0; cues = {};
    const s = G.DB.save;
    // La primera vez se ve entera; en grupo la salta el anfitrión.
    canSkip = !!(s && s.stats && s.stats.judged > 0) && authority();
    G.Sprites.preload([ARCEUS, ...new Set(c.q.slice(0, 12))], 12000);
    cineAnim = new G.Sprites.Animator(ARCEUS, 1);
    G.Touch.reset();
    G.Audio.music(null);
  }

  /** Salta la animación (tecla o toque; en grupo, el anfitrión). */
  function skip() {
    if (phase !== 'cine' || !canSkip || ct >= T_BACK) return;
    if (G.Coop.isHost) G.Coop.broadcast(['jk']);
    doSkip();
  }
  function doSkip() {
    if (phase !== 'cine') return;
    if (!ported) port();
    land(true);
    ct = T_BACK;
  }

  /** Viaje a la arena (a mitad de la animación, tapado por el destello). */
  function port() {
    ported = true;
    const pl = G.Game.player, ts = TS();
    G.Rift.reset();
    if (authority()) G.EnemyMgr.stash(); else G.EnemyMgr.clearRemote();
    G.Projectiles.clear();
    G.Combat.clearFields();
    G.Hazards.clear();
    G.Pickups.clear();
    G.Events.reset();
    G.Weather.clear();
    G.World.setArena({ tx: cfg.tx, ty: cfg.ty, r: ARENA_R, type: 'judgment' });
    G.World.setBiome(G.Tiles.arenaBiome('judgment'), true);
    center = { x: cfg.tx * ts + ts / 2, y: cfg.ty * ts + ts / 2 };
    const ps = G.Game.everyone();
    ps.forEach((p, i) => { p.x = center.x + (i - (ps.length - 1) / 2) * 34; p.y = center.y + ts * 3; });
    G.Camera.x = pl.x; G.Camera.y = pl.y;
    const anim = new G.Sprites.Animator(ARCEUS, SCALE);
    A = { x: center.x, y: center.y - ts * 5, lift: 900, anim, r: G.Sprites.bodyRadius(ARCEUS, SCALE) * 0.9,
          bodyH: G.Sprites.bodyHeight(ARCEUS, SCALE), cd: 2.2, cast: null, touchCd: 0, spin: 0,
          net: null, glow: 0 };
    anim.dir = 0;
  }

  /** Arceus toca el suelo. */
  function land(quiet = false) {
    if (landed || !A) return;
    landed = true;
    A.lift = 0;
    A.anim.play('Attack', { speed: 0.8 });
    if (quiet) return;
    G.Camera.kick(1.2);
    G.Game.flash('#fff3c8', 0.7);
    G.Audio.sfx('land');
    for (let i = 0; i < 4; i++) G.FX.ring(A.x, A.y, 10 + i * 20, 260 + i * 140, i % 2 ? '#fff3c8' : GOLD, 0.5 + i * 0.25, 8 - i);
    G.FX.burst(A.x, A.y - 20, GOLD, 60, 360);
    G.FX.burst(A.x, A.y - 10, '#ffffff', 30, 240);
  }

  /** Fin de la animación: empieza la pelea. */
  function fight() {
    phase = 'fight';
    if (!ported) port();
    land(true);
    arenaT = 0; bossT = 1.2; bossN = 0; downs = 0;
    G.Progress.event('judge');
    // Vida del primer legendario: unos 3 s de vuestro daño a un enemigo (y un mínimo).
    const n = G.Game.everyone().length, t = G.Game.st.time;
    const floor = (3200 + t * 9) * 0.35 * G.Coop.scaleHp(n);
    base = Math.max(floor, singleDps() * 3);
    G.Spawner.say('¡Arceus lleva la ' + PLATES[cfg.pl] + '! Ahora es de tipo ' + G.U.TYPE_NAME[cfg.pl], 4, true);
    if (authority()) addTarget();
  }

  /*
   * El blanco de Arceus: un enemigo invisible que va siempre donde está él.
   * Así los ataques le dan como a cualquiera (y en cooperativo, los golpes de
   * los invitados llegan al anfitrión, que lleva la cuenta). No se mueve solo,
   * no hace daño al tocarle y no cae nunca (ver Enemy.hurt).
   */
  function addTarget() {
    const def = { dex: ARCEUS, name: 'Arceus', hp: 1e9, spd: 0, dmg: 0, xp: 0, behavior: 'arceus' };
    const e = new G.Enemy(def, A.x, A.y, { hp: 1, spd: 1, dmg: 1 }, false);
    dress(e);
    e.update = function (dt) { if (A) { this.x = A.x; this.y = A.y; } if (this.flash > 0) this.flash -= dt; };
    G.EnemyMgr.add(e);
  }
  /** Lo que lo hace "Arceus" (también en la copia de los invitados). */
  function dress(e) {
    e.arceus = true; e.judge = true;
    e.types = [cfg ? cfg.pl : 'normal']; e.atkType = e.types[0];
    e.r = G.Sprites.bodyRadius(ARCEUS, SCALE) * 0.9;
    e.bodyH = G.Sprites.bodyHeight(ARCEUS, SCALE);
  }
  /** Un golpe a Arceus (en quien manda; ya viene reducido, ver dmgK). */
  function hitArceus(d) { if (phase === 'fight') dealt += d; }

  /** En el minuto 35: aviso y, al poco, se rompe el objeto de cada uno. */
  function startBreak() {
    if (brk > 0 || !A) return;
    brk = BREAK_T;
    G.Spawner.say('¡Arceus va a romper vuestros objetos!', 2.6, true);
    G.Audio.sfx('toll');
    for (let i = 0; i < 3; i++) G.FX.ring(A.x, A.y, A.r, 380 + i * 260, i % 2 ? '#fff3c8' : GOLD, BREAK_T * (0.6 + i * 0.2), 6 - i);
  }
  function shatter() {
    const pl = G.Game.player;
    G.Game.flash('#fff3c8', 0.6);
    G.Camera.kick(0.9);
    G.Audio.sfx('land');
    if (A) G.FX.ring(A.x, A.y, 10, 1400, GOLD, 0.7, 8);
    if (!pl || !pl.item) return;
    G.FX.dmgText(pl.x, pl.y - pl.bodyH - 16, '¡Objeto roto: ' + G.Items.BY[pl.item].name + '!', '#ffd25e', true);
    G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#fff3c8', 26, 220);
    pl.equip(null);
  }

  // ---------------- cada fotograma ----------------

  /** Durante la animación (el resto del juego está parado). */
  function cineTick(dt) {
    const prev = ct;
    ct += dt;
    const at = x => prev < x && ct >= x;
    const pl = G.Game.player;
    if (cineAnim) cineAnim.update(dt);
    if (at(0.01)) { G.Audio.sfx('quake'); G.Camera.kick(0.9); }
    if (ct < T_FLASH && Math.random() < dt * 3) G.Camera.kick(0.15);
    if (at(T_TITLE)) G.Audio.sfx('toll');
    if (at(T_TITLE + 1.7)) G.Audio.sfx('toll');
    if (at(T_FLASH)) G.Game.flash('#ffffff', 0.9);
    if (at(T_PORT) && !ported) port();
    if (at(T_DESC)) G.Audio.sfx('descend');
    if (A && !landed) {
      // Bajada: lenta al principio y frenando al final (como si se posara).
      const k = G.U.clamp((ct - T_DESC) / (T_LAND - T_DESC), 0, 1);
      A.lift = 900 * Math.pow(1 - k, 2.2);
      A.anim.loop('Idle');
      if (ct > T_DESC && Math.random() < dt * 30) G.FX.px(A.x + G.U.rand(-60, 60), A.y - A.lift - G.U.rand(0, 200), Math.random() < 0.5 ? GOLD : '#fff3c8', { vy: G.U.rand(60, 160), life: 0.9 });
      if (at(T_LAND)) land();
    }
    if (A) { A.anim.update(dt); A.spin += dt; }
    // Cámara: tu Pokémon; sube despacio hacia Arceus mientras baja y vuelve.
    let tx = pl.x, ty = pl.y;
    if (ported && A && ct < T_BACK) { tx = A.x; ty = A.y - 60; }
    if (!cam || at(T_PORT) || (ported && !cam.ported)) cam = { x: G.Camera.x, y: G.Camera.y, ported };
    cam.x = G.U.damp(cam.x, tx, 2.2, dt); cam.y = G.U.damp(cam.y, ty, 2.2, dt);
    G.Camera.follow(cam.x, cam.y, dt);
    if (ct >= T_END) { cam = null; fight(); }
  }
  let cam = null;

  /** En la pelea (lo llama game.js en cada fotograma de juego). */
  function update(dt, pl, time) {
    if (!phase) {
      sampleDps(dt);                        // (para la vida del primer legendario)
      if (authority() && time >= AT && !G.Rift.inArena) start();
      return;
    }
    if (phase !== 'fight') return;
    arenaT += dt;
    A.touchCd -= dt; A.spin += dt;
    shielded = G.EnemyMgr.all().some(e => e.boss && !e.dead && !e.arceus);
    if (brk > 0 && (brk -= dt) <= 0) shatter();
    if (authority()) {
      arceusTick(dt);
      keepInside();
      bossT -= dt;
      if (bossT <= 0) { bossT = BOSS_EVERY; if (!noBosses) spawnBoss(); }
    } else netTick(dt);
    A.anim.update(dt);
    touch(pl);
    ember(dt);
  }

  // ---------------- Arceus ----------------

  function target() {
    let best = null, bd = Infinity;
    for (const p of G.Game.everyone()) {
      if (p.dead) continue;
      const d = G.U.dist2(p.x, p.y, A.x, A.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function arceusTick(dt) {
    const tg = target();
    if (A.cast) { castTick(dt, tg); return; }
    if (!tg) { A.anim.loop('Idle'); return; }
    if (!broke && G.Game.st.time >= BREAK_AT) {
      broke = true;
      cast('break', tg);
      if (G.Coop.isHost) G.Coop.broadcast(['jb']);
      startBreak();
      return;
    }
    // Más lento que tú al principio; a los ~35 s ya te alcanza.
    const k = Math.min(1.22, 0.74 + arenaT * 0.013) + Math.max(0, arenaT - 300) * 0.0015;
    const spd = Math.max(70, (tg.spd || 100) * k);
    const [dx, dy] = G.U.norm(tg.x - A.x, tg.y - A.y);
    A.x += dx * spd * dt; A.y += dy * spd * dt;
    A.anim.dir = G.Sprites.dirFromAngle(Math.atan2(dy, dx));
    A.anim.loop('Walk', Math.max(0.8, spd / 90));
    if (Math.random() < dt * 14) G.FX.px(A.x + G.U.rand(-20, 20), A.y - G.U.rand(0, A.bodyH), GOLD, { vy: -30, life: 0.6 });
    A.cd -= dt;
    if (A.cd <= 0) {
      const d = G.U.dist(A.x, A.y, tg.x, tg.y);
      const id = d < 210 && Math.random() < 0.6 ? 'nova' : (A.last === 'rain' ? 'cross' : 'rain');
      cast(id, tg);
    }
  }

  /** Ataques de Arceus: todos avisan en el suelo y quitan un % de la vida. */
  function cast(id, tg) {
    A.last = id;
    const c = A.cast = { id, t: 0, wind: 0.7 };
    const H = (o) => G.Hazards.add(Object.assign({ type: null, pure: true, dmg: 1, color: GOLD }, o));
    if (id === 'rain') {
      // La Sentencia: pilares de luz sobre cada uno (más cuanto más dura).
      const n = 4 + Math.min(6, Math.floor(arenaT / 10));
      for (const p of G.Game.everyone()) {
        if (p.dead) continue;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * 6.2832, d = i ? G.U.rand(40, 150) : 0;
          H({ kind: 'zone', x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.8, r: 44, delay: 1.25 + i * 0.09, pct: 0.3, vis: 'pillar' });
        }
      }
      A.anim.play('Shoot', { speed: 0.9 });
    } else if (id === 'cross') {
      // Rayos en cruz que barren la arena.
      const a0 = Math.atan2(tg.y - A.y, tg.x - A.x) + (Math.random() < 0.5 ? 0 : Math.PI / 4);
      const n = arenaT > 30 ? 8 : 4;
      for (let i = 0; i < n; i++) H({ kind: 'beam', x: A.x, y: A.y, angle: a0 + i * 6.2832 / n, len: 1700, w: 34, delay: 1.1, pct: 0.35, color: '#fff3b0' });
      c.wind = 1.1;
      A.anim.play('Charge', { speed: 0.9 });
    } else if (id === 'break') {
      // Se para, carga y rompe los objetos de todos (ver startBreak).
      c.wind = BREAK_T;
      A.anim.play('Charge', { speed: 0.6 });
    } else {
      // Onda alrededor de él (si estás demasiado cerca).
      H({ kind: 'zone', x: A.x, y: A.y, r: 170, delay: 0.85, pct: 0.4 });
      c.wind = 0.85;
      A.anim.play('Charge', { speed: 1.2 });
    }
    G.FX.ring(A.x, A.y, A.r, A.r * 3, GOLD, c.wind, 3);
  }

  function castTick(dt, tg) {
    const c = A.cast;
    c.t += dt;
    if (tg) A.anim.dir = G.Sprites.dirFromAngle(Math.atan2(tg.y - A.y, tg.x - A.x));
    if (c.t >= c.wind && !c.done) {
      c.done = true;
      A.anim.play(c.id === 'nova' ? 'Attack' : 'Shoot', { speed: 1.2 });
    }
    if (c.t >= c.wind + 0.35) {
      A.cast = null;
      A.cd = Math.max(1.4, 3.2 - arenaT * 0.025);
    }
  }

  /** Invitado: Arceus va a donde dice el anfitrión. */
  function netTick(dt) {
    const n = A.net;
    if (!n) return;
    const ox = A.x, oy = A.y;
    if (G.U.dist2(A.x, A.y, n.x, n.y) > 300 * 300) { A.x = n.x; A.y = n.y; }
    else { A.x = G.U.damp(A.x, n.x, 10, dt); A.y = G.U.damp(A.y, n.y, 10, dt); }
    A.anim.dir = n.dir;
    if (n.anim !== A.lastNetAnim) {
      A.lastNetAnim = n.anim;
      const a = G.Coop.ANIMS[n.anim];
      if (a === 'Charge' || a === 'Shoot' || a === 'Attack') A.anim.play(a);
    }
    A.anim.loop(Math.abs(A.x - ox) + Math.abs(A.y - oy) > 0.5 ? 'Walk' : 'Idle');
  }

  /** Tocar a Arceus (cada uno mira el suyo). */
  function touch(pl) {
    if (!pl || pl.dead || A.touchCd > 0) return;
    const rr = A.r + pl.r;
    if (G.U.dist2(A.x, A.y, pl.x, pl.y) > rr * rr) return;
    A.touchCd = 0.9;
    pl.invuln = 0;
    pl.hurt(pl.maxHp * touchPct(), null, true);
    G.Camera.kick(0.6);
    G.FX.ring(pl.x, pl.y, 6, 70, GOLD, 0.4, 4);
    if (authority()) A.anim.play('Attack', { speed: 1.4 });
  }

  /** Nadie sale de la arena (Arceus, los legendarios y tú). */
  function keepInside() {
    const ts = TS(), max = (ARENA_R - 1.4) * ts;
    const clampIn = o => {
      const dx = o.x - center.x, dy = o.y - center.y, d = Math.hypot(dx, dy);
      if (d > max) { o.x = center.x + dx / d * max; o.y = center.y + dy / d * max; }
    };
    clampIn(A);
    for (const e of G.EnemyMgr.all()) if (!e.remote) clampIn(e);
  }

  // ---------------- legendarios ----------------

  function spawnBoss() {
    const dex = cfg.q[bossN % cfg.q.length];
    const mon = G.DEX_BY[dex];
    if (!mon) return;
    const t = G.Game.st.time, ts = TS();
    // Lejos de todos (en el borde de la arena).
    let x = center.x, y = center.y;
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * 6.2832, d = (ARENA_R - G.U.rand(3, 6)) * ts;
      x = center.x + Math.cos(a) * d; y = center.y + Math.sin(a) * d;
      if (G.Game.everyone().every(p => G.U.dist2(p.x, p.y, x, y) > 280 * 280)) break;
    }
    const k = Math.pow(HP_GROW, bossN), kd = Math.pow(DMG_GROW, bossN);
    const fast = Math.max(0, ...G.Game.everyone().map(p => (p.dead ? 0 : p.spd || 0)));
    const def = {
      dex, name: mon.name,
      hp: Math.round(base * k),
      spd: Math.round(Math.max(G.U.clamp(48 + (mon.spd - 78) * 0.6, 48, 105), fast * 0.8)),
      dmg: Math.round((36 + t / 20) * kd), xp: Math.round(500 + t * 1.2),
      behavior: mon.types.some(x => ['psychic', 'electric', 'ghost', 'fairy', 'fire', 'water', 'ice', 'dragon'].includes(x)) ? 'ranged' : 'charger',
      shotDmg: Math.round((18 + t / 40) * kd), shotCd: 0.9, range: 300
    };
    const e = new G.Enemy(def, x, y, { hp: 1, spd: 1, dmg: 1 }, true);
    e.judge = true;
    e.flying = false;
    G.EnemyMgr.add(e);
    bossN++;
    G.Sprites.preload([cfg.q[(bossN + 4) % cfg.q.length]], 8000);
    G.FX.ring(x, y, 8, 120, GOLD, 0.6, 5);
    G.FX.burst(x, y - 30, '#fff3c8', 24, 200);
    G.Spawner.say('¡' + e.name + ' acude a la Sentencia!', 1.8);
    G.Audio.sfx('rift');
  }

  /** Ha caído un legendario de la arena (en cada ordenador). */
  function bossDown() { if (phase === 'fight') downs++; }

  // ---------------- dibujo ----------------

  /** Arceus, ordenado por Y con el resto de la escena. */
  function drawable() {
    if (!A || !ported) return null;
    return { y: A.y, draw: drawArceus };
  }

  function drawArceus(ctx) {
    const lift = A.lift;
    const now = performance.now() / 1000;
    // Sombra que crece mientras baja.
    const near = G.U.clamp(1 - lift / 900, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.15 + near * 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(A.x, A.y, 44 * (0.4 + near * 0.6), 16 * (0.4 + near * 0.6), 0, 0, 6.2832); ctx.fill();
    // Aura dorada en el suelo.
    if (lift < 40) {
      ctx.globalAlpha = 0.22 + Math.sin(now * 3) * 0.06;
      ctx.fillStyle = (cfg && G.U.TYPE_COLOR[cfg.pl]) || GOLD;    // del color de su Tabla
      ctx.beginPath(); ctx.ellipse(A.x, A.y, A.r * 2.2, A.r * 0.8, 0, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
    // La rueda dorada detrás de él.
    wheel(ctx, A.x, A.y - lift - A.bodyH * 0.55, A.bodyH * 0.62, A.spin * 0.6, 0.55);
    A.anim.draw(ctx, A.x, A.y - lift);
  }

  /** La rueda de Arceus: aro dorado con 12 joyas que gira. */
  function wheel(ctx, x, y, R, rot, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(2, R * 0.07);
    ctx.shadowColor = '#ffcf4a'; ctx.shadowBlur = R * 0.3;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.2832); ctx.stroke();
    ctx.lineWidth = Math.max(1, R * 0.025);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, 6.2832); ctx.stroke();
    const GEMS = ['#ff6b4d', '#4fa8ff', '#5fe08a', '#ffe14d', '#b37bff', '#c9d2de'];
    for (let i = 0; i < 12; i++) {
      const a = i * 6.2832 / 12;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = GEMS[i % GEMS.length];
      ctx.beginPath(); ctx.moveTo(R * 1.02, 0); ctx.lineTo(R * 0.91, -R * 0.07); ctx.lineTo(R * 0.8, 0); ctx.lineTo(R * 0.91, R * 0.07); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /** Por encima de todo (en el mundo): el pilar de luz por el que baja. */
  function drawAir(ctx) {
    if (!A || !ported) return;
    const cam = G.Camera;
    let a = 0;
    if (phase === 'cine') a = G.U.clamp((ct - T_PORT) / 0.6, 0, 1) * G.U.clamp((T_LAND + 0.6 - ct) / 0.6, 0, 1);
    if (a <= 0) return;
    const top = cam.top() - 40, bot = A.y + 6;
    const near = G.U.clamp(1 - A.lift / 900, 0, 1);
    const w = 40 + near * 40 + Math.sin(ct * 9) * 6;
    ctx.save();
    const g = ctx.createLinearGradient(A.x - w, 0, A.x + w, 0);
    g.addColorStop(0, 'rgba(255,210,94,0)');
    g.addColorStop(0.5, 'rgba(255,248,220,0.7)');
    g.addColorStop(1, 'rgba(255,210,94,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(A.x - w, top, w * 2, Math.max(0, bot - top));
    // Resplandor en el suelo, donde va a caer.
    ctx.globalAlpha = a * (0.35 + near * 0.55);
    ctx.translate(A.x, A.y); ctx.scale(1, 0.36);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.5);
    rg.addColorStop(0, 'rgba(255,243,200,0.9)'); rg.addColorStop(0.5, 'rgba(255,210,94,0.35)'); rg.addColorStop(1, 'rgba(255,210,94,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(0, 0, w * 1.5, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  const F = (wt, s) => `${wt} ${s}px Pixelify,"Segoe UI",system-ui,sans-serif`;

  /** En pantalla: la animación, o el aviso de la pelea. */
  function drawOverlay(ctx, w, h) {
    if (phase === 'cine') drawCine(ctx, w, h);
    else if (phase === 'fight') drawFight(ctx, w, h);
  }

  function drawCine(ctx, w, h) {
    const t = ct;
    G.Touch.clearButtons();             // (el HUD no se dibuja durante la animación)
    ctx.save();
    // Se oscurece todo (hasta el viaje).
    if (t < T_PORT + 0.1) {
      ctx.fillStyle = `rgba(10,6,2,${(G.U.clamp(t / 1.1, 0, 1) * 0.86).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
    // "LA SENTENCIA DE ARCEUS"
    const a = G.U.clamp((t - T_TITLE + 0.3) / 0.5, 0, 1) * G.U.clamp((T_FLASH + 0.2 - t) / 0.35, 0, 1);
    if (a > 0) {
      const cx = w / 2, cy = h * 0.34, R = Math.min(w, h) * 0.24;
      // Rayos de luz que giran.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.18);
      ctx.globalAlpha = a * 0.35;
      for (let i = 0; i < 16; i++) {
        ctx.rotate(6.2832 / 16);
        const g = ctx.createLinearGradient(0, 0, Math.max(w, h), 0);
        g.addColorStop(0, 'rgba(255,214,110,0.9)'); g.addColorStop(1, 'rgba(255,214,110,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.max(w, h), -R * 0.16); ctx.lineTo(Math.max(w, h), R * 0.16); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // Arceus en silueta de luz, detrás de su rueda.
      wheel(ctx, cx, cy - R * 0.05, R, t * 0.35, a * 0.9);
      const idle = G.Sprites.sheet(ARCEUS, 'Idle');
      if (cineAnim && idle && idle.ready) {
        // Silueta de luz que llena la rueda (en múltiplos de 0,5: píxeles enteros).
        const body = (G.Sprites.animMeta(ARCEUS, 'Idle').ay || 47) * G.Sprites.PX;
        cineAnim.scale = Math.max(1, Math.round(R * 1.7 / body * 2) / 2);
        const rise = (1 - G.U.clamp((t - T_TITLE + 0.3) / 0.8, 0, 1)) * R * 0.3;
        ctx.save();
        ctx.globalAlpha = a * 0.85;
        ctx.shadowColor = '#ffcf4a'; ctx.shadowBlur = 40;
        cineAnim.draw(ctx, cx, cy + body * cineAnim.scale * 0.5 + rise, { flash: true });
        ctx.restore();
      }
      // El título, letra a letra, debajo de la rueda.
      const size = Math.round(G.U.clamp(Math.min(w / 13, h / 9), 24, 64));
      const ty = cy + R + size * 1.15;
      title(ctx, 'LA SENTENCIA', cx, ty, size, T_TITLE, a);
      title(ctx, 'DE ARCEUS', cx, ty + size * 0.95, Math.round(size * 0.8), T_TITLE + 0.75, a);
      ctx.globalAlpha = a * G.U.clamp((t - T_TITLE - 1.6) / 0.6, 0, 1);
      ctx.font = F(700, Math.round(size * 0.32));
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f3e2b0';
      ctx.fillText('El tiempo se ha agotado…', cx, ty + size * 1.7);
    }
    // Franjas negras de cine durante la bajada.
    if (t > T_PORT) {
      const k = G.U.clamp((t - T_PORT) / 0.5, 0, 1) * G.U.clamp((T_END - t) / 0.6, 0, 1);
      const bh = Math.round(h * 0.11 * k);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, bh); ctx.fillRect(0, h - bh, w, bh);
    }
    // ¡Ha descendido!
    const b = G.U.clamp((t - T_LAND - 0.15) / 0.3, 0, 1) * G.U.clamp((T_END - t) / 0.5, 0, 1);
    if (b > 0) {
      const size = Math.round(G.U.clamp(w / 20, 20, 40));
      const pop = 1 + (1 - G.U.clamp((t - T_LAND - 0.15) / 0.25, 0, 1)) * 0.6;
      ctx.save();
      ctx.globalAlpha = b;
      ctx.translate(w / 2, h * 0.24);
      ctx.scale(pop, pop);
      goldText(ctx, '¡ARCEUS HA DESCENDIDO!', 0, 0, size);
      ctx.restore();
      ctx.globalAlpha = b;
      ctx.font = F(700, Math.round(size * 0.45));
      ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      const sub = 'Es invencible: aguanta y hazle todo el daño que puedas';
      ctx.strokeText(sub, w / 2, h * 0.24 + size * 1.1);
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText(sub, w / 2, h * 0.24 + size * 1.1);
    }
    if (canSkip && t < T_BACK) {
      ctx.globalAlpha = 0.55 + Math.sin(t * 4) * 0.2;
      ctx.font = F(700, 11);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f3e2b0';
      ctx.fillText(G.Touch.active ? 'Toca la pantalla para saltar' : 'Pulsa Espacio para saltar', w - 16, h - 14);
      // Toda la pantalla es un botón (móvil y ratón).
      G.Touch.addButton(0, 0, w, h, skip, 0);
    }
    ctx.restore();
  }

  /** Texto dorado con borde y brillo. */
  function goldText(ctx, s, x, y, size) {
    ctx.font = F(800, size);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size * 0.16);
    ctx.strokeStyle = '#2a1500';
    ctx.strokeText(s, x, y);
    const g = ctx.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.1);
    g.addColorStop(0, '#fff8d8'); g.addColorStop(0.5, '#ffd25e'); g.addColorStop(1, '#c7771a');
    ctx.shadowColor = '#ffcf4a'; ctx.shadowBlur = size * 0.4;
    ctx.fillStyle = g;
    ctx.fillText(s, x, y);
    ctx.shadowBlur = 0;
  }

  /** Título que aparece letra a letra (cada una cae y se asienta). */
  function title(ctx, raw, cx, y, size, t0, alpha) {
    const s = G.I18n ? G.I18n.t(raw) : raw;
    ctx.save();
    ctx.font = F(800, size);
    const total = ctx.measureText(s).width;
    let x = cx - total / 2;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const cw = ctx.measureText(ch).width;
      const p = G.U.clamp((ct - t0 - i * 0.055) / 0.28, 0, 1);
      if (p > 0 && ch !== ' ') {
        const k = 1 + (1 - p) * 1.8;
        ctx.save();
        ctx.globalAlpha = alpha * p;
        ctx.translate(x + cw / 2, y);
        ctx.scale(k, k);
        goldText(ctx, ch, 0, 0, size);
        ctx.restore();
      }
      ctx.font = F(800, size);
      x += cw;
    }
    ctx.restore();
  }

  /** Pelea: cielo rojizo, ceniza, flecha a Arceus y el contador. */
  function drawFight(ctx, w, h) {
    ctx.save();
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(120,40,10,0)');
    g.addColorStop(1, 'rgba(120,40,10,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (const e of embers) {
      ctx.globalAlpha = Math.min(1, e.life) * e.a;
      ctx.fillStyle = e.c;
      ctx.fillRect(Math.round(e.x), Math.round(e.y), e.s, e.s);
    }
    ctx.globalAlpha = 1;
    // Contador bajo el reloj.
    const boss = G.EnemyMgr.all().some(e => e.boss && !e.dead);
    ctx.textAlign = 'center';
    ctx.font = F(800, 12);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
    const txt = 'SENTENCIA · ' + G.U.mmss(arenaT) + ' · JEFES ' + downs;
    ctx.strokeText(txt, w / 2, boss ? 98 : 76);
    ctx.fillStyle = GOLD;
    ctx.fillText(txt, w / 2, boss ? 98 : 76);
    const dtx = G.I18n.f('DAÑO A ARCEUS · {x}', Math.round(dealt).toLocaleString(G.I18n.locale));
    ctx.font = F(800, 11);
    ctx.strokeText(dtx, w / 2, (boss ? 98 : 76) + 15);
    ctx.fillStyle = (cfg && G.U.TYPE_COLOR[cfg.pl]) || GOLD;
    ctx.fillText(dtx, w / 2, (boss ? 98 : 76) + 15);
    // Flecha hacia Arceus si no se ve.
    const cam = G.Camera;
    const sx = (A.x - cam.left()) * cam.scale, sy = (A.y - A.bodyH * 0.5 - cam.top()) * cam.scale;
    if (sx < 0 || sx > w || sy < 0 || sy > h) {
      const M = 46, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
      const an = Math.atan2(sy - ey, sx - ex);
      const pl = G.Game.player;
      const beat = 0.5 + Math.sin(performance.now() / 120) * 0.5;
      ctx.translate(ex, ey);
      ctx.globalAlpha = 0.2 + beat * 0.25;
      ctx.fillStyle = '#ff6a3d';
      ctx.beginPath(); ctx.arc(0, 0, 26 + beat * 6, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = beat > 0.5 ? '#fff3c8' : GOLD;
      ctx.beginPath();
      ctx.moveTo(Math.cos(an) * 34, Math.sin(an) * 34);
      ctx.lineTo(Math.cos(an + 2.45) * 17, Math.sin(an + 2.45) * 17);
      ctx.lineTo(Math.cos(an - 2.45) * 17, Math.sin(an - 2.45) * 17);
      ctx.closePath(); ctx.fill();
      ctx.font = F(800, 11);
      ctx.textAlign = Math.cos(an) > 0.3 ? 'right' : Math.cos(an) < -0.3 ? 'left' : 'center';
      const lbl = 'ARCEUS · ' + Math.round(G.U.dist(pl.x, pl.y, A.x, A.y) / 32) + ' m';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.strokeText(lbl, -Math.cos(an) * 30, -Math.sin(an) * 26 + 4);
      ctx.fillStyle = GOLD;
      ctx.fillText(lbl, -Math.cos(an) * 30, -Math.sin(an) * 26 + 4);
    }
    ctx.restore();
  }

  /** Ceniza y chispas que caen (en pantalla). */
  function ember(dt) {
    const cv = document.getElementById('game');
    const w = cv ? cv.clientWidth : 800, h = cv ? cv.clientHeight : 600;
    if (embers.length < 70 && Math.random() < dt * 40) {
      const spark = Math.random() < 0.3;
      embers.push({ x: Math.random() * w, y: -6, vx: G.U.rand(-25, 10), vy: G.U.rand(20, 55), life: G.U.rand(5, 10),
                    s: spark ? 2 : 3, a: spark ? 0.9 : 0.45, c: spark ? '#ffb347' : '#8a8078' });
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt;
      if (e.life <= 0 || e.y > h + 10) embers.splice(i, 1);
    }
  }

  // ---------------- red ----------------

  function onEvent(ev) {
    if (ev[0] === 'jd') begin(ev[1]);
    else if (ev[0] === 'jk') doSkip();
    else if (ev[0] === 'jb' && phase === 'fight') startBreak();
  }

  /** Anfitrión: dónde está Arceus (va en cada envío). */
  function netState() {
    if (phase !== 'fight' || !A) return null;
    const a = G.Coop.ANIMS.indexOf(A.anim.cur);
    return [Math.round(A.x), Math.round(A.y), a < 0 ? 0 : a, A.anim.dir, Math.round(dealt)];
  }
  function netApply(a) {
    if (!A || phase !== 'fight') return;
    A.net = { x: a[0], y: a[1], anim: a[2], dir: a[3] };
    if (Number.isFinite(a[4]) && a[4] >= 0) dealt = a[4];      // el daño a Arceus lo cuenta el anfitrión
  }

  return {
    AT, reset, noteDmg, hitArceus, dress, dmgK, update, cineTick, skip, bossDown, drawable, drawAir, drawOverlay, onEvent, netState, netApply,
    get active() { return !!phase; }, capSpd,
    /** ¿Hay legendarios vivos? (entonces los ataques no le apuntan a Arceus) */
    get shielded() { return shielded; },
    get cinematic() { return phase === 'cine'; },
    /** Lo que suena: nada en la animación hasta que aterriza. */
    get music() { return phase === 'cine' && ct < T_LAND ? null : 'judgment'; },
    /** Para el resumen de la partida: { time, bosses, dmg, plate } o null. */
    summary() { return phase === 'fight' ? { time: arenaT, bosses: downs, dmg: Math.round(dealt), plate: cfg.pl } : null; },
    /** Para pruebas: vida del primer legendario y daño medido. */
    get debug() { return { base, single: singleDps(), samples: samples.length }; },
    /** Para pruebas: la Sentencia ya. */
    debugStart() { if (!phase && authority()) start(); },
    /** Para vídeos: que no acudan legendarios. */
    debugNoBosses(v = true) { noBosses = !!v; }
  };
})();
