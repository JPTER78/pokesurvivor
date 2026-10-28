/* ============ ability-fx.js — qué hace cada habilidad en el juego ============
 * (20-10-2026, del PR #236 de TheAdro7, adaptado a este juego.)
 *
 * Los nombres están en data/abilities.js. Aquí, el efecto en PokéSurvivor de las
 * que tienen sentido en un survivor; las demás dan una pasiva sencilla de su tipo
 * principal (+8 % de daño con sus movimientos), con su nombre de siempre.
 *
 * Ganchos (todos opcionales):
 *   start(pl)             al empezar la partida (stats fijos)
 *   out(pl, m, e)         × al daño que hace el movimiento m al enemigo e (combat.js)
 *   hit(pl, e, m)         ha golpeado a e (después del daño)
 *   inMul(pl, type, cls)  × al daño que recibe (cls 'p' físico, 's' especial)
 *   absorb: 'tipo'        ese tipo no le hace daño: le cura un poco
 *   dodge(pl, type, cls)  probabilidad de esquivar un golpe
 *   hurt(pl, type, cls)   le acaban de golpear
 *   contact(pl, e)        un enemigo le ha golpeado cuerpo a cuerpo
 *   tick(pl, dt)          cada fotograma
 *   kill(pl, e)           ha caído un enemigo
 *   speed(pl)             × a la velocidad
 *   healMul               × a lo que le curan
 *   statusCd              × a la recarga de los potenciadores · cdMul × a todas
 *   critMul               daño del crítico (normal ×1,5)
 *   summon: 'clima'       pone su clima al empezar y cada 3 min (si no hay otro)
 *   levitate / steady / sturdy / sheer / serene / lavaProof / damp / touchPoison  (marcas)
 * Las descripciones van en español; las traducciones, en lang-en.js y lang-updates.js
 * (muchas son el mismo texto con otro tipo: '+20 % de daño con movimientos de tipo {x}.').
 */
