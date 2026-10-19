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
 *   ---- desde 2026-10-10 (mismos gráficos, otra forma de jugar) ----
 *   boomerang   sale hacia el enemigo y vuelve a ti, golpeando a la ida y a la vuelta
 *   chain       golpea a uno y salta a los `count` siguientes más cercanos
 *   mine        minas en el suelo que estallan al pisarlas
 *   meteor      caen `count` meteoros sobre enemigos cercanos (avisa la sombra)
 *   turret      deja algo que dispara solo durante `dur` segundos
 *   dash        cruzas hacia el enemigo golpeando todo el camino (sin recibir daño)
 *   trail       vas dejando charcos que dañan a lo que los pisa
 *   cone        muchos disparos cortos en abanico (aliento, chorro...)
 *   ---- desde 2026-10-16 (movimientos de estado de los juegos) ----
 *   debuff      no hace daño: los enemigos de alrededor pegan menos, reciben más
 *               daño, van más lentos, se envenenan o se queman (`eff`)
 *   weather     no hace daño: invoca un clima un rato, si no hay otro (`w`)
 *
 * Catálogo: los 64 de aquí ("curados") más todos los de los juegos que
 * genera tools/fetch_moves.py (js/data/moves-gen.js), que copian la forma de
 * un curado (`tpl`). Cada Pokémon sólo puede usar los de su lista de
 * aprendizaje (js/data/learnsets.js) hasta su nivel, más los que se le
 * enseñen con MT: ver poolFor().
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
    boomerang: [
      { t: '+1 bumerán',                    m: { count: 1 } },
      { t: '+45% daño',                     m: { dmg: 1.45 } },
      { t: '+30% alcance',                  m: { radius: 1.30 } },
      { t: '+1 bumerán y +40% daño',        m: { count: 1, dmg: 1.40 } }
    ],
    chain: [
      { t: '+2 saltos',                     m: { count: 2 } },
      { t: '+45% daño',                     m: { dmg: 1.45 } },
      { t: '-25% recarga',                  m: { cd: 0.75 } },
      { t: '+2 saltos y +40% daño',         m: { count: 2, dmg: 1.40 } }
    ],
    mine: [
      { t: '+1 mina',                       m: { count: 1 } },
      { t: '+50% daño',                     m: { dmg: 1.50 } },
      { t: '+30% radio de explosión',       m: { radius: 1.30 } },
      { t: '+1 mina y -25% recarga',        m: { count: 1, cd: 0.75 } }
    ],
    meteor: [
      { t: '+1 meteoro',                    m: { count: 1 } },
      { t: '+45% daño',                     m: { dmg: 1.45 } },
      { t: '+30% radio',                    m: { radius: 1.30 } },
      { t: '+2 meteoros y -20% recarga',    m: { count: 2, cd: 0.80 } }
    ],
    turret: [
      { t: '+50% daño',                     m: { dmg: 1.50 } },
      { t: 'Dispara un 35% más rápido',     m: { rate: 0.74 } },
      { t: '+1 a la vez',                   m: { count: 1 } },
      { t: '+50% duración y +40% daño',     m: { dur: 1.50, dmg: 1.40 } }
    ],
    dash: [
      { t: '+40% daño',                     m: { dmg: 1.40 } },
      { t: '+30% distancia',                m: { radius: 1.30 } },
      { t: '-25% recarga',                  m: { cd: 0.75 } },
      { t: '+60% daño y más ancho',         m: { dmg: 1.60, width: 1.40 } }
    ],
    trail: [
      { t: '+40% daño',                     m: { dmg: 1.40 } },
      { t: '+40% duración',                 m: { dur: 1.40 } },
      { t: 'Charcos un 30% más grandes',    m: { radius: 1.30 } },
      { t: '+50% daño y +30% radio',        m: { dmg: 1.50, radius: 1.30 } }
    ],
    cone: [
      { t: '+3 disparos',                   m: { count: 3 } },
      { t: '+40% daño',                     m: { dmg: 1.40 } },
      { t: '+30% alcance',                  m: { life: 1.30 } },
      { t: '+3 disparos y +1 perforación',  m: { count: 3, pierce: 1 } }
    ],
    buff: [
      { t: '+1 acumulación máxima',         m: { stacks: 1 } },
      { t: '+40% potencia',                 m: { amount: 1.40 } },
      { t: '+50% duración',                 m: { dur: 1.50 } },
      { t: '+1 acumulación y +40% potencia', m: { stacks: 1, amount: 1.40 } }
    ],
    debuff: [
      { t: '+30% radio',                    m: { radius: 1.30 } },
      { t: '+40% potencia',                 m: { amount: 1.40 } },
      { t: '-25% recarga',                  m: { cd: 0.75 } },
      { t: '+30% radio y +40% potencia',    m: { radius: 1.30, amount: 1.40 } }
    ],
    weather: [
      { t: '+50% duración',                 m: { dur: 1.50 } },
      { t: '-25% recarga',                  m: { cd: 0.75 } },
      { t: '+50% duración',                 m: { dur: 1.50 } },
      { t: '-25% recarga y +30% duración',  m: { cd: 0.75, dur: 1.30 } }
    ]
  };

  const RAW = [
    // ---------------- NORMAL (pool común a todos) ----------------
    { id: 'tackle', name: 'Placaje', type: 'normal', kind: 'melee',
      desc: 'Embiste en arco a todo lo que tengas delante.',
      cd: 0.50, dmg: 13, radius: 48, arc: 1.7, knock: 90 },

    { id: 'quick-attack', name: 'Ataque Rápido', type: 'normal', kind: 'dash',
      desc: 'Cruzas como un rayo hacia el enemigo y golpeas todo el camino.',
      cd: 0.75, dmg: 20, radius: 110, width: 34, knock: 40 },

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

    { id: 'flamethrower', name: 'Lanzallamas', type: 'fire', kind: 'cone',
      desc: 'Chorro de llamas en abanico corto que quema.',
      cd: 0.70, dmg: 7, count: 7, arc: 0.9, speed: 380, life: 0.42, size: 6, pierce: 1, burn: 1 },

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

    { id: 'razor-leaf', name: 'Hoja Afilada', type: 'grass', kind: 'boomerang',
      desc: 'Dos hojas que van y vuelven cortando a la ida y a la vuelta.',
      cd: 0.90, dmg: 10, speed: 330, count: 2, spread: 0.5, radius: 210, size: 6 },

    { id: 'leaf-storm', name: 'Tormenta Floral', type: 'grass', kind: 'orbit',
      desc: 'Un ciclón de hojas gira amplio a tu alrededor.',
      cd: 0.26, dmg: 14, count: 4, radius: 74, speed: 2.6, size: 8 },

    // (Antes Gigadrenado: curaba con cada golpe y estaba roto. Mismo id para no romper partidas.)
    { id: 'giga-drain', name: 'Hierba Lazo', type: 'grass', kind: 'aura',
      desc: 'Raíces que atrapan y machacan todo lo que tienes cerca.',
      cd: 0.55, dmg: 9, radius: 76 },

    // ---------------- ELÉCTRICO ----------------
    { id: 'thunder-shock', name: 'Impactrueno', type: 'electric', kind: 'projectile',
      desc: 'Descarga rapidísima que atraviesa varios enemigos.',
      cd: 0.40, dmg: 13, speed: 480, count: 1, spread: 0.08, pierce: 2, life: 1.1, size: 5 },

    { id: 'discharge', name: 'Chispazo', type: 'electric', kind: 'aura',
      desc: 'Campo eléctrico permanente alrededor de ti.',
      cd: 0.45, dmg: 8, radius: 70 },

    { id: 'thunderbolt', name: 'Rayo', type: 'electric', kind: 'chain',
      desc: 'Un rayo que salta de un enemigo a otro.',
      cd: 0.95, dmg: 21, count: 4, radius: 140 },

    // ---------------- PSÍQUICO ----------------
    // (11-10-2026: -22/-30 % de daño y persiguen menos; llenaban el ranking.)
    { id: 'confusion', name: 'Confusión', type: 'psychic', kind: 'projectile',
      desc: 'Onda que persigue sola a su objetivo.',
      cd: 0.58, dmg: 13, speed: 280, count: 1, spread: 0.1, pierce: 0, life: 2.2, size: 8, homing: 2.0 },

    { id: 'psybeam', name: 'Psicorrayo', type: 'psychic', kind: 'beam',
      desc: 'Rayo psíquico ancho y contundente.',
      cd: 1.15, dmg: 17, radius: 215, width: 40 },

    { id: 'psychic', name: 'Psíquico', type: 'psychic', kind: 'nova',
      desc: 'Estallido mental radial que busca enemigos.',
      cd: 1.35, dmg: 10, speed: 230, count: 12, pierce: 1, life: 1.6, size: 7, homing: 1.0 },

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

    { id: 'toxic', name: 'Tóxico', type: 'poison', kind: 'trail',
      desc: 'Vas dejando charcos de veneno que intoxican a quien los pisa.',
      cd: 0.3, dmg: 6, radius: 26, dur: 3, poison: 1 },

    // ---------------- TIERRA (extra) ----------------
    { id: 'bulldoze', name: 'Terratemblor', type: 'ground', kind: 'aura',
      desc: 'Sacude el suelo: daña y frena a lo cercano.',
      cd: 0.7, dmg: 11, radius: 80, slow: 0.35 },

    // ---------------- BICHO ----------------
    { id: 'bug-bite', name: 'Picadura', type: 'bug', kind: 'melee',
      desc: 'Mordisco rápido en arco corto.',
      cd: 0.42, dmg: 11, radius: 44, arc: 1.6, knock: 40 },

    { id: 'string-shot', name: 'Disparo Demora', type: 'bug', kind: 'mine',
      desc: 'Deja telarañas en el suelo que atrapan y frenan mucho al que las pisa.',
      cd: 1.1, dmg: 14, count: 2, radius: 56, dur: 7, slow: 0.6 },

    { id: 'bug-buzz', name: 'Zumbido', type: 'bug', kind: 'aura',
      desc: 'Vibración constante que machaca lo cercano.',
      cd: 0.45, dmg: 8, radius: 66 },

    // ---------------- ROCA ----------------
    { id: 'rock-throw', name: 'Lanzarrocas', type: 'rock', kind: 'projectile',
      desc: 'Pedrusco pesado que empuja al enemigo.',
      cd: 0.7, dmg: 24, speed: 260, count: 1, spread: 0.12, pierce: 0, life: 1.4, size: 9, knock: 90 },

    { id: 'rock-slide', name: 'Avalancha', type: 'rock', kind: 'meteor',
      desc: 'Caen rocas del cielo sobre los enemigos cercanos.',
      cd: 1.3, dmg: 21, count: 3, radius: 46, knock: 50 },     // (12-10-2026: era 26; mataba el doble que la media)

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
      cd: 0.5, dmg: 9, radius: 72 },

    // ---------------- NUEVOS (2026-10-10): mismas formas, otras mecánicas ----------------
    { id: 'bonemerang', name: 'Huesomerang', type: 'ground', kind: 'boomerang',
      desc: 'Un hueso que va y vuelve golpeando fuerte.',
      cd: 0.95, dmg: 16, speed: 300, count: 1, radius: 230, size: 8, knock: 40 },

    { id: 'psycho-cut', name: 'Psicocorte', type: 'psychic', kind: 'boomerang',
      desc: 'Cuchillas psíquicas que vuelven a ti.',
      cd: 0.8, dmg: 9, speed: 360, count: 2, spread: 0.6, radius: 200, size: 7 },

    { id: 'spikes', name: 'Púas', type: 'ground', kind: 'mine',
      desc: 'Siembra púas que estallan al pisarlas.',
      cd: 1.2, dmg: 18, count: 2, radius: 60, dur: 8 },

    { id: 'toxic-spikes', name: 'Púas Tóxicas', type: 'poison', kind: 'mine',
      desc: 'Púas venenosas que envenenan mucho al estallar.',
      cd: 1.1, dmg: 11, count: 2, radius: 56, dur: 8, poison: 2 },

    { id: 'hail', name: 'Granizo', type: 'ice', kind: 'meteor',
      desc: 'Bolas de hielo caen sobre los enemigos y los frenan.',
      cd: 1.2, dmg: 18, count: 4, radius: 40, slow: 0.4 },

    { id: 'meteor-mash', name: 'Puño Meteoro', type: 'steel', kind: 'meteor',
      desc: 'Dos meteoros de acero que aplastan donde caen.',
      cd: 1.4, dmg: 34, count: 2, radius: 54, knock: 80 },

    { id: 'will-o-wisp', name: 'Fuego Fatuo', type: 'fire', kind: 'turret',
      desc: 'Deja una llama flotante que dispara sola y quema.',
      cd: 3.5, dmg: 15, rate: 0.55, dur: 6, count: 1, range: 300, speed: 300, size: 7, burn: 1 },

    { id: 'substitute', name: 'Sustituto', type: 'normal', kind: 'turret',
      desc: 'Un muñeco que se queda disparando por ti.',
      cd: 4.0, dmg: 14, rate: 0.4, dur: 6, count: 1, range: 280, speed: 320, size: 6 },

    { id: 'aerial-ace', name: 'Golpe Aéreo', type: 'flying', kind: 'dash',
      desc: 'Te lanzas en picado y cortas todo lo que cruzas.',
      cd: 0.75, dmg: 18, radius: 120, width: 40, knock: 60 },

    { id: 'flame-wheel', name: 'Rueda Fuego', type: 'fire', kind: 'trail',
      desc: 'Corres envuelto en fuego y dejas un rastro de llamas.',
      cd: 0.28, dmg: 10, radius: 28, dur: 2.6, burn: 1 },

    { id: 'bubble-beam', name: 'Rayo Burbuja', type: 'water', kind: 'cone',
      desc: 'Chorro de burbujas en abanico corto que frena.',
      cd: 0.65, dmg: 6, count: 7, arc: 1.0, speed: 340, life: 0.45, size: 6, slow: 0.3 },

    { id: 'hex', name: 'Infortunio', type: 'ghost', kind: 'chain',
      desc: 'Maldición que salta entre enemigos. Mucho más daño si están quemados, envenenados o frenados.',
      cd: 0.9, dmg: 17, count: 4, radius: 150, hex: 1.7 }
  ];

  // Cuerpo a cuerpo (12-10-2026): +20 % de daño y +25 % de alcance y de arco
  // (y -25 % de daño recibido mientras sea tu ataque activo, en player.js).
  // Pegaban bien, pero había que arriesgar mucho más que con los de distancia.
  for (const m of RAW) {
    if (m.kind !== 'melee') continue;
    m.dmg = Math.round(m.dmg * 1.2);
    m.radius = Math.round(m.radius * 1.25);
    if (m.arc) m.arc = Math.min(3, +(m.arc * 1.25).toFixed(2));
  }

  // Pool de movimientos por tipo. El pool `normal` lo tienen todos.
  const POOL = {};
  for (const m of RAW) (POOL[m.type] = POOL[m.type] || []).push(m.id);

  const BY_ID = {};
  for (const m of RAW) {
    m.ups = LADDERS[m.kind];
    m.maxLvl = m.ups.length + 1;
    BY_ID[m.id] = m;
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

  const MULT = ['dmg', 'cd', 'speed', 'radius', 'dur', 'amount', 'arc', 'width', 'spread', 'life', 'size', 'rate'];
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

  /** Movimientos que no hacen daño (como mucho 2 en una partida; ver levelup.js). */
  const STATUS_KINDS = ['buff', 'debuff', 'weather'];
  const isStatus = id => !!BY_ID[id] && STATUS_KINDS.includes(BY_ID[id].kind);

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
    'night-shade': ['Pesadilla', 'rgn'],
    'bonemerang': ['Ataque Óseo', 'atk'],    'psycho-cut': ['Psicocolmillo', 'cd'],
    'spikes': ['Fisura', 'atk'],             'toxic-spikes': ['Lanza Mugre', 'rgn'],
    'hail': ['Alud', 'cd'],                  'meteor-mash': ['Bomba Imán', 'atk'],
    'will-o-wisp': ['Infierno', 'cd'],       'substitute': ['Doble Equipo', 'def'],
    'aerial-ace': ['Acróbata', 'spd'],       'flame-wheel': ['Envite Ígneo', 'spd'],
    'bubble-beam': ['Acua Cola', 'atk'],     'hex': ['Poltergeist', 'mag']
  };
  // Lo que gana al evolucionar, según cómo funcione.
  const EVO_MODS = {
    projectile: { t: '×1,8 daño, +2 proyectiles, +2 perforación y más grandes', m: { dmg: 1.8, count: 2, pierce: 2, size: 1.3, spread: 1.1 } },
    melee:      { t: '×1,9 daño, más alcance y golpea en 360°', m: { dmg: 1.9, radius: 1.3, arc: 9 } },
    beam:       { t: '×1,8 daño, rayo un 50% más grueso y más largo', m: { dmg: 1.8, width: 1.5, radius: 1.2, cd: 0.85 } },
    orbit:      { t: '+2 orbes, ×1,7 daño y más radio', m: { count: 2, dmg: 1.7, radius: 1.15 } },
    nova:       { t: '+6 proyectiles, ×1,6 daño y +1 perforación', m: { count: 6, dmg: 1.6, pierce: 1 } },
    aura:       { t: '×1,8 daño y un 35% más de radio', m: { dmg: 1.8, radius: 1.35 } },
    boomerang:  { t: '×1,8 daño, +1 bumerán y más alcance', m: { dmg: 1.8, count: 1, radius: 1.2, size: 1.2 } },
    chain:      { t: '×1,7 daño y +3 saltos', m: { dmg: 1.7, count: 3, radius: 1.2 } },
    mine:       { t: '×1,8 daño, +2 minas y explosión más grande', m: { dmg: 1.8, count: 2, radius: 1.25 } },
    meteor:     { t: '×1,7 daño, +2 meteoros y más radio', m: { dmg: 1.7, count: 2, radius: 1.2 } },
    turret:     { t: '×1,8 daño, +1 a la vez y dispara más rápido', m: { dmg: 1.8, count: 1, rate: 0.8 } },
    dash:       { t: '×1,9 daño, más distancia y menos recarga', m: { dmg: 1.9, radius: 1.25, cd: 0.8 } },
    trail:      { t: '×1,8 daño, charcos más grandes y duraderos', m: { dmg: 1.8, radius: 1.25, dur: 1.3 } },
    cone:       { t: '×1,7 daño, +4 disparos y +1 perforación', m: { dmg: 1.7, count: 4, pierce: 1 } }
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

  // El logro "evolucionarlos todos" cuenta sólo los curados (con los de los juegos serían cientos).
  const EVO_GOAL = Object.keys(EVO).length;

  // ---------------- movimientos de los juegos (moves-gen.js) ----------------
  /*
   * Cada uno copia la forma de un curado (`tpl`: velocidad, tamaño, recarga...)
   * con su propio daño, tipo y efectos. Los nombres y textos van en español;
   * en inglés se añaden al diccionario de G.I18n.
   */
  const KIND_DESC = {
    projectile: ['Disparo al enemigo más cercano.', 'Shot at the nearest enemy.'],
    melee:      ['Golpe en arco a lo que tengas delante.', 'Arc strike at whatever is in front of you.'],
    beam:       ['Rayo recto que atraviesa todo.', 'Straight beam that pierces everything.'],
    orbit:      ['Gira a tu alrededor sin parar.', 'Circles around you nonstop.'],
    nova:       ['Estalla en todas direcciones.', 'Bursts in every direction.'],
    aura:       ['Daña sin parar todo lo que tienes cerca.', 'Constantly hurts everything near you.'],
    boomerang:  ['Sale hacia el enemigo y vuelve a ti.', 'Flies at the enemy and comes back to you.'],
    chain:      ['Salta de un enemigo a otro.', 'Jumps from one enemy to the next.'],
    mine:       ['Deja trampas que estallan al pisarlas.', 'Leaves traps that blow up when stepped on.'],
    meteor:     ['Cae del cielo sobre los enemigos cercanos.', 'Falls from the sky onto nearby enemies.'],
    turret:     ['Deja algo que dispara solo un rato.', 'Leaves something that shoots on its own for a while.'],
    dash:       ['Cruzas hacia el enemigo golpeando todo el camino.', 'You dash at the enemy, hitting everything on the way.'],
    trail:      ['Vas dejando un rastro que daña.', 'Leaves a damaging trail behind you.'],
    cone:       ['Abanico corto de disparos.', 'Short fan of shots.']
  };
  const FX_DESC = {
    burn: ['Quema.', 'Burns.'], poison: ['Envenena.', 'Poisons.'], slow: ['Frena.', 'Slows.'],
    drain: ['Te cura un poco al golpear.', 'Heals you a little on hit.'],
    recoil: ['Te hace algo de daño a ti.', 'Hurts you a little too.'],
    self: ['Te cuesta mucha vida.', 'Costs you a lot of HP.'],
    crit: ['Más golpes críticos.', 'More critical hits.'],
    weak: ['Los golpeados pegan menos.', 'Enemies it hits deal less damage.'],
    armor: ['Los golpeados reciben más daño.', 'Enemies it hits take more damage.'],
    slowcd: ['Lento pero fuerte.', 'Slow but strong.']
  };
  const BUFF_DESC = {
    atk: ['No hace daño: acumula ATAQUE (movimientos físicos) mientras esté activo.', 'Deals no damage: builds ATTACK (physical moves) while active.'],
    spa: ['No hace daño: acumula AT. ESPECIAL (movimientos especiales) mientras esté activo.', 'Deals no damage: builds SP. ATK (special moves) while active.'],
    def: ['No hace daño: acumula DEFENSA mientras esté activo.', 'Deals no damage: builds DEFENSE while active.'],
    spd: ['No hace daño: acumula VELOCIDAD mientras esté activo.', 'Deals no damage: builds SPEED while active.'],
    regen: ['No hace daño: acumula REGENERACIÓN de vida.', 'Deals no damage: builds health REGENERATION.']
  };
  const DEBUFF_DESC = {
    weak: ['No hace daño: los enemigos de alrededor pegan menos.', 'Deals no damage: nearby enemies deal less damage.'],
    armor: ['No hace daño: los enemigos de alrededor reciben más daño.', 'Deals no damage: nearby enemies take more damage.'],
    slow: ['No hace daño: los enemigos de alrededor van más lentos.', 'Deals no damage: nearby enemies move slower.'],
    poison: ['No hace daño: envenena a los enemigos de alrededor.', 'Deals no damage: poisons nearby enemies.'],
    burn: ['No hace daño: quema a los enemigos de alrededor.', 'Deals no damage: burns nearby enemies.']
  };
  const WEATHER_DESC = {
    sun: ['No hace daño: invoca Sol abrasador un rato (si no hay otro clima).', 'Deals no damage: summons harsh sunlight for a while (if there is no other weather).'],
    rain: ['No hace daño: invoca Lluvia un rato (si no hay otro clima).', 'Deals no damage: summons rain for a while (if there is no other weather).'],
    sand: ['No hace daño: invoca una tormenta de arena un rato (si no hay otro clima).', 'Deals no damage: summons a sandstorm for a while (if there is no other weather).'],
    snow: ['No hace daño: invoca una nevada un rato (si no hay otro clima).', 'Deals no damage: summons snow for a while (if there is no other weather).']
  };
  // Plantilla de los potenciadores según lo que suben.
  const BUFF_TPL = { atk: 'swords-dance', spa: 'swords-dance', def: 'harden', spe: 'agility', regen: 'aqua-ring' };
  // Efectos de la plantilla que no se copian (cada movimiento trae los suyos).
  const OWN_FX = ['burn', 'poison', 'slow', 'hex', 'drain', 'recoil', 'crit', 'weak', 'armor', 'self'];
  const EN = {};

  // ---------------- cada movimiento, a su manera (17-10-2026) ----------------
  // Antes un generado era una copia de su plantilla con otro daño (Salmuera =
  // Pistola Agua). Ahora sale distinto con sus datos de los juegos (moves-gen.js):
  //   PP        ritmo: muchos = rápido y flojo por golpe; pocos = lento y fuerte
  //             (el daño por segundo apenas cambia)
  //   potencia  tamaño (y algo más lento cuanto más grande)
  //   prioridad sale disparado · precisión: nunca falla = persigue; imprecisa = más
  //             grande y dispersa · golpes múltiples = más disparos (o golpes) más pequeños
  //   banderas  sonido atraviesa · puño empuja · mordisco más críticos · pulso más alcance
  //   up        sube tus stats al golpear (Nitrocarga, Puño Incremento...)
  //   SIG       el efecto propio de los famosos (Salmuera, Desquite, Rodar...: combat.js sigMul)
  const TEMPO = pp => (pp >= 35 ? 0.78 : pp >= 25 ? 0.88 : pp >= 15 ? 1 : pp >= 10 ? 1.15 : 1.35);
  const MULTI_KINDS = ['projectile', 'nova', 'cone', 'boomerang', 'meteor', 'orbit'];
  const TRAIT_DESC = {
    fast:   ['Rápido: golpes seguidos pero flojos.', 'Fast: quick but light hits.'],
    heavy:  ['Lento pero contundente.', 'Slow but hard-hitting.'],
    prio:   ['Prioridad: sale disparado.', 'Priority: it shoots out fast.'],
    homing: ['Nunca falla: persigue al enemigo.', 'Never misses: it homes in on the enemy.'],
    wild:   ['Impreciso: más grande y disperso.', 'Inaccurate: bigger and more scattered.'],
    multi:  ['Golpea varias veces.', 'Hits several times.'],
    sound:  ['Sonido: atraviesa a todos.', 'Sound: goes through everyone.'],
    punch:  ['Puñetazo: empuja más.', 'Punch: knocks back harder.'],
    bite:   ['Mordisco: más golpes críticos.', 'Bite: more critical hits.'],
    pulse:  ['Pulso: más alcance.', 'Pulse: longer reach.']
  };
  const UP_DESC = {
    atk: ['Al golpear, puede subir tu Ataque.', 'On hit, it may raise your Attack.'],
    spa: ['Al golpear, puede subir tu At. Esp.', 'On hit, it may raise your Sp. Atk.'],
    def: ['Al golpear, puede subir tu Defensa.', 'On hit, it may raise your Defense.'],
    spd: ['Al golpear, puede subir tu Velocidad.', 'On hit, it may raise your Speed.']
  };
  // Efecto propio de los movimientos famosos (lo aplica combat.js, sigMul / sigHit).
  const SIG = {
    brine: 'lowhp',
    venoshock: 'poisoned', 'barb-barrage': 'poisoned',
    'bolt-beak': 'fresh', 'fishious-rend': 'fresh',
    'knock-off': 'boss', 'low-kick': 'boss', 'grass-knot': 'boss', 'heavy-slam': 'boss', 'heat-crash': 'boss',
    revenge: 'revenge', avalanche: 'revenge', payback: 'revenge', comeuppance: 'revenge', 'rage-fist': 'revenge',
    reversal: 'desperate', flail: 'desperate', facade: 'desperate', 'last-resort': 'desperate',
    eruption: 'fullhp', 'water-spout': 'fullhp', 'dragon-energy': 'fullhp',
    acrobatics: 'noitem',
    'stored-power': 'buffs', 'power-trip': 'buffs',
    rollout: 'combo', 'fury-cutter': 'combo', 'echoed-voice': 'combo', 'triple-axel': 'combo', 'triple-kick': 'combo',
    'smack-down': 'antiair', 'thousand-arrows': 'antiair',
    'electro-ball': 'speedy', 'gyro-ball': 'slowy',
    'weather-ball': 'weather', thunder: 'rain', hurricane: 'rain', blizzard: 'snow', 'solar-beam': 'sun', 'solar-blade': 'sun',
    'body-press': 'defense',
    'pay-day': 'coins', 'make-it-rain': 'coins', thief: 'coins', covet: 'coins',
    pluck: 'heal',
    'brick-break': 'unshield', 'psychic-fangs': 'unshield', 'clear-smog': 'unshield', 'raging-bull': 'unshield',
    psyshock: 'unshield', psystrike: 'unshield', 'secret-sword': 'unshield',
    'super-fang': 'halve', 'ruination': 'halve', 'natures-madness': 'halve',
    'u-turn': 'switch', 'volt-switch': 'switch', 'flip-turn': 'switch', 'rapid-spin': 'switch'
  };
  const SIG_DESC = {
    lowhp:     ['El doble de daño a quien tenga menos de la mitad de vida.', 'Double damage to targets below half HP.'],
    status:    ['El doble de daño a enemigos quemados, envenenados o frenados.', 'Double damage to burned, poisoned or slowed enemies.'],
    poisoned:  ['El doble de daño a enemigos envenenados.', 'Double damage to poisoned enemies.'],
    slowed:    ['El doble de daño a enemigos frenados.', 'Double damage to slowed enemies.'],
    fresh:     ['El doble de daño a enemigos que aún no han recibido daño.', 'Double damage to enemies that haven’t been hurt yet.'],
    boss:      ['Más daño a los jefes.', 'More damage to bosses.'],
    revenge:   ['El doble de daño si te acaban de golpear.', 'Double damage if you were just hit.'],
    desperate: ['Cuanta menos vida te queda, más daño.', 'The less HP you have, the more damage.'],
    fullhp:    ['Cuanta más vida tienes, más daño.', 'The more HP you have, the more damage.'],
    noitem:    ['Más daño si no llevas objeto.', 'More damage if you hold no item.'],
    buffs:     ['Más daño por cada mejora que tengas activa.', 'More damage for each active boost.'],
    combo:     ['Cada vez que acierta seguido pega más fuerte.', 'Hits harder each time it lands in a row.'],
    antiair:   ['El doble de daño a los que vuelan.', 'Double damage to flying enemies.'],
    speedy:    ['Más daño cuanto más rápido eres.', 'More damage the faster you are.'],
    slowy:     ['Más daño cuanto más lento eres.', 'More damage the slower you are.'],
    weather:   ['El doble de daño si hace algún clima.', 'Double damage in any weather.'],
    rain:      ['Más daño con lluvia.', 'More damage in the rain.'],
    snow:      ['Más daño con nieve.', 'More damage in the snow.'],
    sun:       ['Más daño con sol.', 'More damage in the sun.'],
    defense:   ['Pega más cuanta más Defensa tienes.', 'Hits harder the higher your Defense.'],
    coins:     ['A veces suelta monedas al golpear.', 'Sometimes drops coins on hit.'],
    heal:      ['Al golpear recuperas un poco de vida.', 'You recover a little HP on hit.'],
    unshield:  ['Rompe los escudos de los enemigos.', 'Breaks enemy shields.'],
    halve:     ['Quita un buen trozo de la vida que le quede (menos a los jefes).', 'Takes a big chunk of the target’s remaining HP (not bosses).'],
    switch:    ['Al golpear, te da un acelerón.', 'On hit, you get a burst of speed.']
  };

  // Retoques a mano de los pocos que aún saldrían idénticos a otro que aprende el mismo Pokémon.
  const EXTRA = {
    'sacred-fire': { burn: 2 },                        // 50 % de quemar (Llamarada, 10 %)
    overheat: { cd: 1.3, dmg: 1.3, trait: 'heavy' },   // luego te baja el At. Esp.: más lento y más fuerte
    'thousand-waves': { slow: 0.4 }                    // atrapa: frena
  };

  /** Ritmo, tamaño y rasgos de un movimiento generado según sus datos originales. → [rasgos] */
  function profile(d, g, tplPw) {
    const traits = [];
    const t = TEMPO(g.pp || 15);
    if (t !== 1 && d.cd && d.dmg) {
      d.cd = +(d.cd * t).toFixed(2);
      d.dmg = +(d.dmg * t).toFixed(1);
      traits.push(t < 1 ? 'fast' : 'heavy');
    }
    const pk = Math.max(0.8, Math.min(1.3, Math.pow((g.pw || tplPw || 60) / (tplPw || g.pw || 60), 0.35)));
    for (const k of ['size', 'radius', 'width']) if (d[k]) d[k] = Math.round(d[k] * pk);
    const flies = d.speed && d.kind !== 'orbit';
    if (flies) d.speed = Math.round(d.speed / Math.sqrt(pk));
    if (g.pri > 0) {
      if (flies) d.speed = Math.round(d.speed * 1.35);
      d.cd = +(d.cd * 0.9).toFixed(2);
      traits.push('prio');
    }
    if (g.acc === 0 && (d.kind === 'projectile' || d.kind === 'boomerang')) {
      d.homing = Math.max(d.homing || 0, 3);
      traits.push('homing');
    } else if (g.acc && g.acc < 85) {
      if (d.size) d.size = Math.round(d.size * 1.15);
      if (d.radius) d.radius = Math.round(d.radius * 1.1);
      if (d.spread != null) d.spread = +(d.spread + 0.12).toFixed(2);
      traits.push('wild');
    }
    if (g.hits) {
      const n = Math.max(2, Math.round((g.hits[0] + g.hits[1]) / 2));
      if (MULTI_KINDS.includes(d.kind) && d.count) {
        d.count += n - 1;
        d.dmg = +(d.dmg / n * 1.15).toFixed(1);
        if (d.size) d.size = Math.max(4, Math.round(d.size * 0.85));
      } else {
        d.cd = +(d.cd * 0.6).toFixed(2);
        d.dmg = +(d.dmg * 0.62).toFixed(1);
      }
      d.multi = true;                                  // (Encadenado: +25 % con estos)
      traits.push('multi');
    }
    const fl = g.fl || '';
    if (fl.includes('s')) {
      if (d.pierce != null || flies) d.pierce = (d.pierce || 0) + 3;
      else if (d.radius) d.radius = Math.round(d.radius * 1.12);
      traits.push('sound');
    }
    if (fl.includes('p')) { d.knock = Math.round((d.knock || 50) * 1.5); traits.push('punch'); }
    if (fl.includes('b')) { d.crit = Math.max(d.crit || 0, 0.15); traits.push('bite'); }
    if (fl.includes('u')) {
      if (d.life) d.life = +(d.life * 1.3).toFixed(2);
      else if (d.radius) d.radius = Math.round(d.radius * 1.15);
      traits.push('pulse');
    }
    if (g.up) d.up = [g.up[0] === 'spe' ? 'spd' : g.up[0] === 'spd' ? 'def' : g.up[0], g.up[1]];
    return traits;
  }

  function fromGen(id, g) {
    let d;
    if (g.k === 'buff') {
      const t = BY_ID[BUFF_TPL[g.stat]];
      const stat = g.stat === 'spe' ? 'spd' : g.stat;
      d = { kind: 'buff', cd: t.cd, dur: t.dur, stacks: t.stacks, stat, amount: g.amount, desc: BUFF_DESC[stat] };
    } else if (g.k === 'debuff') {
      d = { kind: 'debuff', cd: 1.4, radius: 110, dur: 3, eff: g.eff, amount: g.amount, desc: DEBUFF_DESC[g.eff] };
    } else if (g.k === 'weather') {
      d = { kind: 'weather', cd: 30, dur: 30, w: g.w, desc: WEATHER_DESC[g.w] };
    } else {
      // Daño (o trampas: Trampa Rocas como Púas, Red Viscosa como Disparo Demora).
      const t = BY_ID[g.k === 'hazard' ? (g.eff === 'slow' ? 'string-shot' : 'spikes') : g.tpl];
      if (!t) return null;
      d = Object.assign({}, t, { tpl: t.id });
      for (const k of OWN_FX) delete d[k];
      let traits = [];
      if (g.k === 'hazard') { if (g.eff === 'slow') d.slow = t.slow; }
      else {
        d.dmg = g.dmg;
        if (g.cdm) d.cd = +(t.cd * g.cdm).toFixed(2);
        for (const k of OWN_FX) if (g[k] != null) d[k] = g[k];
        if (g.knock) d.knock = Math.max(d.knock || 0, g.knock);
        traits = profile(d, g, (G.MOVES_GEN[t.id] || {}).pw);
        if (g.fl) d.fl = g.fl;                       // banderas: también deciden su aspecto (vfx.js)
        d.sig = SIG[id];
        if (d.sig === 'switch') d.up = ['spd', 100];
        const x = EXTRA[id];
        if (x) {
          if (x.burn) d.burn = x.burn;
          if (x.slow) d.slow = x.slow;
          if (x.cd) d.cd = +(d.cd * x.cd).toFixed(2);
          if (x.dmg) d.dmg = +(d.dmg * x.dmg).toFixed(1);
          if (x.trait && !traits.includes(x.trait)) traits.push(x.trait);
        }
      }
      // (Sin repetir: el mordisco ya dice lo de los críticos y "lento" ya lo dice la recarga.)
      const fx = OWN_FX.filter(k => d[k] && FX_DESC[k] && !(k === 'crit' && traits.includes('bite'))).map(k => FX_DESC[k]);
      if (g.cdm && !g.self) { fx.push(FX_DESC.slowcd); traits = traits.filter(x => x !== 'heavy'); }
      // Lo que lo distingue: su efecto propio primero, luego cómo se nota.
      if (d.sig) fx.unshift(SIG_DESC[d.sig]);
      for (const tr of traits) fx.push(TRAIT_DESC[tr]);
      if (d.up && d.sig !== 'switch') fx.push(UP_DESC[d.up[0]]);
      const base = KIND_DESC[d.kind] || ['', ''];
      d.desc = [0, 1].map(i => [base[i]].concat(fx.map(f => f[i])).join(' '));
    }
    const desc = d.desc;
    Object.assign(d, { id, name: g.n[0], type: g.t, cls: g.c, gen: 1, desc: desc[0] });
    EN[g.n[0]] = g.n[1];
    EN[desc[0]] = desc[1];
    return d;
  }

  if (G.MOVES_GEN) {
    for (const id of Object.keys(G.MOVES_GEN)) {
      const g = G.MOVES_GEN[id];
      if (BY_ID[id]) continue;                       // curado: se queda como está
      const d = fromGen(id, g);
      if (!d) continue;
      d.ups = LADDERS[d.kind];
      d.maxLvl = d.ups.length + 1;
      RAW.push(d);
      BY_ID[id] = d;
      if (g.evo && EVO_MODS[d.kind]) {
        EVO[id] = [g.evo[0][0], g.evo[1]];
        EN[g.evo[0][0]] = g.evo[0][1];
      }
    }
    if (G.I18n && G.I18n.lang === 'en') G.I18n.add(EN);
  }

  // ---------------- qué puede usar cada Pokémon ----------------

  /** [[nivel, id], ...] de su lista de aprendizaje (sólo los que existen en el juego). */
  function learnset(dex) {
    const L = G.LEARN && G.LEARN[dex];
    if (!L) return [];
    return L.map(([lv, i]) => [lv, G.MOVE_IDS[i]]).filter(([, id]) => BY_ID[id]);
  }

  /** Movimientos de un Pokémon con nivel `level`: los de su lista hasta ese nivel + los enseñados con MT. */
  function poolFor(mon, level = G.Mons.level(mon.dex)) {
    const L = learnset(mon.dex);
    // Sin lista (no debería pasar): los de sus tipos, como antes.
    if (!L.length) {
      const ids = new Set(POOL.normal);
      for (const t of mon.types) for (const id of (POOL[t] || [])) ids.add(id);
      return [...ids];
    }
    const ids = new Set(L.filter(([lv]) => lv <= level).map(([, id]) => id));
    for (const id of G.Mons.taught(mon.dex)) if (BY_ID[id]) ids.add(id);
    return [...ids];
  }

  /**
   * Movimiento con el que empieza la partida: el mejor de ataque que ya sabe
   * (más potencia, y con su tipo mejor), sin los que cuestan vida y mejor sin
   * retroceso ni recarga larga (Envite Ígneo o Rayo Solar no son buen comienzo).
   */
  function bestStart(mon, level = G.Mons.level(mon.dex)) {
    let best = null, score = -1;
    const L = learnset(mon.dex).filter(([lv]) => lv <= level);
    for (const [, id] of L.concat(G.Mons.taught(mon.dex).map(i => [0, i]))) {
      const d = BY_ID[id];
      if (!d || isStatus(id) || d.self) continue;
      const g = G.MOVES_GEN && G.MOVES_GEN[id];
      const s = ((g && g.pw) || 50) * (mon.types.includes(d.type) ? 1.51 : 1) * (d.recoil || (g && g.cdm) ? 0.6 : 1);
      if (s >= score) { score = s; best = id; }
    }
    return best;
  }

  G.Moves = { ALL: RAW, BY_ID, POOL, poolFor, learnset, bestStart, isStatus, STATUS_KINDS, instance, levelUp,
              nextUpText, startFor, EVO, EVO_GOAL, NEED_NAME, evoInfo, evolve };
})();
