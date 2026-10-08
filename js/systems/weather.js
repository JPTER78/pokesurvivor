/* ============ weather.js — climas (evento raro) ============
 * De vez en cuando (desde el minuto 2, ~1 de cada 6 minutos) llega un clima
 * que dura alrededor de un minuto. Cambia el daño según el tipo del ataque,
 * para ti y para los enemigos:
 *
 *   sol      Fuego ×1,5 · Agua ×0,5
 *   lluvia   Agua ×1,5 · Eléctrico ×1,2 · Fuego ×0,5
 *   arena    Roca, Tierra y Acero ×1,3; los demás pierden un poco de vida
 *   nieve    Hielo ×1,5; los demás pierden un poco de vida y van algo más lentos
 *   niebla   Fantasma, Hada y Psíquico ×1,3
 *
 * Cada bioma tiene sus climas más probables (el volcán, sol y arena...).
 * Lo visual es suave a propósito: un tinte leve y pocas partículas.
 *
 * Cooperativo: lo decide el anfitrión y lo manda con 'wx'.
 */
G.Weather = (() => {
  const KINDS = {
    sun:  { name: 'Sol abrasador', icon: 'wsun', color: '#ffcb3d', tint: [255, 190, 90, 0.07],
            mult: { fire: 1.5, water: 0.5 }, hint: 'el Fuego se potencia y el Agua se debilita' },
    rain: { name: 'Lluvia', icon: 'wrain', color: '#7fb8ff', tint: [50, 90, 170, 0.09],
            mult: { water: 1.5, electric: 1.2, fire: 0.5 }, hint: 'el Agua se potencia y el Fuego se debilita' },
    sand: { name: 'Tormenta de arena', icon: 'wsand', color: '#e0bf73', tint: [200, 160, 90, 0.09],
            mult: { rock: 1.3, ground: 1.3, steel: 1.3 }, safe: ['rock', 'ground', 'steel'],
            hint: 'Roca, Tierra y Acero se potencian; el resto sufre' },
    snow: { name: 'Nevada', icon: 'wsnow', color: '#d8f1ff', tint: [210, 230, 255, 0.08],
            mult: { ice: 1.5 }, safe: ['ice'], slow: true, hint: 'el Hielo se potencia; el resto sufre y va más lento' },
    fog:  { name: 'Niebla', icon: 'wfog', color: '#c9cfdc', tint: [190, 195, 210, 0.12],
            mult: { ghost: 1.3, fairy: 1.3, psychic: 1.3 }, hint: 'Fantasma, Hada y Psíquico se potencian' }
  };
  // Probabilidad de cada clima según el bioma (bosque, cueva, volcán).
  const BIOME_W = [
    { rain: 3, fog: 2, sun: 1.5, snow: 0.5, sand: 0.5 },
    { fog: 3, snow: 2.5, rain: 1, sand: 1 },
    { sun: 3, sand: 3, fog: 1 }
  ];
  const FROM = 120, CHECK = 60, CHANCE = 0.18;

  let cur = null;           // { kind, t, dur }
  let checkT = CHECK, chipT = 0;
  let parts = [];
  const authority = () => !G.Coop.active || G.Coop.isHost;

  function reset() { cur = null; checkT = CHECK; chipT = 0; parts = []; }

  function def() { return cur ? KINDS[cur.kind] : null; }

  /** Multiplicador de daño de un ataque de este tipo con el clima actual. */
  function mult(type) {
    const d = def();
    return d && d.mult[type] ? 1 + (d.mult[type] - 1) * level() : 1;
  }

  /** Intensidad 0..1 (entra y sale en 3 s). */
  function level() {
    if (!cur) return 0;
    return Math.min(1, cur.t / 3, (cur.dur - cur.t) / 3);
  }

  /** ¿Le afecta el daño de arena/nieve a un Pokémon con estos tipos? */
  function hurts(types) {
    const d = def();
    return !!(d && d.safe && !types.some(t => d.safe.includes(t)));
  }

  /** Factor de velocidad (nieve) para un Pokémon con estos tipos. */
  function speedFor(types) {
    const d = def();
    return d && d.slow && !types.includes('ice') ? 1 - 0.1 * level() : 1;
  }

  function start(kind, dur) {
    cur = { kind, t: 0, dur };
    const d = KINDS[kind];
    G.Spawner.say(d.name + ': ' + d.hint, 3.4, true);
    G.Audio.sfx('biome');
  }

  function stop() {
    if (!cur) return;
    // Deja que se desvanezca.
    cur.dur = Math.min(cur.dur, cur.t + 3);
  }

  function pick(biome) {
    const w = BIOME_W[biome % BIOME_W.length];
    let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
    for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return 'rain';
  }

  function update(dt, time, pl) {
    if (cur) {
      cur.t += dt;
      if (cur.t >= cur.dur) cur = null;
    } else if (authority() && time > FROM && !G.Rift.inArena) {
      checkT -= dt;
      if (checkT <= 0) {
        checkT = CHECK;
        if (Math.random() < CHANCE) {
          const kind = pick(G.World.biome), dur = Math.round(G.U.rand(55, 75));
          start(kind, dur);
          if (G.Coop.isHost) G.Coop.broadcast(['wx', kind, dur]);
        }
      }
    }
    // Arena y nieve: te van quitando un poco de vida (nunca te dejan KO).
    chipT -= dt;
    if (chipT <= 0) {
      chipT = 2;
      if (pl && !pl.dead && hurts(pl.mon.types) && level() > 0.5) {
        const d = Math.max(1, pl.maxHp * 0.012);
        if (pl.hp > d + 1) {
          pl.hp -= d;
          G.FX.dmgText(pl.x, pl.y - pl.bodyH - 4, '-' + Math.round(d), def().color);
        }
      }
      if (authority() && cur && def().safe && level() > 0.5) {
        for (const e of G.EnemyMgr.all()) {
          if (e.dead || e.remote || e.boss) continue;
          if (!hurts(e.types || [])) continue;
          e.hp -= e.maxHp * 0.02 + 1;
          e.flash = 0.05;
          if (e.hp <= 0) e.die();
        }
      }
    }
  }

  /** Cooperativo: el anfitrión manda el clima. */
  function onEvent(ev) { if (ev[1]) start(ev[1], ev[2]); else stop(); }

  // ---------------- dibujo (en pantalla) ----------------

  /** Partículas suaves y un tinte leve. Se llama después de dibujar el mundo. */
  function draw(ctx, w, h, dt) {
    const d = def();
    const k = level();
    if (!d || k <= 0) { parts.length = 0; return; }
    const [r, g, b, a] = d.tint;
    ctx.fillStyle = `rgba(${r},${g},${b},${a * k})`;
    ctx.fillRect(0, 0, w, h);

    const want = { rain: 70, snow: 45, sand: 40, sun: 14, fog: 0 }[cur.kind] * k * (w / 1280);
    while (parts.length < want) parts.push(spawn(w, h, true));
    if (parts.length > want + 4) parts.length = Math.ceil(want);
    const s = Math.max(2, Math.round(w / 640));          // un "píxel" del juego
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.t += dt;
      if (p.y > h + 20 || p.x < -40 || p.x > w + 40 || p.t > p.life) { parts[i] = spawn(w, h, false); continue; }
      ctx.globalAlpha = p.a * k;
      ctx.fillStyle = p.c;
      if (cur.kind === 'rain') { for (let j = 0; j < 4; j++) ctx.fillRect(Math.round(p.x - j * s * 0.5), Math.round(p.y - j * s * 1.5), s * 0.5, s * 1.5); }
      else if (cur.kind === 'sand') ctx.fillRect(Math.round(p.x), Math.round(p.y), s * 3, s * 0.5);
      else ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
    ctx.globalAlpha = 1;
  }

  function spawn(w, h, anywhere) {
    const kind = cur.kind;
    const y = anywhere ? Math.random() * h : -10;
    if (kind === 'rain') return { x: Math.random() * (w + 200), y, vx: -120, vy: 720, a: 0.5, c: '#cfe2ff', t: 0, life: 9 };
    if (kind === 'snow') return { x: Math.random() * w, y, vx: G.U.rand(-20, 20), vy: G.U.rand(40, 80), a: 0.7, c: '#ffffff', t: 0, life: 20 };
    if (kind === 'sand') return { x: anywhere ? Math.random() * w : w + 20, y: Math.random() * h, vx: G.U.rand(-520, -380), vy: G.U.rand(20, 60), a: 0.4, c: '#e8cf8f', t: 0, life: 9 };
    // sol: motas de luz que suben despacio
    return { x: Math.random() * w, y: anywhere ? Math.random() * h : h + 5, vx: G.U.rand(-8, 8), vy: -G.U.rand(15, 30), a: 0.45, c: '#fff1b0', t: 0, life: 12 };
  }

  return {
    KINDS, reset, update, draw, mult, speedFor, hurts, onEvent,
    get current() { return cur && level() > 0 ? Object.assign({ left: Math.max(0, cur.dur - cur.t) }, cur, KINDS[cur.kind]) : null; },
    get vignette() { return cur && cur.kind === 'fog' ? level() : 0; },
    /** Pone un clima ya (la arena de la grieta; no se manda: cada uno lo pone). */
    force(kind, dur) { start(kind, dur); },
    /** Quita el clima de golpe (al salir de la arena). */
    clear() { cur = null; parts.length = 0; },
    debugStart(kind = 'rain', dur = 60) { start(kind, dur); if (G.Coop.isHost) G.Coop.broadcast(['wx', kind, dur]); }
  };
})();
