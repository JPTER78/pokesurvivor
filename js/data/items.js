/* ============ items.js — objetos equipables (uno por run) ============
 * Se encuentran en los cofres (a veces en los normales, a menudo en los de
 * candado) y los sueltan los jefes. Sólo puedes llevar UNO; si encuentras
 * otro, eliges con cuál quedarte. Duran lo que dura la run.
 *
 *   mods     lo que da mientras lo llevas: { atkMul, spdMul, cdMul, xpMul,
 *            coinMul (se multiplican), dmgReduce, regen (se suman) }, o una
 *            función de pl que lo devuelve (se calcula al ponértelo). Lo suma el
 *            jugador al recalcular sus stats (Player.equip).
 * Los que reaccionan a algo (golpe mortal, daño hecho...) los mira el
 * jugador con pl.hasItem(id).
 */
G.Items = (() => {
  const LIST = [
    { id: 'leftovers', name: 'Restos', desc: 'Recuperas un 1,5% de tu vida por segundo.',
      mods: p => ({ regen: p.maxHp * 0.015 }) },
    { id: 'choiceband', name: 'Cinta Elección', desc: '+40% de daño, pero no puedes cambiar de movimiento.',
      mods: { atkMul: 1.4 } },
    { id: 'quickclaw', name: 'Garra Rápida', desc: '-20% de recarga en todos tus movimientos.',
      mods: { cdMul: 0.8 } },
    { id: 'focussash', name: 'Banda Focus', desc: 'Un golpe que te dejaría KO te deja con 1 de vida (cada 60 s).' },
    { id: 'shellbell', name: 'Cascabel Concha', desc: 'Recuperas vida con el daño que haces.' },
    { id: 'amuletcoin', name: 'Moneda Amuleto', desc: '+50% de Pokémonedas al acabar la run.',
      mods: { coinMul: 1.5 } },
    { id: 'luckyegg', name: 'Huevo Suerte', desc: '+30% de experiencia.',
      mods: { xpMul: 1.3 } },
    { id: 'lifeorb', name: 'Vidasfera', desc: '+30% de daño, pero cada ataque te quita un poco de vida.',
      mods: { atkMul: 1.3 } },
    { id: 'choicescarf', name: 'Pañuelo Elección', desc: '+35% de velocidad.',
      mods: { spdMul: 1.35 } },
    { id: 'rockyhelmet', name: 'Casco Dentado', desc: 'Los que te golpean cuerpo a cuerpo reciben daño.' },
    { id: 'assaultvest', name: 'Chaleco Asalto', desc: '+20% de reducción de daño recibido.',
      mods: { dmgReduce: 0.2 } }
  ];
  const BY = {};
  for (const it of LIST) BY[it.id] = it;

  /** Uno al azar, distinto del que ya llevas. */
  function roll(except) {
    const pool = LIST.filter(i => i.id !== except);
    return G.U.pick(pool).id;
  }

  return { LIST, BY, roll };
})();
