/* ============ run-summary.js — resumen de la partida en curso ============
 * Convierte el estado del jugador en los datos del panel "Tu partida" de la
 * pausa (lo pinta ui/run-ui.js). Es una función pura y sin DOM, para poder
 * probarla sin navegador:  node tools/run-summary.test.js
 *
 *   G.RunSummary.build(pl, time, { items })  ->  { ... } | null
 *
 * Números de combate (mismos que usa systems/combat.js):
 *   daño por golpe = m.dmg * pl.atk      (antes del tipo: eso depende del enemigo)
 *   recarga        = m.cd * pl.cdMul
 *   DPS            = daño * golpes / recarga   (estimación sostenida)
 */
G.RunSummary = (() => {
  // Mejoras de combate temporales (pl.buffs): icono, nombre y cómo se lee su valor.
  //   pct: true  -> el efecto es un porcentaje (ataque, velocidad, defensa).
  //   pct: false -> es vida recuperada por segundo (Regeneración).
  const BUFFS = [
    { id: 'atk',   icon: 'fist',   label: 'Ataque',       pct: true,  unit: 'de daño' },
    { id: 'spd',   icon: 'boot',   label: 'Velocidad',    pct: true,  unit: '' },
    { id: 'def',   icon: 'shield', label: 'Defensa',      pct: true,  unit: '' },
    { id: 'regen', icon: 'sprout', label: 'Regeneración', pct: false, unit: 'vida/s' }
  ];

  // Icono del poder de altar, por id (ver systems/interact.js POWERS).
  const POWER_ICON = { dmg: 'fist', spd: 'boot', mag: 'magnet', cd: 'clock' };

  /**
   * Lo que da cada carta de nivel UNA vez (los mismos números que las funciones
   * `apply` de systems/levelup.js STATS):
   *   mul  -> se multiplica cada vez que la coges (0.92 tres veces = ×0.78)
   *   add  -> se suma cada vez (20 de vida, 6% de coraza...)
   *   sign -> el efecto es una resta (recarga y daño recibido bajan)
   *   cap  -> tope real del juego para esa característica (Coraza: 70%)
   *   pct  -> el número se lee en porcentaje
   */
  const UPGRADES = {
    hp:  { mul: 1,    add: 20,  unit: 'de vida máxima' },
    atk: { mul: 1.10, add: 0,   unit: 'de daño',            pct: true },
    spd: { mul: 1.07, add: 0,   unit: 'de velocidad',       pct: true },
    cd:  { mul: 0.92, add: 0,   unit: 'de recarga',         pct: true, sign: -1 },
    def: { mul: 1,    add: 6,   unit: 'de daño recibido',   pct: true, sign: -1, cap: 70 },
    rgn: { mul: 1,    add: 0.9, unit: 'vida/s' },
    mag: { mul: 1.30, add: 0,   unit: 'de recogida',        pct: true },
    xp:  { mul: 1.12, add: 0,   unit: 'de experiencia',     pct: true }
  };

  /** Texto del efecto total de una carta cogida `n` veces ('' si no la conozco). */
  function upgradeEffect(id, n) {
    const u = UPGRADES[id];
    if (!u || !n) return '';
    // Las de multiplicar y las de % se leen sin decimales; las de sumar que no
    // son %, con uno (0.9 de regeneración).
    const dec = u.mul !== 1 || u.pct ? 0 : 1;
    let v;
    if (u.mul !== 1) v = (Math.pow(u.mul, n) - 1) * 100;
    else { v = u.add * n; if (u.cap) v = Math.min(u.cap, v); }
    v = Math.round(v * Math.pow(10, dec)) / Math.pow(10, dec);
    const neg = v < 0 || (u.sign === -1 && v > 0);
    return `${neg ? '-' : '+'}${Math.abs(v)}${u.pct ? '%' : ''} ${u.unit}`;
  }

  // Número seguro: lo que no sea finito cuenta como 0 (una partida editada a
  // mano no rompe el panel).
  const n = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

  const BUFF_BY = {};
  for (const b of BUFFS) BUFF_BY[b.id] = b;

  /**
   * Cómo se lee el valor de una mejora: `pct` si es un porcentaje (ataque,
   * velocidad, defensa) o `rate` si son puntos de vida por segundo. `total` es
   * ya la suma de todas las pilas (p. ej. 3 pilas de +13% = 0.39).
   */
  function buffValue(stat, total) {
    const def = BUFF_BY[stat] || { label: stat, pct: true, unit: '' };
    return {
      label: def.label, unit: def.unit,
      pct: def.pct ? Math.round(total * 100) : 0,
      rate: def.pct ? 0 : Math.round(total * 10) / 10
    };
  }

  /** Datos de combate de un movimiento ya instanciado (ver data/moves.js). */
  function moveInfo(m, atk, cdMul) {
    const dmg = m.dmg ? m.dmg * atk : 0;
    const hits = m.count ? n(m.count) : 1;
    const cd = m.cd ? Math.max(0.05, m.cd * cdMul) : 0;
    return {
      id: m.id, name: m.name, lvl: n(m.lvl), type: m.type, kind: m.kind,
      dmg: Math.round(dmg),
      hits,
      cd: cd ? +cd.toFixed(2) : 0,
      dps: dmg && cd ? Math.round(dmg * hits / cd) : 0,
      pierce: n(m.pierce),
      dur: m.dur ? +n(m.dur).toFixed(1) : 0,
      burn: !!m.burn, poison: !!m.poison, slow: n(m.slow), drain: !!m.drain,
      // Movimiento de mejora (Danza Espada, Acua Aro...): no pega, te potencia.
      // `stacks` es lo máximo que se acumula (sube con el nivel del movimiento).
      buff: m.stat ? Object.assign(buffValue(m.stat, n(m.amount)), { dur: +n(m.dur).toFixed(1), stacks: n(m.stacks) }) : null
    };
  }

  /**
   * @param pl    el jugador en curso (G.Game.player)
   * @param time  segundos que llevas de run (G.Game.st.time)
   * @param opts  { items, stats } catálogos: objetos (G.Items.BY) y cartas de
   *              nivel (G.LevelUp.STATS) para sacar nombres e iconos
   */
  function build(pl, time, opts = {}) {
    if (!pl) return null;
    const items = opts.items || (G.Items && G.Items.BY) || {};
    const stats = opts.stats || (G.LevelUp && G.LevelUp.STATS) || [];
    const atk = n(pl.atk);
    const cdMul = n(pl.cdMul) || 1;

    const slots = (pl.slots || []).map((group, i) => ({
      n: i + 1,
      active: i === n(pl.active),
      moves: (group || []).map(m => moveInfo(m, atk, cdMul))
    }));

    const info = pl.item ? items[pl.item] : null;
    const item = pl.item
      ? { id: pl.item, name: (info && info.name) || pl.item, desc: (info && info.desc) || '' }
      : null;

    const buffs = BUFFS
      .map(b => {
        const cur = pl.buffs && pl.buffs[b.id];
        const stacks = cur ? n(cur.n) : 0;
        // Lo que te está dando ahora mismo: pilas × cantidad.
        return Object.assign(buffValue(b.id, stacks * (cur ? n(cur.amount) : 0)), {
          id: b.id, icon: b.icon, n: stacks, t: cur ? n(cur.t) : 0
        });
      })
      .filter(b => b.n > 0);

    const hp = n(pl.hp), maxHp = Math.max(1, n(pl.maxHp));

    // Cartas de nivel cogidas (mejoras permanentes de la run), con cuántas veces
    // cada una. La Baya Zidra se salta: cura al momento, no es un número que
    // suba durante la partida.
    const taken = pl.statsTaken || {};
    const upgrades = stats
      .filter(s => s.id !== 'heal' && n(taken[s.id]) > 0)
      .map(s => ({ id: s.id, icon: s.icon, name: s.title, n: n(taken[s.id]), effect: upgradeEffect(s.id, n(taken[s.id])) }));

    // Poder de altar activo (Furia, Rayo, Imán, Prisa): dura poco y corre.
    const pw = pl.power && pl.power.def;
    const power = pw
      ? { id: pw.id, icon: POWER_ICON[pw.id] || 'star', name: pw.name, desc: pw.desc, t: n(pl.power.t) }
      : null;

    return {
      dex: pl.dex,
      name: (pl.mon && pl.mon.name) || '',
      shiny: !!pl.shiny,
      level: n(pl.level),
      hp, maxHp, hpFrac: Math.max(0, Math.min(1, hp / maxHp)),
      bonds: n(pl.bonds),
      slots, item, buffs, upgrades, power,
      stats: {
        time: n(time),
        kills: n(pl.kills),
        bosses: n(pl.bosses),
        damage: Math.round(n(pl.dmgDealt)),
        coins: n(pl.coins),
        t1: n(pl.t1),
        t10: n(pl.t10),
        // El multiplicador con dos decimales, como número (×1.43, ×1.7).
        atk: Math.round(atk * 100) / 100,
        // La ventaja del ataque, en %: ×1.34 = los golpes pegan un 34% más.
        atkPct: Math.round((atk - 1) * 100),
        crit: Math.round(n(pl.critChance) * 100)
      }
    };
  }

  return { build, moveInfo, buffValue, upgradeEffect, BUFFS, UPGRADES, POWER_ICON };
})();
