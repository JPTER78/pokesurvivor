/* ============ passives.js — pasivas de la run ============
 * Hasta G.Passives.MAX a la vez, cada una de nivel 1 a MAX_LVL. Sustituyen a
 * las antiguas cartas de stat (que eran ilimitadas): ahora ocupan un hueco y
 * se eligen como parte de la build. Las condiciones de evolución de los
 * movimientos (moves.js, EVO) piden LLEVAR una de estas.
 *
 *   apply(pl)  aplica UN nivel.
 */
G.Passives = (() => {
  const LIST = [
    { id: 'hp',  icon: 'heart',  name: 'Vigor',       desc: '+20 de vida máxima por nivel (y la recupera).',
      apply: pl => pl.addMaxHp(20) },
    { id: 'atk', icon: 'fist',   name: 'Potencia',    desc: '+10% de daño con todos los movimientos por nivel.',
      apply: pl => { pl.atkMul *= 1.10; } },
    { id: 'spd', icon: 'boot',   name: 'Carrera',     desc: '+7% de velocidad de movimiento por nivel.',
      apply: pl => { pl.spdMul *= 1.07; } },
    { id: 'cd',  icon: 'clock',  name: 'Reflejos',    desc: '-8% de recarga en todos los movimientos por nivel.',
      apply: pl => { pl.cdMul *= 0.92; } },
    { id: 'def', icon: 'shield', name: 'Coraza',      desc: '+6% de reducción de daño recibido por nivel.',
      apply: pl => { pl.dmgReduce = Math.min(0.7, pl.dmgReduce + 0.06); } },
    { id: 'rgn', icon: 'sprout', name: 'Síntesis',    desc: '+0.9 de vida regenerada por segundo por nivel.',
      apply: pl => { pl.regenFlat += 0.9; } },
    { id: 'mag', icon: 'magnet', name: 'Imán',        desc: '+30% de radio de recogida por nivel.',
      apply: pl => { pl.magnet *= 1.30; } },
    { id: 'xp',  icon: 'book',   name: 'Aprendizaje', desc: '+12% de experiencia ganada por nivel.',
      apply: pl => { pl.xpMul *= 1.12; } }
  ];
  const BY = {};
  for (const p of LIST) BY[p.id] = p;
  return { LIST, BY, MAX: 4, MAX_LVL: 5 };
})();
