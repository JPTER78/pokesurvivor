/* ============ passives.js — objetos de apoyo (varios por run, con nivel) ============
 * Salen en las cartas de subir de nivel, como los movimientos: una carta
 * "Objeto de apoyo" para coger uno nuevo y otra para subirlo de nivel.
 * Se pueden llevar hasta SLOTS distintos a la vez, cada uno hasta su `max`.
 * Son aparte del objeto equipado (data/items.js, uno solo por run).
 *
 *   apply(pl)  se le aplica al jugador cada vez que lo coge o lo sube un nivel
 *              (el efecto de `desc` es lo que gana en cada nivel).
 * Los que reaccionan a algo (barrera, revivir, robo de vida) los lleva el
 * jugador en sus campos (barrierLv, revives, lifesteal...) y tick() de aquí.
 */
G.Passives = (() => {
  const SLOTS = 6;

  const LIST = [
    { id: 'expertbelt', name: 'Cinta Experto', max: 5, desc: '+8% de daño con todos los movimientos.',
      apply: pl => { pl.atkMul *= 1.08; } },
    { id: 'quickpowder', name: 'Polvo Veloz', max: 5, desc: '+6% de velocidad de movimiento.',
      apply: pl => { pl.spdMul *= 1.06; } },
    { id: 'powerherb', name: 'Hierba Única', max: 5, desc: '-6% de recarga en todos los movimientos.',
      apply: pl => { pl.cdMul *= 0.94; } },
    { id: 'scopelens', name: 'Periscopio', max: 5, desc: '+4% de probabilidad de golpe crítico.',
      apply: pl => { pl.critChance = (pl.critChance || 0) + 0.04; } },
    { id: 'eviolite', name: 'Mineral Evolutivo', max: 5, desc: '+4% de reducción de daño recibido.',
      apply: pl => { pl.dmgReduce = Math.min(0.7, pl.dmgReduce + 0.04); } },
    { id: 'hpup', name: 'Más PS', max: 5, desc: '+15 de vida máxima (y la recupera).',
      apply: pl => pl.addMaxHp(15) },
    { id: 'honey', name: 'Miel', max: 5, desc: '+20% de radio de recogida de experiencia.',
      apply: pl => { pl.magnet *= 1.20; } },
    { id: 'bigroot', name: 'Raíz Grande', max: 5, desc: 'El 0,4% del daño que haces te cura (hasta 2 de vida por segundo cada nivel).',
      apply: pl => { pl.lifesteal += 0.004; } },
    { id: 'lightclay', name: 'Refleluz', max: 5, desc: 'Cada cierto tiempo te pone una barrera que para un golpe; con más nivel, más a menudo (y desde el nivel 4, hasta 2 barreras).',
      apply: pl => { pl.barrierLv++; } },
    { id: 'revive', name: 'Revivir', max: 1, desc: 'Si te debilitan, vuelves una vez con la mitad de la vida.',
      apply: pl => { pl.revives++; } },
    { id: 'expshare', name: 'Repartir Experiencia', max: 5, desc: '+8% de experiencia ganada.',
      apply: pl => { pl.xpMul *= 1.08; } },
    { id: 'nugget', name: 'Pepita', max: 5, desc: '+10% de monedas.',
      apply: pl => { pl.coinMul *= 1.10; } },
    { id: 'blacksludge', name: 'Lodo Negro', max: 5, desc: '+0.6 de vida regenerada por segundo.',
      apply: pl => { pl.regenFlat += 0.6; } },
    { id: 'widelens', name: 'Lupa', max: 5, desc: '+6% de alcance y tamaño de todos los movimientos.',
      apply: pl => { pl.areaMul *= 1.06; for (const m of pl.moves) area(m, 1.06); } }
  ];
  const BY = {};
  for (const p of LIST) BY[p.id] = p;

  /** Lupa: agranda un movimiento (alcance, tamaño de los disparos y grosor). */
  function area(m, k) { for (const f of ['radius', 'size', 'width']) if (m[f] != null) m[f] *= k; }

  /** Coge uno nuevo o le sube un nivel. */
  function take(pl, id) {
    const d = BY[id];
    if (!d) return;
    pl.passives[id] = (pl.passives[id] || 0) + 1;
    d.apply(pl);
  }

  /** Cada fotograma: tope del robo de vida y barreras de Refleluz. */
  function tick(pl, dt) {
    const root = pl.passives.bigroot || 0;
    if (root) pl.lsBudget = Math.min(2 * root, pl.lsBudget + 2 * root * dt);
    const lv = pl.barrierLv;
    if (lv) {
      const every = 22 - 3 * (lv - 1), most = lv >= 4 ? 2 : 1;
      if (pl.barriers < most && (pl.barrierT += dt) >= every) {
        pl.barrierT = 0;
        pl.barriers++;
        G.FX.ring(pl.x, pl.y, 6, pl.r * 2.6, '#9fd8ff', 0.4, 3);
      }
    }
  }

  /** Las cartas de nivel de los objetos de apoyo (las mezcla levelup.js con las demás). */
  function cards(pl) {
    const out = [], have = pl.passives, owned = Object.keys(have);
    for (const id of owned) {
      const d = BY[id], lv = have[id];
      if (!d || lv >= d.max) continue;
      out.push({ w: 6, type: 'pitem', key: 'pitem:' + id, icon: id, color: '#ffb84d',
                 tag: 'Nv.' + lv + ' > ' + (lv + 1), title: d.name, desc: d.desc, apply: p => take(p, id) });
    }
    if (owned.length < SLOTS) {
      for (const d of G.U.pickN(LIST.filter(x => !have[x.id]), 3)) {
        out.push({ w: 5, type: 'pitem', key: 'pitem:' + d.id, icon: d.id, color: '#ffb84d',
                   tag: 'Objeto de apoyo', title: d.name, desc: d.desc, apply: p => take(p, d.id) });
      }
    }
    return out;
  }

  return { LIST, BY, SLOTS, area, take, tick, cards };
})();
