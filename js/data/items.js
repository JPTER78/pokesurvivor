/* ============ items.js — objetos equipables (uno por run) ============
 * Se encuentran en los cofres (a veces en los normales, a menudo en los de
 * candado) y los sueltan los jefes. Sólo puedes llevar UNO; si encuentras
 * otro, eliges con cuál quedarte. Duran lo que dura la run.
 *
 *   on(pl)   se lo pones (lo que hace mientras lo llevas)
 *   off(pl)  se lo quitas (deshace lo de on)
 * Los que reaccionan a algo (golpe mortal, daño hecho...) los mira el
 * jugador con pl.hasItem(id).
 */
G.Items = (() => {
  const LIST = [
    { id: 'leftovers', name: 'Restos', desc: 'Recuperas un 1,5% de tu vida por segundo.',
      on: p => { p.regenFlat += p.maxHp * 0.015; p._itemRegen = p.maxHp * 0.015; },
      off: p => { p.regenFlat -= p._itemRegen || 0; } },
    { id: 'choiceband', name: 'Cinta Elección', desc: '+40% de daño, pero no puedes cambiar de movimiento.',
      on: p => { p.atkMul *= 1.4; }, off: p => { p.atkMul /= 1.4; } },
    { id: 'quickclaw', name: 'Garra Rápida', desc: '-20% de recarga en todos tus movimientos.',
      on: p => { p.cdMul *= 0.8; }, off: p => { p.cdMul /= 0.8; } },
    { id: 'focussash', name: 'Banda Focus', desc: 'Un golpe que te dejaría KO te deja con 1 de vida (cada 60 s).',
      on: () => {}, off: () => {} },
    { id: 'shellbell', name: 'Cascabel Concha', desc: 'Recuperas vida con el daño que haces.',
      on: () => {}, off: () => {} },
    { id: 'amuletcoin', name: 'Moneda Amuleto', desc: '+50% de Pokémonedas al acabar la run.',
      on: p => { p.coinMul *= 1.5; }, off: p => { p.coinMul /= 1.5; } },
    { id: 'luckyegg', name: 'Huevo Suerte', desc: '+30% de experiencia.',
      on: p => { p.xpMul *= 1.3; }, off: p => { p.xpMul /= 1.3; } },
    { id: 'lifeorb', name: 'Vidasfera', desc: '+30% de daño, pero cada ataque te quita un poco de vida.',
      on: p => { p.atkMul *= 1.3; }, off: p => { p.atkMul /= 1.3; } },
    { id: 'choicescarf', name: 'Pañuelo Elección', desc: '+35% de velocidad.',
      on: p => { p.spdMul *= 1.35; }, off: p => { p.spdMul /= 1.35; } },
    { id: 'rockyhelmet', name: 'Casco Dentado', desc: 'Los que te golpean cuerpo a cuerpo reciben daño.',
      on: () => {}, off: () => {} },
    { id: 'assaultvest', name: 'Chaleco Asalto', desc: '+20% de reducción de daño recibido.',
      on: p => { p.dmgReduce += 0.2; }, off: p => { p.dmgReduce -= 0.2; } },
    // ---- desde el 16-10-2026 (objetos de combate de los juegos) ----
    { id: 'scopelens', name: 'Periscopio', desc: '+12% de probabilidad de golpe crítico.',
      on: p => { p.critChance += 0.12; }, off: p => { p.critChance -= 0.12; } },
    { id: 'expertbelt', name: 'Cinta Experto', desc: '+25% de daño con los golpes muy eficaces.',
      on: () => {}, off: () => {} },
    { id: 'muscleband', name: 'Cinta Fuerte', desc: '+20% de daño con los movimientos físicos.',
      on: p => { p.itemP = 1.2; }, off: p => { p.itemP = 1; } },
    { id: 'wiseglasses', name: 'Gafas Especiales', desc: '+20% de daño con los movimientos especiales.',
      on: p => { p.itemS = 1.2; }, off: p => { p.itemS = 1; } },
    { id: 'weaknesspolicy', name: 'Seguro Debilidad', desc: 'Si te golpean con algo muy eficaz, +50% de daño durante 10 s.',
      on: () => {}, off: p => { p.wpT = 0; } },
    { id: 'airballoon', name: 'Globo Helio', desc: 'Flotas: el agua, la lava y las trampas no te afectan. Se pincha al recibir un golpe y se vuelve a hinchar a los 25 s.',
      on: p => { p.balloonUp = true; p.levitate = true; },
      off: p => { p.balloonUp = false; p.levitate = !!p.afx.levitate; } },
    { id: 'brightpowder', name: 'Polvo Brillo', desc: 'Esquivas 1 de cada 10 golpes.',
      on: () => {}, off: () => {} },
    { id: 'whiteherb', name: 'Hierba Blanca', desc: 'Nada te frena: ni las trampas pegajosas, ni el agua, ni el clima.',
      on: p => { p.steady = true; }, off: p => { p.steady = !!p.afx.steady; } }
  ];
  const BY = {};
  for (const it of LIST) BY[it.id] = it;

  /** Uno al azar, distinto del que ya llevas. */
  /** Objeto al azar, nunca el que ya llevas (antes 1 de cada 19 era el mismo y no servía). */
  function roll(except = G.Game && G.Game.player ? G.Game.player.item : null) {
    const pool = LIST.filter(i => i.id !== except);
    return G.U.pick(pool).id;
  }

  return { LIST, BY, roll };
})();
