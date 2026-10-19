/* ============ mons.js — el Pokémon permanente: nivel, naturaleza, habilidad y stats ============
 *
 * Cada Pokémon de la colección tiene su propio NIVEL (1-100), que no es el nivel
 * de la partida. Sube con la experiencia que gana al acabar cada partida jugada
 * con él, con el ritmo de crecimiento de su especie en los juegos (G.EXP_TABLE).
 *
 * Guardado (js/core/db.js):
 *   save.pxp[dex]    experiencia total de ese Pokémon (sólo crece: se fusiona con el máximo)
 *   save.pnat[dex]   naturaleza elegida (índice de G.NATURES), si se ha cambiado
 *   save.pabil[dex]  habilidad elegida (0, 1 o 2 = oculta), si se ha cambiado
 * Sin elegir, la naturaleza y la habilidad salen "al azar" pero fijas para cada
 * cuenta y Pokémon (semilla = fecha de creación de la partida + nº de Pokédex):
 * así todos los aparatos de la misma cuenta ven lo mismo sin guardar nada.
 *
 * Stats del juego (iguales a los de antes en el Nv. 1 y con naturaleza neutra):
 *   vida      70 + PS × 0,45                         × nivel (hasta +50 %)
 *   ataque    0,70 + Ataque/100 × 0,55 (físicos)       × nivel (hasta +50 %)
 *             0,70 + At. Esp./100 × 0,55 (especiales)
 *   defensa   reducción de daño de su clase: (Def − 70) / 450, de −10 % a +30 %,
 *             más hasta +8 % por nivel (19-10-2026: era /400 con tope +20 %, y los
 *             muros como Shuckle o Steelix no aguantaban más que cualquiera)
 *   velocidad 78 + Velocidad × 0,42                  × nivel (hasta +10 %)
 * Muros (19-10-2026): pegan con su coraza, como Plancha Corporal. El ataque físico
 * usa el 45 % de su Defensa si es mayor que su Ataque (y el especial, el 45 % de su
 * Def. Esp.). Así Shuckle, Bastiodon o Toxapex no son inútiles y los demás no cambian.
 * Naturaleza (desde el 19-10-2026, de verdad): ×1,1 / ×0,9 al ataque de su clase
 * y a la velocidad finales; en defensa, ±5 % de reducción. Antes multiplicaba el
 * stat base y en el juego se notaba un 1-6 %.
 */
