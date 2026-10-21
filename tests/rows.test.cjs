// Enemigos del cooperativo en compacto (js/net/rows.js) y su uso en coop.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const load = (file, G = {}) => { new Function('G', 'document', source(file))(G, { addEventListener() {} }); return G; };
const R = load('js/net/rows.js').NetRows;

// Partida de mentira y reproducible: enemigos que van hacia el centro, a veces
// reciben un golpe o cambian de animación, de dirección o de estado.
function world(n, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const list = Array.from({ length: n }, (_, i) => {
    const a = rnd() * Math.PI * 2, d = 80 + rnd() * 860;
    return [100 + i * 3, Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d), 200 + Math.floor(rnd() * 900), 1, Math.floor(rnd() * 8), 0];
  });
  function step() {
    for (const r of list) {
      const d = Math.hypot(r[1], r[2]) || 1;
      r[1] = Math.round(r[1] - (r[1] / d) * 6) + 0; r[2] = Math.round(r[2] - (r[2] / d) * 6) + 0;   // (+ 0: sin -0, como llega por JSON)
      const x = rnd();
      if (x < 0.08) r[3] = Math.max(1, r[3] - 1 - Math.floor(rnd() * 40));       // golpe
      else if (x < 0.10) r[4] = Math.floor(rnd() * 7);                           // animación
      else if (x < 0.11) r[5] = Math.floor(rnd() * 8);                           // dirección
      else if (x < 0.115) r[6] = Math.floor(rnd() * 16);                         // estados
    }
  }
  return { list, step };
}

test('compact rows: the guest always ends with the same hp, animation, direction and status', () => {
  const w = world(300), memo = R.memo(), guest = new Map(), view = { x: 0, y: 0 };
  for (const r of w.list) guest.set(r[0], { x: r[1], y: r[2] });          // como al llegar 'ne'
  for (let f = 0; f < 90; f++) {
    w.step();
    const flat = JSON.parse(JSON.stringify(R.encode(w.list.map(r => r.slice()), view, memo)));
    const got = new Set();
    R.decode(flat, (id, x, y, hp, anim, dir, st) => {
      const g = guest.get(id); got.add(id);
      if (hp === undefined) { g.x += x; g.y += y; }                       // corta: lo movido
      else Object.assign(g, { x, y, hp, anim, dir, st });
    });
    for (const r of w.list) {
      const g = guest.get(r[0]), far = Math.hypot(r[1], r[2]) > R.FAR;
      // Cerca (en pantalla): todos los envíos y exactos. Lejos: como mucho cada FAR_EVERY.
      if (!far) assert.ok(got.has(r[0]), `near enemy ${r[0]} missing in frame ${f}`);
      if (got.has(r[0])) {
        assert.deepEqual([g.x, g.y, g.hp, g.anim, g.dir, g.st], r.slice(1), `enemy ${r[0]} frame ${f}`);
      }
    }
    if (f % R.KEY === 0) assert.equal(got.size, w.list.length, 'key frame sends everyone');
  }
});

test('compact rows: far enemies skip at most FAR_EVERY - 1 frames in a row', () => {
  const memo = R.memo(), rows = [[500, 900, 0, 50, 1, 2, 0]], seen = [];
  for (let f = 0; f < 30; f++) {
    let sent = false;
    R.decode(R.encode(rows, { x: 0, y: 0 }, memo), () => { sent = true; });
    seen.push(sent);
  }
  let gap = 0;
  for (const s of seen) { gap = s ? 0 : gap + 1; assert.ok(gap < R.FAR_EVERY); }
});

test('compact rows: an enemy missing from one send (gone far, stashed by a rift) comes back as a full row', () => {
  const memo = R.memo(), view = { x: 0, y: 0 }, a = [10, 100, 100, 50, 1, 0, 0];
  R.encode([a], view, memo);                                    // completa (envío clave)
  assert.deepEqual(R.encode([[10, 104, 100, 50, 1, 0, 0]], view, memo), [-11, 4, 0]);   // corta: lo movido
  R.encode([], view, memo);                                     // falta: se olvida
  assert.deepEqual(R.encode([[10, 300, 300, 50, 1, 0, 0]], view, memo), [11, 300, 300, 50, 1]);
});

