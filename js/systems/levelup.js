/* ============ levelup.js — las tres cartas de subida de nivel ============
 * Tipos de carta:
 *   new      aprender un movimiento nuevo (si quedan huecos de los 6)
 *   passive  una pasiva nueva (si quedan huecos de los 4)
 *   up       subir de nivel un movimiento o una pasiva que ya tienes
 *   evo      evolución (dorada): movimiento al máximo + llevas su pasiva
 *   bonus    Baya Zidra (cura) y Pokémonedas: no ocupan hueco y siempre están
 */
G.LevelUp = (() => {
  const GOLD = '#ffd23f', SLATE = '#8fa3c4';

  const BONUS = [
    { id: 'heal',  w: 3, icon: 'berry', title: 'Baya Zidra',  desc: 'Recupera el 45% de tu vida ahora mismo.', apply: pl => pl.heal(pl.maxHp * 0.45) },
    { id: 'coins', w: 2, icon: 'coin',  title: 'Pokémonedas', desc: '+40 Pokémonedas para esta run.',         apply: pl => { pl.coins += 40; } }
  ];

  /** Construye el conjunto de cartas candidatas, con pesos. */
  function candidates(pl) {
    const out = [];
    const has = id => pl.hasPassive(id);

    // --- movimientos nuevos ---
    if (pl.moves.length < G.Player.MAX_MOVES) {
      const pool = G.Moves.poolFor(pl.mon).filter(id => !pl.hasMove(id));
      for (const id of G.U.pickN(pool, 6)) {
        const d = G.Moves.BY_ID[id];
        out.push({ w: 10, type: 'new', key: 'new:' + id, icon: 'move:' + id, color: G.U.TYPE_COLOR[d.type],
                   tag: G.U.TYPE_NAME[d.type], title: d.name, desc: d.desc, apply: p => p.addMove(id) });
      }
    }

    // --- evoluciones: movimiento al máximo + llevas su pasiva ---
    const waiting = {};                   // pasiva -> movimiento que la espera
    for (const m of pl.moves) {
      const ev = G.Moves.evoInfo(m, has);
      if (!ev) continue;
      if (!ev.ready) { waiting[ev.needs] = m; continue; }
      out.push({
        w: 40, type: 'evo', key: 'evo:' + m.id, icon: 'move:' + m.id, color: GOLD, tag: 'EVOLUCIÓN',
        title: m.name + ' → ' + ev.name, desc: ev.text,
        apply: p => {
          G.Moves.evolve(m);
          G.FX.ring(p.x, p.y, 8, 120, GOLD, 0.8, 6);
          G.FX.burst(p.x, p.y - p.bodyH * 0.5, '#ffe14d', 40, 240);
          G.Audio.sfx('legend');
          G.Progress.event('evolve', { move: m.id });
        }
      });
    }

    // --- subir movimientos ---
    for (const m of pl.moves) {
      const txt = G.Moves.nextUpText(m);
      if (!txt) continue;
      // En el penúltimo nivel se avisa de qué pasiva hace falta para evolucionar.
      const ev = G.Moves.evoInfo(Object.assign({}, m, { lvl: m.def.maxLvl }), has);
      // (Cada trozo se traduce por separado: juntos no casarían con ninguna entrada del diccionario.)
      const hint = m.lvl === m.def.maxLvl - 1 && ev && !ev.ready ? ' ' + G.I18n.t('Evoluciona con ' + ev.needName + '.') : '';
      out.push({ w: 8, type: 'up', key: 'up:' + m.id, icon: 'move:' + m.id, color: G.U.TYPE_COLOR[m.type],
                 tag: 'Nv.' + m.lvl + ' > ' + (m.lvl + 1), title: m.name, desc: G.I18n.t(txt) + hint, apply: () => G.Moves.levelUp(m) });
    }

    // --- pasivas nuevas (las que desbloquean una evolución salen siempre y en dorado) ---
    if (pl.passives.length < G.Player.MAX_PASSIVES) {
      const free = G.Passives.LIST.filter(s => !has(s.id));
      const pick = G.U.pickN(free.filter(s => !waiting[s.id]), 3).concat(free.filter(s => waiting[s.id]));
      for (const s of pick) {
        const evoFor = waiting[s.id];
        out.push({ w: evoFor ? 14 : 6, type: 'passive', key: 'passive:' + s.id, icon: s.icon, color: evoFor ? GOLD : SLATE,
                   tag: evoFor ? 'Evoluciona ' + evoFor.name : 'Pasiva', title: s.name, desc: s.desc, apply: p => p.addPassive(s.id) });
      }
    }

    // --- subir pasivas ---
    for (const p of pl.passives) {
      if (p.lvl >= G.Passives.MAX_LVL) continue;
      out.push({ w: 7, type: 'up', key: 'pup:' + p.id, icon: p.def.icon, color: SLATE,
                 tag: 'Nv.' + p.lvl + ' > ' + (p.lvl + 1), title: p.def.name, desc: p.def.desc, apply: pp => pp.levelPassive(pp.passive(p.id)) });
    }

    // --- bonus: siempre ---
    for (const b of BONUS) {
      out.push({ w: b.w, type: 'bonus', key: 'bonus:' + b.id, icon: b.icon, color: SLATE, tag: 'Extra', title: b.title, desc: b.desc, apply: b.apply });
    }
    return out;
  }

  /** Devuelve hasta n cartas distintas, elegidas por peso. La evolución lista sale siempre. */
  function offer(pl, n = 3) {
    const pool = candidates(pl);
    const picked = [];
    const evo = pool.findIndex(c => c.type === 'evo');
    if (evo >= 0) picked.push(pool.splice(evo, 1)[0]);
    while (picked.length < n && pool.length) {
      const total = pool.reduce((a, c) => a + c.w, 0);
      let r = Math.random() * total, idx = 0;
      for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { idx = i; break; } }
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  }

  return { offer, candidates, BONUS };
})();
