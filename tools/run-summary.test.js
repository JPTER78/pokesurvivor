/* ============ run-summary.test.js — pruebas de G.RunSummary ============
 *   node tools/run-summary.test.js
 *
 * Carga el módulo puro (sin navegador) y comprueba que convierte bien el
 * estado del jugador en los datos que pinta el panel "Tu partida" de la pausa.
 */
const fs = require('fs');
const path = require('path');

global.G = {};
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'run-summary.js'), 'utf8');
new Function('G', src + '\nreturn G.RunSummary;')(global.G);

const S = global.G.RunSummary;
let passed = 0, failed = 0;

function t(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('FALLA  ' + name + '\n       ' + e.message); }
}
function eq(a, b, msg) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((msg ? msg + ': ' : '') + 'esperado ' + B + ' · recibido ' + A);
}

const ITEMS = { leftovers: { name: 'Restos', desc: 'Recuperas vida con el daño.' } };

// Jugador de mentira con la misma forma que G.Player (solo lo que usa el panel).
function fakePl(over = {}) {
  const moves = over.moves || [
    { id: 'ember', name: 'Ascuas', lvl: 3, type: 'fire', kind: 'projectile', dmg: 12, cd: 0.5, count: 3, pierce: 1 },
    { id: 'water-gun', name: 'Pistola Agua', lvl: 1, type: 'water', kind: 'projectile', dmg: 14, cd: 0.44 }
  ];
  const pl = Object.assign({
    dex: 4, mon: { dex: 4, name: 'Charmander', types: ['fire'] }, shiny: false,
    level: 7, hp: 45, maxHp: 90, bonds: 2,
    atk: 25, cdMul: 1, critChance: 0.15,
    slots: moves.map(m => [m]), active: 1,
    item: 'leftovers',
    buffs: {
      atk: { n: 2, t: 5, amount: .1 }, spd: { n: 0, t: 0, amount: 0 },
      def: { n: 0, t: 0, amount: 0 }, regen: { n: 1, t: 0, amount: .2 }
    },
    kills: 30, bosses: 2, dmgDealt: 12345.7, coins: 99, t1: 1, t10: 0
  }, over);
  pl.moves = moves;
  return pl;
}

t('sin jugador devuelve null', () => eq(S.build(null, 10), null));

t('cabecera: nombre, nivel, dex, shiny y vida', () => {
  const r = S.build(fakePl(), 100, { items: ITEMS });
  eq(r.name, 'Charmander'); eq(r.level, 7); eq(r.dex, 4); eq(r.shiny, false);
  eq(r.hp, 45); eq(r.maxHp, 90); eq(r.hpFrac, 0.5); eq(r.bonds, 2);
});

t('marca shiny si el jugador lo es', () => eq(S.build(fakePl({ shiny: true }), 0, { items: ITEMS }).shiny, true));

t('la fracción de vida se acota entre 0 y 1', () => {
  eq(S.build(fakePl({ hp: -5 }), 0, { items: ITEMS }).hpFrac, 0);
  eq(S.build(fakePl({ hp: 999 }), 0, { items: ITEMS }).hpFrac, 1);
  eq(S.build(fakePl({ hp: 0, maxHp: 0 }), 0, { items: ITEMS }).hpFrac, 0);
});

t('movimientos por hueco, con nivel y hueco activo', () => {
  const r = S.build(fakePl(), 0, { items: ITEMS });
  eq(r.slots.length, 2);
  eq(r.slots[0].n, 1); eq(r.slots[1].n, 2);
  eq(r.slots[0].moves[0].name, 'Ascuas'); eq(r.slots[0].moves[0].lvl, 3); eq(r.slots[0].moves[0].type, 'fire');
  eq([r.slots[0].active, r.slots[1].active], [false, true]);
});

t('sin huecos devuelve lista vacía', () => eq(S.build(fakePl({ slots: [] }), 0, { items: ITEMS }).slots, []));

t('daño por golpe = daño del movimiento × ataque', () => {
  const m = S.build(fakePl(), 0, { items: ITEMS }).slots[0].moves[0];
  eq(m.dmg, 12 * 25);        // 300
});

t('DPS = daño × golpes ÷ recarga', () => {
  const m = S.build(fakePl(), 0, { items: ITEMS }).slots[0].moves[0];
  eq({ dmg: m.dmg, hits: m.hits, cd: m.cd, dps: m.dps }, { dmg: 300, hits: 3, cd: 0.5, dps: 1800 });
});

t('sin "count" hay un solo golpe por lanzamiento', () => {
  const m = S.build(fakePl(), 0, { items: ITEMS }).slots[1].moves[0];
  eq({ hits: m.hits, dmg: m.dmg, cd: m.cd, dps: m.dps }, { hits: 1, dmg: 350, cd: 0.44, dps: 795 });
});

