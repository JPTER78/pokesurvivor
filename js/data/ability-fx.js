/* ============ ability-fx.js — qué hace cada habilidad en el juego ============
 *
 * Las habilidades (nombre y texto original) están en js/data/abilities.js
 * (generado). Aquí, a mano, el efecto en PokéSurvivor de las que tienen un
 * efecto claro en un survivor. Las demás usan una pasiva genérica de su tipo
 * (+8 % de daño con los movimientos de su tipo principal), con su nombre.
 *
 * Ganchos (todos opcionales; los llama el jugador o combat.js):
 *   start(pl)              al empezar la partida (stats fijos)
 *   out(pl, m, e)          × al daño que hace el movimiento m al enemigo e
 *   inMul(pl, type, cls)   × al daño que recibe (cls 'p' físico, 's' especial)
 *   absorb: 'tipo'         ese tipo no le hace daño: lo cura un poco
 *   contact(pl, e)         un enemigo le ha golpeado cuerpo a cuerpo
 *   tick(pl, dt)           cada fotograma
 *   kill(pl, e)            ha derrotado a un enemigo
 *   speed(pl)              × a la velocidad (climas)
 *   levitate / guard / steady / sturdy / sheer / serene  (marcas, ver player.js)
 *   summon: 'clima'        invoca su clima al empezar y cada 3 min (si no hay otro)
 */
