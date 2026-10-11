/* ============ fusions.js — fusiones de movimientos (vínculos) ============
 * Cada legendario vencido en una grieta da un VÍNCULO. Con él se fusionan dos
 * movimientos que lleves en uno nuevo, más fuerte, que ocupa un solo hueco.
 * Las recetas son fijas (par → resultado). Se dan de alta en G.Moves.BY_ID
 * con `fused: true`: usan la escalera de su `kind` para subir de nivel y no
 * evolucionan (ya son la cima del árbol). No entran en los pools.
 *
 * Cuerpo a cuerpo y embestida ya llevan el ×1,4 de data/moves.js.
 */
G.Fusions = (() => {
  const LIST = [
    { pair: ['ember', 'gust'], id: 'fire-tornado', name: 'Tormenta Ígnea', type: 'fire', kind: 'orbit',
      desc: 'Cinco tornados de fuego giran a tu alrededor quemando y empujando.',
      cd: 0.28, dmg: 22, count: 5, radius: 78, speed: 2.6, size: 12, burn: 1, knock: 50 },
    { pair: ['water-gun', 'thunder-shock'], id: 'volt-tide', name: 'Marea Voltio', type: 'electric', kind: 'chain',
      desc: 'Un rayo que salta entre ocho enemigos, los frena y los deja empapados.',
      cd: 0.85, dmg: 26, count: 8, radius: 170, slow: 0.3, wet: 1 },
    { pair: ['ice-beam', 'rock-throw'], id: 'glacial-avalanche', name: 'Alud Glacial', type: 'ice', kind: 'meteor',
      desc: 'Cinco peñascos helados caen sobre los enemigos, los frenan y los empujan.',
      cd: 1.2, dmg: 34, count: 5, radius: 52, slow: 0.6, knock: 70 },
    { pair: ['sludge', 'ember'], id: 'toxic-blaze', name: 'Llama Tóxica', type: 'fire', kind: 'trail',
      desc: 'Dejas charcos de fuego venenoso que queman e intoxican.',
      cd: 0.28, dmg: 12, radius: 32, dur: 3.2, burn: 1, poison: 1 },
    { pair: ['confusion', 'shadow-ball'], id: 'phantom-force', name: 'Golpe Umbrío', type: 'ghost', kind: 'projectile',
      desc: 'Tres esferas espectrales que persiguen y atraviesan a varios.',
      cd: 0.6, dmg: 24, speed: 300, count: 3, spread: 0.25, pierce: 3, life: 2.2, size: 9, homing: 3.5 },
    { pair: ['vine-whip', 'bite'], id: 'jaw-lock', name: 'Cepo Mandíbula', type: 'grass', kind: 'melee',
      desc: 'Lianas con colmillos en 360° que empujan y atrapan.',
      cd: 0.6, dmg: 34, radius: 72, arc: 9, knock: 160, slow: 0.5 },
    { pair: ['thunderbolt', 'hex'], id: 'volt-hex', name: 'Maldición Voltio', type: 'electric', kind: 'chain',
      desc: 'Rayo maldito que salta ocho veces y castiga el doble a quien ya sufre un estado.',
      cd: 0.9, dmg: 28, count: 8, radius: 170, hex: 2.0 },
    { pair: ['razor-leaf', 'psycho-cut'], id: 'petal-blades', name: 'Filos Pétalo', type: 'grass', kind: 'boomerang',
      desc: 'Cinco hojas psíquicas que van y vuelven cortando.',
      cd: 0.85, dmg: 14, speed: 350, count: 5, spread: 0.7, radius: 230, size: 7 },
    { pair: ['heat-wave', 'hyper-voice'], id: 'eruption-roar', name: 'Rugido Ígneo', type: 'fire', kind: 'nova',
      desc: 'Un rugido de fuego en todas direcciones que atraviesa y quema.',
      cd: 1.2, dmg: 17, speed: 260, count: 24, pierce: 2, life: 1.1, size: 8, burn: 1 },
    { pair: ['quick-attack', 'aerial-ace'], id: 'extreme-dive', name: 'Picado Extremo', type: 'flying', kind: 'dash',
      desc: 'Un picado larguísimo y ancho que corta todo lo que cruza.',
      cd: 0.75, dmg: 36, radius: 200, width: 60, knock: 70 },
    { pair: ['spikes', 'toxic-spikes'], id: 'spike-field', name: 'Campo de Púas', type: 'poison', kind: 'mine',
      desc: 'Seis púas que estallan y envenenan mucho.',
      cd: 1.1, dmg: 22, count: 6, radius: 62, dur: 8, poison: 2 },
    { pair: ['will-o-wisp', 'substitute'], id: 'phantom-decoy', name: 'Señuelo Fatuo', type: 'fire', kind: 'turret',
      desc: 'Tres muñecos de fuego fatuo que disparan solos y queman.',
      cd: 3.2, dmg: 18, rate: 0.45, dur: 7, count: 3, range: 300, speed: 320, size: 7, burn: 1 },
    { pair: ['bubble', 'powder-snow'], id: 'frost-bubbles', name: 'Burbujas Gélidas', type: 'ice', kind: 'aura',
      desc: 'Una ventisca de burbujas heladas: frena mucho y deja empapado.',
      cd: 0.5, dmg: 12, radius: 110, slow: 0.7, wet: 1 },
    { pair: ['karate-chop', 'metal-claw'], id: 'iron-fist', name: 'Puño Férreo', type: 'steel', kind: 'melee',
      desc: 'Puñetazo de acero devastador que lanza por los aires.',
      cd: 0.5, dmg: 45, radius: 56, arc: 1.5, knock: 150 },
    { pair: ['hydro-pump', 'dragon-rage'], id: 'draco-cannon', name: 'Cañón Draco', type: 'dragon', kind: 'beam',
      desc: 'Un cañonazo dracónico enorme y larguísimo.',
      cd: 1.3, dmg: 40, radius: 320, width: 60 },
    { pair: ['mud-shot', 'bulldoze'], id: 'earthquake-wave', name: 'Onda Sísmica', type: 'ground', kind: 'nova',
      desc: 'Dieciséis olas de tierra que frenan y empujan.',
      cd: 1.1, dmg: 16, speed: 220, count: 16, pierce: 1, life: 1.1, size: 9, slow: 0.5, knock: 60 }
  ];
  const BY = {};
  for (const f of LIST) {
    f.fused = true;
    G.Moves.register(f);
    BY[f.id] = f;
  }

  function forPair(a, b) { return LIST.find(f => (f.pair[0] === a && f.pair[1] === b) || (f.pair[0] === b && f.pair[1] === a)) || null; }

  /** Recetas posibles con estos movimientos: [{ recipe, a, b }] (a y b son las instancias). */
  function available(moves) {
    const out = [];
    for (const f of LIST) {
      const a = moves.find(m => m.id === f.pair[0]), b = moves.find(m => m.id === f.pair[1]);
      if (a && b) out.push({ recipe: f, a, b });
    }
    return out;
  }

  return { LIST, BY, forPair, available };
})();
