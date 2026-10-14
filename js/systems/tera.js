/* ============ tera.js — Teracristalización ============
 * Como en Escarlata/Púrpura: una vez por partida tu Pokémon se vuelve de
 * cristal, se pone la corona de su Teratipo y se queda así hasta el final.
 *
 *   Antes      En Mejoras se compra el Teraorbe de cada Pokémon (ORB_COST) y se
 *              elige su Teratipo, uno de los 18 (al principio, su primer tipo;
 *              cambiarlo cuesta CHANGE_COST). save.ptera[dex].
 *   Partida    El orbe empieza vacío. Desde FROM sale un cristal Tera en el
 *              mapa (con flecha en el HUD); quédate CHARGE segundos a su lado
 *              y se carga. Entonces T (o tocar el orbe) y se teracristaliza.
 *   Efecto     +BONUS a los movimientos de su Teratipo y recibe el daño como si
 *              fuera de ese tipo. Como en los juegos, no aprende movimientos
 *              nuevos: con Teraorbe puede salirle Teraexplosión (Normal), que al
 *              teracristalizarse pasa a ser de su Teratipo (adapt).
 *   Astral     No se elige: es un cristal más raro (desde STELLAR_FROM, cada
 *              STELLAR_EVERY s una probabilidad STELLAR_CHANCE; dura STELLAR_TTL s).
 *              Cargado, T da una ráfaga Astral de STELLAR_TIME s: +STELLAR_BONUS
 *              de daño a todos los movimientos, más velocidad y recarga, menos
 *              daño recibido, y conserva sus tipos. Luego vuelve a como estaba.
 *              Si tiene las dos cargas, T usa primero la normal (es para siempre).
 *
 * El aspecto se hace aquí para cualquier Pokémon, a partir de sus hojas de
 * siempre: el cuerpo de cristal (facetas planas con su propio color, la misma
 * malla para todos los tipos) y la corona de cada tipo en 5 vistas, que se
 * coloca encima de la cabeza en cada fotograma (assets/tera, data/tera-data.js).
 * Cooperativo: los demás ven la transformación (evento 'tera' de coop.js).
 */
