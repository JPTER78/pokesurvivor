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