t('la recarga aplica el multiplicador del jugador (Reflejos, Garra Rápida)', () => {
  const m = S.build(fakePl({ cdMul: 0.5 }), 0, { items: ITEMS }).slots[0].moves[0];
  eq(m.cd, 0.25); eq(m.dps, 3600);
});

t('una recarga mínima de 0.05 s nunca da infinito', () => {
  const mv = { id: 'x', name: 'X', lvl: 1, type: 'fire', kind: 'nova', dmg: 10, cd: 0.0001 };
  eq(S.build(fakePl({ moves: [mv] }), 0, { items: ITEMS }).slots[0].moves[0].cd, 0.05);
});

t('efectos: perforación y duración', () => {
  const mv = { id: 'x', name: 'X', lvl: 1, type: 'fire', kind: 'mine', dmg: 8, cd: 1, pierce: 2, dur: 7 };
  const m = S.build(fakePl({ moves: [mv] }), 0, { items: ITEMS }).slots[0].moves[0];
  eq({ pierce: m.pierce, dur: m.dur }, { pierce: 2, dur: 7 });
});

t('efectos de estado: quema, veneno, ralentiza y drena', () => {
  const mv = { id: 'x', name: 'X', lvl: 1, type: 'fire', kind: 'aura', dmg: 5, cd: 1, burn: 1, poison: 1, slow: 0.4, drain: 1 };
  const m = S.build(fakePl({ moves: [mv] }), 0, { items: ITEMS }).slots[0].moves[0];
  eq({ burn: m.burn, poison: m.poison, slow: m.slow, drain: m.drain }, { burn: true, poison: true, slow: 0.4, drain: true });
});

t('movimiento de mejora: efecto en % y duración, sin daño', () => {
  const mv = { id: 'sd', name: 'Danza Espada', lvl: 1, type: 'normal', kind: 'buff', stat: 'atk', amount: 0.13, dur: 7, stacks: 5 };
  const m = S.build(fakePl({ moves: [mv] }), 0, { items: ITEMS }).slots[0].moves[0];
  eq(m.buff, { label: 'Ataque', unit: 'de daño', pct: 13, rate: 0, dur: 7, stacks: 5 });
  eq({ dmg: m.dmg, dps: m.dps }, { dmg: 0, dps: 0 });
});

t('la regeneración no es un porcentaje: son puntos de vida por segundo', () => {
  const mv = { id: 'ar', name: 'Acua Aro', lvl: 1, type: 'water', kind: 'buff', stat: 'regen', amount: 1.6, dur: 8, stacks: 4 };
  const m = S.build(fakePl({ moves: [mv] }), 0, { items: ITEMS }).slots[0].moves[0];
  eq(m.buff, { label: 'Regeneración', unit: 'vida/s', pct: 0, rate: 1.6, dur: 8, stacks: 4 });
});

t('la mejora activa suma las acumulaciones (Acua Aro ×4 = 6.4 vida/s)', () => {
  const buffs = { atk: { n: 0, t: 0 }, spd: { n: 0, t: 0 }, def: { n: 0, t: 0 }, regen: { n: 4, t: 6, amount: 1.6 } };
  const b = S.build(fakePl({ buffs }), 0, { items: ITEMS }).buffs[0];
  eq({ id: b.id, n: b.n, rate: b.rate, t: b.t }, { id: 'regen', n: 4, rate: 6.4, t: 6 });
});

t('velocidad y defensa también son porcentajes', () => {
  eq(S.buffValue('spd', 0.3), { label: 'Velocidad', unit: '', pct: 30, rate: 0 });
  eq(S.buffValue('def', 0.14), { label: 'Defensa', unit: '', pct: 14, rate: 0 });
});

t('ventaja del ataque en porcentaje (×1.34 = +34%)', () => {
  const s = S.build(fakePl({ atk: 1.339 }), 0, { items: ITEMS }).stats;
  eq({ atk: s.atk, atkPct: s.atkPct }, { atk: 1.34, atkPct: 34 });
  eq(S.build(fakePl({ atk: 1 }), 0, { items: ITEMS }).stats.atkPct, 0);
});

t('ataque y crítico del jugador en las estadísticas', () => {
  const s = S.build(fakePl(), 0, { items: ITEMS }).stats;
  eq({ atk: s.atk, crit: s.crit }, { atk: 25, crit: 15 });
});

t('objeto: nombre y descripción del catálogo', () => {
  eq(S.build(fakePl(), 0, { items: ITEMS }).item, { id: 'leftovers', name: 'Restos', desc: 'Recuperas vida con el daño.' });
});

t('sin objeto', () => eq(S.build(fakePl({ item: null }), 0, { items: ITEMS }).item, null));

