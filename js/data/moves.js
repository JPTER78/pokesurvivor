/* ============ moves.js — catálogo de movimientos ============
 *
 * kind (comportamiento, implementado en systems/combat.js):
 *   projectile  dispara `count` proyectiles al enemigo más cercano
 *   melee       golpe en arco alrededor del Pokémon
 *   beam        rayo recto que atraviesa todo lo que pilla
 *   orbit       orbes que giran alrededor mientras el movimiento está activo
 *   nova        ráfaga radial en todas las direcciones
 *   aura        círculo de daño continuo alrededor
 *   buff        potencia al propio Pokémon (acumulable, caduca)
 *
 * Sólo el movimiento ACTIVO se ejecuta. Se cambia con 1-4 / Q / E.
 *
 * El icono no se guarda aquí: G.Icons lo compone (emblema del tipo +
 * insignia de la familia), ver ui/icons.js.
 *
 * Las mejoras (lvl 1 -> 5) salen de una escalera común por `kind`:
 *   mods multiplicativos -> dmg, cd, speed, radius, dur, amount, arc
 *   mods aditivos        -> count, pierce, stacks
 */
(() => {
  const LADDERS = {
    projectile: [
      { t: '+1 proyectil',                  m: { count: 1, spread: 1.4 } },
      { t: '+45% daño',                     m: { dmg: 1.45 } },
      { t: '-25% recarga',                  m: { cd: 0.75 } },
      { t: '+1 proyectil y +1 perforación',   m: { count: 1, pierce: 1, spread: 1.2 } }
    ],
    melee: [
      { t: '+40% daño',                     m: { dmg: 1.40 } },
      { t: '+25% alcance',                  m: { radius: 1.25 } },
      { t: '-25% recarga',                  m: { cd: 0.75 } },
      { t: 'Golpea en 360° y +50% daño',    m: { arc: 9, dmg: 1.50 } }
    ],
    beam: [
      { t: '+45% daño',                     m: { dmg: 1.45 } },
      { t: '+30% alcance y grosor',         m: { radius: 1.30, width: 1.30 } },
      { t: '-25% recarga',                  m: { cd: 0.75 } },
      { t: '+50% daño',                     m: { dmg: 1.50 } }
    ],
    orbit: [
      { t: '+1 orbe',                       m: { count: 1 } },
      { t: '+55% daño',                     m: { dmg: 1.55 } },
      { t: '+25% radio y gira más rápido',  m: { radius: 1.25, speed: 1.35 } },
      { t: '+1 orbe y +55% daño',           m: { count: 1, dmg: 1.55 } }
    ],
    nova: [
      { t: '+4 proyectiles',                m: { count: 4 } },
      { t: '+40% daño',                     m: { dmg: 1.40 } },
      { t: '-25% recarga',                  m: { cd: 0.75 } },
      { t: '+4 proyectiles y +1 perforación', m: { count: 4, pierce: 1 } }
    ],
    aura: [
      { t: '+30% radio',                    m: { radius: 1.30 } },
      { t: '+45% daño',                     m: { dmg: 1.45 } },
      { t: 'Golpea un 40% más a menudo',    m: { cd: 0.70 } },
      { t: '+30% radio y +50% daño',        m: { radius: 1.30, dmg: 1.50 } }
    ],
    buff: [
      { t: '+1 acumulación máxima',         m: { stacks: 1 } },
      { t: '+40% potencia',                 m: { amount: 1.40 } },
      { t: '+50% duración',                 m: { dur: 1.50 } },
      { t: '+1 acumulación y +40% potencia', m: { stacks: 1, amount: 1.40 } }
    ]
  };

  const RAW = [
    // ---------------- NORMAL (pool común a todos) ----------------
    { id: 'tackle', name: 'Placaje', type: 'normal', kind: 'melee',
      desc: 'Embiste en arco a todo lo que tengas delante.',
      cd: 0.50, dmg: 13, radius: 48, arc: 1.7, knock: 90 },

    { id: 'quick-attack', name: 'Ataque Rápido', type: 'normal', kind: 'projectile',
      desc: 'Ráfaga veloz y constante. Poco daño, mucha cadencia.',
      cd: 0.26, dmg: 8, speed: 440, count: 1, spread: 0.10, pierce: 0, life: 0.9, size: 5 },

    { id: 'swords-dance', name: 'Danza Espada', type: 'normal', kind: 'buff',
      desc: 'No hace daño: acumula ATAQUE mientras esté activo.',
      cd: 0.85, stat: 'atk', amount: 0.13, dur: 7, stacks: 5 },

    { id: 'agility', name: 'Agilidad', type: 'normal', kind: 'buff',
      desc: 'No hace daño: acumula VELOCIDAD mientras esté activo.',
      cd: 0.85, stat: 'spd', amount: 0.10, dur: 7, stacks: 5 },

    { id: 'harden', name: 'Fortaleza', type: 'normal', kind: 'buff',
      desc: 'No hace daño: acumula DEFENSA mientras esté activo.',
      cd: 0.85, stat: 'def', amount: 0.07, dur: 7, stacks: 5 },

    // ---------------- FUEGO ----------------
    { id: 'ember', name: 'Ascuas', type: 'fire', kind: 'projectile',
      desc: 'Bola de fuego al enemigo más cercano.',
      cd: 0.52, dmg: 18, speed: 310, count: 1, spread: 0.12, pierce: 0, life: 1.6, size: 7, burn: 1 },

    { id: 'flamethrower', name: 'Lanzallamas', type: 'fire', kind: 'beam',
      desc: 'Chorro de fuego que atraviesa todo en línea recta.',
      cd: 1.10, dmg: 20, radius: 210, width: 36, burn: 1 },

    { id: 'fire-spin', name: 'Giro Fuego', type: 'fire', kind: 'orbit',
      desc: 'Llamas que giran a tu alrededor. Defensa constante.',
      cd: 0.30, dmg: 14, count: 3, radius: 62, speed: 2.4, size: 9, burn: 1 },

    { id: 'heat-wave', name: 'Onda Ígnea', type: 'fire', kind: 'nova',
      desc: 'Explota en llamas en todas las direcciones.',
      cd: 1.25, dmg: 13, speed: 250, count: 10, pierce: 1, life: 1.1, size: 7, burn: 1 },

    // ---------------- AGUA ----------------
    { id: 'water-gun', name: 'Pistola Agua', type: 'water', kind: 'projectile',
      desc: 'Chorro perforante. Fiable a cualquier distancia.',
      cd: 0.44, dmg: 14, speed: 350, count: 1, spread: 0.10, pierce: 1, life: 1.5, size: 6 },

    { id: 'bubble', name: 'Burbuja', type: 'water', kind: 'nova',
      desc: 'Burbujas en abanico que ralentizan a quien tocan.',
      cd: 1.00, dmg: 9, speed: 210, count: 8, pierce: 0, life: 1.3, size: 8, slow: 0.45 },

    { id: 'hydro-pump', name: 'Hidrobomba', type: 'water', kind: 'beam',
      desc: 'Cañonazo de agua lento pero devastador.',
      cd: 1.50, dmg: 29, radius: 250, width: 30 },

    { id: 'aqua-ring', name: 'Acua Aro', type: 'water', kind: 'buff',
      desc: 'No hace daño: acumula REGENERACIÓN de vida.',
      cd: 0.90, stat: 'regen', amount: 1.6, dur: 8, stacks: 4 },

    // ---------------- PLANTA ----------------
    { id: 'vine-whip', name: 'Látigo Cepa', type: 'grass', kind: 'melee',
      desc: 'Látigos de largo alcance en arco amplio.',
      cd: 0.62, dmg: 16, radius: 68, arc: 1.3, knock: 60 },

    { id: 'razor-leaf', name: 'Hoja Afilada', type: 'grass', kind: 'projectile',
      desc: 'Abanico de tres hojas perforantes.',
      cd: 0.62, dmg: 9, speed: 330, count: 3, spread: 0.34, pierce: 1, life: 1.4, size: 6 },

    { id: 'leaf-storm', name: 'Tormenta Floral', type: 'grass', kind: 'orbit',
      desc: 'Un ciclón de hojas gira amplio a tu alrededor.',
      cd: 0.26, dmg: 14, count: 4, radius: 74, speed: 2.6, size: 8 },

    { id: 'giga-drain', name: 'Gigadrenado', type: 'grass', kind: 'aura',
      desc: 'Drena vida de todo lo cercano y te cura con cada golpe.',
      cd: 0.55, dmg: 9, radius: 76, drain: 0.5 },

    // ---------------- ELÉCTRICO ----------------
    { id: 'thunder-shock', name: 'Impactrueno', type: 'electric', kind: 'projectile',
      desc: 'Descarga rapidísima que atraviesa varios enemigos.',
      cd: 0.40, dmg: 13, speed: 480, count: 1, spread: 0.08, pierce: 2, life: 1.1, size: 5 },

    { id: 'discharge', name: 'Chispazo', type: 'electric', kind: 'aura',
      desc: 'Campo eléctrico permanente alrededor de ti.',
      cd: 0.45, dmg: 8, radius: 70 },

    { id: 'thunderbolt', name: 'Rayo', type: 'electric', kind: 'beam',
      desc: 'Un rayo instantáneo que perfora en línea.',
      cd: 0.95, dmg: 23, radius: 230, width: 22 },

    // ---------------- PSÍQUICO ----------------
    { id: 'confusion', name: 'Confusión', type: 'psychic', kind: 'projectile',
      desc: 'Onda que persigue sola a su objetivo.',
      cd: 0.58, dmg: 19, speed: 280, count: 1, spread: 0.1, pierce: 0, life: 2.2, size: 8, homing: 3.2 },

    { id: 'psybeam', name: 'Psicorrayo', type: 'psychic', kind: 'beam',
      desc: 'Rayo psíquico ancho y contundente.',
      cd: 1.15, dmg: 22, radius: 215, width: 40 },

    { id: 'psychic', name: 'Psíquico', type: 'psychic', kind: 'nova',
      desc: 'Estallido mental radial que busca enemigos.',
      cd: 1.35, dmg: 14, speed: 230, count: 12, pierce: 1, life: 1.6, size: 7, homing: 1.6 },

    // ---------------- TIPOS SECUNDARIOS ----------------
    { id: 'sludge', name: 'Residuos', type: 'poison', kind: 'projectile',
      desc: 'Lodo tóxico que envenena al impactar.',
      cd: 0.60, dmg: 17, speed: 290, count: 1, spread: 0.12, pierce: 0, life: 1.5, size: 8, poison: 1 },

    { id: 'mud-shot', name: 'Disparo Lodo', type: 'ground', kind: 'nova',
      desc: 'Salpica lodo alrededor y ralentiza.',
      cd: 1.10, dmg: 11, speed: 200, count: 7, pierce: 0, life: 1.0, size: 9, slow: 0.4 },

    { id: 'gust', name: 'Tornado', type: 'flying', kind: 'orbit',
      desc: 'Remolinos de viento que te escoltan.',
      cd: 0.26, dmg: 13, count: 3, radius: 72, speed: 2.8, size: 8, knock: 40 },

    { id: 'wing-attack', name: 'Ataque Ala', type: 'flying', kind: 'melee',
      desc: 'Barrido de alas amplio que empuja.',
      cd: 0.55, dmg: 14, radius: 58, arc: 1.9, knock: 70 },

    // ---------------- NORMAL (extra) ----------------
    { id: 'body-slam', name: 'Golpe Cuerpo', type: 'normal', kind: 'melee',
      desc: 'Placaje con todo el peso: lento, corto y brutal.',
      cd: 0.95, dmg: 30, radius: 46, arc: 2.2, knock: 140 },

    { id: 'hyper-voice', name: 'Vozarrón', type: 'normal', kind: 'nova',
      desc: 'Onda sonora que sale en todas direcciones.',
      cd: 1.15, dmg: 12, speed: 260, count: 9, pierce: 1, life: 0.9, size: 7 },

    // ---------------- VENENO (extra) ----------------
    { id: 'poison-sting', name: 'Picotazo Veneno', type: 'poison', kind: 'projectile',
      desc: 'Aguijón rápido que envenena.',
      cd: 0.34, dmg: 8, speed: 420, count: 1, spread: 0.08, pierce: 0, life: 1.0, size: 4, poison: 1 },

    { id: 'toxic', name: 'Tóxico', type: 'poison', kind: 'aura',
      desc: 'Nube venenosa a tu alrededor que intoxica.',
      cd: 0.6, dmg: 5, radius: 74, poison: 1 },

    // ---------------- TIERRA (extra) ----------------
    { id: 'bulldoze', name: 'Terratemblor', type: 'ground', kind: 'aura',
      desc: 'Sacude el suelo: daña y frena a lo cercano.',
      cd: 0.7, dmg: 11, radius: 80, slow: 0.35 },

    // ---------------- BICHO ----------------
    { id: 'bug-bite', name: 'Picadura', type: 'bug', kind: 'melee',
      desc: 'Mordisco rápido en arco corto.',
      cd: 0.42, dmg: 11, radius: 44, arc: 1.6, knock: 40 },

    { id: 'string-shot', name: 'Disparo Demora', type: 'bug', kind: 'nova',
      desc: 'Hilos pegajosos en todas direcciones que frenan mucho.',
      cd: 1.05, dmg: 7, speed: 220, count: 8, pierce: 1, life: 1.0, size: 6, slow: 0.6 },

    { id: 'bug-buzz', name: 'Zumbido', type: 'bug', kind: 'aura',
      desc: 'Vibración constante que machaca lo cercano.',
      cd: 0.45, dmg: 8, radius: 66 },

    // ---------------- ROCA ----------------
    { id: 'rock-throw', name: 'Lanzarrocas', type: 'rock', kind: 'projectile',
      desc: 'Pedrusco pesado que empuja al enemigo.',
      cd: 0.7, dmg: 24, speed: 260, count: 1, spread: 0.12, pierce: 0, life: 1.4, size: 9, knock: 90 },

    { id: 'rock-slide', name: 'Avalancha', type: 'rock', kind: 'nova',
      desc: 'Lluvia de rocas alrededor tuyo.',
      cd: 1.3, dmg: 16, speed: 200, count: 8, pierce: 1, life: 1.0, size: 8, knock: 50 },

    // ---------------- HIELO ----------------
    { id: 'ice-beam', name: 'Rayo Hielo', type: 'ice', kind: 'beam',
      desc: 'Rayo helado que congela casi del todo.',
      cd: 1.1, dmg: 20, radius: 220, width: 30, slow: 0.7 },

    { id: 'powder-snow', name: 'Nieve Polvo', type: 'ice', kind: 'aura',
      desc: 'Ventisca a tu alrededor que ralentiza.',
      cd: 0.55, dmg: 8, radius: 76, slow: 0.45 },

    // ---------------- LUCHA ----------------
    { id: 'karate-chop', name: 'Golpe Kárate', type: 'fighting', kind: 'melee',
      desc: 'Golpe seco y potente al frente.',
      cd: 0.5, dmg: 18, radius: 50, arc: 1.2, knock: 110 },

    { id: 'aura-sphere', name: 'Esfera Aural', type: 'fighting', kind: 'projectile',
      desc: 'Esfera de energía que nunca falla.',
      cd: 0.62, dmg: 17, speed: 300, count: 1, spread: 0.1, pierce: 0, life: 2.0, size: 8, homing: 4 },

    // ---------------- FANTASMA ----------------
    { id: 'lick', name: 'Lengüetazo', type: 'ghost', kind: 'melee',
      desc: 'Lametazo espectral que paraliza un poco.',
      cd: 0.48, dmg: 12, radius: 48, arc: 1.8, slow: 0.4 },

    { id: 'shadow-ball', name: 'Bola Sombra', type: 'ghost', kind: 'projectile',
      desc: 'Esfera oscura que atraviesa a varios.',
      cd: 0.66, dmg: 19, speed: 280, count: 1, spread: 0.1, pierce: 2, life: 1.6, size: 9 },

    // ---------------- DRAGÓN ----------------
    { id: 'dragon-rage', name: 'Furia Dragón', type: 'dragon', kind: 'beam',
      desc: 'Llamarada dracónica en línea recta.',
      cd: 1.0, dmg: 24, radius: 230, width: 34 },

    { id: 'dragon-dance', name: 'Danza Dragón', type: 'dragon', kind: 'buff',
      desc: 'No hace daño: acumula ATAQUE más rápido que Danza Espada.',
      cd: 0.7, stat: 'atk', amount: 0.11, dur: 7, stacks: 5 },

    // ---------------- HADA ----------------
    { id: 'fairy-wind', name: 'Viento Feérico', type: 'fairy', kind: 'nova',
      desc: 'Brisa mágica en todas direcciones.',
      cd: 1.0, dmg: 11, speed: 230, count: 10, pierce: 0, life: 1.2, size: 7 },

    { id: 'dazzling-gleam', name: 'Brillo Mágico', type: 'fairy', kind: 'aura',
      desc: 'Destello a tu alrededor.',
      cd: 0.5, dmg: 9, radius: 72 },

    // ---------------- ACERO ----------------
    { id: 'metal-claw', name: 'Garra Metal', type: 'steel', kind: 'melee',
      desc: 'Zarpazo de acero en arco.',
      cd: 0.5, dmg: 15, radius: 50, arc: 1.6, knock: 60 },

    { id: 'flash-cannon', name: 'Foco Resplandor', type: 'steel', kind: 'beam',
      desc: 'Rayo de luz metálica que perfora.',
      cd: 1.05, dmg: 23, radius: 220, width: 30 },

    // ---------------- SINIESTRO ----------------
    { id: 'bite', name: 'Mordisco', type: 'dark', kind: 'melee',
      desc: 'Dentellada rápida que hace retroceder.',
      cd: 0.45, dmg: 14, radius: 46, arc: 1.5, knock: 70 },

    { id: 'dark-pulse', name: 'Pulso Umbrío', type: 'dark', kind: 'nova',
      desc: 'Onda de energía oscura en todas direcciones.',
      cd: 1.15, dmg: 14, speed: 240, count: 10, pierce: 1, life: 1.1, size: 8 },

    { id: 'night-shade', name: 'Tinieblas', type: 'dark', kind: 'aura',
      desc: 'Una sombra te rodea y consume lo cercano.',
      cd: 0.5, dmg: 9, radius: 72 }
  ];

  // Pool de movimientos por tipo. El pool `normal` lo tienen todos.
  const POOL = {};
  for (const m of RAW) (POOL[m.type] = POOL[m.type] || []).push(m.id);

  const BY_ID = {};
  for (const m of RAW) {
    m.ups = LADDERS[m.kind];
    m.maxLvl = m.ups.length + 1;
    BY_ID[m.id] = m;
  }

  /** Movimientos que este Pokémon puede aprender (sus tipos + normal). */
  function poolFor(mon) {
    const ids = new Set(POOL.normal);
    for (const t of mon.types) for (const id of (POOL[t] || [])) ids.add(id);
    return [...ids];
  }

  /**
   * Instancia de movimiento en una run: los números base de `def` con todas
   * las mejoras de la escalera hasta `lvl` ya aplicadas.
   */
  function instance(id, lvl = 1) {
    const def = BY_ID[id];
    const s = Object.assign({}, def, { id, def, lvl, t: 0 });
    delete s.ups;
    for (let i = 0; i < lvl - 1; i++) applyMods(s, def.ups[i].m);
    return s;
  }

  const MULT = ['dmg', 'cd', 'speed', 'radius', 'dur', 'amount', 'arc', 'width', 'spread', 'life', 'size'];
  const ADD = ['count', 'pierce', 'stacks'];

  function applyMods(s, m) {
    for (const k in m) {
      if (MULT.includes(k) && s[k] != null) s[k] *= m[k];
      else if (ADD.includes(k)) s[k] = (s[k] || 0) + m[k];
      else s[k] = m[k];
    }
  }

  /** Sube de nivel una instancia ya creada. */
  function levelUp(s) {
    if (s.lvl >= s.def.maxLvl) return false;
    applyMods(s, s.def.ups[s.lvl - 1].m);
    s.lvl++;
    return true;
  }

  /** Texto de la próxima mejora, para la carta de subida de nivel. */
  function nextUpText(s) {
    return s.lvl >= s.def.maxLvl ? null : s.def.ups[s.lvl - 1].t;
  }

  /** Movimiento inicial según el tipo principal (si el Pokémon no trae uno). */
  const START = {
    fire: 'ember', water: 'water-gun', grass: 'vine-whip', electric: 'thunder-shock',
    psychic: 'confusion', poison: 'sludge', ground: 'mud-shot', flying: 'gust',
    bug: 'bug-bite', rock: 'rock-throw', ice: 'ice-beam', fighting: 'karate-chop',
    ghost: 'shadow-ball', dragon: 'dragon-rage', fairy: 'fairy-wind', steel: 'metal-claw',
    dark: 'bite', normal: 'tackle'
  };
  function startFor(mon) {
    if (mon.start && BY_ID[mon.start]) return mon.start;
    for (const t of mon.types) if (START[t]) return START[t];
    return 'tackle';
  }

  // ---------------- evolución de movimientos ----------------
  /*
   * Un movimiento al NIVEL MÁXIMO evoluciona si en esa run has cogido alguna
   * vez la mejora de su condición (`needs`, un id de LevelUp.STATS). Sale una
   * carta dorada. Los potenciadores (buff) no evolucionan.
   */
  const NEED_NAME = { hp: 'Vigor', atk: 'Potencia', spd: 'Carrera', cd: 'Reflejos', def: 'Coraza',
                      rgn: 'Síntesis', mag: 'Imán', xp: 'Aprendizaje' };
  const EVO = {
    'tackle': ['Derribo', 'hp'],             'quick-attack': ['Velocidad Extrema', 'spd'],
    'body-slam': ['Gigaimpacto', 'atk'],     'hyper-voice': ['Alboroto', 'cd'],
    'ember': ['Llamarada', 'atk'],           'flamethrower': ['Sofoco', 'cd'],
    'fire-spin': ['Fuego Sagrado', 'rgn'],   'heat-wave': ['Erupción', 'hp'],
    'water-gun': ['Escaldar', 'atk'],        'bubble': ['Surf', 'spd'],
    'hydro-pump': ['Hidrocañón', 'atk'],     'vine-whip': ['Latigazo', 'atk'],
    'razor-leaf': ['Lluevehojas', 'cd'],     'leaf-storm': ['Danza Pétalo', 'rgn'],
    'giga-drain': ['Planta Feroz', 'hp'],    'thunder-shock': ['Trueno', 'atk'],
    'discharge': ['Campo Eléctrico', 'def'], 'thunderbolt': ['Electrocañón', 'cd'],
    'confusion': ['Psicocarga', 'cd'],       'psybeam': ['Premonición', 'atk'],
    'psychic': ['Vasta Fuerza', 'mag'],      'sludge': ['Bomba Lodo', 'atk'],
    'poison-sting': ['Puya Nociva', 'spd'],  'toxic': ['Gas Venenoso', 'rgn'],
    'mud-shot': ['Tierra Viva', 'atk'],      'bulldoze': ['Terremoto', 'atk'],
    'gust': ['Vendaval', 'spd'],             'wing-attack': ['Pájaro Osado', 'atk'],
    'bug-bite': ['Tijera X', 'atk'],         'string-shot': ['Red Viscosa', 'cd'],
    'bug-buzz': ['Enjambre', 'rgn'],         'rock-throw': ['Roca Afilada', 'atk'],
    'rock-slide': ['Trampa Rocas', 'cd'],    'ice-beam': ['Ventisca', 'atk'],
    'powder-snow': ['Viento Hielo', 'spd'],  'karate-chop': ['A Bocajarro', 'atk'],
    'aura-sphere': ['Onda Certera', 'cd'],   'lick': ['Puño Sombra', 'atk'],
    'shadow-ball': ['Golpe Fantasma', 'cd'], 'dragon-rage': ['Cometa Draco', 'atk'],
    'fairy-wind': ['Fuerza Lunar', 'atk'],   'dazzling-gleam': ['Campo de Niebla', 'rgn'],
    'metal-claw': ['Cabeza de Hierro', 'atk'], 'flash-cannon': ['Rayo Metálico', 'def'],
    'bite': ['Triturar', 'atk'],             'dark-pulse': ['Alarido', 'spd'],
    'night-shade': ['Pesadilla', 'rgn']
  };
  // Lo que gana al evolucionar, según cómo funcione.
  const EVO_MODS = {
    projectile: { t: '×1,8 daño, +2 proyectiles, +2 perforación y más grandes', m: { dmg: 1.8, count: 2, pierce: 2, size: 1.3, spread: 1.1 } },
    melee:      { t: '×1,9 daño, más alcance y golpea en 360°', m: { dmg: 1.9, radius: 1.3, arc: 9 } },
    beam:       { t: '×1,8 daño, rayo un 50% más grueso y más largo', m: { dmg: 1.8, width: 1.5, radius: 1.2, cd: 0.85 } },
    orbit:      { t: '+2 orbes, ×1,7 daño y más radio', m: { count: 2, dmg: 1.7, radius: 1.15 } },
    nova:       { t: '+6 proyectiles, ×1,6 daño y +1 perforación', m: { count: 6, dmg: 1.6, pierce: 1 } },
    aura:       { t: '×1,8 daño y un 35% más de radio', m: { dmg: 1.8, radius: 1.35 } }
  };

  /** ¿Puede evolucionar ya? → { name, needs, needName, text, ready } o null */
  function evoInfo(m, statsTaken) {
    const e = EVO[m.id];
    if (!e || m.evolved || m.lvl < m.def.maxLvl || !EVO_MODS[m.kind]) return null;
    const [name, needs] = e;
    return { name, needs, needName: NEED_NAME[needs], text: EVO_MODS[m.kind].t,
             ready: !!(statsTaken && statsTaken[needs]) };
  }

  /** Evoluciona una instancia (cambia nombre y potencia; sigue siendo del mismo tipo). */
  function evolve(m) {
    const e = EVO[m.id];
    if (!e || m.evolved) return false;
    applyMods(m, EVO_MODS[m.kind].m);
    m.baseName = m.name;
    m.name = e[0];
    m.evolved = true;
    return true;
  }

  G.Moves = { ALL: RAW, BY_ID, POOL, poolFor, instance, levelUp, nextUpText, startFor,
              EVO, NEED_NAME, evoInfo, evolve };
})();
