// Ranking: js/net/ranking.js de verdad, con una base de datos falsa que aplica
// los topes de firestore.rules (validEntry) a cada marca.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js/net/ranking.js'), 'utf8');

function env() {
  const docs = new Map();             // ruta -> datos
  const store = new Map();
  const clone = o => JSON.parse(JSON.stringify(o));
  const ruleOk = (p, d) => {
    if (!p.startsWith('lb/')) return true;
    const dmg = d.dmg || 0, old = docs.get(p);
    return Number.isInteger(d.t) && d.t > 0 && d.t <= 86400 && d.lv >= 1 && d.lv <= 10 + d.t / 4
      && d.kills >= 0 && d.kills <= 100 + d.t * 12
      && (!old || (d.t >= old.t && dmg >= (old.dmg || 0) && (d.t > old.t || dmg > (old.dmg || 0))));
  };
  const ref = p => ({
    p,
    async get() { return { exists: docs.has(p), id: p.split('/').pop(), data: () => clone(docs.get(p)) }; },
    async set(d) { if (!ruleOk(p, d)) throw { code: 'permission-denied' }; docs.set(p, clone(d)); },
    collection: c => ({ doc: id => ref(p + '/' + c + '/' + id) })
  });
  const fsx = {
    collection: c => ({ doc: id => ref(c + '/' + id) }),
    async runTransaction(fn) {
      const writes = [];
      await fn({ get: r => r.get(), set: (r, d) => writes.push([r.p, d]) });
      for (const [p, d] of writes) if (!ruleOk(p, d)) throw { code: 'permission-denied' };
      for (const [p, d] of writes) docs.set(p, clone(d));
    }
  };
  const G = {
    U: { int: (v, max = 1e12) => (Number.isFinite(+v) && +v > 0 ? Math.min(max, Math.floor(+v)) : 0),
         str: (v, max = 64) => (typeof v === 'string' ? v.slice(0, max) : ''), list: (v, max = 50) => (Array.isArray(v) ? v.slice(0, max) : []) },
    DB: { online: true, fb: { fs: fsx, uid: 'U1' } },
    Social: { me: { name: 'Ash' }, friends: [], ensureFriends: async () => {} },
    UI: { toast() {} }
  };
  const localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k), key: i => [...store.keys()][i], get length() { return store.size; } };
  const ctx = { G, localStorage, console: { warn() {}, log: console.log }, Intl, Date, Math, JSON, Object, Promise,
    firebase: { firestore: { FieldValue: { serverTimestamp: () => 0 } } } };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { R: G.Ranking, docs, store };
}

test('una partida con más de 12 derrotados por segundo entra igual (antes el servidor la rechazaba entera)', async () => {
  const { R, docs } = env();
  await R.submitSolo({ t: 2400, lv: 200, kills: 40000, dex: 25, shiny: false, dmg: 0 });
  const b = R.board('s', 'a');
  const e = docs.get('lb/' + b + '/e/U1');
  assert.ok(e, 'la marca del histórico está guardada');
  assert.equal(e.t, 2400);
  assert.equal(e.kills, 100 + 2400 * 12);
  assert.ok(docs.get('lbs/' + b).top.U1, 'y está en el top 50');
  for (const p of ['d', 'w', 'm']) assert.ok(docs.get('lbs/' + R.board('s', p)).top.U1, 'también en ' + p);
});

test('el histórico enseña lo que ya se sabe del semanal (leído después): ya cuadran', async () => {
  const { R, store } = env();
  const old = Date.now() - 60 * 60e3, fresh = Date.now();
  const row = (t, n) => ({ t, uids: [n], names: [n], dex: [25], lv: 50, kills: 100 });
  // El histórico se leyó hace 1 h; el semanal, ahora, con una marca nueva de Misty.
  store.set('ps.rk.c.S:' + R.board('s', 'a'), JSON.stringify({ at: old, v: { top: { A: row(900, 'A') }, dtop: {} } }));
  store.set('ps.rk.c.S:' + R.board('s', 'w'), JSON.stringify({ at: fresh, v: { top: { M: row(1500, 'M') }, dtop: {} } }));
  const rows = await R.top('s', 'a', null, false);
  assert.deepEqual(rows.map(r => r.id), ['M', 'A']);
  // Al revés no: lo del histórico no sale en el semanal.
  assert.deepEqual((await R.top('s', 'w', null, false)).map(r => r.id), ['M']);
});