G.Tera = (() => {
  const D = G.TERA_DATA;
  const TYPES = Object.keys(G.U.TYPE_COLOR);
  const STELLAR = 'stellar';
  const ORB_COST = 1000, CHANGE_COST = 300;
  const BONUS = 0.2;
  const FROM = 120, CHARGE = 2, NEAR = 40;
  // Ráfaga Astral: rara y corta, así que fuerte (el poder Furia de los altares es ×2 de daño 25 s).
  const STELLAR_TIME = 15, STELLAR_BONUS = 0.5, STELLAR_SPD = 1.2, STELLAR_CD = 0.8, STELLAR_TAKEN = 0.75;
  const STELLAR_FROM = 300, STELLAR_EVERY = 180, STELLAR_CHANCE = 0.4, STELLAR_TTL = 60;
  const COL = Object.assign({}, G.U.TYPE_COLOR, { stellar: '#ffffff' });
  const NAME = t => t === STELLAR ? 'Astral' : G.U.TYPE_NAME[t];
  const ROW_VIEW = ['front', 'front_3q', 'side', 'back_3q', 'back', 'back_3q', 'side', 'front_3q'];
  const VIEWS = ['front', 'front_3q', 'side', 'back_3q', 'back'];
  const RAINBOW = ['#ff5fa8', '#ffd33d', '#6be38a', '#4fd8ff', '#6b8cff', '#c77dff', '#ff8a3d', '#ffffff'];
  const PX = G.Sprites.PX;

  // ---------------- imágenes ----------------
  const imgs = new Map();
  function img(name) {
    let i = imgs.get(name);
    if (!i) { i = new Image(); i.src = 'assets/tera/' + name + '.png'; imgs.set(name, i); }
    return i;
  }
  const ready = i => i.complete && i.naturalWidth > 0;
  function preload(type) {
    const b = type === STELLAR ? 'normal' : type;
    ['fx/shell', 'fx/emblem', 'fx/orb', 'fx/orb_toss', 'crowns/' + type, 'fx/rays_' + type, 'fx/burst_' + type,
     'fx/crystal_' + type, 'fx/beam_' + b, 'fx/glow_' + b].forEach(img);
    if (type === STELLAR) { img('fx/gems'); img('fx/symbol'); }
  }

  // ---------------- partida guardada ----------------
  /** ¿Se puede elegir de Teratipo? (Los 18; el Astral sólo sale como cristal en partida.) */
  const pickable = t => TYPES.includes(t);
  /** ¿Es un Teratipo que se puede ver (en un mensaje del cooperativo)? */
  const valid = t => t === STELLAR || TYPES.includes(t);
  /** Teratipo elegido para ese Pokémon, o null si no tiene Teraorbe. */
  function typeOf(dex) {
    const s = G.DB.save;
    const t = s && s.ptera && s.ptera[dex];
    return pickable(t) ? t : null;
  }

  // ---------------- reglas ----------------
  const bursting = pl => !!(pl && pl.teraBurst > 0);
  /** Multiplicador de daño de un movimiento de tipo `type` (ataques de tu Pokémon). */
  function dmgMul(pl, type) {
    if (bursting(pl)) return 1 + STELLAR_BONUS;
    const t = pl && pl.tera && pl.tera.type;
    return t && type === t ? 1 + BONUS : 1;
  }
  /** Tipos con los que se defiende (la tabla de tipos al recibir daño). En la ráfaga Astral, los suyos. */
  function defTypes(pl) {
    const t = pl.tera && pl.tera.type;
    return t && !bursting(pl) ? [t] : pl.mon.types;
  }
  /** Tipo de Teraexplosión para este Pokémon: Normal, o su Teratipo si ya se ha teracristalizado. */
  function blastType(pl) { return pl && pl.tera ? pl.tera.type : 'normal'; }
  /** Ajusta una instancia de movimiento al Teratipo (sólo cambia Teraexplosión). */
  function adapt(pl, m) { if (m && m.id === 'tera-blast') m.type = blastType(pl); }
  /** Daño recibido (la ráfaga Astral lo baja). */
  function takenMul(pl) { return bursting(pl) ? STELLAR_TAKEN : 1; }

  // ---------------- la partida: cristales, carga y activación ----------------
  // run: { type, at, crystal, charged, used, stellar, sCharged, sNext, shatters }
  //   crystal / stellar: { kind: 'tera'|'stellar', x, y, t, charge, ttl }
  let run = null;
  const fxs = [];          // transformaciones en curso (tuya y de los compañeros)
  const bursts = new Set();// Pokémon en ráfaga Astral

  function reset(pl) {
    fxs.length = 0;
    bursts.clear();
    const t = pl ? typeOf(pl.dex) : null;
    run = t ? { type: t, at: FROM, crystal: null, charged: false, used: false,
                stellar: null, sCharged: false, sNext: STELLAR_FROM, shatters: [] } : null;
    if (run) { preload(run.type); preload(STELLAR); }
  }

  function update(dt, pl, time) {
    for (let i = fxs.length - 1; i >= 0; i--) if (tickFx(fxs[i], dt)) fxs.splice(i, 1);
    for (const p of [...bursts]) if ((p.teraBurst -= dt) <= 0) endBurst(p);
    if (!run) return;
    for (let i = run.shatters.length - 1; i >= 0; i--) if ((run.shatters[i].t += dt) > 0.5) run.shatters.splice(i, 1);
    if (!pl) return;
    const free = !G.Rift.inArena && !G.Judgment.active;
    // El cristal de tu Teratipo: desde FROM, uno hasta que lo cargas.
    if (!run.charged && !run.used) {
      if (!run.crystal) { if (time >= run.at && free) run.crystal = place(pl, time, 'tera'); }
      else if (charging(run.crystal, dt, pl)) charged();
    }
    // El cristal Astral: más raro, y se va si no lo cargas a tiempo.
    if (run.stellar) {
      if ((run.stellar.ttl -= dt) <= 0) { run.stellar = null; G.Spawner.say('El cristal Astral se ha desvanecido', 2.2, true); }
      else if (charging(run.stellar, dt, pl)) chargedStellar();
    } else if (time >= run.sNext) {
      run.sNext = time + STELLAR_EVERY;
      if (free && !run.sCharged && !bursting(pl) && Math.random() < STELLAR_CHANCE) run.stellar = place(pl, time, 'stellar');
    }
  }

  /** Quedarse al lado de un cristal lo va cargando; si te alejas, se va descargando. */
  function charging(c, dt, pl) {
    c.t += dt;
    const near = !pl.dead && G.U.dist2(pl.x, pl.y, c.x, c.y) < (NEAR + pl.r) ** 2;
    if (near) {
      if (c.charge === 0) G.Audio.sfx('select');
      c.charge = Math.min(1, c.charge + dt / CHARGE);
      const col = c.kind === 'stellar' ? RAINBOW[Math.floor(Math.random() * RAINBOW.length)] : '#74e9ef';
      if (Math.random() < dt * 18) G.FX.px(c.x + G.U.rand(-14, 14), c.y - G.U.rand(10, 70), col, { vy: -40, life: 0.5 });
    } else c.charge = Math.max(0, c.charge - dt * 0.75 / CHARGE);
    return c.charge >= 1;
  }

  /** Los cristales salen a una distancia media de tu Pokémon, en suelo libre. */
  function place(pl, time, kind) {
    const st = kind === 'stellar';
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(380, 540);
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d * 0.85;
      if (!G.World.isFree(x, y, 22)) continue;
      G.FX.ring(x, y, 6, 70, st ? '#ffffff' : '#74e9ef', 0.6, 4);
      G.Audio.sfx(st ? 'legend' : 'rift');
      G.Spawner.say(st ? '¡Ha aparecido un cristal Astral! Es raro y dura poco: cárgalo para una ráfaga Astral'
                       : '¡Ha aparecido un cristal Tera! Quédate a su lado para cargar el Teraorbe', 3.2, true);
      return { kind, x, y, t: 0, charge: 0, ttl: st ? STELLAR_TTL : Infinity };
    }
    if (!st) run.at = time + 2;     // no había sitio: se vuelve a probar enseguida
    return null;
  }

  function charged() {
    const c = run.crystal;
    run.charged = true; run.crystal = null;
    run.shatters.push({ kind: 'tera', x: c.x, y: c.y, t: 0 });
    G.FX.burst(c.x, c.y - 30, COL[run.type], 30, 240);
    G.FX.burst(c.x, c.y - 30, '#ffffff', 16, 180);
    G.FX.ring(c.x, c.y - 20, 8, 90, '#74e9ef', 0.5, 4);
    G.Audio.sfx('shinyGet');
    G.Spawner.say(G.Touch.active ? '¡Teraorbe cargado! Toca el orbe para teracristalizarte' : '¡Teraorbe cargado! Pulsa T para teracristalizarte', 3.4, true);
  }

  function chargedStellar() {
    const c = run.stellar;
    run.sCharged = true; run.stellar = null;
    run.shatters.push({ kind: 'stellar', x: c.x, y: c.y, t: 0 });
    for (let i = 0; i < 6; i++) G.FX.burst(c.x, c.y - 30, RAINBOW[i], 8, 230);
    G.FX.ring(c.x, c.y - 20, 8, 100, '#ffffff', 0.5, 4);
    G.Audio.sfx('shinyGet');
    G.Spawner.say((G.Touch.active ? '¡Carga Astral! Toca el orbe para una ráfaga Astral de ' : '¡Carga Astral! Pulsa T para una ráfaga Astral de ') + STELLAR_TIME + ' s', 3.4, true);
  }

  /**
   * T (o tocar el orbe): primero la Teracristalización normal (es para toda la
   * partida, no se pierde nada); si no, la ráfaga Astral.
   */
  function activate(pl) {
    if (!run || !pl || pl.dead) return false;
    if (run.charged && !run.used) {
      run.used = true;
      start(pl, run.type, true);
      G.Coop.tera(run.type);
      return true;
    }
    if (run.sCharged && !bursting(pl)) {
      run.sCharged = false;
      burst(pl, true);
      G.Coop.tera(STELLAR);
      return true;
    }
    return false;
  }

  // ---------------- la transformación (como en el juego, a escala de sprite) ----------------
  // Tiempos: el orbe aparece y absorbe energía, destella el emblema, el cristal
  // crece y estalla (T_SHELL + SH.ms) y queda el Pokémon de cristal con su corona.
  const SH = D.shell, T_SHELL = 0.35;
  const at = n => T_SHELL + SH.ms.slice(0, n).reduce((a, b) => a + b, 0) / 1000;
  const BODY = at(7), SHELL_END = at(SH.ms.length);
  // El Astral, después del estallido: las 18 gemas en un círculo de pie que se tumba
  // hasta ser el anillo, un destello rosa y los rayos de colores.
  const CIRCLE = BODY + 0.25, TIP = CIRCLE + 0.9, RING = TIP + 0.5, FLASH = RING + 0.05, RAYS_ST = FLASH + 0.15;
  const length = type => (type === STELLAR ? RAYS_ST : at(4)) + 1.4;

  /** Empieza la transformación de un Pokémon (el tuyo o el de un compañero). */
  function start(pl, type, local) {
    preload(type);
    pl.tera = { type };
    for (const m of pl.moves) adapt(pl, m);   // Teraexplosión pasa a ser de su Teratipo
    if (bursting(pl)) return;            // en plena ráfaga Astral: se verá al acabar
    show(pl, type, local);
  }
  function show(pl, type, local) {
    const fx = { pl, type, t: 0, burst: false, sparkT: 0 };
    pl.anim.tera = type;
    pl.anim.teraFx = fx;
    fxs.push(fx);
    if (local) pl.invuln = Math.max(pl.invuln, length(type) - 0.6);
    G.Audio.sfx('legend');
  }

  /** Ráfaga Astral (STELLAR_TIME s). `local`: tu Pokémon (los compañeros sólo se ven). */
  function burst(pl, local) {
    preload(STELLAR);
    pl.teraBurst = STELLAR_TIME;
    bursts.add(pl);
    show(pl, STELLAR, local);
    if (local) {
      pl.spdMul *= STELLAR_SPD; pl.cdMul *= STELLAR_CD; pl.teraStats = true;
      G.Spawner.say('¡Ráfaga Astral! +' + Math.round(STELLAR_BONUS * 100) + ' % de daño a todo durante ' + STELLAR_TIME + ' s', 2.6, true);
    }
  }
  function endBurst(pl) {
    bursts.delete(pl);
    pl.teraBurst = 0;
    if (pl.teraStats) { pl.spdMul /= STELLAR_SPD; pl.cdMul /= STELLAR_CD; pl.teraStats = false; }
    const y = pl.y - pl.bodyH * 0.6;
    for (let i = 0; i < 6; i++) G.FX.burst(pl.x, y, RAINBOW[i], 5, 160);
    G.FX.ring(pl.x, y, 6, 60, '#ffffff', 0.4, 3);
    G.Audio.sfx('break');
    // Vuelve a como estaba: con la corona de su Teratipo si ya se había teracristalizado.
    const base = pl.tera && pl.tera.type;
    pl.anim.tera = base || null;
    pl.anim.teraFx = base ? { t: 99 } : null;
    if (pl === G.Game.player) G.Spawner.say('La ráfaga Astral ha terminado', 1.8, true);
  }
  /** Lo que llega de un compañero (coop.js): su Teratipo o su ráfaga Astral. */
  function remote(pl, type) {
    if (type === STELLAR) { if (!bursting(pl)) burst(pl, false); }
    else start(pl, type, false);
  }

  function tickFx(fx, dt) {
    fx.t += dt;
    const pl = fx.pl, p = fx.t, k = scaleOf(pl);
    if (!fx.burst && p >= BODY) {
      fx.burst = true;
      const y = pl.y - pl.bodyH * 0.5;
      G.Audio.sfx('break');
      if (fx.type === STELLAR) {
        for (let i = 0; i < 18; i++) {
          const a = Math.random() * 6.2832, v = G.U.rand(60, 170);
          G.FX.px(pl.x, y, RAINBOW[i % 7], { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: G.U.rand(0.4, 0.8), size: 2, grav: 180 });
        }
        for (let i = 0; i < 6; i++) G.FX.ring(pl.x, y, 6 * k, 70 * k, RAINBOW[i], 0.45 + i * 0.03, 2);
      } else {
        G.FX.burst(pl.x, y, COL[fx.type], 22, 200);
        G.FX.burst(pl.x, y, '#ffffff', 12, 160);
      }
    }
    // Centelleos alrededor del cuerpo al terminar (de todos los colores en el Astral).
    if (p > SHELL_END && p < length(fx.type) + 0.6 && (fx.sparkT -= dt) <= 0) {
      fx.sparkT = 0.09;
      const x = pl.x + G.U.rand(-1, 1) * pl.r * 1.6, y = pl.y - G.U.rand(0.1, 1.2) * pl.bodyH;
      if (fx.type === STELLAR) G.FX.px(x, y, RAINBOW[Math.floor(Math.random() * RAINBOW.length)], { vy: -20, life: 0.6, size: 2 });
      else G.FX.twinkle(x, y);
    }
    return p > length(fx.type) + 0.8;
  }

  /** ¿Está en plena transformación? (No parpadea aunque sea invulnerable.) */
  function busy(pl) { return fxs.some(f => f.pl === pl && f.t < length(f.type)); }

  /** Tamaño de los efectos según el Pokémon (Pikachu = 1; los grandes, 2 o 3). */
  function scaleOf(pl) { return G.U.clamp(Math.round(pl.bodyH / PX / 30), 1, 3) * PX; }

  function sheetFrame(ms, t) {
    let k = t * 1000;
    if (k < 0) return -1;
    for (let i = 0; i < ms.length; i++) { if (k < ms[i]) return i; k -= ms[i]; }
    return -1;
  }
  function blit(ctx, im, fr, i, ax, ay, x, y, k) {
    if (!ready(im)) return;
    ctx.drawImage(im, i * fr[0], 0, fr[0], fr[1], Math.round(x - ax * k), Math.round(y - ay * k), fr[0] * k, fr[1] * k);
  }

  /** En el suelo, detrás de todo: rayos de luz del tipo y la onda a los pies. */
  function drawGround(ctx) {
    for (const fx of fxs) {
      const pl = fx.pl, k = scaleOf(pl), p = fx.t;
      const r0 = fx.type === STELLAR ? RAYS_ST : at(4), b0 = fx.type === STELLAR ? RAYS_ST + 0.12 : BODY;
      const ri = sheetFrame(D.rays.ms, p - r0);
      if (ri >= 0) blit(ctx, img('fx/rays_' + fx.type), D.rays.frame, ri, D.rays.anchor[0], D.rays.anchor[1], pl.x, pl.y, k);
      const bi = sheetFrame(D.burst.ms, p - b0);
      if (bi >= 0) blit(ctx, img('fx/burst_' + fx.type), D.burst.frame, bi, D.burst.anchor[0], D.burst.anchor[1], pl.x, pl.y, k);
    }
  }

  /** Por encima de todo: orbe, emblema, el cristal que crece y estalla, y el círculo de gemas del Astral. */
  function drawAir(ctx) {
    const now = performance.now();
    for (const fx of fxs) {
      const pl = fx.pl, k = scaleOf(pl), p = fx.t;
      const headY = pl.y - pl.bodyH - 8 * k;
      if (p < 0.3) {                                       // el orbe sobre la cabeza, absorbiendo energía
        blit(ctx, img('fx/orb_toss'), D.toss.frame, Math.floor(now / 80) % 2, 4, 4, pl.x, headY, k);
        for (let i = 0; i < 6; i++) {
          const q = 1 - p / 0.3, a = i * 1.047 + p * 9, r = (6 + 18 * q) * k;
          ctx.fillStyle = '#74e9ef'; ctx.fillRect(Math.round(pl.x + Math.cos(a) * r), Math.round(headY + Math.sin(a) * r), k, k);
        }
      }
      if (p >= 0.2 && p < 0.5) {                           // emblema y aro de energía
        const ef = p < 0.24 ? 0 : p < 0.29 ? 1 : 2;
        ctx.save(); ctx.globalAlpha = p < 0.4 ? 1 : Math.max(0, 1 - (p - 0.4) / 0.1);
        blit(ctx, img('fx/emblem'), D.emblem.frame, ef, D.emblem.anchor[0], D.emblem.anchor[1], pl.x, headY, k);
        ctx.restore();
        const q = Math.min(1, (p - 0.2) / 0.18);
        ctx.save(); ctx.globalAlpha = 1 - q; ctx.strokeStyle = q < 0.5 ? '#74e9ef' : '#15e1b6'; ctx.lineWidth = k;
        ctx.beginPath(); ctx.arc(pl.x, headY, (2 + 20 * q) * k, 0, 6.2832); ctx.stroke(); ctx.restore();
      }
      const si = sheetFrame(SH.ms, p - T_SHELL);           // el cristal crece, se pone blanco y estalla
      if (si >= 0) blit(ctx, img('fx/shell'), SH.frame, si, SH.anchor[0], SH.anchor[1], pl.x, pl.y, k);
      if (fx.type === STELLAR) {
        if (p >= BODY + 0.05 && p < RING) gemCircle(ctx, fx, k);
        if (p >= FLASH && p < FLASH + 0.18) {
          ctx.save(); ctx.globalAlpha = 0.35 * (1 - (p - FLASH) / 0.18); ctx.fillStyle = '#ff6ed2';
          ctx.beginPath(); ctx.arc(pl.x, pl.y - pl.bodyH * 0.6, 90 * k / PX, 0, 6.2832); ctx.fill(); ctx.restore();
        }
      }
    }
  }

  /** Astral: las gemas forman un círculo de pie alrededor de la cabeza y se tumban hasta el anillo. */
  function gemCircle(ctx, fx, k) {
    const pl = fx.pl, a = pl.anim, c = crownPoint(a);
    if (!c) return;
    const p = fx.t, O = D.orbit, R = 21;
    const inK = Math.min(1, (p - BODY - 0.05) / 0.25);
    const tipK = p >= TIP ? ease((p - TIP) / (RING - TIP)) : 0;
    const t = performance.now() / 1000 + (RING - p);
    const list = O.order.map((ty, i) => {
      const ph = (-90 + 20 * i) * Math.PI / 180;
      const ux = c.ax + R * Math.cos(ph) * inK, uy = c.ay + O.from_anchor[1] + 6 + R * Math.sin(ph) * inK;
      const th = (O.start_deg + 20 * i + O.deg_per_s * t) * Math.PI / 180;
      const vx = c.ax + O.from_anchor[0] + O.radii[0] * Math.cos(th), vy = c.ay + O.from_anchor[1] + O.radii[1] * Math.sin(th);
      return { ty, sn: Math.sin(th), x: Math.round(ux + (vx - ux) * tipK), y: Math.round(uy + (vy - uy) * tipK) };
    });
    list.sort((u, v) => u.sn - v.sn).forEach(g => gem(ctx, g.ty, tipK < 0.5 || g.sn > O.near_from, g.x, g.y, c.ox, c.oy, c.k));
  }
  const ease = q => q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;

  // ---------------- el sprite de cristal de cualquier Pokémon ----------------
  // Para cada hoja (imagen) se hace una vez: el cuerpo de cristal, las "orejas"
  // (lo que queda por encima de la corona y se dibuja delante de ella) y el
  // punto de la cabeza de cada fotograma.
  const built = new WeakMap();

  function hls(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, l, 0];
    const d = mx - mn, s = l <= 0.5 ? d / (mx + mn) : d / (2 - mx - mn);
    const rc = (mx - r) / d, gc = (mx - g) / d, bc = (mx - b) / d;
    let h = r === mx ? bc - gc : g === mx ? 2 + rc - bc : 4 + gc - rc;
    h = ((h / 6) % 1 + 1) % 1;
    return [h, l, s];
  }
  function rgb(h, l, s) {
    if (s === 0) return [l, l, l];
    const m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s, m1 = 2 * l - m2;
    const v = hh => {
      hh = ((hh % 1) + 1) % 1;
      if (hh < 1 / 6) return m1 + (m2 - m1) * hh * 6;
      if (hh < 0.5) return m2;
      if (hh < 2 / 3) return m1 + (m2 - m1) * (2 / 3 - hh) * 6;
      return m1;
    };
    return [v(h + 1 / 3), v(h), v(h - 1 / 3)];
  }
  /** Tres tonos de un color: el mismo matiz y saturación, más luz (facetas planas). */
  const shadeCache = new Map();
  function shades(c) {
    let s = shadeCache.get(c);
    if (s) return s;
    const [h, l, sa] = hls((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255);
    s = [0, 0.25, 0.57].map(a => rgb(h, l + (1 - l) * a, sa).map(v => Math.floor(v * 255 + 0.5)));
    shadeCache.set(c, s);
    return s;
  }

  // Malla fija de triángulos irregulares alrededor de la cabeza (la de la propuesta),
  // ampliada por fuera para los Pokémon grandes. Sin azar: no "baila" entre fotogramas.
  const XS0 = [-36, -27, -19, -12, -6, 0, 6, 12, 19, 27, 36], YS0 = [-24, -16, -10, -4, 2, 7, 12, 18, 25, 34, 44];
  const XL = [-85, -70, -57, -46], XR = [46, 57, 70, 85], YT = [-60, -46, -34], YB = [55, 68, 83, 100, 120];
  const XS = XL.concat(XS0, XR), YS = YT.concat(YS0, YB), I0 = XL.length, J0 = YT.length;
  const OFFS = [0, 2, -1, 1, -2, 1, -1, 2, 0, -2, 0], LEVELS = [[0, 2], [1, 0], [2, 1], [0, 1], [1, 2], [2, 0]];
  const mod = (a, n) => ((a % n) + n) % n;

  /** Nivel de faceta (0..2) de cada píxel de un fotograma, con la malla centrada en la cabeza. */
  function facets(w, h, ax, ay, mirror) {
    const lv = new Uint8Array(w * h);
    const pt = (i, j) => { const x = XS[i] + OFFS[mod(j - J0, OFFS.length)]; return [ax + (mirror ? -x : x), ay + YS[j]]; };
    for (let j = 0; j < YS.length - 1; j++) {
      for (let i = 0; i < XS.length - 1; i++) {
        const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
        const ii = i - I0, jj = j - J0;
        const sh = LEVELS[mod(ii + 2 * jj, LEVELS.length)];
        const tris = mod(ii + jj, 2) ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
        tris.forEach((tri, n) => fill(lv, w, h, tri, sh[n]));
      }
    }
    return lv;
  }
  function fill(lv, w, h, [p, q, r], v) {
    const x0 = Math.max(0, Math.floor(Math.min(p[0], q[0], r[0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(p[0], q[0], r[0])));
    const y0 = Math.max(0, Math.floor(Math.min(p[1], q[1], r[1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(p[1], q[1], r[1])));
    const e = (a, b, x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    const area = e(p, q, r[0], r[1]);
    if (!area) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const w0 = e(q, r, x, y), w1 = e(r, p, x, y), w2 = e(p, q, x, y);
      if (area > 0 ? w0 >= 0 && w1 >= 0 && w2 >= 0 : w0 <= 0 && w1 <= 0 && w2 <= 0) lv[y * w + x] = v;
    }
  }

  /**
   * Punto de la cabeza donde se apoya la corona: se buscan las zonas anchas del
   * sprite (sin orejas, cuernos ni colas finas), se coge el centro de la parte
   * más alta y se sube por esa columna hasta el borde de la cabeza, sin seguir
   * por crestas o cuernos finos (de menos de 4 píxeles de ancho: Gyarados).
   */
  function headPoint(mask, w, h) {
    const sat = new Int32Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      sat[(y + 1) * (w + 1) + x + 1] = mask[y * w + x] + sat[y * (w + 1) + x + 1] + sat[(y + 1) * (w + 1) + x] - sat[y * (w + 1) + x];
    const box = (x0, y0, x1, y1) => sat[(y1 + 1) * (w + 1) + x1 + 1] - sat[y0 * (w + 1) + x1 + 1] - sat[(y1 + 1) * (w + 1) + x0] + sat[y0 * (w + 1) + x0];
    for (const [rx, ry] of [[3, 2], [2, 1], [1, 1]]) {
      const core = [];
      for (let y = ry; y < h - ry; y++) for (let x = rx; x < w - rx; x++)
        if (mask[y * w + x] && box(x - rx, y - ry, x + rx, y + ry) === (2 * rx + 1) * (2 * ry + 1)) core.push(x, y);
      if (!core.length) continue;
      let top = h;
      for (let i = 1; i < core.length; i += 2) top = Math.min(top, core[i]);
      const xs = [];
      for (let i = 0; i < core.length; i += 2) if (core[i + 1] <= top + 5) xs.push(core[i]);
      xs.sort((a, b) => a - b);
      const x = xs[xs.length >> 1];
      let y = h;
      for (let i = 0; i < core.length; i += 2) if (core[i] === x) y = Math.min(y, core[i + 1]);
      const wide = yy => {
        let a = x, b = x;
        while (a > 0 && mask[yy * w + a - 1]) a--;
        while (b < w - 1 && mask[yy * w + b + 1]) b++;
        return mask[yy * w + x] && b - a + 1 >= 4;
      };
      while (y > 0 && wide(y - 1)) y--;
      return [x, y + 1];
    }
    return null;
  }

  function build(im, m) {
    let b = built.get(im);
    if (b) return b;
    const W = im.width, H = im.height, rows = Math.min(m.r, Math.floor(H / m.h)), cols = Math.min(m.n, Math.floor(W / m.w));
    const src = document.createElement('canvas'); src.width = W; src.height = H;
    const sx = src.getContext('2d', { willReadFrequently: true });
    sx.drawImage(im, 0, 0);
    const data = sx.getImageData(0, 0, W, H), d = data.data;
    const body = new ImageData(new Uint8ClampedArray(d), W, H);
    const ears = new ImageData(W, H), bd = body.data, ed = ears.data;
    const heads = [];
    const w = m.w, h = m.h;
    const mask = new Uint8Array(w * h);
    for (let r = 0; r < rows; r++) {
      heads.push([]);
      for (let f = 0; f < cols; f++) {
        const ox = f * w, oy = r * h;
        const at_ = (x, y) => ((oy + y) * W + ox + x) * 4;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[y * w + x] = d[at_(x, y) + 3] > 0 ? 1 : 0;
        const hp = headPoint(mask, w, h);
        heads[r].push(hp);
        if (!hp) continue;
        const [ax, ay] = hp, mirror = r >= 5;
        const lv = facets(w, h, ax, ay, mirror);
        // Color principal (el más repetido), para los brillos.
        const count = new Map();
        let main = -1, best = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (!mask[y * w + x]) continue;
          const i = at_(x, y), c = d[i] << 16 | d[i + 1] << 8 | d[i + 2];
          const n = (count.get(c) || 0) + 1; count.set(c, n);
          if (n > best && c !== 0 && c !== 0xffffff) { best = n; main = c; }
        }
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (!mask[y * w + x]) continue;
          const edge = !x || !y || x === w - 1 || y === h - 1 || !mask[y * w + x - 1] || !mask[y * w + x + 1] || !mask[(y - 1) * w + x] || !mask[(y + 1) * w + x];
          const i = at_(x, y), c = d[i] << 16 | d[i + 1] << 8 | d[i + 2];
          if (!edge && c !== 0 && c !== 0xffffff) {      // ojos, boca y perfil se quedan como están
            const s = shades(c)[lv[y * w + x]];
            bd[i] = s[0]; bd[i + 1] = s[1]; bd[i + 2] = s[2];
          }
        }
        for (const [gx, gy] of [[-3, 2], [3, 8], [-2, 14], [-9, 9], [10, 12]]) {   // unos brillos de cristal
          const x = ax + (mirror ? -gx : gx), y = ay + gy;
          if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1 || !mask[y * w + x]) continue;
          if (!mask[y * w + x - 1] || !mask[y * w + x + 1] || !mask[(y - 1) * w + x] || !mask[(y + 1) * w + x]) continue;
          const i = at_(x, y);
          if ((d[i] << 16 | d[i + 1] << 8 | d[i + 2]) === main) { bd[i] = 255; bd[i + 1] = 255; bd[i + 2] = 245; }
        }
        // Lo que asoma por encima de la corona (orejas, cuernos) va delante de ella.
        for (let y = 0; y < Math.max(0, ay - 4); y++) for (let x = 0; x < w; x++) {
          if (!mask[y * w + x]) continue;
          const i = at_(x, y);
          ed[i] = bd[i]; ed[i + 1] = bd[i + 1]; ed[i + 2] = bd[i + 2]; ed[i + 3] = bd[i + 3];
        }
      }
    }
    const canvas = n => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(n, 0, 0); return c; };
    b = { body: canvas(body), ears: canvas(ears), heads };
    built.set(im, b);
    return b;
  }

  // Coronas espejadas (filas 5-7 miran a la izquierda): se hacen una vez por tipo.
  const flipped = new Map();
  function crownImg(type, mirror) {
    const im = img('crowns/' + type);
    if (!ready(im)) return null;
    if (!mirror) return im;
    let c = flipped.get(type);
    if (!c) {
      c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.translate(im.width, 0); x.scale(-1, 1); x.drawImage(im, 0, 0);
      flipped.set(type, c);
    }
    return c;
  }

  /** Punto de la corona del último dibujo de ese animador (para el círculo de gemas). */
  function crownPoint(a) { return a._teraPt || null; }

  // Gemas del Astral: cerca (grandes) o lejos (pequeñas).
  const gemIdx = {};
  D.gems.order.forEach((t, i) => { gemIdx[t] = i; });
  const gemCell = Math.max(D.gems.near[0], D.gems.far[0]);
  function gem(ctx, t, near, px, py, ox, oy, k) {
    const im = img('fx/gems');
    if (!ready(im)) return;
    const [w, h] = near ? D.gems.near : D.gems.far, sy = near ? 0 : D.gems.near[1];
    ctx.drawImage(im, gemIdx[t] * gemCell, sy, w, h, Math.round(ox + (px - Math.floor(w / 2)) * k), Math.round(oy + (py - Math.floor(h / 2)) * k), w * k, h * k);
  }
  /** El anillo de 18 gemas (la regla de la propuesta): pass 'back' detrás del Pokémon, 'front' delante. */
  function ring(ctx, t, ax, ay, pass, ox, oy, k) {
    const O = D.orbit, [ra, rb] = O.radii, list = [];
    for (let i = 0; i < 18; i++) {
      const th = (O.start_deg + 20 * i + O.deg_per_s * t) * Math.PI / 180, sn = Math.sin(th);
      if ((pass === 'back') !== (sn < 0)) continue;
      list.push({ t: O.order[i], sn, x: Math.round(ax + O.from_anchor[0] + ra * Math.cos(th)), y: Math.round(ay + O.from_anchor[1] + rb * sn) });
    }
    list.sort((p, q) => p.sn - q.sn).forEach(g => gem(ctx, g.t, g.sn > O.near_from, g.x, g.y, ox, oy, k));
  }
  function symbol(ctx, now, ax, ay, ox, oy, k) {
    const S = D.symbol, im = img('fx/symbol');
    if (!ready(im)) return;
    const tot = S.ms.reduce((a, b) => a + b, 0);
    let q = now % tot, f = 0;
    while (f < S.ms.length - 1 && q >= S.ms[f]) { q -= S.ms[f]; f++; }
    const x = ax + S.from_anchor[0] - S.anchor[0], y = ay + S.from_anchor[1] + S.bob[f] - S.anchor[1];
    ctx.drawImage(im, f * S.frame[0], 0, S.frame[0], S.frame[1], Math.round(ox + x * k), Math.round(oy + y * k), S.frame[0] * k, S.frame[1] * k);
  }

  const tmp = document.createElement('canvas'), tc = tmp.getContext('2d');

  /**
   * Dibuja un fotograma de un Pokémon teracristalizado (lo llama Animator.draw).
   * Antes de que estalle el cristal se ve el sprite de siempre (blanco al
   * empezar). Devuelve false si aún no se puede (y se dibuja el normal).
   */
  function drawSprite(ctx, a, s, m, frame, row, dx, dy, k, opts) {
    const fx = a.teraFx, type = a.tera;
    const p = fx ? fx.t : 99;
    if (p < BODY) {
      if (p > 0.22 && p < 0.42) {
        ctx.drawImage(s.img, frame * m.w, row * m.h, m.w, m.h, dx, dy, m.w * k, m.h * k);
        ctx.save(); ctx.globalAlpha = Math.min(1, (p - 0.22) / 0.1);
        ctx.drawImage(G.Sprites.white(s.img), frame * m.w, row * m.h, m.w, m.h, dx, dy, m.w * k, m.h * k);
        ctx.restore();
        return true;
      }
      return false;
    }
    const b = build(s.img, m), hp = b.heads[row] && b.heads[row][frame];
    const crown = crownImg(type, row >= 5);
    if (!hp || !crown) return false;
    const [ax, ay] = hp, now = performance.now();
    a._teraPt = { ax, ay, ox: dx, oy: dy, k };
    const ringOn = type === STELLAR && p >= RING;
    if (ringOn) ring(ctx, now / 1000, ax, ay, 'back', dx, dy, k);
    // Cuerpo + corona + orejas, en un lienzo pequeño con margen (la corona puede
    // salirse del fotograma) para poder pasarles el barrido de luz por encima.
    const top = 30, side = 16;
    tmp.width = m.w + 2 * side; tmp.height = m.h + top;
    tc.clearRect(0, 0, tmp.width, tmp.height);
    tc.drawImage(b.body, frame * m.w, row * m.h, m.w, m.h, side, top, m.w, m.h);
    const v = m.r > 1 ? ROW_VIEW[row] : 'front', [cw, ch] = D.crowns.cell;
    const vi = VIEWS.indexOf(v), mirror = row >= 5, an = D.crowns.types[type][v];
    const jx = mirror ? cw - 1 - an[0] : an[0], jy = an[1];
    tc.drawImage(crown, (mirror ? 4 - vi : vi) * cw, 0, cw, ch, side + ax - jx, top + ay - jy, cw, ch);
    tc.drawImage(b.ears, frame * m.w, row * m.h, m.w, m.h, side, top, m.w, m.h);
    tc.globalCompositeOperation = 'source-atop';
    const white = p < BODY + 0.06 ? 0.6 : p < BODY + 0.12 ? 0.25 : 0;
    if (white) { tc.fillStyle = `rgba(255,255,255,${white})`; tc.fillRect(0, 0, tmp.width, tmp.height); }
    if (p > SHELL_END + 0.1) {                         // el brillo de cristal que cruza el cuerpo
      const per = 2.4, q = ((now / 1000) % per) / per, pos = -14 + q * (tmp.width + tmp.height + 28), H2 = tmp.height;
      tc.fillStyle = 'rgba(255,255,255,.45)';
      tc.beginPath(); tc.moveTo(pos, 0); tc.lineTo(pos + 3, 0); tc.lineTo(pos + 3 - H2, H2); tc.lineTo(pos - H2, H2); tc.closePath(); tc.fill();
    }
    if (opts.flash) { tc.fillStyle = 'rgba(255,255,255,.55)'; tc.fillRect(0, 0, tmp.width, tmp.height); }
    tc.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, dx - side * k, dy - top * k, tmp.width * k, tmp.height * k);
    if (ringOn) { ring(ctx, now / 1000, ax, ay, 'front', dx, dy, k); symbol(ctx, now, ax, ay, dx, dy, k); }
    return true;
  }

  // ---------------- los cristales del mapa ----------------
  /** Lo que se dibuja ordenado por Y con lo demás: los cristales y los que se acaban de romper. */
  function drawables() {
    if (!run) return [];
    const out = [];
    for (const c of [run.crystal, run.stellar]) if (c) out.push({ y: c.y, draw: ctx => drawCrystal(ctx, c, false) });
    for (const c of run.shatters) out.push({ y: c.y, draw: ctx => drawCrystal(ctx, c, true) });
    return out;
  }
  function drawCrystal(ctx, c, broken) {
    const now = performance.now(), k = PX, st = c.kind === 'stellar';
    const ct = st ? STELLAR : run.type, bt = st ? 'normal' : run.type;
    const crystal = img('fx/crystal_' + ct);
    if (broken) {                                         // al cargarse: un destello y se va
      ctx.save(); ctx.globalAlpha = 1 - c.t / 0.5;
      blit(ctx, crystal, D.crystal.frame, 0, D.crystal.anchor[0], D.crystal.anchor[1], c.x, c.y, k);
      ctx.globalCompositeOperation = 'lighter';
      blit(ctx, crystal, D.crystal.frame, 0, D.crystal.anchor[0], D.crystal.anchor[1], c.x, c.y, k);
      ctx.restore();
      return;
    }
    ctx.save();
    if (st && c.ttl < 10 && Math.floor(now / 150) % 2) ctx.globalAlpha = 0.45;   // el Astral avisa antes de irse
    const gi = Math.floor(now / D.glow.ms[0]) % D.glow.ms.length;
    blit(ctx, img('fx/glow_' + bt), D.glow.frame, gi, D.glow.anchor[0], D.glow.anchor[1], c.x, c.y, k);
    const bi = Math.floor(now / D.beam.ms[0]) % D.beam.ms.length, beam = img('fx/beam_' + bt);
    if (ready(beam)) {                                   // haz de luz hacia arriba (se ve desde lejos)
      const bh = D.beam.frame[1] * k;
      for (let y = c.y - 44 * k - bh, n = 0; n < 12; y -= bh, n++)
        ctx.drawImage(beam, bi * D.beam.frame[0], 0, D.beam.frame[0], D.beam.frame[1], Math.round(c.x - D.beam.frame[0] / 2 * k), Math.round(y), D.beam.frame[0] * k, bh);
    }
    const ci = Math.floor(now / D.crystal.ms[0]) % D.crystal.ms.length;
    blit(ctx, crystal, D.crystal.frame, ci, D.crystal.anchor[0], D.crystal.anchor[1], c.x, c.y, k);
    ctx.restore();
    if (c.charge > 0) {                                  // aro de carga (de colores en el Astral)
      const cy = c.y - 18 * k, r = 26 * k, end = -1.5708 + c.charge * 6.2832;
      ctx.save(); ctx.lineWidth = 2 * k;
      ctx.strokeStyle = 'rgba(7,16,42,.7)'; ctx.beginPath(); ctx.arc(c.x, cy, r, 0, 6.2832); ctx.stroke();
      if (!st) { ctx.strokeStyle = '#74e9ef'; ctx.beginPath(); ctx.arc(c.x, cy, r, -1.5708, end); ctx.stroke(); }
      else for (let a = -1.5708, i = 0; a < end; a += 0.5236, i++) {
        ctx.strokeStyle = RAINBOW[i % 7]; ctx.beginPath(); ctx.arc(c.x, cy, r, a, Math.min(end, a + 0.5236)); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ---------------- HUD ----------------
  /** Estado del orbe para el HUD: null si este Pokémon no tiene Teraorbe. */
  function orbState(pl) {
    if (!run) return null;
    return { type: run.type, charge: run.crystal ? run.crystal.charge : 0, charged: run.charged, used: run.used, crystal: run.crystal,
             stellar: run.stellar, sCharged: run.sCharged, burst: pl && pl.teraBurst > 0 ? pl.teraBurst : 0, burstTime: STELLAR_TIME };
  }
  /** Fotograma del orbe: vacío, 1/3, 2/3 o cargado (brillando). */
  function orbFrame(now) {
    if (!run || (run.used && !run.sCharged)) return 0;
    if ((run.charged && !run.used) || run.sCharged) return D.orb.loop[Math.floor(now / D.orb.ms) % D.orb.loop.length];
    const q = run.crystal ? run.crystal.charge : 0;
    return q >= 2 / 3 ? D.orb.held[2] : q >= 1 / 3 ? D.orb.held[1] : D.orb.held[0];
  }
  function drawOrb(ctx, x, y, size, now) {
    const im = img('fx/orb');
    if (!ready(im)) return;
    const f = orbFrame(now);
    ctx.save();
    if (run && run.used && !run.sCharged) ctx.globalAlpha = 0.4;
    ctx.drawImage(im, f * D.orb.frame[0], 0, D.orb.frame[0], D.orb.frame[1], Math.round(x), Math.round(y), size, size);
    ctx.restore();
    // Carga Astral esperando: el símbolo Tera en la esquina.
    const sy = img('fx/symbol');
    if (run && run.sCharged && ready(sy)) {
      const S = D.symbol, k = Math.max(1, Math.floor(size / 22));
      ctx.drawImage(sy, 0, 0, S.frame[0], S.frame[1], Math.round(x + size - S.frame[0] * k * 0.6), Math.round(y - S.frame[1] * k * 0.3), S.frame[0] * k, S.frame[1] * k);
    }
  }

  return {
    TYPES, STELLAR, ORB_COST, CHANGE_COST, BONUS, STELLAR_BONUS, STELLAR_TIME, FROM, CHARGE, COL, NAME, RAINBOW,
    typeOf, pickable, valid, dmgMul, defTypes, takenMul, blastType, adapt,
    reset, update, activate, start, remote, busy, drawGround, drawAir, drawables, drawSprite, orbState, drawOrb, img, ready,
    /** Para pruebas y vídeos (sólo en dev.html): sale el cristal ya, o se carga ya; lo mismo con el Astral. */
    debugCrystal(pl) { if (run && !run.crystal && !run.charged) { run.at = 0; run.crystal = place(pl || G.Game.player, 0, 'tera'); } },
    debugCharge() { if (run && !run.charged && !run.used) { if (!run.crystal) run.crystal = { kind: 'tera', x: 0, y: 0, t: 0, charge: 1 }; charged(); } },
    debugStellar(pl) { if (run && !run.stellar) run.stellar = place(pl || G.Game.player, 0, 'stellar'); },
    debugStellarCharge() { if (run) { if (!run.stellar) run.stellar = { kind: 'stellar', x: 0, y: 0, t: 0, charge: 1, ttl: 1 }; chargedStellar(); } }
  };
})();
