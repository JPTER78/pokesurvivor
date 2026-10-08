/* ============ enemies.js — Pokémon salvajes de todas las generaciones ============
 *
 * Los tramos ya no son listas fijas: cada tramo recoge a todos los Pokémon
 * (de cualquier generación) cuyo total de stats base cae en su rango, y al
 * empezar una run se elige al azar un ELENCO de cada tramo. Así cada partida
 * trae Pokémon distintos sin tener que cargar cientos de sprites a la vez.
 *
 * Los stats de combate salen de la plantilla del tramo, ajustados con la
 * vida y la velocidad propias de cada Pokémon.
 *
 * behavior:
 *   chase    va directo a por ti
 *   charger  se para, apunta y embiste
 *   ranged   se mantiene a distancia y dispara
 *   tank     lento, mucha vida
 *
 * Jefes: Pokémon fuertes NO legendarios (pseudolegendarios, Slaking...), al
 * azar por franjas de poder. Los legendarios sólo salen en las grietas
 * (systems/rift.js).
 */
G.Enemies = (() => {
  const TIERS = [
    { from: 0,   bst: [180, 330], hp: 17,  spd: 56, dmg: 6,  xp: 3.5, cast: 7 },
    { from: 70,  bst: [300, 405], hp: 32,  spd: 62, dmg: 8.5, xp: 5,  cast: 7 },
    { from: 160, bst: [385, 465], hp: 52,  spd: 60, dmg: 11, xp: 8,  cast: 7 },
    { from: 260, bst: [445, 515], hp: 88,  spd: 70, dmg: 14, xp: 13, cast: 7 },
    { from: 380, bst: [495, 560], hp: 150, spd: 66, dmg: 22, xp: 24, cast: 7 },
    { from: 500, bst: [530, 620], hp: 250, spd: 72, dmg: 28, xp: 38, cast: 7 }
  ];

  // Franjas de jefe: minuto en que salen, PV base y franja de BST.
  const BOSS_SLOTS = [
    { at: 180, hp: 1400,  dmg: 34, xp: 220,  bst: [490, 545] },
    { at: 360, hp: 3200,  dmg: 42, xp: 420,  bst: [520, 580] },
    { at: 540, hp: 5600,  dmg: 48, xp: 680,  bst: [540, 600] },
    { at: 720, hp: 9000,  dmg: 56, xp: 1000, bst: [580, 700] },
    { at: 900, hp: 16000, dmg: 68, xp: 1800, bst: [600, 700] }
  ];

  // Stats base aproximados a partir de los de juego (inverso de fetch_pokedex).
  const baseHp = p => (p.hp - 70) / 0.45;
  const baseSpd = p => (p.spd - 78) / 0.42;

  const H = (d, s) => G.U.hash(d, 7, s);

  function behaviorOf(p) {
    const t = p.types, h = H(p.dex, 11);
    const has = (...xs) => xs.some(x => t.includes(x));
    if (has('psychic', 'electric', 'ghost', 'fairy') && h < 0.4) return 'ranged';
    if (has('fire', 'water', 'poison', 'ice') && h < 0.22) return 'ranged';
    if (has('fighting', 'normal', 'ground', 'rock', 'dragon', 'steel', 'dark') && h < 0.4) return 'charger';
    if (baseHp(p) > 95 && baseSpd(p) < 50) return 'tank';
    return 'chase';
  }

  /** Construye la definición de enemigo de un Pokémon para un tramo. */
  function defFor(p, tier, ti) {
    const hpK = G.U.clamp(baseHp(p) / 65, 0.7, 1.6);
    const spdK = G.U.clamp(0.75 + baseSpd(p) / 260, 0.75, 1.3);
    const behavior = behaviorOf(p);
    const d = {
      dex: p.dex, name: p.name, behavior,
      hp: Math.round(tier.hp * hpK * (behavior === 'tank' ? 1.5 : 1)),
      spd: Math.round(tier.spd * spdK * (behavior === 'tank' ? 0.7 : 1)),
      dmg: Math.round(tier.dmg * (behavior === 'tank' ? 1.2 : 1)),
      xp: Math.max(3, Math.round(tier.xp * (behavior === 'tank' ? 1.3 : 1)))
    };
    if (behavior === 'ranged') {
      d.shotDmg = Math.round(tier.dmg * 0.8);
      d.shotCd = +(2.2 - ti * 0.15).toFixed(2);
      d.range = 190 + ti * 6;
    }
    return d;
  }

  /** Todos los candidatos de un tramo (sin legendarios ni míticos). */
  function candidates(tier) {
    return G.DEX.filter(p => p.rarity < 5 && p.bst >= tier.bst[0] && p.bst <= tier.bst[1] && G.SPRITE_META[p.dex]);
  }

  // ---------------- elenco de la run ----------------

  let cast = null;      // [{ from, list: [def] }]
  let bosses = null;    // [def de jefe]

  /** Sortea el elenco de una run nueva. */
  function rollRun() {
    cast = TIERS.map((tier, ti) => ({
      from: tier.from,
      list: G.U.pickN(candidates(tier), tier.cast).map(p => defFor(p, tier, ti))
    }));
    const used = new Set();
    bosses = BOSS_SLOTS.map(slot => {
      const ok = p => !p.leg && G.SPRITE_META[p.dex] && !used.has(p.dex);
      let pool = G.DEX.filter(p => ok(p) && p.bst >= slot.bst[0] && p.bst <= slot.bst[1]);
      if (!pool.length) pool = G.DEX.filter(p => ok(p) && p.bst >= 580);
      const p = G.U.pick(pool);
      used.add(p.dex);
      return {
        at: slot.at, dex: p.dex, name: p.name,
        hp: slot.hp, spd: Math.round(G.U.clamp(40 + baseSpd(p) * 0.5, 40, 100)),
        dmg: slot.dmg, xp: slot.xp,
        behavior: behaviorOf(p) === 'ranged' ? 'ranged' : (baseSpd(p) > 90 ? 'charger' : 'chase'),
        shotDmg: Math.round(slot.dmg * 0.55), shotCd: 1.1, range: 260
      };
    });
    return { cast, bosses };
  }

  function scale(t) {
    return { hp: 1 + t / 95, dmg: 1 + t / 420, spd: 1 + Math.min(0.35, t / 1400) };
  }

  /**
   * Los jefes ya traen su vida base creciente (1.400 ... 16.000), así que
   * escalan mucho más suave: con la curva normal el último llegaba a 168.000 PV.
   */
  function bossScale(t) { return { hp: 1 + t / 600, dmg: 1 + t / 600, spd: 1 }; }

  /** Bolsa de enemigos disponibles en el segundo `t`. */
  function bagAt(t) {
    if (!cast) rollRun();
    const bag = [];
    for (const tier of cast) {
      if (t < tier.from) continue;
      const w = t - tier.from > 260 ? 3 : 10;       // los tramos viejos pierden peso
      for (const e of tier.list) for (let i = 0; i < w; i++) bag.push(e);
    }
    return bag.length ? bag : cast[0].list;
  }

  /** dex del elenco que aparecerán pronto (para precargar sprites). */
  function upcomingDex(t, ahead = 60) {
    if (!cast) rollRun();
    const out = [];
    for (const tier of cast) if (tier.from <= t + ahead) for (const e of tier.list) out.push(e.dex);
    for (const b of bosses) if (b.at <= t + ahead) out.push(b.dex);
    return out;
  }

  return {
    TIERS, BOSS_SLOTS, rollRun, scale, bossScale, bagAt, upcomingDex, candidates,
    get BOSSES() { if (!bosses) rollRun(); return bosses; },
    get cast() { if (!cast) rollRun(); return cast; }
  };
})();