G.AbilityFX = (() => {
  const low = pl => pl.hp < pl.maxHp / 3;
  const half = pl => pl.hp < pl.maxHp / 2;
  const wx = () => (G.Weather.current || {}).kind;
  const mult = (type, types) => G.Types.mult(type, types || []);

  const pinch = (type, es, en) => ({ d: ['+35 % de daño de tipo ' + es + ' con poca vida (menos de 1/3).', '+35% ' + en + '-type damage at low HP (under 1/3).'],
    out: (pl, m) => (m.type === type && low(pl) ? 1.35 : 1) });
  const boost = (type, es, en) => ({ d: ['+20 % de daño con movimientos de tipo ' + es + '.', '+20% damage with ' + en + '-type moves.'],
    out: (pl, m) => (m.type === type ? 1.2 : 1) });
  const byName = (re, es, en, k = 1.3) => ({ d: ['+' + Math.round((k - 1) * 100) + ' % de daño con ' + es + '.', '+' + Math.round((k - 1) * 100) + '% damage with ' + en + '.'],
    out: (pl, m) => (re.test(m.id) ? k : 1) });
  const absorb = (type, es, en) => ({ d: ['Los ataques de tipo ' + es + ' no le hacen daño: le curan un poco.', en + '-type attacks deal no damage: they heal it a little.'],
    absorb: type });
  const rush = (w, es, en) => ({ d: ['+50 % de velocidad con ' + es + '.', '+50% speed in ' + en + '.'],
    speed: () => (wx() === w ? 1.5 : 1) });
  const summon = (w, es, en) => ({ d: ['Invoca ' + es + ' al empezar la partida y cada 3 minutos.', 'Summons ' + en + ' at the start of the run and every 3 minutes.'],
    summon: w });
  const steady = { d: ['No le frenan las trampas pegajosas ni los efectos que ralentizan.', 'Sticky traps and slowing effects do not slow it down.'], steady: true };
  const moxie = { d: ['Cada enemigo derrotado le da +0,5 % de daño (hasta +15 %).', 'Each enemy defeated gives +0.5% damage (up to +15%).'],
    kill: pl => { pl.moxie = Math.min(0.15, (pl.moxie || 0) + 0.005); } };
  const contact = (fn, es, en) => ({ d: [es, en], contact: fn });

  const FX = {
    // --- más daño ---
    'overgrow': pinch('grass', 'Planta', 'Grass'), 'blaze': pinch('fire', 'Fuego', 'Fire'),
    'torrent': pinch('water', 'Agua', 'Water'), 'swarm': pinch('bug', 'Bicho', 'Bug'),
    'steelworker': boost('steel', 'Acero', 'Steel'), 'steely-spirit': boost('steel', 'Acero', 'Steel'),
    'dragons-maw': boost('dragon', 'Dragón', 'Dragon'), 'transistor': boost('electric', 'Eléctrico', 'Electric'),
    'water-bubble': { d: ['+40 % de daño de tipo Agua y recibe la mitad de daño de Fuego.', '+40% Water-type damage and takes half damage from Fire.'],
      out: (pl, m) => (m.type === 'water' ? 1.4 : 1), inMul: (pl, type) => (type === 'fire' ? 0.5 : 1) },
    'technician': { d: ['+35 % de daño con movimientos de 60 de potencia o menos.', '+35% damage with moves of 60 power or less.'],
      out: (pl, m) => (G.Mons.movePower(m) <= 60 ? 1.35 : 1) },
    'huge-power': { d: ['+50 % de daño con movimientos físicos.', '+50% damage with physical moves.'],
      out: (pl, m) => (G.Mons.moveClass(m) === 'p' ? 1.5 : 1) },
    // (19-10-2026) Como en los juegos, a cambio de fallar: 1 de cada 6 golpes físicos sale flojo.
    'hustle': { d: ['+25 % de daño con movimientos físicos, pero 1 de cada 6 golpes físicos sale flojo.', '+25% damage with physical moves, but 1 in 6 physical hits comes out weak.'],
      out: (pl, m) => (G.Mons.moveClass(m) !== 'p' ? 1 : Math.random() < 1 / 6 ? 0.3 : 1.25) },
    'guts': { d: ['+30 % de daño físico con menos de la mitad de vida.', '+30% physical damage under half HP.'],
      out: (pl, m) => (G.Mons.moveClass(m) === 'p' && half(pl) ? 1.3 : 1) },
    'adaptability': { d: ['Los movimientos de su tipo hacen +45 % de daño (en vez de +20 %).', 'Moves of its type deal +45% damage (instead of +20%).'],
      start: pl => { pl.stab = 1.45; } },
    'protean': { d: ['Todos sus movimientos cuentan como de su tipo (+20 % de daño).', 'All its moves count as its own type (+20% damage).'],
      start: pl => { pl.stabAll = true; } },
    'sheer-force': { d: ['+25 % de daño con movimientos que queman, envenenan, frenan o empujan, pero pierden ese efecto.', '+25% damage with moves that burn, poison, slow or push, but they lose that effect.'],
      out: (pl, m) => (m.burn || m.poison || m.slow || m.knock ? 1.25 : 1), sheer: true },
    'serene-grace': { d: ['Las quemaduras, venenos y frenazos de sus movimientos son el doble de fuertes.', 'Burns, poisons and slows from its moves are twice as strong.'], serene: true },
    'tough-claws': { d: ['+25 % de daño con ataques cuerpo a cuerpo y embestidas.', '+25% damage with melee attacks and dashes.'],
      out: (pl, m) => (m.kind === 'melee' || m.kind === 'dash' ? 1.25 : 1) },
    'reckless': { d: ['+25 % de daño con las embestidas.', '+25% damage with dashes.'],
      out: (pl, m) => (m.kind === 'dash' ? 1.25 : 1) },
    'iron-fist': byName(/punch/, 'los puñetazos', 'punches', 1.25),
    'strong-jaw': byName(/bite|fang|crunch|jaw/, 'los mordiscos', 'bites'),
    'mega-launcher': byName(/pulse|aura-sphere/, 'los pulsos y esferas', 'pulses and spheres'),
    'sharpness': byName(/cut|slash|blade|razor|scissor|sword/, 'los cortes', 'slicing moves'),
    'punk-rock': byName(/voice|buzz|boom|noise|sing|echo|uproar|snarl/, 'los sonidos', 'sound moves'),
    'tinted-lens': { d: ['Sus movimientos poco eficaces hacen daño normal.', 'Its not very effective moves deal normal damage.'],
      out: (pl, m, e) => { const k = e ? mult(m.type, e.types) : 1; return k < 1 ? 1 / k : 1; } },
    'scrappy': { d: ['Sus movimientos Normal y Lucha dañan del todo a los Fantasma.', 'Its Normal and Fighting moves fully hit Ghost types.'],
      out: (pl, m, e) => ((m.type === 'normal' || m.type === 'fighting') && e && (e.types || []).includes('ghost') ? 1 / Math.max(0.3, mult(m.type, e.types)) : 1) },
    'sand-force': { d: ['+30 % de daño Roca, Tierra y Acero con tormenta de arena, y la arena no le daña.', '+30% Rock, Ground and Steel damage in a sandstorm, and sand does not hurt it.'],
      out: (pl, m) => (wx() === 'sand' && ['rock', 'ground', 'steel'].includes(m.type) ? 1.3 : 1), guardWeather: 'sand' },
    'solar-power': { d: ['+40 % de daño especial con sol, pero el sol le quita algo de vida.', '+40% special damage in sun, but the sun drains some HP.'],
      out: (pl, m) => (wx() === 'sun' && G.Mons.moveClass(m) === 's' ? 1.4 : 1),
      tick: (pl, dt) => { if (wx() === 'sun' && pl.hp > pl.maxHp * 0.1) pl.hp -= pl.maxHp * 0.004 * dt; } },
    'sniper': { d: ['Sus golpes críticos hacen ×2 de daño (en vez de ×1,5).', 'Its critical hits deal ×2 damage (instead of ×1.5).'],
      start: pl => { pl.critMul = 2; } },
    'super-luck': { d: ['+10 % de probabilidad de golpe crítico.', '+10% critical hit chance.'],
      start: pl => { pl.critChance += 0.1; } },
    'compound-eyes': { d: ['+6 % de probabilidad de golpe crítico.', '+6% critical hit chance.'],
      start: pl => { pl.critChance += 0.06; } },
    'moxie': moxie, 'chilling-neigh': moxie, 'grim-neigh': moxie, 'beast-boost': moxie,

    // --- velocidad ---
    'speed-boost': { d: ['Cada 10 segundos va un 1,5 % más rápido (hasta +30 %).', 'Every 10 seconds it gets 1.5% faster (up to +30%).'],
      tick: (pl, dt) => { pl.boostT = (pl.boostT || 0) + dt; if (pl.boostT >= 10) { pl.boostT = 0; pl.abSpd = Math.min(0.3, (pl.abSpd || 0) + 0.015); } } },
    'swift-swim': rush('rain', 'lluvia', 'rain'), 'chlorophyll': rush('sun', 'sol', 'sun'),
    'sand-rush': rush('sand', 'tormenta de arena', 'a sandstorm'), 'slush-rush': rush('snow', 'nieve', 'snow'),
    'run-away': { d: ['+8 % de velocidad.', '+8% speed.'], start: pl => { pl.spdMul *= 1.08; } },

    // --- climas ---
    'drought': summon('sun', 'sol', 'sun'), 'orichalcum-pulse': summon('sun', 'sol', 'sun'),
    'drizzle': summon('rain', 'lluvia', 'rain'),
    'sand-stream': summon('sand', 'una tormenta de arena', 'a sandstorm'), 'snow-warning': summon('snow', 'nieve', 'snow'),
    'rain-dish': { d: ['Con lluvia recupera un 1,5 % de vida por segundo.', 'Recovers 1.5% HP per second in rain.'],
      tick: (pl, dt) => { if (wx() === 'rain') pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.015 * dt); } },
    'ice-body': { d: ['Con nieve recupera un 1,5 % de vida por segundo y la nieve no le daña.', 'Recovers 1.5% HP per second in snow, and snow does not hurt it.'],
      tick: (pl, dt) => { if (wx() === 'snow') pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.015 * dt); }, guardWeather: 'snow' },
    'dry-skin': { d: ['El Agua le cura y con lluvia recupera vida, pero el Fuego le hace un 25 % más.', 'Water heals it and rain restores HP, but Fire deals 25% more.'],
      absorb: 'water', inMul: (pl, type) => (type === 'fire' ? 1.25 : 1),
      tick: (pl, dt) => { if (wx() === 'rain') pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.012 * dt); } },

    // --- defensa ---
    'levitate': { d: ['Flota: no le afectan el agua, la lava ni las trampas, y la Tierra le hace muy poco.', 'Floats: unaffected by water, lava and traps, and Ground barely hurts it.'],
      levitate: true, inMul: (pl, type) => (type === 'ground' ? 0.3 : 1) },
    'thick-fat': { d: ['Recibe un 40 % menos de daño de Fuego y Hielo.', 'Takes 40% less damage from Fire and Ice.'],
      inMul: (pl, type) => (type === 'fire' || type === 'ice' ? 0.6 : 1) },
    'heatproof': { d: ['Recibe la mitad de daño de Fuego.', 'Takes half damage from Fire.'], inMul: (pl, type) => (type === 'fire' ? 0.5 : 1) },
    'water-absorb': absorb('water', 'Agua', 'Water'), 'storm-drain': absorb('water', 'Agua', 'Water'),
    'volt-absorb': absorb('electric', 'Eléctrico', 'Electric'), 'lightning-rod': absorb('electric', 'Eléctrico', 'Electric'),
    'motor-drive': absorb('electric', 'Eléctrico', 'Electric'), 'flash-fire': absorb('fire', 'Fuego', 'Fire'),
    'well-baked-body': absorb('fire', 'Fuego', 'Fire'), 'sap-sipper': absorb('grass', 'Planta', 'Grass'),
    'earth-eater': absorb('ground', 'Tierra', 'Ground'),
    'multiscale': { d: ['Con la vida casi llena recibe la mitad de daño.', 'Takes half damage while at (nearly) full HP.'],
      inMul: pl => (pl.hp >= pl.maxHp * 0.95 ? 0.5 : 1) },
    'shadow-shield': { d: ['Con la vida casi llena recibe la mitad de daño.', 'Takes half damage while at (nearly) full HP.'],
      inMul: pl => (pl.hp >= pl.maxHp * 0.95 ? 0.5 : 1) },
    'filter': { d: ['Los ataques muy eficaces le hacen un 25 % menos.', 'Super effective attacks deal 25% less.'],
      inMul: (pl, type) => (type && mult(type, pl.mon.types) > 1 ? 0.75 : 1) },
    'solid-rock': { d: ['Los ataques muy eficaces le hacen un 25 % menos.', 'Super effective attacks deal 25% less.'],
      inMul: (pl, type) => (type && mult(type, pl.mon.types) > 1 ? 0.75 : 1) },
    'prism-armor': { d: ['Los ataques muy eficaces le hacen un 25 % menos.', 'Super effective attacks deal 25% less.'],
      inMul: (pl, type) => (type && mult(type, pl.mon.types) > 1 ? 0.75 : 1) },
    'fur-coat': { d: ['Recibe un 40 % menos de daño físico.', 'Takes 40% less physical damage.'], inMul: (pl, type, cls) => (cls === 'p' ? 0.6 : 1) },
    'fluffy': { d: ['Recibe un 30 % menos de daño físico.', 'Takes 30% less physical damage.'], inMul: (pl, type, cls) => (cls === 'p' ? 0.7 : 1) },
    'ice-scales': { d: ['Recibe un 40 % menos de daño especial.', 'Takes 40% less special damage.'], inMul: (pl, type, cls) => (cls === 's' ? 0.6 : 1) },
    'shell-armor': { d: ['Recibe un 8 % menos de daño.', 'Takes 8% less damage.'], inMul: () => 0.92 },
    'battle-armor': { d: ['Recibe un 8 % menos de daño.', 'Takes 8% less damage.'], inMul: () => 0.92 },
    'intimidate': { d: ['Los enemigos le hacen un 12 % menos de daño físico.', 'Enemies deal 12% less physical damage to it.'], inMul: (pl, type, cls) => (cls === 'p' ? 0.88 : 1) },
    'pressure': { d: ['Recibe un 8 % menos de daño de todo.', 'Takes 8% less damage from everything.'], inMul: () => 0.92 },
    'sturdy': { d: ['Un golpe que le dejaría KO le deja con 1 de vida (cada 90 s).', 'A hit that would KO it leaves it with 1 HP (every 90 s).'], sturdy: true },
    'regenerator': { d: ['Recupera un 0,6 % de su vida por segundo.', 'Recovers 0.6% of its HP per second.'],
      start: pl => { pl.regenFlat += pl.maxHp * 0.006; } },
    'magic-guard': { d: ['Sólo le hacen daño los ataques: ni el clima, ni la lava, ni las trampas de veneno.', 'Only attacks hurt it: no weather, lava or poison trap damage.'], guard: true },
    'stamina': { d: ['Cada golpe cuerpo a cuerpo que recibe le sube un poco la defensa.', 'Each melee hit it takes raises its defense a little.'],
      contact: pl => pl.addBuff('def', 0.03, 6, 5) },
    'limber': steady, 'own-tempo': steady, 'oblivious': steady, 'inner-focus': steady, 'clear-body': steady,
    'white-smoke': steady, 'full-metal-body': steady, 'insomnia': steady, 'vital-spirit': steady,

    // --- contraataques (al recibir un golpe cuerpo a cuerpo) ---
    'static': contact((pl, e) => e.applySlow(0.5, 2.5), 'Quien le golpea cuerpo a cuerpo se queda frenado (paralizado).', 'Whoever hits it in melee is slowed (paralyzed).'),
    'flame-body': contact((pl, e) => e.applyBurn(2), 'Quien le golpea cuerpo a cuerpo se quema.', 'Whoever hits it in melee gets burned.'),
    'poison-point': contact((pl, e) => e.applyPoison(2), 'Quien le golpea cuerpo a cuerpo se envenena.', 'Whoever hits it in melee gets poisoned.'),
    'cute-charm': contact((pl, e) => e.applySlow(0.4, 2.5), 'Quien le golpea cuerpo a cuerpo se queda embobado (frenado).', 'Whoever hits it in melee is smitten (slowed).'),
    'effect-spore': contact((pl, e) => (Math.random() < 0.5 ? e.applySlow(0.45, 2.5) : e.applyPoison(2)), 'Quien le golpea cuerpo a cuerpo se frena o se envenena.', 'Whoever hits it in melee is slowed or poisoned.'),
    'rough-skin': contact((pl, e) => e.hurt(10 + pl.level * 3, '#9aa6b5'), 'Quien le golpea cuerpo a cuerpo recibe daño.', 'Whoever hits it in melee takes damage.'),
    'iron-barbs': contact((pl, e) => e.hurt(10 + pl.level * 3, '#9aa6b5'), 'Quien le golpea cuerpo a cuerpo recibe daño.', 'Whoever hits it in melee takes damage.'),
    'poison-touch': { d: ['Sus ataques cuerpo a cuerpo y embestidas envenenan.', 'Its melee attacks and dashes poison.'], touchPoison: true },

    // --- botín ---
    'pickup': { d: ['+15 % de Pokémonedas al acabar la partida.', '+15% Pokécoins at the end of the run.'], start: pl => { pl.coinMul *= 1.15; } },
    'honey-gather': { d: ['+15 % de Pokémonedas al acabar la partida.', '+15% Pokécoins at the end of the run.'], start: pl => { pl.coinMul *= 1.15; } },
    // ================= desde el 19-10-2026 =================
    // Regla: ninguna hunde a un Pokémon ni lo hace imparable. Las que en los
    // juegos son un lastre son un INTERCAMBIO (algo peor a cambio de algo mejor);
    // las pequeñas o de vez en cuando conservan además la pasiva genérica de su
    // tipo (plusGeneric), para que nadie salga perdiendo respecto a antes.

    // --- las del original con lastre: intercambio ---
    'truant': { d: ['Golpes sueltos y fuertes: tarda un 60 % más en recargar, pero cada golpe hace +35 %.', 'Slow but heavy: recharges take 60% longer, but each hit deals +35%.'],
      cdMul: 1.6, out: () => 1.35 },
    // (Regigigas: sus stats son de los mejores del juego; con el extra de después rompía el juego.)
    'slow-start': { d: ['Arranca lento: el primer minuto hace −40 % de daño y va más despacio; después, a plena potencia.', 'Slow start: for the first minute it deals −40% damage and moves slower; after that, full power.'],
      tick: (pl, dt) => { pl.ssT = (pl.ssT || 0) + dt; },
      out: pl => ((pl.ssT || 0) < 60 ? 0.6 : 1), speed: pl => ((pl.ssT || 0) < 60 ? 0.8 : 1) },
    'defeatist': { d: ['Cañón de cristal: +15 % de daño con más de la mitad de vida; con menos, −25 %.', 'Glass cannon: +15% damage above half HP; below it, −25%.'],
      out: pl => (half(pl) ? 0.75 : 1.15) },
    'wonder-guard': { d: ['Lo que no es muy eficaz apenas le hace daño (35 %); lo muy eficaz, un 50 % más.', 'Anything not super effective barely hurts it (35%); super effective hits deal 50% more.'],
      inMul: (pl, type) => (type && mult(type, pl.mon.types) > 1 ? 1.5 : 0.35) },
    'schooling': { d: ['Forma banco: +25 % de vida y, con más de 1/4 de vida, +50 % de daño.', 'School form: +25% HP and, above 1/4 HP, +50% damage.'],
      start: pl => { pl.maxHp = Math.round(pl.maxHp * 1.25); pl.hp = pl.maxHp; },
      out: pl => (pl.hp > pl.maxHp / 4 ? 1.5 : 1) },
    'zen-mode': { d: ['Con menos de la mitad de vida entra en Modo Daruma: +30 % de daño especial.', 'Below half HP it enters Zen Mode: +30% special damage.'], plusGeneric: true,
      out: (pl, m) => (half(pl) && G.Mons.moveClass(m) === 's' ? 1.3 : 1) },
    'stance-change': { d: ['Alterna cada 8 s entre filo (+20 % de daño) y escudo (−20 % de daño recibido).', 'Switches every 8 s between blade (+20% damage) and shield (−20% damage taken).'],
      tick: (pl, dt) => { pl.stanceT = (pl.stanceT || 0) + dt; if (pl.stanceT >= 8) { pl.stanceT = 0; pl.shieldForm = !pl.shieldForm; } },
      out: pl => (pl.shieldForm ? 1 : 1.2), inMul: pl => (pl.shieldForm ? 0.8 : 1) },
    'imposter': { d: ['Se transforma: sus stats son los de un Pokémon equilibrado (72 en todo).', 'Transforms: its stats become those of a balanced Pokémon (72 in everything).'],
      start: pl => {
        const t = (pl.monLevel - 1) / 99, lm = 1 + 0.5 * t, B = 72;
        pl.maxHp = pl.hp = Math.round((70 + B * 0.45) * lm);
        pl.atkP = pl.atkS = pl.baseAtk = (0.70 + B / 100 * 0.55) * lm;
        pl.redP = pl.redS = (B - 70) / 450 + 0.08 * t;
        pl.baseSpd = Math.round((78 + B * 0.42) * (1 + 0.1 * t));
      } },

    // --- las 60 genéricas más comunes ---
    'keen-eye': { d: ['+5 % de probabilidad de golpe crítico.', '+5% critical hit chance.'], plusGeneric: true, start: pl => { pl.critChance += 0.05; } },
    'frisk': { d: ['Atrae los objetos desde más lejos (+20 % de imán).', 'Pulls items from farther away (+20% magnet).'], plusGeneric: true, start: pl => { pl.magnet *= 1.2; } },
    'magnet-pull': { d: ['Atrae los objetos desde más lejos (+20 % de imán).', 'Pulls items from farther away (+20% magnet).'], plusGeneric: true, start: pl => { pl.magnet *= 1.2; } },
    'sticky-hold': { d: ['Atrae los objetos desde más lejos (+20 % de imán).', 'Pulls items from farther away (+20% magnet).'], plusGeneric: true, start: pl => { pl.magnet *= 1.2; } },
    'sand-veil': { d: ['Con tormenta de arena esquiva el 15 % de los golpes, y la arena no le daña.', 'In a sandstorm it dodges 15% of hits, and sand does not hurt it.'], plusGeneric: true,
      dodge: () => (wx() === 'sand' ? 0.15 : 0), guardWeather: 'sand' },
    'snow-cloak': { d: ['Con nieve esquiva el 15 % de los golpes, y la nieve no le daña.', 'In snow it dodges 15% of hits, and snow does not hurt it.'], plusGeneric: true,
      dodge: () => (wx() === 'snow' ? 0.15 : 0), guardWeather: 'snow' },
    'gluttony': { d: ['Las curas que recoge y las bayas le curan un 40 % más.', 'Healing pickups and berries heal it 40% more.'], plusGeneric: true, healMul: 1.4 },
    'harvest': { d: ['Las curas que recoge y las bayas le curan un 30 % más.', 'Healing pickups and berries heal it 30% more.'], plusGeneric: true, healMul: 1.3 },
    'unnerve': { d: ['Pone nerviosos a los enemigos: le hacen un 6 % menos de daño.', 'Makes enemies nervous: they deal 6% less damage to it.'], plusGeneric: true, inMul: () => 0.94 },
    'infiltrator': { d: ['Sus golpes atraviesan y rompen los escudos de los enemigos.', 'Its hits go through and break enemy shields.'], plusGeneric: true,
      hit: (pl, e) => { if (e.remote) G.Coop.status(e, 'u', 1); else if (e.shield > 0) { e.shield = 0; e.shieldT = 0; } } },
    'telepathy': { d: ['Lee las intenciones: esquiva el 8 % de los golpes.', 'Reads intentions: dodges 8% of hits.'], plusGeneric: true, dodge: () => 0.08 },
    'anticipation': { d: ['Presiente el peligro: esquiva el 6 % de los golpes.', 'Senses danger: dodges 6% of hits.'], plusGeneric: true, dodge: () => 0.06 },
    'forewarn': { d: ['Se lo ve venir: esquiva el 6 % de los golpes.', 'Sees it coming: dodges 6% of hits.'], plusGeneric: true, dodge: () => 0.06 },
    'weak-armor': { d: ['Al recibir un golpe físico se aligera: +20 % de velocidad un momento.', 'When hit physically it gets lighter: +20% speed for a moment.'], plusGeneric: true,
      hurt: (pl, type, cls) => { if (cls === 'p') pl.addBuff('spd', 0.2, 3, 1); } },
    'steadfast': { d: ['Al recibir un golpe, +10 % de velocidad un momento (se acumula).', 'When hit, +10% speed for a moment (stacks).'], plusGeneric: true,
      hurt: pl => pl.addBuff('spd', 0.1, 3, 2) },
    'rattled': { d: ['Los golpes de Bicho, Fantasma o Siniestro le asustan: +25 % de velocidad un momento.', 'Bug, Ghost or Dark hits scare it: +25% speed for a moment.'], plusGeneric: true,
      hurt: (pl, type) => { if (type === 'bug' || type === 'ghost' || type === 'dark') pl.addBuff('spd', 0.25, 4, 1); } },
    'hydration': { d: ['Con lluvia recupera un 1 % de vida por segundo y nada le frena.', 'In rain it recovers 1% HP per second and nothing slows it.'], plusGeneric: true,
      tick: (pl, dt) => { if (wx() === 'rain') { pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.01 * dt); pl.slowT = 0; } } },
    'overcoat': { d: ['Ningún clima le daña y recibe un 5 % menos de daño especial.', 'No weather hurts it and it takes 5% less special damage.'], plusGeneric: true,
      guardWeather: 'all', inMul: (pl, type, cls) => (cls === 's' ? 0.95 : 1) },
    'cloud-nine': { d: ['Ningún clima le daña.', 'No weather hurts it.'], plusGeneric: true, guardWeather: 'all' },
    'shed-skin': { d: ['Cada 5 s muda: se quita los frenazos y recupera un 2 % de vida.', 'Every 5 s it sheds: removes slows and recovers 2% HP.'], plusGeneric: true,
      tick: (pl, dt) => { pl.shedT = (pl.shedT || 0) + dt; if (pl.shedT >= 5) { pl.shedT = 0; pl.slowT = 0; pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.02); } } },
    'rock-head': { d: ['Sus movimientos con retroceso no le hacen daño a él.', 'Its recoil moves do not hurt it.'], plusGeneric: true, noRecoil: true },
    'natural-cure': { d: ['Recupera un 0,3 % de su vida por segundo.', 'Recovers 0.3% of its HP per second.'], plusGeneric: true,
      start: pl => { pl.regenFlat += pl.maxHp * 0.003; } },
    'healer': { d: ['Recupera un 0,3 % de su vida por segundo.', 'Recovers 0.3% of its HP per second.'], plusGeneric: true,
      start: pl => { pl.regenFlat += pl.maxHp * 0.003; } },
    'leaf-guard': { d: ['Con sol no le frena nada y recibe un 15 % menos de daño.', 'In sun nothing slows it and it takes 15% less damage.'], plusGeneric: true,
      tick: pl => { if (wx() === 'sun') pl.slowT = 0; }, inMul: () => (wx() === 'sun' ? 0.85 : 1) },
    'mold-breaker': { d: ['+12 % de daño a los jefes.', '+12% damage to bosses.'], plusGeneric: true, out: (pl, m, e) => (e && e.boss ? 1.12 : 1) },
    'damp': { d: ['Las explosiones de los Pokémon kamikaze no le dañan.', 'Explosions from kamikaze Pokémon do not hurt it.'], plusGeneric: true, damp: true },
    'rivalry': { d: ['+15 % de daño a los enemigos que comparten un tipo con él.', '+15% damage to enemies that share a type with it.'],
      out: (pl, m, e) => (e && (e.types || []).some(t => pl.mon.types.includes(t)) ? 1.15 : 1), plusGeneric: true },
    'synchronize': { d: ['Quien le golpea cuerpo a cuerpo recibe parte del golpe.', 'Whoever hits it in melee takes part of the hit back.'], plusGeneric: true,
      contact: (pl, e) => e.hurt(6 + pl.level * 2, '#ff9fcf') },
    'prankster': { d: ['Sus movimientos de estado se recargan un 30 % antes.', 'Its status moves recharge 30% faster.'], plusGeneric: true, statusCd: 0.7 },
    'early-bird': Object.assign({}, steady, { plusGeneric: true }),
    'shield-dust': Object.assign({}, steady, { plusGeneric: true }),
    'sweet-veil': Object.assign({}, steady, { plusGeneric: true }),
    'unburden': { d: ['Sin objeto va un 15 % más rápido.', 'Without an item it is 15% faster.'], plusGeneric: true, speed: pl => (pl.item ? 1 : 1.15) },
    'unaware': { d: ['No se deja impresionar: recibe un 8 % menos de daño.', 'Unimpressed: takes 8% less damage.'], plusGeneric: true, inMul: () => 0.92 },
    'defiant': { d: ['Si le frenan, se pica: +20 % de daño físico mientras dure.', 'If it is slowed it fights back: +20% physical damage while it lasts.'], plusGeneric: true,
      out: (pl, m) => (pl.isSlowed() && G.Mons.moveClass(m) === 'p' ? 1.2 : 1) },
    'competitive': { d: ['Si le frenan, se pica: +20 % de daño especial mientras dure.', 'If it is slowed it fights back: +20% special damage while it lasts.'], plusGeneric: true,
      out: (pl, m) => (pl.isSlowed() && G.Mons.moveClass(m) === 's' ? 1.2 : 1) },
    'soundproof': { d: ['Recibe un 10 % menos de daño especial.', 'Takes 10% less special damage.'], plusGeneric: true, inMul: (pl, type, cls) => (cls === 's' ? 0.9 : 1) },
    'big-pecks': { d: ['Recibe un 8 % menos de daño físico.', 'Takes 8% less physical damage.'], plusGeneric: true, inMul: (pl, type, cls) => (cls === 'p' ? 0.92 : 1) },
    'water-veil': { d: ['La lava no le quema y recibe la mitad de daño de Fuego.', 'Lava does not burn it and it takes half damage from Fire.'], plusGeneric: true,
      lavaProof: true, inMul: (pl, type) => (type === 'fire' ? 0.5 : 1) },
    'pickpocket': { d: ['Al recibir golpes, a veces les quita una moneda.', 'When hit, it sometimes snatches a coin.'], plusGeneric: true,
      hurt: pl => { if (Math.random() < 0.12) G.Pickups.drop('coin', pl.x + G.U.rand(-10, 10), pl.y + G.U.rand(-10, 10), 2); } },
    'analytic': { d: ['+15 % de daño a enemigos con menos de la mitad de vida.', '+15% damage to enemies below half HP.'], plusGeneric: true,
      out: (pl, m, e) => (e && e.hp < e.maxHp * 0.5 ? 1.15 : 1) },
    'klutz': { d: ['Sin objeto, +12 % de daño.', 'Without an item, +12% damage.'], out: pl => (pl.item ? 1 : 1.12), plusGeneric: true },
    'hyper-cutter': { d: ['+6 % de daño con movimientos físicos.', '+6% damage with physical moves.'], plusGeneric: true,
      out: (pl, m) => (G.Mons.moveClass(m) === 'p' ? 1.06 : 1) },
    'contrary': { d: ['Al revés: lo que le frena le acelera.', 'The other way round: what slows it speeds it up.'], plusGeneric: true,
      speed: pl => { const k = pl.slowFactor(); return k < 0.99 ? 1.2 / k : 1; } },
    'bulletproof': { d: ['Recibe un 15 % menos de daño de los disparos.', 'Takes 15% less damage from shots.'], plusGeneric: true, inMul: (pl, type, cls) => (cls === 's' ? 0.85 : 1) },
    'magic-bounce': { d: ['Recibe un 15 % menos de daño de los disparos y esquiva el 10 %.', 'Takes 15% less damage from shots and dodges 10% of them.'], plusGeneric: true,
      inMul: (pl, type, cls) => (cls === 's' ? 0.85 : 1), dodge: (pl, type, cls) => (cls === 's' ? 0.1 : 0) },
    'friend-guard': { d: ['Recibe un 6 % menos de daño.', 'Takes 6% less damage.'], plusGeneric: true, inMul: () => 0.94 },
    'stench': { d: ['Sus golpes a veces frenan (1 de cada 10).', 'Its hits sometimes slow (1 in 10).'], plusGeneric: true,
      hit: (pl, e) => { if (Math.random() < 0.1) e.applySlow(0.35, 1.5); } },
    'anger-point': { d: ['La primera vez que baja de la mitad de vida se enfurece: +25 % de daño el resto de la partida.', 'The first time it drops below half HP it gets angry: +25% damage for the rest of the run.'],
      tick: pl => { if (!pl.angry && half(pl)) { pl.angry = true; G.FX.dmgText(pl.x, pl.y - pl.bodyH - 16, '¡Irascible!', '#ff6b4d', true); } },
      out: pl => (pl.angry ? 1.25 : 1) },
    'justified': { d: ['+15 % de daño a los Pokémon de tipo Siniestro.', '+15% damage to Dark-type Pokémon.'], plusGeneric: true,
      out: (pl, m, e) => (e && (e.types || []).includes('dark') ? 1.15 : 1) },
    'cursed-body': contact((pl, e) => { if (Math.random() < 0.3) e.applySlow(0.5, 2); }, 'A veces frena a quien le golpea cuerpo a cuerpo.', 'Sometimes slows whoever hits it in melee.'),
    'quick-feet': { d: ['Frenado, va un 25 % más rápido (en vez de más lento).', 'When slowed, it goes 25% faster (instead of slower).'], plusGeneric: true,
      speed: pl => { const k = pl.slowFactor(); return k < 0.99 ? 1.25 / k : 1; } },
    'plus': { d: ['+10 % de daño con movimientos especiales.', '+10% damage with special moves.'], out: (pl, m) => (G.Mons.moveClass(m) === 's' ? 1.1 : 1) },
    'minus': { d: ['+10 % de daño con movimientos especiales.', '+10% damage with special moves.'], out: (pl, m) => (G.Mons.moveClass(m) === 's' ? 1.1 : 1) },
    'no-guard': { d: ['Todo acierta: +15 % de daño hecho, pero recibe un 10 % más.', 'Everything hits: +15% damage dealt, but takes 10% more.'],
      out: () => 1.15, inMul: () => 1.1 },
    'aftermath': { d: ['Una vez por partida, al quedar con poca vida, explota y daña a los de alrededor.', 'Once per run, when low on HP, it explodes and hurts everything around.'], plusGeneric: true,
      tick: pl => {
        if (pl.boomed || pl.hp >= pl.maxHp * 0.2 || pl.dead) return;
        pl.boomed = true;
        G.FX.ring(pl.x, pl.y, 10, 140, '#ff7b3d', 0.5, 6); G.Camera.kick(0.6); G.Audio.sfx('break');
        for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, 140)) e.hurt(40 + pl.level * 10, '#ff7b3d', e.x - pl.x, e.y - pl.y, 160);
      } },
    // Lleva su propio +10 % (pl.mood), aparte de los buffs: antes usaba addBuff con
    // tope 1 y, al tocarle el mismo stat, dejaba en 1 las 5 cargas de Danza Espada.
    'moody': { d: ['Cada 10 s, +10 % a algo al azar: ataque, ataque especial, velocidad o defensa.', 'Every 10 s, +10% to something at random: attack, special attack, speed or defense.'], plusGeneric: true,
      tick: (pl, dt) => {
        pl.moodT = (pl.moodT || 0) - dt;
        if (pl.moodT > 0) return;
        pl.moodT = 10; pl.mood = G.U.pick(['atk', 'spa', 'spd', 'def']);
        const c = { atk: '#ff6b4d', spa: '#ff8ad8', spd: '#7fe0ff', def: '#b0b8c8' }[pl.mood];
        G.FX.ring(pl.x, pl.y, pl.r * 2.4, pl.r * 1.1, c, 0.35, 2.5);
        G.FX.dmgText(pl.x, pl.y - pl.r * 2, '+' + { atk: 'ATK', spa: 'AT.E', spd: 'VEL', def: 'DEF' }[pl.mood], c);   // como en el HUD
      },
      out: (pl, m) => (pl.mood === (G.Mons.moveClass(m) === 's' ? 'spa' : 'atk') ? 1.1 : 1),
      speed: pl => (pl.mood === 'spd' ? 1.1 : 1),
      inMul: pl => (pl.mood === 'def' ? 0.9 : 1) },
    'tangled-feet': { d: ['Frenado, esquiva el 20 % de los golpes.', 'When slowed, it dodges 20% of hits.'], plusGeneric: true, dodge: pl => (pl.isSlowed() ? 0.2 : 0) },
    'skill-link': { d: ['+25 % de daño con los movimientos de varios golpes.', '+25% damage with multi-hit moves.'], plusGeneric: true,
      out: (pl, m) => (m.multi || (m.count || 1) > 2 ? 1.25 : 1) },
    'illuminate': { d: ['Ve más en el apagón y atrae los objetos desde más lejos (+10 % de imán).', 'Sees farther in a blackout and pulls items from farther away (+10% magnet).'], plusGeneric: true,
      seeFar: 1.6, start: pl => { pl.magnet *= 1.1; } },
    'protosynthesis': { d: ['Con sol, +20 % de daño.', 'In sun, +20% damage.'], plusGeneric: true, out: () => (wx() === 'sun' ? 1.2 : 1) },
    'pure-power': null, 'libero': null,
  };
  FX['pure-power'] = FX['huge-power'];                // Energía Pura = Potencia
  FX['libero'] = FX['protean'];                       // Líbero = Mutatipo

  const TYPE_ES = { normal: 'Normal', fire: 'Fuego', water: 'Agua', grass: 'Planta', electric: 'Eléctrico', ice: 'Hielo',
    fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho', rock: 'Roca',
    ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro', steel: 'Acero', fairy: 'Hada' };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /** Pasiva genérica: +8 % con los movimientos de su tipo principal. */
  function generic(mon) {
    const t = mon.types[0];
    return { generic: true, d: ['+8 % de daño con movimientos de tipo ' + TYPE_ES[t] + '.', '+8% damage with ' + cap(t) + '-type moves.'],
      out: (pl, m) => (m.type === t ? 1.08 : 1) };
  }

  /**
   * Efecto de la habilidad `id` para el Pokémon `mon` (nunca null). Las que
   * llevan plusGeneric suman además la pasiva genérica (+8 % a su tipo).
   */
  function of(id, mon) {
    const fx = id && FX[id];
    if (!fx) return generic(mon);
    if (!fx.plusGeneric) return fx;
    const g = generic(mon);
    return Object.assign({}, fx, {
      d: [fx.d[0] + ' ' + g.d[0], fx.d[1] + ' ' + g.d[1]],
      out: (pl, m, e) => (fx.out ? fx.out(pl, m, e) : 1) * g.out(pl, m, e)
    });
  }

  return { FX, of };
})();
