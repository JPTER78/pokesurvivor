/* Pruebas de datos y lógica del juego (sin navegador).
 *   node tools/test.js
 * Carga los mismos archivos que el juego en un sandbox, como tools/export_data.js.
 * Los módulos de dibujo y sonido se sustituyen por stubs (ver stubs()).
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const noop = () => {};
const fakeCtx = new Proxy({}, { get: () => noop });
const G = {};
const sandbox = {
  G, console, Math, JSON, Date, Map, Set, Object, Array, Number, String, RegExp, Promise, Symbol, Infinity, NaN,
  isFinite, parseInt, parseFloat, Error,
  location: { pathname: '/', protocol: 'file:' }, navigator: { language: 'es', languages: ['es'] },
  // En inglés: así las pruebas de traducción comprueban que cada texto nuevo tiene entrada
  // (G.I18n.t devuelve el mismo texto cuando el idioma es español).
  localStorage: { getItem: () => 'en', setItem: noop }, confirm: noop, alert: noop,
  document: { documentElement: {}, createElement: () => ({ getContext: () => fakeCtx, width: 0, height: 0 }),
              addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], body: {}, getElementById: () => null },
  addEventListener: noop, matchMedia: () => ({ matches: false }), CanvasRenderingContext2D: function () {}, Image: function () {},
  performance: { now: () => Date.now() }, setTimeout: noop, setInterval: noop, requestAnimationFrame: noop, cancelAnimationFrame: noop
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const load = f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });

/** Sustitutos de los módulos con dibujo/sonido que la lógica llama pero que aquí no existen. */
function stubs() {
  class Animator { constructor() { this.dir = 0; this.cur = 'Idle'; } update() {} play() {} loop() {} busy() { return false; } progress() { return 1; } _start() {} draw() {} }
  G.Sprites = { Animator, bodyRadius: () => 10, bodyHeight: () => 20, hasShiny: () => false, animMeta: () => null, dirFromAngle: () => 0, drawShadow: noop, preload: noop, hovers: () => false };
  G.Audio = { sfx: noop, music: noop };
  G.FX = { ring: noop, burst: noop, dmgText: noop, spark: noop, slash: noop, beam: noop, sp: noop, trail: noop, twinkle: noop, px: noop };
  G.Camera = { kick: noop, sees: () => true, x: 0, y: 0 };
  G.VFX = { forMove: () => ({ pal: 'normal', proj: 'ball' }), forType: () => ({ pal: 'normal', proj: 'ball' }), draw: noop, spins: () => false, sp: noop };
  G.Weather = { mult: () => 1, speedFor: () => 1 };
  G.World = { isWall: () => false, isFree: () => true, isLiquid: () => false, collide: noop, propsInCircle: () => [], damageProp: noop,
              nearestBreakable: () => null, projectileBlock: () => null, liquidEffect: () => ({}) };
  G.Projectiles = G.Projectiles || { clearOrbs: noop, all: () => [], spawn: noop, spawnOrb: noop, remove: noop, nearest: () => null };
  G.EnemyMgr = { queryCircle: () => [], all: () => [] };
  G.Coop = { active: false, isHost: false, cast: noop, status: noop, hit: noop };
  G.Input = { axis: () => [0, 0] };
  G.Items = G.Items || { BY: {} };
  G.Progress = { event: noop };
  G.Settings = { get: () => true };
  G.Game = { state: 'playing', player: null, st: { time: 0 }, everyone: () => [] };
  G.Icons = { draw: noop, html: () => '' };
  G.Touch = { active: false, addButton: noop, clearButtons: noop };
  G.Spawner = G.Spawner || { say: noop };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function eq(a, b, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} esperado ${JSON.stringify(b)}, hay ${JSON.stringify(a)}`); }
function ok(v, msg = 'falso') { if (!v) throw new Error(msg); }
function throws(fn, msg = 'no lanzó') { let t = false; try { fn(); } catch (e) { t = true; } if (!t) throw new Error(msg); }

// ---------------- carga base ----------------
for (const f of ['js/core/util.js', 'js/core/i18n.js', 'js/data/lang-en.js', 'js/core/settings.js', 'js/data/pokedex.js',
                 'js/data/sprites-meta.js', 'js/data/moves.js', 'js/data/types.js', 'js/data/starters.js', 'js/data/items.js']) load(f);
stubs();

// ---- Task 1
test('cada movimiento tiene escalera de mejoras y nivel máximo 5', () => {
  for (const m of G.Moves.ALL) { ok(Array.isArray(m.ups), m.id + ' sin ups'); eq(m.maxLvl, 5, m.id); }
});
test('cada movimiento de ataque tiene evolución', () => {
  for (const m of G.Moves.ALL) if (m.kind !== 'buff') ok(G.Moves.EVO[m.id], m.id + ' sin evolución');
});

// ---- Task 2
test('ya no hay potenciadores en el catálogo', () => {
  eq(G.Moves.ALL.filter(m => m.kind === 'buff').length, 0);
  for (const id of ['swords-dance', 'agility', 'harden', 'aqua-ring', 'dragon-dance']) ok(!G.Moves.BY_ID[id], id + ' sigue');
});
test('Dragón tiene dos ataques: Furia Dragón y Dragoaliento', () => {
  eq(G.Moves.POOL.dragon.slice().sort(), ['dragon-breath', 'dragon-rage']);
  eq(G.Moves.EVO['dragon-breath'], ['Pulso Dragón', 'cd']);
});
test('cuerpo a cuerpo y embestida pegan ×1,4 (Placaje 18, Ataque Rápido 28)', () => {
  eq(G.Moves.BY_ID.tackle.dmg, 18); eq(G.Moves.BY_ID['quick-attack'].dmg, 28); eq(G.Moves.BY_ID['body-slam'].dmg, 42);
});
test('la escalera de cuerpo a cuerpo sube +50% y +60%', () => {
  const L = G.Moves.BY_ID.tackle.ups;
  eq(L[0].m.dmg, 1.5); eq(L[3].m.dmg, 1.6);
});
test('register añade un movimiento sin meterlo en el pool', () => {
  G.Moves.register({ id: 'zz-test', name: 'Prueba', type: 'fire', kind: 'nova', desc: '', cd: 1, dmg: 1, speed: 1, count: 3, life: 1, size: 1 });
  ok(G.Moves.BY_ID['zz-test']); eq(G.Moves.BY_ID['zz-test'].maxLvl, 5);
  ok(!G.Moves.POOL.fire.includes('zz-test'));
  const i = G.Moves.instance('zz-test', 3); eq(i.lvl, 3); eq(i.count, 7);   // nova: +4 proyectiles en el nivel 2
});
test('evoInfo mira si LLEVAS la pasiva', () => {
  const m = G.Moves.instance('ember', 5);
  ok(!G.Moves.evoInfo(m, () => false).ready);
  ok(G.Moves.evoInfo(m, id => id === 'atk').ready);
  eq(G.Moves.evoInfo(m, () => false).needs, 'atk');
});
test('nombres nuevos tienen traducción', () => {
  for (const es of ['Dragoaliento', 'Pulso Dragón']) ok(G.I18n.t(es) !== es, es);
});

// ---- Task 3
load('js/data/passives.js');
test('8 pasivas, ids únicos, cubren las condiciones de evolución', () => {
  eq(G.Passives.LIST.length, 8);
  eq(new Set(G.Passives.LIST.map(p => p.id)).size, 8);
  for (const [, needs] of Object.values(G.Moves.EVO)) ok(G.Passives.BY[needs], 'evolución pide pasiva inexistente: ' + needs);
  eq(G.Passives.MAX, 4); eq(G.Passives.MAX_LVL, 5);
});
test('aplicar Potencia sube el daño un 10%', () => {
  const pl = { atkMul: 1 };
  G.Passives.BY.atk.apply(pl);
  ok(Math.abs(pl.atkMul - 1.1) < 1e-9);
});
test('las descripciones de las pasivas tienen traducción', () => {
  for (const p of G.Passives.LIST) ok(G.I18n.t(p.desc) !== p.desc, p.id);
});

// ---- Task 4
load('js/entities/player.js');
const mkPlayer = (types = ['fire']) => new G.Player({ dex: 4, name: 'Charmander', types, hp: 100, spd: 100, atk: 1 }, {}, false);
test('hasta 6 movimientos, el primero queda enfocado', () => {
  const pl = mkPlayer();
  for (const id of ['ember', 'flamethrower', 'fire-spin', 'heat-wave', 'tackle', 'quick-attack']) ok(pl.addMove(id), id);
  ok(!pl.addMove('body-slam'), 'séptimo');
  eq(pl.moves.length, 6); eq(pl.focus, 0); eq(pl.focused().id, 'ember');
  ok(!pl.addMove('ember'), 'repetido');
});
test('enfocar: 1-6 y ciclar, ×1,25 al enfocado', () => {
  const pl = mkPlayer();
  pl.addMove('ember'); pl.addMove('tackle');
  pl.setFocus(1); eq(pl.focused().id, 'tackle');
  eq(pl.dmgMul(pl.moves[1]), 1.25); eq(pl.dmgMul(pl.moves[0]), 1);
  pl.cycle(1); eq(pl.focus, 0); pl.cycle(-1); eq(pl.focus, 1);
  pl.setFocus(5); eq(pl.focus, 1, 'índice fuera de rango se ignora');
});
test('Cinta Elección impide cambiar el enfoque', () => {
  const pl = mkPlayer(); pl.addMove('ember'); pl.addMove('tackle');
  pl.item = 'choiceband';
  pl.setFocus(1); eq(pl.focus, 0);
});
test('pasivas: hasta 4, con nivel hasta 5, y hasPassive', () => {
  const pl = mkPlayer();
  ok(pl.addPassive('atk')); ok(!pl.addPassive('atk'), 'repetida');
  ok(pl.hasPassive('atk')); ok(!pl.hasPassive('spd'));
  ok(Math.abs(pl.atkMul - 1.1) < 1e-9);
  for (let i = 0; i < 4; i++) pl.levelPassive(pl.passive('atk'));
  eq(pl.passive('atk').lvl, 5); ok(!pl.levelPassive(pl.passive('atk')), 'tope');
  ok(pl.addPassive('spd')); ok(pl.addPassive('cd')); ok(pl.addPassive('def')); ok(!pl.addPassive('rgn'), 'quinta');
});
test('removeMove recoloca el enfoque', () => {
  const pl = mkPlayer(); pl.addMove('ember'); pl.addMove('tackle'); pl.addMove('fire-spin');
  pl.setFocus(2); pl.removeMove(pl.moves[2]);
  eq(pl.moves.length, 2); eq(pl.focus, 1);
});
test('packMoves / parseMoves ida y vuelta, y basura → null', () => {
  const pl = mkPlayer(); pl.addMove('ember'); pl.addMove('tackle'); G.Moves.levelUp(pl.moves[1]); G.Moves.evolve(pl.moves[1]);
  const s = G.Player.packMoves(pl.moves);
  eq(s, 'ember:1:0,tackle:2:1');
  const back = G.Player.parseMoves(s);
  eq(back.map(m => [m.id, m.lvl, !!m.evolved]), [['ember', 1, false], ['tackle', 2, true]]);
  eq(G.Player.parseMoves('nope:x'), null); eq(G.Player.parseMoves(''), null);
  const legacy = G.Player.parseMoves('ember');          // formato viejo: sólo el id
  eq(legacy.length, 1); eq(legacy[0].id, 'ember'); eq(legacy[0].lvl, 1);
});

// ---- Task 5
load('js/entities/projectile.js');
load('js/systems/move-kinds.js');
load('js/systems/combat.js');
const enemyAt = (x, y, extra = {}) => Object.assign({ x, y, r: 10, bodyH: 20, cy() { return this.y; }, dead: false, boss: false, types: ['normal'], id: Math.random(), hurt: noop, applyBurn: noop, applyPoison: noop, applySlow: noop, applyWet: noop }, extra);
test('aimFor: a distancia prefiere al jefe; cuerpo a cuerpo a quien te toca', () => {
  const pl = { x: 0, y: 0, r: 12, aim: 0, moveAngle: 0, walking: false, remote: false };
  const touching = enemyAt(15, 0), boss = enemyAt(200, 0, { boss: true }), far = enemyAt(400, 0);
  const all = [touching, boss, far];
  const proj = G.Moves.instance('ember', 1), melee = G.Moves.instance('tackle', 1);
  eq(G.Combat.aimFor(pl, proj, all).target, boss);
  eq(G.Combat.aimFor(pl, melee, all).target, touching);
  ok(Math.abs(proj.aim) < 1e-9, 'aim guardado en el movimiento');
});
test('aimFor sin enemigos apunta a donde caminas y no revienta', () => {
  const pl = { x: 0, y: 0, r: 12, aim: 1, moveAngle: 2, walking: true };
  const m = G.Moves.instance('heat-wave', 1);
  const r = G.Combat.aimFor(pl, m, []);
  eq(r.target, null); eq(m.aim, 2);
});
test('damage aplica tabla de tipos y ×1,25 al enfocado', () => {
  let got = 0;
  const e = enemyAt(0, 0, { types: ['grass'], hurt: d => { got = d; } });
  const m = G.Moves.instance('ember', 1);
  const pl = { x: 0, y: 0, atk: 1, moves: [m], focus: 0, focused() { return this.moves[this.focus]; }, dmgMul(x) { return x === this.focused() ? 1.25 : 1; }, onDealt: noop, dmgDealt: 0, level: 1 };
  const dealt = G.Combat.damage(pl, e, 10, m, 1, 0, 0);
  ok(Math.abs(dealt - 10 * 1.6 * 1.25) < 1e-6, 'fuego vs planta ×1,6 y enfocado ×1,25: ' + dealt);
  ok(Math.abs(got - dealt) < 1e-6);
});
test('todos los kinds del catálogo existen en MoveKinds', () => {
  for (const m of G.Moves.ALL) ok(G.MoveKinds.KINDS[m.kind], m.kind);
  ok(!G.MoveKinds.KINDS.buff);
});
test('tick lanza TODOS los movimientos, cada uno con su recarga', () => {
  const casts = [];
  const pl = { x: 0, y: 0, r: 12, aim: 0, moveAngle: 0, walking: false, dead: false, cdK: 1, atk: 1, level: 1,
               moves: [G.Moves.instance('heat-wave', 1), G.Moves.instance('hyper-voice', 1)], focus: 0,
               focused() { return this.moves[0]; }, dmgMul: () => 1, cast: m => casts.push(m.id), onDealt: noop, dmgDealt: 0 };
  G.Combat.tick(0.016, pl, 0);
  eq(casts.sort(), ['heat-wave', 'hyper-voice']);
  ok(pl.moves[0].t > 0 && pl.moves[1].t > 0);
});

// ---- Task 6
load('js/systems/levelup.js');
const fakePl = (types, moves = [], passives = []) => ({
  mon: { types }, moves, passives, coins: 0, maxHp: 100, hp: 50,
  hasMove(id) { return this.moves.some(m => m.id === id); },
  hasPassive(id) { return this.passives.some(p => p.id === id); },
  passive(id) { return this.passives.find(p => p.id === id) || null; },
  addMove: () => true, addPassive: () => true, levelPassive: () => true, heal: noop
});
test('con todo al máximo y el pool agotado quedan las dos cartas extra (Baya Zidra y Pokémonedas)', () => {
  const moves = ['tackle', 'quick-attack', 'body-slam', 'hyper-voice', 'substitute'].map(id => G.Moves.instance(id, 5));
  const passives = ['hp', 'atk', 'spd', 'cd'].map(id => ({ id, lvl: 5, def: G.Passives.BY[id] }));
  const pl = fakePl(['normal'], moves, passives);
  for (const m of moves) G.Moves.evolve(m);
  const cards = G.LevelUp.offer(pl);
  eq(cards.length, 2, 'sólo quedan las dos de bonus');
  ok(cards.every(c => c.type === 'bonus'));
});
test('pool agotado: no se ofrecen movimientos nuevos; pasivas sí si hay hueco', () => {
  const pl = fakePl(['normal'], ['tackle', 'quick-attack', 'body-slam', 'hyper-voice', 'substitute'].map(id => G.Moves.instance(id, 1)));
  const c = G.LevelUp.candidates(pl);
  eq(c.filter(x => x.type === 'new').length, 0);
  ok(c.filter(x => x.type === 'passive').length > 0);
});
test('la evolución lista sale siempre, en dorado', () => {
  const m = G.Moves.instance('ember', 5);
  const pl = fakePl(['fire'], [m], [{ id: 'atk', lvl: 1, def: G.Passives.BY.atk }]);
  const cards = G.LevelUp.offer(pl);
  eq(cards[0].type, 'evo'); eq(cards[0].title, 'Ascuas → Llamarada');
});
test('pasiva que desbloquea una evolución sale marcada', () => {
  const m = G.Moves.instance('ember', 5);
  const pl = fakePl(['fire'], [m], []);
  const c = G.LevelUp.candidates(pl).find(x => x.type === 'passive' && x.key === 'passive:atk');
  ok(c && c.color === '#ffd23f' && /Ascuas/.test(c.tag), JSON.stringify(c && c.tag));
});
test('nunca más de 6 ataques ni 4 pasivas nuevas', () => {
  const pl = fakePl(['fire', 'flying'], ['ember', 'flamethrower', 'fire-spin', 'heat-wave', 'gust', 'wing-attack'].map(id => G.Moves.instance(id, 1)),
                    ['hp', 'atk', 'spd', 'cd'].map(id => ({ id, lvl: 1, def: G.Passives.BY[id] })));
  const c = G.LevelUp.candidates(pl);
  eq(c.filter(x => x.type === 'new').length, 0); eq(c.filter(x => x.type === 'passive').length, 0);
  ok(c.filter(x => x.type === 'up').length >= 6);
});

// ---- Task 8
load('js/data/fusions.js');
test('30 fusiones registradas, con pares que existen y escalera de su kind', () => {
  eq(G.Fusions.LIST.length, 30);
  for (const f of G.Fusions.LIST) {
    ok(G.Moves.BY_ID[f.pair[0]] && G.Moves.BY_ID[f.pair[1]], f.id + ' par desconocido');
    ok(G.Moves.BY_ID[f.id] && G.Moves.BY_ID[f.id].fused, f.id + ' no registrada');
    eq(G.Moves.BY_ID[f.id].maxLvl, 5, f.id);
  }
});
test('cada fusión la puede conseguir algún Pokémon (ambos movimientos en su pool)', () => {
  for (const f of G.Fusions.LIST) {
    const can = G.DEX.some(p => { const pool = G.Moves.poolFor(p); return pool.includes(f.pair[0]) && pool.includes(f.pair[1]); });
    ok(can, f.id + ' inalcanzable');
  }
});
test('las 30 fusiones usan los 60 movimientos, cada uno una sola vez', () => {
  const used = G.Fusions.LIST.flatMap(f => f.pair);
  eq(used.length, 60); eq(new Set(used).size, 60);
  for (const m of G.Moves.ALL) ok(used.includes(m.id), m.id + ' sin fusión');
});
test('available sólo con los dos al nivel máximo; pending lista los pares a medias', () => {
  const a = G.Moves.instance('gust', 5), b = G.Moves.instance('ember', 3);
  eq(G.Fusions.available([a, b]).length, 0);
  eq(G.Fusions.pending([a, b]).map(p => p.recipe.id), ['fire-tornado']);
  G.Moves.levelUp(b); G.Moves.levelUp(b);
  eq(G.Fusions.available([a, b]).length, 1); eq(G.Fusions.pending([a, b]).length, 0);
});
test('available encuentra la receta sin importar el orden', () => {
  const ms = [G.Moves.instance('gust', 5), G.Moves.instance('ember', 5)];
  const av = G.Fusions.available(ms);
  eq(av.length, 1); eq(av[0].recipe.id, 'fire-tornado'); eq(av[0].a.id, 'ember');   // a y b siguen el orden de la receta
});
test('fuse: quita los dos, mete la fusión al nivel mayor, gasta el vínculo y enfoca bien', () => {
  const pl = mkPlayer(['fire', 'flying']);
  pl.addMove('ember'); pl.addMove('tackle'); pl.addMove('gust');
  for (const m of [pl.moves[0], pl.moves[2]]) while (G.Moves.levelUp(m)) { /* al máximo */ }
  pl.setFocus(2); pl.bonds = 1;
  const f = pl.fuse(G.Fusions.BY['fire-tornado']);
  eq(pl.moves.map(m => m.id), ['tackle', 'fire-tornado']);
  eq(f.lvl, 5); ok(f.fused); eq(pl.bonds, 0);
  eq(pl.focused().id, 'fire-tornado'); ok(pl.focus < pl.moves.length);
});
test('boostMove sube al máximo y gasta el vínculo', () => {
  const pl = mkPlayer(); pl.addMove('ember'); pl.bonds = 1;
  pl.boostMove(pl.moves[0]); eq(pl.moves[0].lvl, 5); eq(pl.bonds, 0);
});
test('Pokémonedas se traduce a Pokécoins', () => { eq(G.I18n.t('Pokémonedas'), 'Pokécoins'); });
test('las fusiones tienen traducción de nombre y descripción', () => {
  for (const f of G.Fusions.LIST) { ok(G.I18n.t(f.name) !== f.name, f.name); ok(G.I18n.t(f.desc) !== f.desc, f.id + ' desc'); }
});

// ---- Task 9
load('js/systems/reactions.js');
const reactPl = () => { const m = G.Moves.instance('water-gun', 1); return { x: 0, y: 0, atk: 1, level: 1, moves: [m], focus: 0, focused() { return m; }, dmgMul: () => 1, onDealt: noop, dmgDealt: 0 }; };
const stEnemy = (extra = {}) => Object.assign(enemyAt(0, 0), { burn: 0, poison: 0, slow: 0, wet: 0, frozenT: 0, remote: false, maxHp: 100,
  hits: [], hurt(d) { this.hits.push(d); }, applyWet() { this.wet = 1; }, applyFreeze() { this.frozenT = 1.2; }, applySlow(f) { this.slow = Math.max(this.slow, f); },
  clearStatus(k) { if (k === 'burn') this.burn = 0; if (k === 'poison') this.poison = 0; if (k === 'slow') this.slow = 0; if (k === 'wet') this.wet = 0; } }, extra);
test('Vapor: agua sobre quemado consume la quemadura y hace daño de área', () => {
  const e = stEnemy({ burn: 3 }), n = stEnemy({ x: 30 });
  G.EnemyMgr.queryCircle = () => [e, n];
  const k = G.Reactions.check(reactPl(), e, G.Moves.instance('water-gun', 1), 10);
  eq(k, 1); eq(e.burn, 0); ok(n.hits.length === 1, 'vecino dañado'); ok(e.reactT > 0);
  G.EnemyMgr.queryCircle = () => [];
});
test('Rotura: roca sobre frenado ×1,6 (cuerpo a cuerpo desde 0,25)', () => {
  const e = stEnemy({ slow: 0.45 });
  eq(G.Reactions.check(reactPl(), e, G.Moves.instance('rock-throw', 1), 10), 1.6);
  const e2 = stEnemy({ slow: 0.3 });
  eq(G.Reactions.check(reactPl(), e2, G.Moves.instance('rock-throw', 1), 10), 1, 'proyectil necesita 0,4');
  eq(G.Reactions.check(reactPl(), stEnemy({ slow: 0.3 }), G.Moves.instance('karate-chop', 1), 10), 1.6, 'melee desde 0,25');
});
test('Conducción, Congelación y Detonación', () => {
  const wet = stEnemy({ wet: 1 });
  G.EnemyMgr.queryCircle = () => [wet, stEnemy({ x: 40 })];
  eq(G.Reactions.check(reactPl(), wet, G.Moves.instance('thunder-shock', 1), 10), 1);
  G.EnemyMgr.queryCircle = () => [];
  const wet2 = stEnemy({ wet: 1 });
  G.Reactions.check(reactPl(), wet2, G.Moves.instance('ice-beam', 1), 10);
  eq(wet2.wet, 0); ok(wet2.frozenT > 0);
  const poi = stEnemy({ poison: 2 }), near = stEnemy({ x: 40 });
  G.EnemyMgr.queryCircle = () => [poi, near];
  G.Reactions.check(reactPl(), poi, G.Moves.instance('ember', 1), 10);
  eq(poi.poison, 0); ok(near.hits.length >= 1, 'explosión alcanza al vecino');
  G.EnemyMgr.queryCircle = () => [];
});
test('cooldown de reacción por enemigo y sin reacción en remotos sin bits', () => {
  const e = stEnemy({ burn: 2, reactT: sandbox.performance.now() });   // el reloj del sandbox, no el de Node
  eq(G.Reactions.check(reactPl(), e, G.Moves.instance('water-gun', 1), 10), 1); eq(e.burn, 2);
  const r = stEnemy({ remote: true, net: { st: 0 }, burn: 5 });
  eq(G.Reactions.check(reactPl(), r, G.Moves.instance('water-gun', 1), 10), 1); eq(r.burn, 5);
  const r2 = stEnemy({ remote: true, net: { st: 1 } });
  ok(G.Reactions.has(r2, 'burn'));
});
test('las etiquetas de reacción tienen traducción', () => {
  for (const r of G.Reactions.LIST) ok(G.I18n.t(r.label) !== r.label, r.label);
});

// ---- Task 10
load('js/systems/spawner.js');
test('powerK: 1 ataque → ×1; 6 ataques → ×3 (jefe ×2,5); listas vacías cuentan como 1', () => {
  const mk = n => ({ moves: new Array(n).fill(0), dead: false });
  eq(G.Spawner.powerK([mk(1)]), 1);
  ok(Math.abs(G.Spawner.powerK([mk(6)]) - 3) < 1e-9);
  ok(Math.abs(G.Spawner.powerK([mk(6)], true) - 2.5) < 1e-9);
  eq(G.Spawner.powerK([]), 1);
  eq(G.Spawner.powerK([{ moves: [] }, mk(1)]), 1);
  ok(Math.abs(G.Spawner.powerK([mk(2), mk(4)]) - 1.8) < 1e-9, 'media de 3 ataques');
});

// ---- Task 11
load('js/world/liquid.js');
test('agua: los de tipo agua nadan; los voladores planean; el resto se frena', () => {
  eq(G.Liquid.effect('water', ['normal']).slow, 0.6);
  const sw = G.Liquid.effect('water', ['water', 'ground']);
  ok(sw.swim && sw.speed === 1.15 && sw.regen === 1 && sw.dmgTaken === 1.15);
  const hv = G.Liquid.effect('swamp', ['flying', 'normal']);
  ok(hv.hover && !hv.slow && !hv.slide);
});
test('lava: fuego inmune, volador la mitad, agua se quema igual', () => {
  eq(G.Liquid.effect('lava', ['fire']), {});
  const hv = G.Liquid.effect('lava', ['flying']);
  ok(hv.hover && Math.abs(hv.dmg - 0.03) < 1e-9 && hv.flat === 2.5);
  eq(G.Liquid.effect('lava', ['water']).dmg, 0.06);
});
test('hielo: el de hielo no resbala, el volador tampoco, el resto sí', () => {
  eq(G.Liquid.effect('ice', ['ice']), {});
  ok(!G.Liquid.effect('ice', ['flying']).slide);
  ok(G.Liquid.effect('ice', ['fire']).slide);
});
test('cdK sube un 10% al planear', () => {
  const pl = mkPlayer(['flying']); pl.cdMul = 1;
  eq(pl.cdK, 1); pl.hover = true; ok(Math.abs(pl.cdK - 1.1) < 1e-9);
});

// ---- Task 12
test('un compañero reconstruye su lista de movimientos del estado y aguanta basura', () => {
  const p = mkPlayer(); p.remote = true;
  p.net = { x: 0, y: 0, ang: 0, walk: 0, hp: 10, maxHp: 10, dead: 0, mvs: 'ember:2:0,tackle:1:0', mag: 78, aim: 0, rev: 0 };
  p.netUpdate(0.016);
  eq(p.moves.map(m => [m.id, m.lvl]), [['ember', 2], ['tackle', 1]]);
  p.net.mvs = 'zzz:9';
  p.netUpdate(0.016);
  eq(p.moves.map(m => m.id), ['ember', 'tackle'], 'basura: se queda la lista anterior');
});

// ---- Revisión final: arreglos
test('un enemigo congelado no te golpea por contacto', () => {
  G.Projectiles.clear();
  let hits = 0;
  const e = { x: 5, y: 0, r: 10, touchCd: 0, behavior: 'chase', frozenT: 1, strike: noop, dmg: 5, atkType: 'normal', kx: 0, ky: 0, dead: false };
  const pl = { x: 0, y: 0, r: 12, dead: false, level: 1, hurt: () => { hits++; }, hasItem: () => false };
  G.EnemyMgr.queryCircle = () => [e];
  G.Combat.resolve(0.016, pl, 0);
  G.EnemyMgr.queryCircle = () => [];
  eq(hits, 0, 'congelado y aun así golpea');
});
test('en un invitado la pausa entre reacciones caduca sola (sin Enemy.update)', async () => {
  let labels = 0;
  const orig = G.FX.dmgText; G.FX.dmgText = () => { labels++; };
  const r = stEnemy({ remote: true, net: { st: 1 } });
  G.Reactions.check(reactPl(), r, G.Moves.instance('water-gun', 1), 10);
  await new Promise(res => setTimeout(res, 550));
  G.Reactions.check(reactPl(), r, G.Moves.instance('water-gun', 1), 10);
  G.FX.dmgText = orig;
  eq(labels, 2, 'la segunda reacción no salió');
});
test('la pista de la pausa en dev.html tiene traducción', () => {
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'dev.html'), 'utf8');
  ok(!html.includes('toca un ataque para cambiarlo'), 'dev.html sigue con "cambiarlo"');
  const es = 'Arrastra el dedo para moverte · toca un ataque para enfocarlo';
  ok(G.I18n.t(es) !== es, 'sin traducción');
});
test('la carta de subir un movimiento sale entera en inglés (pista de evolución incluida)', () => {
  const m = G.Moves.instance('ember', 4);
  const pl = fakePl(['fire'], [m], []);
  const c = G.LevelUp.candidates(pl).find(x => x.key === 'up:ember');
  ok(c, 'sin carta'); ok(!/Evoluciona/.test(c.desc), c.desc); ok(/Evolves with Power\.$/.test(c.desc), c.desc);
});

// ---------------- ejecutar ----------------
(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); console.log('  ok  ' + t.name); }
    catch (e) { failed++; console.log('FALLA  ' + t.name + '\n       ' + (e && e.message)); }
  }
  console.log(`\n${tests.length - failed}/${tests.length} pruebas pasan`);
  process.exit(failed ? 1 : 0);
})();