test('compact rows: garbage from the network stops reading instead of breaking', () => {
  const calls = [];
  for (const bad of [null, 'x', [0, 1, 2], [5, 1], [-3, 1], ['a', 1, 2, 3, 4], [1.5, 1, 2, 3, 4]]) {
    R.decode(bad, (...a) => calls.push(a));
  }
  assert.deepEqual(calls, []);
  R.decode([124, 1, 2, 3, 4 + 7 * 5 + 56 * 9, -124, 9, 8], (...a) => calls.push(a));
  assert.deepEqual(calls, [[123, 1, 2, 3, 4, 5, 9], [123, 9, 8]]);
});

// coop.js de verdad, con un anfitrión y un invitado de mentira.
function coop(role, guestCv) {
  const sent = [], G = {};
  G.Net = { uid: role, on(fn) { G.recv = fn; }, onPeer() {}, slow: () => false,
    send: (uid, f) => sent.push(f), toHost: f => sent.push(f) };
  G.Player = class { constructor() { this.maxHp = 300; } };
  G.DEX_BY = { 25: { dex: 25 } }; G.baseStartOf = () => 'thundershock';
  G.Sprites = { preload() {} };
  G.U = { dist2: (x, y, a, b) => (x - a) ** 2 + (y - b) ** 2, clamp: (v, a, b) => Math.max(a, Math.min(b, v)) };
  const enemy = { id: 123, x: 50, y: -10, hp: 125.1, maxHp: 400, anim: { cur: 'Walk', dir: 3 }, burn: 1, remote: true,
                  net: { x: 0, y: 0 } };
  G.EnemyMgr = { all: () => [enemy], get: id => (id === 123 ? enemy : null) };
  G.Judgment = { netState: () => null, netApply() {} };
  load('js/net/rows.js', G); load('js/net/coop.js', G);
  const local = { x: 0, y: 0, moveAngle: 0, walking: false, hp: 100, maxHp: 300, magnet: 78, aim: 0, xpMul: 1, reviveT: 0,
                  activeGroup: () => [{ id: 'thundershock', lvl: 1 }] };
  G.Coop.begin({ host: 'host', members: [{ uid: 'host', name: 'A', dex: 25 }, { uid: 'guest', name: 'B', dex: 25 }] }, local,
    { team: () => ({ time: 1, level: 1, xp: 0, xpNext: 10, kills: 0, bosses: 0, coins: 0, t1: 0, t10: 0 }),
      choosing: () => false, syncTeam() {} });
  if (role === 'host') G.recv('guest', Object.assign({ k: 'f', p: [0, 0, 0, 0, 100, 300, 0, '', 1, 78, 0, 1, 0, 0, 0, ''], ev: [] },
                                                      guestCv ? { cv: guestCv } : {}));
  return { G, sent, enemy };
}

test('coop: a guest that says cv 2 gets compact enemies and short player keys; old guests do not', () => {
  const now = coop('host', 2);
  now.G.Coop.tick(1 / 15);
  const f = now.sent.at(-1);
  assert.equal(f.e, undefined);
  assert.deepEqual(f.e2, [124, 50, -10, 126, 1 + 7 * 3 + 56 * 1]);
  assert.deepEqual(Object.keys(f.p), ['0']);
  const old = coop('host');
  old.G.Coop.tick(1 / 15);
  const o = old.sent.at(-1);
  assert.equal(o.e2, undefined);
  assert.deepEqual(o.e, [[123, 50, -10, 126, 1, 3, 1]]);
  assert.deepEqual(Object.keys(o.p), ['host']);
});

test('coop: guests announce cv and apply both formats to the same enemy state', () => {
  for (const form of ['e', 'e2']) {
    const g = coop('guest');
    g.G.Coop.tick(1 / 15);
    assert.equal(g.sent.at(-1).cv, 2);
    const frame = { k: 'f', t: 1, lv: 1, xp: 0, xn: 10, ki: 0, bo: 0, co: 0, tk: [0, 0], p: {}, ev: [] };
    frame[form] = form === 'e' ? [[123, 70, 20, 99, 2, 5, 4]] : [124, 70, 20, 99, 2 + 7 * 5 + 56 * 4];
    g.G.recv('host', frame);
    assert.deepEqual([g.enemy.net.x, g.enemy.net.y, g.enemy.hp, g.enemy.net.anim, g.enemy.net.dir, g.enemy.net.st], [70, 20, 99, 2, 5, 4]);
    // Fila corta: se mueve (5, 2) desde la última y lo demás se queda.
    g.G.recv('host', Object.assign({}, frame, { e: undefined, e2: [-124, 5, 2] }));
    assert.deepEqual([g.enemy.net.x, g.enemy.net.y, g.enemy.hp, g.enemy.net.anim], [75, 22, 99, 2]);
  }
});
