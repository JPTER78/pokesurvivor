/* Pruebas de js/systems/recount.js — node tools/test_recount.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '../js/systems/recount.js'), 'utf8');
function load(opts = {}) {
  const G = {
    Coop: opts.coop || { active: false, mates: [] },
    Social: { me: { name: 'Ana' } },
    I18n: { lang: opts.lang || 'es' }
  };
  vm.runInNewContext(SRC, { G });
  return G.Recount;
}
// Lo que sale del contexto de vm es de otro "realm": se pasa a objetos de aquí para deepStrictEqual.
const plain = x => JSON.parse(JSON.stringify(x));
const mv = (id, type, dealt = 0) => ({ id, name: id.toUpperCase(), type, dealt });
const player = (moves, other = 0) => ({ moves, dealtOther: other, uid: 'me', tagColor: '#ffcb3d' });

let n = 0;
function test(name, fn) { fn(); n++; console.log('ok -', name); }

test('myTotal suma movimientos y objetos', () => {
  const R = load();
  R.reset(player([mv('ember', 'fire', 100), mv('tackle', 'normal', 50)], 25));
  assert.strictEqual(R.myTotal(), 175);
});

test('rows ordena desc, calcula % y omite los que no han hecho daño', () => {
  const R = load();
  R.reset(player([mv('tackle', 'normal', 25), mv('ember', 'fire', 75), mv('growl', 'normal', 0)]));
  const r = R.rows();
  assert.deepStrictEqual(plain(r.map(x => x.id)), ['ember', 'tackle']);
  assert.strictEqual(r[0].pct, 0.75);
  assert.strictEqual(r[0].type, 'fire');
});

test('rows añade la fila Objetos', () => {
  const R = load();
  R.reset(player([mv('ember', 'fire', 10)], 30));
  const r = R.rows();
  assert.strictEqual(r[0].id, null);
  assert.strictEqual(r[0].name, 'Objetos');
  assert.strictEqual(r[0].pct, 0.75);
});

test('rows sin daño: lista vacía y sin dividir entre 0', () => {
  const R = load();
  R.reset(player([mv('ember', 'fire', 0)]));
  assert.deepStrictEqual(plain(R.rows()), []);
});

test('dps', () => {
  const R = load();
  R.reset(player([mv('ember', 'fire', 300)]));
  assert.strictEqual(R.dps(60), 5);
  assert.strictEqual(R.dps(0), 0);
});

test('dot local suma al movimiento por id; id desconocido o nulo se ignora', () => {
  const R = load();
  const pl = player([mv('ember', 'fire', 10)]);
  R.reset(pl);
  R.dot(null, 'ember', 5);
  R.dot(null, 'nope', 5);
  R.dot(null, null, 5);
  assert.strictEqual(pl.moves[0].dealt, 15);
});

test('dot de un invitado queda pendiente y takePending lo vacía', () => {
  const R = load();
  R.reset(player([]));
  R.dot('u2', 'ember', 4);
  R.dot('u2', 'ember', 6);
  R.dot('u2', 'toxic', 1);
  assert.deepStrictEqual(plain(R.takePending('u2')), { ember: 10, toxic: 1 });
  assert.strictEqual(R.takePending('u2'), null);
  assert.strictEqual(R.takePending('u3'), null);
});

test('reset vacía lo pendiente', () => {
  const R = load();
  R.reset(player([]));
  R.dot('u2', 'ember', 4);
  R.reset(player([]));
  assert.strictEqual(R.takePending('u2'), null);
});

test('addDot suma a mis movimientos', () => {
  const R = load();
  const pl = player([mv('ember', 'fire', 1), mv('toxic', 'poison', 0)]);
  R.reset(pl);
  R.addDot({ ember: 9, toxic: 3, nope: 100 });
  R.addDot(null);
  assert.strictEqual(pl.moves[0].dealt, 10);
  assert.strictEqual(pl.moves[1].dealt, 3);
});

test('team: local + compañeros (también desconectados y versiones viejas), orden y %', () => {
  const mates = [
    { uid: 'u2', name: 'Bea', color: '#5fc8ff', connected: true, pl: { net: { dm: 300 } } },
    { uid: 'u3', name: 'Cris', color: '#7ee07a', connected: false, pl: { net: { dm: 100 } } },
    { uid: 'u4', name: 'Dani', color: '#ff8ad8', connected: true, pl: { net: {} } },
    { uid: 'u5', name: 'Eva', color: '#fff', connected: true, pl: {} }
  ];
  const R = load({ coop: { active: true, mates } });
  R.reset(player([mv('ember', 'fire', 100)]));
  const t = R.team();
  assert.deepStrictEqual(plain(t.map(x => x.name)), ['Bea', 'Ana', 'Cris', 'Dani', 'Eva']);
  assert.strictEqual(t[1].me, true);
  assert.strictEqual(t[1].color, '#ffcb3d');
  assert.strictEqual(t[0].pct, 0.6);
  assert.strictEqual(t[3].dealt, 0);
});

test('snapshot: team sólo en coop', () => {
  const R = load();
  R.reset(player([mv('ember', 'fire', 120)]));
  const s = R.snapshot(60);
  assert.strictEqual(s.total, 120);
  assert.strictEqual(s.dps, 2);
  assert.strictEqual(s.rows.length, 1);
  assert.strictEqual(s.team, null);
});

test('fmt compacto en español e inglés', () => {
  const es = load(), en = load({ lang: 'en' });
  assert.strictEqual(es.fmt(949.6), '950');
  assert.strictEqual(es.fmt(12345), '12,3k');
  assert.strictEqual(es.fmt(1234567), '1,2M');
  assert.strictEqual(en.fmt(12345), '12.3k');
});

test('freeze: la tabla del grupo sobrevive a G.Coop.end() (que vacía mates)', () => {
  const coop = { active: true, mates: [{ uid: 'u2', name: 'Bea', color: '#5fc8ff', connected: true, pl: { net: { dm: 50 } } }] };
  const R = load({ coop });
  R.reset(player([mv('ember', 'fire', 150)]));
  R.freeze();
  coop.active = false; coop.mates = [];
  const s = R.snapshot(10);
  assert.deepStrictEqual(plain(s.team.map(x => x.name)), ['Ana', 'Bea']);
  R.reset(player([]));
  assert.strictEqual(R.snapshot(10).team, null);
});

console.log(`\n${n} pruebas OK`);