t('objeto desconocido usa el id como nombre', () => {
  eq(S.build(fakePl({ item: 'misterio' }), 0, { items: ITEMS }).item, { id: 'misterio', name: 'misterio', desc: '' });
});

t('buffs: solo los activos, con etiqueta, icono, unidades y tiempo', () => {
  const b = S.build(fakePl(), 0, { items: ITEMS }).buffs;
  eq(b.map(x => x.id), ['atk', 'regen']);
  eq({ label: b[0].label, icon: b[0].icon, n: b[0].n, t: b[0].t, pct: b[0].pct, unit: b[0].unit },
     { label: 'Ataque', icon: 'fist', n: 2, t: 5, pct: 20, unit: 'de daño' });
  // 1 pila de +0.2: vida por segundo, no un 20%.
  eq({ pct: b[1].pct, rate: b[1].rate, unit: b[1].unit }, { pct: 0, rate: 0.2, unit: 'vida/s' });
});

t('sin buffs activos la lista va vacía', () => {
  const none = { atk: { n: 0, t: 0 }, spd: { n: 0, t: 0 }, def: { n: 0, t: 0 }, regen: { n: 0, t: 0 } };
  eq(S.build(fakePl({ buffs: none }), 0, { items: ITEMS }).buffs, []);
});

t('números de la run: daño redondeado y el resto tal cual', () => {
  const s = S.build(fakePl(), 90.6, { items: ITEMS }).stats;
  eq({ time: s.time, kills: s.kills, bosses: s.bosses, damage: s.damage, coins: s.coins, t1: s.t1, t10: s.t10 },
     { time: 90.6, kills: 30, bosses: 2, damage: 12346, coins: 99, t1: 1, t10: 0 });
});

t('valores basura no rompen el panel (cuentan como 0)', () => {
  const r = S.build(fakePl({ level: 'x', kills: undefined, dmgDealt: NaN, coins: null, t1: '3', atk: 'x', cdMul: 0, critChance: NaN }), 'nope', { items: ITEMS });
  eq(r.level, 0); eq(r.stats.time, 0); eq(r.stats.kills, 0);
  eq(r.stats.atk, 0); eq(r.stats.crit, 0);
  eq(r.stats.damage, 0); eq(r.stats.coins, 0); eq(r.stats.t1, 3);
  eq(r.slots[0].moves[0].cd, 0.5);   // cdMul=0 no puede acelerar la recarga
});

t('tira de G.Items.BY si no se le pasa catálogo', () => {
  global.G.Items = { BY: ITEMS };
  eq(S.build(fakePl(), 0).item.name, 'Restos');
  delete global.G.Items;
});

// Catálogo de cartas de nivel (recortado), con la misma forma que G.LevelUp.STATS.
const STATS = [
  { id: 'hp', icon: 'heart', title: 'Vigor' },
  { id: 'atk', icon: 'fist', title: 'Potencia' },
  { id: 'cd', icon: 'clock', title: 'Reflejos' },
  { id: 'heal', icon: 'berry', title: 'Baya Zidra' }
];

/** Carga el levelup.js de verdad para comparar con sus números. */
function levelup() {
  return new Function('G', fs.readFileSync(path.join(__dirname, '..', 'js', 'systems', 'levelup.js'), 'utf8') + '\nreturn G.LevelUp;')(global.G);
}

t('mejoras de la run: sólo las cogidas, con cuántas veces, en orden y con su efecto', () => {
  const u = S.build(fakePl({ statsTaken: { atk: 3, hp: 1 } }), 0, { items: ITEMS, stats: STATS }).upgrades;
  eq(u, [
    { id: 'hp', icon: 'heart', name: 'Vigor', n: 1, effect: '+20 de vida máxima' },
    { id: 'atk', icon: 'fist', name: 'Potencia', n: 3, effect: '+33% de daño' }
  ]);
});

t('efecto de cada carta: lo que suma cada vez que la coges', () => {
  const fx = S.upgradeEffect;
  eq(fx('hp', 2), '+40 de vida máxima');
  eq(fx('atk', 1), '+10% de daño');          // Potencia multiplica: 1.10
  eq(fx('atk', 3), '+33% de daño');          // 1.10³ = +33.1%
  eq(fx('spd', 1), '+7% de velocidad');
  eq(fx('cd', 1), '-8% de recarga');         // Reflejos multiplica: 0.92
  eq(fx('cd', 2), '-15% de recarga');        // 0.92² = -15.36%
  eq(fx('def', 1), '-6% de daño recibido');
  eq(fx('def', 12), '-70% de daño recibido'); // Coraza tiene tope del 70%
  eq(fx('rgn', 2), '+1.8 vida/s');            // Síntesis suma 0.9 por carta
  eq(fx('mag', 1), '+30% de recogida');
  eq(fx('xp', 2), '+25% de experiencia');     // Aprendizaje multiplica: 1.12
  eq(fx('heal', 3), '');                      // la Baya Zidra no se pinta
  eq(fx('raro', 1), '');                      // carta desconocida: sin efecto
});