G.AbilityFX = (() => {
  const low = pl => pl.hp < pl.maxHp / 3;
  const half = pl => pl.hp < pl.maxHp / 2;
  const wx = () => (G.Weather.current || {}).kind;
  const mult = (type, types) => G.Types.mult(type, types || []);
  const cls = m => (m && m.cat === 'physical' ? 'p' : m && m.cat === 'special' ? 's' : '');
  const TN = t => G.U.TYPE_NAME[t];
  const heal = (pl, k) => { pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * k); };

  const pinch = type => ({ d: '+35 % de daño de tipo ' + TN(type) + ' con poca vida (menos de 1/3).',
    out: (pl, m) => (m.type === type && low(pl) ? 1.35 : 1) });
  const boost = type => ({ d: '+20 % de daño con movimientos de tipo ' + TN(type) + '.',
    out: (pl, m) => (m.type === type ? 1.2 : 1) });
  const byName = (re, es, k = 1.3) => ({ d: '+' + Math.round((k - 1) * 100) + ' % de daño con ' + es + '.',
    out: (pl, m) => (re.test(m.id) ? k : 1) });
  const absorb = type => ({ d: 'Los ataques de tipo ' + TN(type) + ' no le hacen daño: le curan un poco.', absorb: type });
  const rush = (w, es) => ({ d: '+50 % de velocidad con ' + es + '.', speed: () => (wx() === w ? 1.5 : 1) });
  const summon = (w, es) => ({ d: 'Pone ' + es + ' al empezar la partida y cada 3 minutos.', summon: w });
  const steady = { d: 'No le frenan las trampas pegajosas ni el terreno.', steady: true };
  const moxie = { d: 'Cada enemigo derrotado le da +0,5 % de daño (hasta +15 %).',
    kill: pl => { pl.moxie = Math.min(0.15, (pl.moxie || 0) + 0.005); }, out: pl => 1 + (pl.moxie || 0) };
  const contact = (fn, d) => ({ d, contact: fn });
  const dmgBack = pl => 10 + pl.level * 3;
  const superEff = (pl, type) => type && mult(type, pl.mon.types) > 1;

  const FX = {
    // --- más daño ---
    'overgrow': pinch('grass'), 'blaze': pinch('fire'), 'torrent': pinch('water'), 'swarm': pinch('bug'),
    'steelworker': boost('steel'), 'steely-spirit': boost('steel'), 'dragons-maw': boost('dragon'), 'transistor': boost('electric'),
    'corrosion': boost('poison'),
    'water-bubble': { d: '+40 % de daño de tipo Agua y recibe la mitad de daño de Fuego.',
      out: (pl, m) => (m.type === 'water' ? 1.4 : 1), inMul: (pl, type) => (type === 'fire' ? 0.5 : 1) },
    'technician': { d: '+35 % de daño con los ataques de golpes flojos.', out: (pl, m) => ((m.def || m).dmg <= 12 ? 1.35 : 1) },
    'huge-power': { d: '+50 % de daño con movimientos físicos.', out: (pl, m) => (cls(m) === 'p' ? 1.5 : 1) },
    'hustle': { d: '+25 % de daño con movimientos físicos, pero 1 de cada 6 golpes físicos sale flojo.',
      out: (pl, m) => (cls(m) !== 'p' ? 1 : Math.random() < 1 / 6 ? 0.3 : 1.25) },
    'guts': { d: '+30 % de daño físico con menos de la mitad de vida.', out: (pl, m) => (cls(m) === 'p' && half(pl) ? 1.3 : 1) },
    'adaptability': { d: '+25 % de daño con los movimientos de sus tipos.', out: (pl, m) => (pl.mon.types.includes(m.type) ? 1.25 : 1) },
    'protean': { d: '+12 % de daño con todos sus movimientos.', out: () => 1.12 },
    'sheer-force': { d: '+25 % de daño con movimientos que queman, envenenan, frenan o empujan, pero pierden ese efecto.',
      out: (pl, m) => (m.burn || m.poison || m.slow || m.knock ? 1.25 : 1), sheer: true },
    'serene-grace': { d: 'Las quemaduras, venenos y frenazos de sus movimientos son el doble de fuertes.', serene: true },
    'tough-claws': { d: '+25 % de daño con ataques cuerpo a cuerpo y embestidas.', out: (pl, m) => (m.kind === 'melee' || m.kind === 'dash' ? 1.25 : 1) },
    'reckless': { d: '+25 % de daño con las embestidas.', out: (pl, m) => (m.kind === 'dash' ? 1.25 : 1) },
    'iron-fist': byName(/punch/, 'los puñetazos', 1.25),
    'strong-jaw': byName(/bite|fang|crunch|jaw/, 'los mordiscos'),
    'mega-launcher': byName(/pulse|aura-sphere/, 'los pulsos y esferas'),
    'sharpness': byName(/cut|slash|blade|razor|scissor|sword/, 'los cortes'),
    'punk-rock': byName(/voice|buzz|boom|noise|sing|echo|uproar|snarl/, 'los sonidos'),
    'tinted-lens': { d: 'Sus movimientos poco eficaces hacen daño normal.',
      out: (pl, m, e) => { const k = e ? mult(m.type, e.types) : 1; return k < 1 && k > 0 ? 1 / k : 1; } },
    'scrappy': { d: 'Sus movimientos Normal y Lucha dañan del todo a los Fantasma.',
      out: (pl, m, e) => ((m.type === 'normal' || m.type === 'fighting') && e && (e.types || []).includes('ghost') ? 1 / Math.max(0.3, mult(m.type, e.types)) : 1) },
    'sand-force': { d: '+30 % de daño Roca, Tierra y Acero con tormenta de arena.',
      out: (pl, m) => (wx() === 'sand' && ['rock', 'ground', 'steel'].includes(m.type) ? 1.3 : 1) },
    'solar-power': { d: '+40 % de daño especial con sol, pero el sol le quita algo de vida.',
      out: (pl, m) => (wx() === 'sun' && cls(m) === 's' ? 1.4 : 1),
      tick: (pl, dt) => { if (wx() === 'sun' && pl.hp > pl.maxHp * 0.1) pl.hp -= pl.maxHp * 0.004 * dt; } },
    'sniper': { d: 'Sus golpes críticos hacen ×2 de daño (en vez de ×1,5).', critMul: 2 },
    'super-luck': { d: '+10 % de probabilidad de golpe crítico.', start: pl => { pl.critChance += 0.1; } },
    'compound-eyes': { d: '+6 % de probabilidad de golpe crítico.', start: pl => { pl.critChance += 0.06; } },
    'moxie': moxie, 'chilling-neigh': moxie, 'grim-neigh': moxie, 'beast-boost': moxie,

    // --- velocidad ---
    'speed-boost': { d: 'Cada 10 segundos va un 1,5 % más rápido (hasta +30 %).',
      tick: (pl, dt) => { pl.boostT = (pl.boostT || 0) + dt; if (pl.boostT >= 10) { pl.boostT = 0; pl.abSpd = Math.min(0.3, (pl.abSpd || 0) + 0.015); } },
      speed: pl => 1 + (pl.abSpd || 0) },
    'swift-swim': rush('rain', 'lluvia'), 'chlorophyll': rush('sun', 'sol'),
    'sand-rush': rush('sand', 'tormenta de arena'), 'slush-rush': rush('snow', 'nieve'),
    'run-away': { d: '+8 % de velocidad.', speed: () => 1.08 },

    // --- climas ---
    'drought': summon('sun', 'sol'), 'orichalcum-pulse': summon('sun', 'sol'), 'drizzle': summon('rain', 'lluvia'),
    'sand-stream': summon('sand', 'una tormenta de arena'), 'snow-warning': summon('snow', 'nieve'),
    'rain-dish': { d: 'Con lluvia recupera un 1,5 % de vida por segundo.', tick: (pl, dt) => { if (wx() === 'rain') heal(pl, 0.015 * dt); } },
    'ice-body': { d: 'Con nieve recupera un 1,5 % de vida por segundo.', tick: (pl, dt) => { if (wx() === 'snow') heal(pl, 0.015 * dt); } },
    'dry-skin': { d: 'El Agua le cura y con lluvia recupera vida, pero el Fuego le hace un 25 % más.',
      absorb: 'water', inMul: (pl, type) => (type === 'fire' ? 1.25 : 1), tick: (pl, dt) => { if (wx() === 'rain') heal(pl, 0.012 * dt); } },

    // --- defensa ---
    'levitate': { d: 'Flota: no le afectan el agua, la lava ni las trampas, y la Tierra le hace muy poco.',
      levitate: true, inMul: (pl, type) => (type === 'ground' ? 0.3 : 1) },
    'thick-fat': { d: 'Recibe un 40 % menos de daño de Fuego y Hielo.', inMul: (pl, type) => (type === 'fire' || type === 'ice' ? 0.6 : 1) },
    'heatproof': { d: 'Recibe la mitad de daño de Fuego.', inMul: (pl, type) => (type === 'fire' ? 0.5 : 1) },
    'water-absorb': absorb('water'), 'storm-drain': absorb('water'), 'volt-absorb': absorb('electric'),
    'lightning-rod': absorb('electric'), 'motor-drive': absorb('electric'), 'flash-fire': absorb('fire'),
    'well-baked-body': absorb('fire'), 'sap-sipper': absorb('grass'), 'earth-eater': absorb('ground'),
    'multiscale': { d: 'Con la vida casi llena recibe la mitad de daño.', inMul: pl => (pl.hp >= pl.maxHp * 0.95 ? 0.5 : 1) },
    'shadow-shield': { d: 'Con la vida casi llena recibe la mitad de daño.', inMul: pl => (pl.hp >= pl.maxHp * 0.95 ? 0.5 : 1) },
    'filter': { d: 'Los ataques muy eficaces le hacen un 25 % menos.', inMul: (pl, type) => (superEff(pl, type) ? 0.75 : 1) },
    'solid-rock': { d: 'Los ataques muy eficaces le hacen un 25 % menos.', inMul: (pl, type) => (superEff(pl, type) ? 0.75 : 1) },
    'prism-armor': { d: 'Los ataques muy eficaces le hacen un 25 % menos.', inMul: (pl, type) => (superEff(pl, type) ? 0.75 : 1) },
    'fur-coat': { d: 'Recibe un 40 % menos de daño físico.', inMul: (pl, type, c) => (c === 'p' ? 0.6 : 1) },
    'fluffy': { d: 'Recibe un 30 % menos de daño físico.', inMul: (pl, type, c) => (c === 'p' ? 0.7 : 1) },
    'ice-scales': { d: 'Recibe un 40 % menos de daño especial.', inMul: (pl, type, c) => (c === 's' ? 0.6 : 1) },
    'shell-armor': { d: 'Recibe un 8 % menos de daño.', inMul: () => 0.92 },
    'battle-armor': { d: 'Recibe un 8 % menos de daño.', inMul: () => 0.92 },
    'intimidate': { d: 'Los enemigos le hacen un 12 % menos de daño físico.', inMul: (pl, type, c) => (c === 'p' ? 0.88 : 1) },
    'pressure': { d: 'Recibe un 8 % menos de daño.', inMul: () => 0.92 },
    'sturdy': { d: 'Un golpe que le dejaría KO le deja con 1 de vida (cada 90 s).', sturdy: true },
    'regenerator': { d: 'Recupera un 0,6 % de su vida por segundo.', start: pl => { pl.regenFlat += pl.maxHp * 0.006; } },
    'magic-guard': { d: 'Sólo le hacen daño los ataques: ni la lava ni las trampas.', lavaProof: true, trapProof: true },
    'stamina': { d: 'Cada golpe cuerpo a cuerpo que recibe le sube un poco la defensa.', contact: pl => pl.addBuff('def', 0.03, 6, 5) },
    'limber': steady, 'own-tempo': steady, 'oblivious': steady, 'inner-focus': steady, 'clear-body': steady,
    'white-smoke': steady, 'full-metal-body': steady, 'insomnia': steady, 'vital-spirit': steady,

    // --- contraataques (al recibir un golpe cuerpo a cuerpo) ---
    'static': contact((pl, e) => e.applySlow(0.5, 2.5), 'Quien le golpea cuerpo a cuerpo se queda frenado (paralizado).'),
    'flame-body': contact((pl, e) => e.applyBurn(2), 'Quien le golpea cuerpo a cuerpo se quema.'),
    'poison-point': contact((pl, e) => e.applyPoison(2), 'Quien le golpea cuerpo a cuerpo se envenena.'),
    'toxic-debris': contact((pl, e) => e.applyPoison(2), 'Quien le golpea cuerpo a cuerpo se envenena.'),
    'cute-charm': contact((pl, e) => e.applySlow(0.4, 2.5), 'Quien le golpea cuerpo a cuerpo se queda embobado (frenado).'),
    'effect-spore': contact((pl, e) => (Math.random() < 0.5 ? e.applySlow(0.45, 2.5) : e.applyPoison(2)), 'Quien le golpea cuerpo a cuerpo se frena o se envenena.'),
    'rough-skin': contact((pl, e) => e.hurt(dmgBack(pl), '#9aa6b5'), 'Quien le golpea cuerpo a cuerpo recibe daño.'),
    'iron-barbs': contact((pl, e) => e.hurt(dmgBack(pl), '#9aa6b5'), 'Quien le golpea cuerpo a cuerpo recibe daño.'),
    'poison-touch': { d: 'Sus ataques cuerpo a cuerpo y embestidas envenenan.', touchPoison: true },

    // --- botín ---
    'pickup': { d: '+15 % de Pokémonedas en la partida.', start: pl => { pl.coinMul *= 1.15; } },
    'honey-gather': { d: '+15 % de Pokémonedas en la partida.', start: pl => { pl.coinMul *= 1.15; } },

    // --- las que en los juegos son un lastre: aquí, un intercambio ---
    'truant': { d: 'Golpes sueltos y fuertes: tarda un 60 % más en recargar, pero cada golpe hace +35 %.', cdMul: 1.6, out: () => 1.35 },
    'slow-start': { d: 'Arranca lento: el primer minuto hace −40 % de daño y va más despacio; después, a plena potencia.',
      tick: (pl, dt) => { pl.ssT = (pl.ssT || 0) + dt; }, out: pl => ((pl.ssT || 0) < 60 ? 0.6 : 1), speed: pl => ((pl.ssT || 0) < 60 ? 0.8 : 1) },
    'defeatist': { d: 'Cañón de cristal: +15 % de daño con más de la mitad de vida; con menos, −25 %.', out: pl => (half(pl) ? 0.75 : 1.15) },
    'wonder-guard': { d: 'Lo que no es muy eficaz apenas le hace daño (35 %); lo muy eficaz, un 50 % más.',
      inMul: (pl, type) => (superEff(pl, type) ? 1.5 : 0.35) },
    'schooling': { d: 'Forma banco: +25 % de vida y, con más de 1/4 de vida, +50 % de daño.',
      start: pl => { pl.maxHp = Math.round(pl.maxHp * 1.25); pl.hp = pl.maxHp; }, out: pl => (pl.hp > pl.maxHp / 4 ? 1.5 : 1) },
    'zen-mode': { d: 'Con menos de la mitad de vida entra en Modo Daruma: +30 % de daño especial.', plus: true,
      out: (pl, m) => (half(pl) && cls(m) === 's' ? 1.3 : 1) },
    'stance-change': { d: 'Alterna cada 8 s entre filo (+20 % de daño) y escudo (−20 % de daño recibido).',
      tick: (pl, dt) => { pl.stanceT = (pl.stanceT || 0) + dt; if (pl.stanceT >= 8) { pl.stanceT = 0; pl.shieldForm = !pl.shieldForm; } },
      out: pl => (pl.shieldForm ? 1 : 1.2), inMul: pl => (pl.shieldForm ? 0.8 : 1) },
    'imposter': { d: 'Se transforma: pega y aguanta como un Pokémon equilibrado.',
      start: pl => { const m = pl.mon; m.pa = m.sa = m.atk = pl.baseAtk = Math.max(m.atk, 1.12); m.df = Math.max(m.df, 72); m.sd = Math.max(m.sd, 72); } },

    // --- las genéricas más comunes (suman también la pasiva de su tipo: plus) ---
    'keen-eye': { d: '+5 % de probabilidad de golpe crítico.', plus: true, start: pl => { pl.critChance += 0.05; } },
    'frisk': { d: 'Atrae los objetos desde más lejos (+20 % de imán).', plus: true, start: pl => { pl.magnet *= 1.2; } },
    'magnet-pull': { d: 'Atrae los objetos desde más lejos (+20 % de imán).', plus: true, start: pl => { pl.magnet *= 1.2; } },
    'sticky-hold': { d: 'Atrae los objetos desde más lejos (+20 % de imán).', plus: true, start: pl => { pl.magnet *= 1.2; } },
    'illuminate': { d: 'Atrae los objetos desde más lejos (+10 % de imán).', plus: true, start: pl => { pl.magnet *= 1.1; } },
    'sand-veil': { d: 'Con tormenta de arena esquiva el 15 % de los golpes.', plus: true, dodge: () => (wx() === 'sand' ? 0.15 : 0) },
    'snow-cloak': { d: 'Con nieve esquiva el 15 % de los golpes.', plus: true, dodge: () => (wx() === 'snow' ? 0.15 : 0) },
    'gluttony': { d: 'Las curas le curan un 40 % más.', plus: true, healMul: 1.4 },
    'harvest': { d: 'Las curas le curan un 30 % más.', plus: true, healMul: 1.3 },
    'unnerve': { d: 'Pone nerviosos a los enemigos: le hacen un 6 % menos de daño.', plus: true, inMul: () => 0.94 },
    'infiltrator': { d: 'Sus golpes rompen los escudos de los enemigos.', plus: true,
      hit: (pl, e) => { if (!e.remote && e.shield > 0) { e.shield = 0; e.shieldT = 0; } } },
    'telepathy': { d: 'Lee las intenciones: esquiva el 8 % de los golpes.', plus: true, dodge: () => 0.08 },
    'anticipation': { d: 'Presiente el peligro: esquiva el 6 % de los golpes.', plus: true, dodge: () => 0.06 },
    'forewarn': { d: 'Presiente el peligro: esquiva el 6 % de los golpes.', plus: true, dodge: () => 0.06 },
    'weak-armor': { d: 'Al recibir un golpe físico se aligera: +20 % de velocidad un momento.', plus: true,
      hurt: (pl, type, c) => { if (c === 'p') pl.addBuff('spd', 0.2, 3, 1); } },
    'steadfast': { d: 'Al recibir un golpe, +10 % de velocidad un momento (se acumula).', plus: true, hurt: pl => pl.addBuff('spd', 0.1, 3, 2) },
    'rattled': { d: 'Los golpes de Bicho, Fantasma o Siniestro le asustan: +25 % de velocidad un momento.', plus: true,
      hurt: (pl, type) => { if (type === 'bug' || type === 'ghost' || type === 'dark') pl.addBuff('spd', 0.25, 4, 1); } },
    'hydration': { d: 'Con lluvia recupera un 1 % de vida por segundo y nada le frena.', plus: true,
      tick: (pl, dt) => { if (wx() === 'rain') { heal(pl, 0.01 * dt); pl.slowT = 0; } } },
    'overcoat': { d: 'Recibe un 5 % menos de daño especial.', plus: true, inMul: (pl, type, c) => (c === 's' ? 0.95 : 1) },
    'shed-skin': { d: 'Cada 5 s muda: se quita los frenazos y recupera un 2 % de vida.', plus: true,
      tick: (pl, dt) => { pl.shedT = (pl.shedT || 0) + dt; if (pl.shedT >= 5) { pl.shedT = 0; pl.slowT = 0; heal(pl, 0.02); } } },
    'natural-cure': { d: 'Recupera un 0,3 % de su vida por segundo.', plus: true, start: pl => { pl.regenFlat += pl.maxHp * 0.003; } },
    'healer': { d: 'Recupera un 0,3 % de su vida por segundo.', plus: true, start: pl => { pl.regenFlat += pl.maxHp * 0.003; } },
    'leaf-guard': { d: 'Con sol no le frena nada y recibe un 15 % menos de daño.', plus: true,
      tick: pl => { if (wx() === 'sun') pl.slowT = 0; }, inMul: () => (wx() === 'sun' ? 0.85 : 1) },
    'mold-breaker': { d: '+12 % de daño a los jefes.', plus: true, out: (pl, m, e) => (e && e.boss ? 1.12 : 1) },
    'damp': { d: 'Las explosiones de los Pokémon kamikaze no le dañan.', plus: true, damp: true },
    'rivalry': { d: '+15 % de daño a los enemigos que comparten un tipo con él.', plus: true,
      out: (pl, m, e) => (e && (e.types || []).some(t => pl.mon.types.includes(t)) ? 1.15 : 1) },
    'synchronize': { d: 'Quien le golpea cuerpo a cuerpo recibe parte del golpe.', plus: true, contact: (pl, e) => e.hurt(6 + pl.level * 2, '#ff9fcf') },
    'prankster': { d: 'Sus potenciadores se recargan un 30 % antes.', plus: true, statusCd: 0.7 },
    'early-bird': Object.assign({}, steady, { plus: true }),
    'shield-dust': Object.assign({}, steady, { plus: true }),
    'sweet-veil': Object.assign({}, steady, { plus: true }),
    'unburden': { d: 'Sin objeto va un 15 % más rápido.', plus: true, speed: pl => (pl.item ? 1 : 1.15) },
    'unaware': { d: 'No se deja impresionar: recibe un 8 % menos de daño.', plus: true, inMul: () => 0.92 },
    'defiant': { d: 'Si le frenan, se pica: +20 % de daño físico mientras dure.', plus: true, out: (pl, m) => (pl.slowT > 0 && cls(m) === 'p' ? 1.2 : 1) },
    'competitive': { d: 'Si le frenan, se pica: +20 % de daño especial mientras dure.', plus: true, out: (pl, m) => (pl.slowT > 0 && cls(m) === 's' ? 1.2 : 1) },
    'soundproof': { d: 'Recibe un 10 % menos de daño especial.', plus: true, inMul: (pl, type, c) => (c === 's' ? 0.9 : 1) },
    'big-pecks': { d: 'Recibe un 8 % menos de daño físico.', plus: true, inMul: (pl, type, c) => (c === 'p' ? 0.92 : 1) },
    'water-veil': { d: 'La lava no le quema y recibe la mitad de daño de Fuego.', plus: true, lavaProof: true, inMul: (pl, type) => (type === 'fire' ? 0.5 : 1) },
    'pickpocket': { d: 'Al recibir golpes, a veces les quita una moneda.', plus: true,
      hurt: pl => { if (Math.random() < 0.12) G.Pickups.drop('coin', pl.x + G.U.rand(-10, 10), pl.y + G.U.rand(-10, 10), 2); } },
    'analytic': { d: '+15 % de daño a enemigos con menos de la mitad de vida.', plus: true, out: (pl, m, e) => (e && e.hp < e.maxHp * 0.5 ? 1.15 : 1) },
    'klutz': { d: 'Sin objeto, +12 % de daño.', plus: true, out: pl => (pl.item ? 1 : 1.12) },
    'hyper-cutter': { d: '+6 % de daño con movimientos físicos.', plus: true, out: (pl, m) => (cls(m) === 'p' ? 1.06 : 1) },
    'contrary': { d: 'Al revés: frenado, va más rápido.', plus: true, speed: pl => (pl.slowT > 0 ? 2.4 : 1) },
    'quick-feet': { d: 'Frenado, va más rápido (en vez de más lento).', plus: true, speed: pl => (pl.slowT > 0 ? 2.5 : 1) },
    'bulletproof': { d: 'Recibe un 15 % menos de daño especial.', plus: true, inMul: (pl, type, c) => (c === 's' ? 0.85 : 1) },
    'magic-bounce': { d: 'Recibe un 15 % menos de daño especial y esquiva el 10 % de esos golpes.', plus: true,
      inMul: (pl, type, c) => (c === 's' ? 0.85 : 1), dodge: (pl, type, c) => (c === 's' ? 0.1 : 0) },
    'friend-guard': { d: 'Recibe un 6 % menos de daño.', plus: true, inMul: () => 0.94 },
    'stench': { d: 'Sus golpes a veces frenan (1 de cada 10).', plus: true, hit: (pl, e) => { if (Math.random() < 0.1) e.applySlow(0.35, 1.5); } },
    'anger-point': { d: 'La primera vez que baja de la mitad de vida se enfurece: +25 % de daño el resto de la partida.',
      tick: pl => { if (!pl.angry && half(pl)) { pl.angry = true; G.FX.dmgText(pl.x, pl.y - pl.bodyH - 16, '¡Irascible!', '#ff6b4d', true); } },
      out: pl => (pl.angry ? 1.25 : 1) },
    'justified': { d: '+15 % de daño a los Pokémon de tipo Siniestro.', plus: true, out: (pl, m, e) => (e && (e.types || []).includes('dark') ? 1.15 : 1) },
    'cursed-body': contact((pl, e) => { if (Math.random() < 0.3) e.applySlow(0.5, 2); }, 'A veces frena a quien le golpea cuerpo a cuerpo.'),
    'plus': { d: '+10 % de daño con movimientos especiales.', out: (pl, m) => (cls(m) === 's' ? 1.1 : 1) },
    'minus': { d: '+10 % de daño con movimientos especiales.', out: (pl, m) => (cls(m) === 's' ? 1.1 : 1) },
    'no-guard': { d: 'Todo acierta: +15 % de daño hecho, pero recibe un 10 % más.', out: () => 1.15, inMul: () => 1.1 },
    'aftermath': { d: 'Una vez por partida, al quedar con poca vida, explota y daña a los de alrededor.', plus: true,
      tick: pl => {
        if (pl.boomed || pl.hp >= pl.maxHp * 0.2 || pl.dead) return;
        pl.boomed = true;
        G.FX.ring(pl.x, pl.y, 10, 140, '#ff7b3d', 0.5, 6); G.Camera.kick(0.6); G.Audio.sfx('break');
        for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, 140)) e.hurt(40 + pl.level * 10, '#ff7b3d', e.x - pl.x, e.y - pl.y, 160);
      } },
    'moody': { d: 'Cada 10 s, +10 % a algo al azar: ataque, ataque especial, velocidad o defensa.', plus: true,
      tick: (pl, dt) => {
        pl.moodT = (pl.moodT || 0) - dt;
        if (pl.moodT > 0) return;
        pl.moodT = 10; pl.mood = G.U.pick(['atk', 'spa', 'spd', 'def']);
        G.FX.ring(pl.x, pl.y, pl.r * 2.4, pl.r * 1.1, { atk: '#ff6b4d', spa: '#ff8ad8', spd: '#7fe0ff', def: '#b0b8c8' }[pl.mood], 0.35, 2.5);
      },
      out: (pl, m) => (pl.mood === (cls(m) === 's' ? 'spa' : 'atk') ? 1.1 : 1),
      speed: pl => (pl.mood === 'spd' ? 1.1 : 1), inMul: pl => (pl.mood === 'def' ? 0.9 : 1) },
    'tangled-feet': { d: 'Frenado, esquiva el 20 % de los golpes.', plus: true, dodge: pl => (pl.slowT > 0 ? 0.2 : 0) },
    'skill-link': { d: '+25 % de daño con los movimientos de varios golpes.', plus: true, out: (pl, m) => ((m.count || 1) > 2 || m.bounce ? 1.25 : 1) },
    'protosynthesis': { d: 'Con sol, +20 % de daño.', plus: true, out: () => (wx() === 'sun' ? 1.2 : 1) }
  };
  FX['pure-power'] = FX['huge-power'];                // Energía Pura = Potencia
  FX['libero'] = FX['protean'];                       // Líbero = Mutatipo

  /** Pasiva genérica: +8 % con los movimientos de su tipo principal. */
  function generic(mon) {
    const t = mon.types[0];
    return { generic: true, d: '+8 % de daño con movimientos de tipo ' + TN(t) + '.', out: (pl, m) => (m.type === t ? 1.08 : 1) };
  }

  /**
   * Efecto de la habilidad `id` para el Pokémon `mon` (nunca null). Las que
   * llevan `plus` suman además la pasiva genérica de su tipo (su texto va en d2,
   * aparte, para que cada frase se traduzca entera).
   */
  function of(id, mon) {
    const fx = id && FX[id];
    if (!fx) return generic(mon);
    if (!fx.plus) return fx;
    const g = generic(mon);
    return Object.assign({}, fx, {
      d2: g.d,
      out: (pl, m, e) => (fx.out ? fx.out(pl, m, e) : 1) * g.out(pl, m, e)
    });
  }

  return { FX, of };
})();