G.Mons = (() => {
  const MAX = 100;
  const HIDDEN_RATE = 1 / 20;
  const STAT_I = { hp: 0, atk: 1, def: 2, spa: 3, spd: 4, spe: 5 };

  const save = () => G.DB.save;
  const tx = a => (Array.isArray(a) ? (G.I18n.lang === 'en' ? a[1] : a[0]) : a);

  // Número pseudoaleatorio fijo para (cuenta, Pokémon, sal).
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const roll = (dex, salt) => hash(((save() && save().created) || 0) + ':' + dex + ':' + salt);

  // ---------------- nivel y experiencia ----------------

  function table(dex) {
    const st = G.DEX_STATS && G.DEX_STATS[dex];
    return (G.EXP_TABLE && G.EXP_TABLE[st ? st[6] : 2]) || G.EXP_TABLE[2];
  }
  function xp(dex) {
    const s = save();
    return Math.max(0, +(s && s.pxp && s.pxp[dex]) || 0);
  }
  /** Experiencia total que hace falta para llegar al nivel L. */
  const xpAt = (dex, L) => table(dex)[Math.max(1, Math.min(MAX, L)) - 1];
  function levelOf(dex, x) {
    const T = table(dex);
    let L = 1;
    while (L < MAX && x >= T[L]) L++;
    return L;
  }
  function level(dex) { return levelOf(dex, xp(dex)); }

  /** { level, cur, need, frac }: lo que lleva dentro del nivel actual. */
  function progress(dex) {
    const L = level(dex), x = xp(dex);
    if (L >= MAX) return { level: L, cur: 0, need: 0, frac: 1 };
    const a = xpAt(dex, L), b = xpAt(dex, L + 1);
    return { level: L, cur: x - a, need: b - a, frac: (x - a) / (b - a) };
  }

  /** Suma experiencia a un Pokémon. Devuelve { from, to } (niveles). */
  function addXp(dex, amount) {
    const s = save();
    const from = level(dex);
    if (!s || !(amount > 0)) return { from, to: from };
    s.pxp = s.pxp || {};
    s.pxp[dex] = Math.min(xpAt(dex, MAX), xp(dex) + Math.floor(amount));
    return { from, to: level(dex) };
  }

  /** Movimientos enseñados con MT (save.ptm[dex]; la Tienda Kecleon llega en la fase 4). */
  function taught(dex) {
    const s = save();
    const l = s && s.ptm && s.ptm[dex];
    return Array.isArray(l) ? l : [];
  }

  // ---------------- naturaleza y habilidad ----------------

  function natureIndex(dex) {
    const s = save();
    const o = s && s.pnat && s.pnat[dex];
    if (Number.isInteger(o) && o >= 0 && o < G.NATURES.length) return o;
    return Math.floor(roll(dex, 'nat') * G.NATURES.length);
  }
  function nature(dex) { return G.NATURES[natureIndex(dex)]; }

  /** Hueco de habilidad: 0 o 1 (normales) o 2 (oculta). `natural`: la que le tocó, sin Cápsulas. */
  function abilitySlot(dex, natural = false) {
    const list = (G.DEX_ABIL && G.DEX_ABIL[dex]) || [];
    const s = save();
    const o = !natural && s && s.pabil && s.pabil[dex];
    if (Number.isInteger(o) && list[o]) return o;
    if (list[2] && roll(dex, 'hid') < HIDDEN_RATE) return 2;
    const normal = [0, 1].filter(i => list[i]);
    return normal.length ? normal[Math.floor(roll(dex, 'abil') * normal.length)] : 0;
  }
  function ability(dex) {
    const list = (G.DEX_ABIL && G.DEX_ABIL[dex]) || [];
    return list[abilitySlot(dex)] || null;
  }

  // ---------------- stats ----------------

  function base(dex) {
    const st = G.DEX_STATS && G.DEX_STATS[dex];
    if (st) return { hp: st[0], atk: st[1], def: st[2], spa: st[3], spd: st[4], spe: st[5] };
    // Sin datos (no debería pasar): lo que se sabía antes.
    const p = G.DEX_BY[dex];
    const a = (p.atk - 0.70) / 0.55 * 100;
    return { hp: (p.hp - 70) / 0.45, atk: a, def: 70, spa: a, spd: 70, spe: (p.spd - 78) / 0.42 };
  }
  const natMul = (n, stat) => (n && n.up === stat ? 1.1 : n && n.down === stat ? 0.9 : 1);
  const natRed = (n, stat) => (n && n.up === stat ? 0.05 : n && n.down === stat ? -0.05 : 0);
  const red = def => Math.max(-0.1, Math.min(0.3, (def - 70) / 450));

  /** Stats del juego de un Pokémon (con su nivel y naturaleza, o los que se pidan). */
  function stats(dex, L = level(dex), nat = nature(dex)) {
    const b = base(dex);
    const t = (L - 1) / (MAX - 1);
    const lm = 1 + 0.5 * t;
    return {
      level: L,
      hp: Math.round((70 + b.hp * 0.45) * lm),
      atkP: (0.70 + Math.max(b.atk, b.def * 0.45) / 100 * 0.55) * lm * natMul(nat, 'atk'),
      atkS: (0.70 + Math.max(b.spa, b.spd * 0.45) / 100 * 0.55) * lm * natMul(nat, 'spa'),
      redP: red(b.def) + natRed(nat, 'def') + 0.08 * t,
      redS: red(b.spd) + natRed(nat, 'spd') + 0.08 * t,
      spd: Math.round((78 + b.spe * 0.42) * (1 + 0.1 * t) * natMul(nat, 'spe')),
      base: b
    };
  }

  // ---------------- movimientos: clase y potencia ----------------

  /** 'p' (físico) o 's' (especial), como en los juegos. */
  function moveClass(m) {
    const g = G.MOVES_GEN && G.MOVES_GEN[m.id];
    if (g && (g.c === 'p' || g.c === 's')) return g.c;
    return m.kind === 'melee' || m.kind === 'dash' || m.kind === 'trail' ? 'p' : 's';
  }
  /** Potencia original (para Experto y compañía). */
  function movePower(m) {
    const g = G.MOVES_GEN && G.MOVES_GEN[m.id];
    return g && g.pw ? g.pw : 60;
  }

  // ---------------- textos ----------------

  const STAT_NAME = { atk: 'Ataque', def: 'Defensa', spa: 'At. Esp.', spd: 'Def. Esp.', spe: 'Velocidad' };
  function natureText(n) {
    if (!n.up) return 'neutra';
    return '+' + STAT_NAME[n.up] + ' / −' + STAT_NAME[n.down];
  }

  return { MAX, xp, xpAt, level, levelOf, progress, addXp, taught, nature, natureIndex, natureText,
           ability, abilitySlot, stats, base, moveClass, movePower, tx, STAT_I };
})();