t('todas las cartas de nivel tienen su efecto calculado', () => {
  // Carga el catálogo real (las funciones de dentro no se usan aquí).
  const lu = levelup();
  const faltan = lu.STATS.filter(s => s.id !== 'heal' && !(s.id in S.UPGRADES)).map(s => s.id);
  eq(faltan, []);
  const sobran = Object.keys(S.UPGRADES).filter(id => !lu.STATS.some(s => s.id === id));
  eq(sobran, []);
});

t('los números del panel cuadran con lo que hacen de verdad las cartas', () => {
  // Aplica cada carta a un jugador de mentira y compara el resultado con lo que
  // enseña UPGRADES: si alguien cambia un número en levelup.js, esto falla.
  const FIELD = { hp: 'maxHp', atk: 'atkMul', spd: 'spdMul', cd: 'cdMul', def: 'dmgReduce', rgn: 'regenFlat', mag: 'magnet', xp: 'xpMul' };
  const probe = () => ({
    maxHp: 0, atkMul: 1, spdMul: 1, cdMul: 1, dmgReduce: 0, regenFlat: 0, magnet: 1, xpMul: 1,
    addMaxHp(h) { this.maxHp += h; }, heal() {}
  });
  for (const s of levelup().STATS) {
    if (s.id === 'heal') continue;
    const u = S.UPGRADES[s.id], f = FIELD[s.id];
    if (!u || !f) throw new Error('el panel no sabe calcular la carta ' + s.id);
    const pl = probe();
    const before = pl[f];
    s.apply(pl);
    const got = u.mul !== 1 ? pl[f] : (pl[f] - before) * (u.pct ? 100 : 1);
    const want = u.mul !== 1 ? u.mul : u.add;
    if (Math.abs(got - want) > 1e-9) throw new Error(s.id + ': la carta hace ' + got + ' y el panel dice ' + want);
    // Y el texto que se enseña tiene que empezar como toca (+, -).
    const txt = S.upgradeEffect(s.id, 1);
    if (!/^[+-]/.test(txt)) throw new Error(s.id + ': efecto sin signo (' + txt + ')');
  }
});

t('la Baya Zidra (curación instantánea) no sale como mejora', () => {
  const u = S.build(fakePl({ statsTaken: { heal: 4 } }), 0, { items: ITEMS, stats: STATS }).upgrades;
  eq(u, []);
});

t('sin cartas cogidas la lista va vacía', () => {
  eq(S.build(fakePl(), 0, { items: ITEMS, stats: STATS }).upgrades, []);
});

t('poder de altar activo: nombre, efecto, icono y lo que le queda', () => {
  const pl = fakePl({ power: { def: { id: 'dmg', name: 'Furia', desc: 'daño ×2' }, t: 12.4, dur: 25 } });
  eq(S.build(pl, 0, { items: ITEMS, stats: STATS }).power,
     { id: 'dmg', icon: 'fist', name: 'Furia', desc: 'daño ×2', t: 12.4 });
});

t('cada poder tiene su icono (y uno de reserva si es desconocido)', () => {
  const icon = id => S.build(fakePl({ power: { def: { id, name: 'X', desc: '' }, t: 5 } }), 0).power.icon;
  eq({ dmg: icon('dmg'), spd: icon('spd'), mag: icon('mag'), cd: icon('cd'), raro: icon('raro') },
     { dmg: 'fist', spd: 'boot', mag: 'magnet', cd: 'clock', raro: 'star' });
});

t('sin poder de altar no hay nada que pintar', () => {
  eq(S.build(fakePl(), 0, { items: ITEMS }).power, null);
});

t('cada poder de altar tiene su icono, y no sobra ninguno', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'systems', 'interact.js'), 'utf8');
  const it = new Function('G', src + '\nreturn G.Interact;')(global.G);
  const ids = it.POWERS.map(p => p.id);
  eq(ids.filter(id => !(id in S.POWER_ICON)), []);                        // poder nuevo sin icono
  eq(Object.keys(S.POWER_ICON).filter(id => ids.indexOf(id) < 0), []);    // icono de un poder que ya no existe
});

t('BUFFS expone las cuatro mejoras en orden', () => {
  eq(S.BUFFS.map(b => b.id), ['atk', 'spd', 'def', 'regen']);
});

console.log('\n' + passed + ' ok · ' + failed + ' fallos');
process.exit(failed ? 1 : 0);
