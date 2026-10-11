/* ============ fusions.js — fusiones de movimientos (vínculos) ============
 * Cada legendario vencido en una grieta da un VÍNCULO. Con él se fusionan dos
 * movimientos que lleves, LOS DOS AL NIVEL MÁXIMO, en uno nuevo que ocupa un
 * solo hueco. La fusión nace en NIVEL 1 pero ya rinde más que su mejor origen
 * al máximo y evolucionado (lo comprueba tools/test.js), y su escalera propia
 * (moves.js, LADDERS.fusion) sólo le da daño y velocidad: +20% y -8% de
 * recarga por nivel.
 * Las recetas son fijas (par → resultado): 30, y cada uno de los 60 movimientos
 * está en una sola. Se dan de alta en G.Moves.BY_ID con `fused: true` y no
 * evolucionan (ya son la cima). No entran en los pools.
 *
 * Cuerpo a cuerpo y embestida ya llevan el ×1,4 de data/moves.js.
 */
G.Fusions = (() => {
  const LIST = [
    { pair: ['ember', 'gust'], id: 'fire-tornado', name: 'Tormenta Ígnea', type: 'fire', kind: 'orbit',
      desc: 'Cinco tornados de fuego giran a tu alrededor quemando y empujando.',
      cd: 0.28, dmg: 93, count: 5, radius: 78, speed: 2.6, size: 12, burn: 1, knock: 50 },
    { pair: ['water-gun', 'thunder-shock'], id: 'volt-tide', name: 'Marea Voltio', type: 'electric', kind: 'chain',
      desc: 'Un rayo que salta entre ocho enemigos, los frena y los deja empapados.',
      cd: 0.85, dmg: 110, count: 8, radius: 170, slow: 0.3, wet: 1 },
    { pair: ['ice-beam', 'rock-throw'], id: 'glacial-avalanche', name: 'Alud Glacial', type: 'ice', kind: 'meteor',
      desc: 'Cinco peñascos helados caen sobre los enemigos, los frenan y los empujan.',
      cd: 1.2, dmg: 198, count: 5, radius: 52, slow: 0.6, knock: 70 },
    { pair: ['sludge', 'flame-wheel'], id: 'toxic-blaze', name: 'Llama Tóxica', type: 'fire', kind: 'trail',
      desc: 'Dejas charcos de fuego venenoso que queman e intoxican.',
      cd: 0.28, dmg: 65, radius: 32, dur: 3.2, burn: 1, poison: 1 },
    { pair: ['confusion', 'shadow-ball'], id: 'phantom-force', name: 'Golpe Umbrío', type: 'ghost', kind: 'projectile',
      desc: 'Tres esferas espectrales que persiguen y atraviesan a varios.',
      cd: 0.6, dmg: 79, speed: 300, count: 3, spread: 0.25, pierce: 3, life: 2.2, size: 9, homing: 3.5 },
    { pair: ['vine-whip', 'bite'], id: 'jaw-lock', name: 'Cepo Mandíbula', type: 'grass', kind: 'melee',
      desc: 'Lianas con colmillos en 360° que empujan y atrapan.',
      cd: 0.6, dmg: 187, radius: 72, arc: 9, knock: 160, slow: 0.5 },
    { pair: ['thunderbolt', 'hex'], id: 'volt-hex', name: 'Maldición Voltio', type: 'electric', kind: 'chain',
      desc: 'Rayo maldito que salta ocho veces y castiga el doble a quien ya sufre un estado.',
      cd: 0.9, dmg: 121, count: 8, radius: 170, hex: 2.0 },
    { pair: ['razor-leaf', 'psycho-cut'], id: 'petal-blades', name: 'Filos Pétalo', type: 'grass', kind: 'boomerang',
      desc: 'Cinco hojas psíquicas que van y vuelven cortando.',
      cd: 0.85, dmg: 54, speed: 350, count: 5, spread: 0.7, radius: 230, size: 7 },
    { pair: ['heat-wave', 'hyper-voice'], id: 'eruption-roar', name: 'Rugido Ígneo', type: 'fire', kind: 'nova',
      desc: 'Un rugido de fuego en todas direcciones que atraviesa y quema.',
      cd: 1.2, dmg: 44, speed: 260, count: 24, pierce: 2, life: 1.1, size: 8, burn: 1 },
    { pair: ['quick-attack', 'aerial-ace'], id: 'extreme-dive', name: 'Picado Extremo', type: 'flying', kind: 'dash',
      desc: 'Un picado larguísimo y ancho que corta todo lo que cruza; vuelves a tu sitio.',
      cd: 0.75, dmg: 245, radius: 200, width: 60, knock: 70 },
    { pair: ['spikes', 'toxic-spikes'], id: 'spike-field', name: 'Campo de Púas', type: 'poison', kind: 'mine',
      desc: 'Seis púas que estallan y envenenan mucho.',
      cd: 1.1, dmg: 69, count: 6, radius: 62, dur: 8, poison: 2 },
    { pair: ['will-o-wisp', 'substitute'], id: 'phantom-decoy', name: 'Señuelo Fatuo', type: 'fire', kind: 'turret',
      desc: 'Tres muñecos de fuego fatuo que disparan solos y queman.',
      cd: 3.2, dmg: 119, rate: 0.45, dur: 7, count: 3, range: 300, speed: 320, size: 7, burn: 1 },
    { pair: ['bubble', 'powder-snow'], id: 'frost-bubbles', name: 'Burbujas Gélidas', type: 'ice', kind: 'aura',
      desc: 'Una ventisca de burbujas heladas: frena mucho y deja empapado.',
      cd: 0.5, dmg: 50, radius: 110, slow: 0.7, wet: 1 },
    { pair: ['karate-chop', 'metal-claw'], id: 'iron-fist', name: 'Puño Férreo', type: 'steel', kind: 'melee',
      desc: 'Puñetazo de acero devastador que lanza por los aires.',
      cd: 0.5, dmg: 280, radius: 56, arc: 1.5, knock: 150 },
    { pair: ['hydro-pump', 'dragon-rage'], id: 'draco-cannon', name: 'Cañón Draco', type: 'dragon', kind: 'beam',
      desc: 'Un cañonazo dracónico enorme y larguísimo.',
      cd: 1.3, dmg: 221, radius: 320, width: 60 },
    { pair: ['mud-shot', 'bulldoze'], id: 'earthquake-wave', name: 'Onda Sísmica', type: 'ground', kind: 'nova',
      desc: 'Dieciséis olas de tierra que frenan y empujan.',
      cd: 1.1, dmg: 47, speed: 220, count: 16, pierce: 1, life: 1.1, size: 9, slow: 0.5, knock: 60 },
    // ---- las otras 14, para que cada uno de los 60 movimientos tenga su fusión ----
    { pair: ['tackle', 'body-slam'], id: 'colossal-slam', name: 'Golpe Colosal', type: 'normal', kind: 'melee',
      desc: 'Un placaje con todo el cuerpo en arco amplio que manda lejos a lo que toca.',
      cd: 0.7, dmg: 347, radius: 62, arc: 2.6, knock: 200 },
    { pair: ['flamethrower', 'dragon-breath'], id: 'inferno-breath', name: 'Aliento Infernal', type: 'fire', kind: 'cone',
      desc: 'Un aliento de fuego dracónico, ancho y denso, que quema y entumece.',
      cd: 0.7, dmg: 22, count: 12, arc: 1.1, speed: 390, life: 0.46, size: 7, pierce: 2, burn: 1, slow: 0.3 },
    { pair: ['fire-spin', 'leaf-storm'], id: 'blazing-petals', name: 'Pétalos Ardientes', type: 'fire', kind: 'orbit',
      desc: 'Un ciclón de pétalos en llamas gira amplio a tu alrededor.',
      cd: 0.26, dmg: 88, count: 6, radius: 84, speed: 2.7, size: 10, burn: 1 },
    { pair: ['bubble-beam', 'string-shot'], id: 'tide-net', name: 'Red Marina', type: 'water', kind: 'mine',
      desc: 'Redes empapadas en el suelo que atrapan, frenan muchísimo y dejan empapado.',
      cd: 1.0, dmg: 80, count: 4, radius: 64, dur: 8, slow: 0.7, wet: 1 },
    { pair: ['giga-drain', 'bug-buzz'], id: 'devouring-swarm', name: 'Enjambre Devorador', type: 'grass', kind: 'aura',
      desc: 'Un enjambre que roe todo lo cercano y te devuelve un poco de vida.',
      cd: 0.5, dmg: 58, radius: 100, drain: 1 },
    { pair: ['discharge', 'flash-cannon'], id: 'magnet-cannon', name: 'Cañón Magnético', type: 'electric', kind: 'beam',
      desc: 'Un rayo magnético enorme que frena a quien atraviesa.',
      cd: 1.1, dmg: 171, radius: 300, width: 50, slow: 0.3 },
    { pair: ['psybeam', 'fairy-wind'], id: 'psychic-gleam', name: 'Resplandor Psíquico', type: 'psychic', kind: 'nova',
      desc: 'Un estallido de luz psíquica en todas direcciones que busca a los enemigos.',
      cd: 1.2, dmg: 63, speed: 240, count: 18, pierce: 1, life: 1.5, size: 8, homing: 2 },
    { pair: ['psychic', 'dazzling-gleam'], id: 'moonlight-field', name: 'Luz Lunar', type: 'psychic', kind: 'aura',
      desc: 'Un campo de luz lunar muy amplio que machaca lo cercano.',
      cd: 0.45, dmg: 53, radius: 120 },
    { pair: ['poison-sting', 'bug-bite'], id: 'lethal-sting', name: 'Aguijón Letal', type: 'poison', kind: 'projectile',
      desc: 'Cuatro aguijones rapidísimos que atraviesan y envenenan mucho.',
      cd: 0.4, dmg: 84, speed: 450, count: 4, spread: 0.2, pierce: 2, life: 1.1, size: 5, poison: 2 },
    { pair: ['toxic', 'night-shade'], id: 'cursed-mist', name: 'Niebla Maldita', type: 'poison', kind: 'trail',
      desc: 'Dejas una niebla oscura que intoxica mucho a quien la cruza.',
      cd: 0.3, dmg: 36, radius: 40, dur: 4, poison: 2 },
    { pair: ['bonemerang', 'rock-slide'], id: 'bone-avalanche', name: 'Avalancha Ósea', type: 'ground', kind: 'meteor',
      desc: 'Seis huesos y rocas caen del cielo sobre los enemigos y los empujan.',
      cd: 1.2, dmg: 114, count: 6, radius: 50, knock: 80 },
    { pair: ['wing-attack', 'dark-pulse'], id: 'dark-gale', name: 'Ráfaga Oscura', type: 'flying', kind: 'nova',
      desc: 'Un vendaval de plumas oscuras que atraviesa y empuja en todas direcciones.',
      cd: 1.1, dmg: 144, speed: 270, count: 14, pierce: 1, life: 1.0, size: 8, knock: 60 },
    { pair: ['hail', 'aura-sphere'], id: 'glacial-sphere', name: 'Esfera Glacial', type: 'ice', kind: 'projectile',
      desc: 'Dos esferas de hielo que nunca fallan y frenan mucho.',
      cd: 0.65, dmg: 132, speed: 290, count: 2, spread: 0.3, pierce: 1, life: 2.0, size: 9, homing: 4, slow: 0.5 },
    { pair: ['lick', 'meteor-mash'], id: 'spectral-fist', name: 'Puño Espectral', type: 'ghost', kind: 'melee',
      desc: 'Un puñetazo espectral de acero que paraliza y empuja.',
      cd: 0.55, dmg: 218, radius: 60, arc: 2.2, slow: 0.5, knock: 90 }
  ];
  const BY = {};
  for (const f of LIST) {
    f.fused = true;
    G.Moves.register(f);
    BY[f.id] = f;
  }

  function forPair(a, b) { return LIST.find(f => (f.pair[0] === a && f.pair[1] === b) || (f.pair[0] === b && f.pair[1] === a)) || null; }

  const maxed = m => m.lvl >= m.def.maxLvl;

  /** Pares de la receta que llevas: [{ recipe, a, b }] (a y b son las instancias). */
  function held(moves) {
    const out = [];
    for (const f of LIST) {
      const a = moves.find(m => m.id === f.pair[0]), b = moves.find(m => m.id === f.pair[1]);
      if (a && b) out.push({ recipe: f, a, b });
    }
    return out;
  }

  /** Recetas posibles ahora: los dos movimientos al nivel máximo. */
  function available(moves) { return held(moves).filter(h => maxed(h.a) && maxed(h.b)); }

  /** Recetas que llevas pero a medias (alguno sin llegar al máximo): para avisar. */
  function pending(moves) { return held(moves).filter(h => !(maxed(h.a) && maxed(h.b))); }

  return { LIST, BY, forPair, held, available, pending };
})();
