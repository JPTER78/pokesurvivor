const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { frame, client } = require('./net-fixtures.cjs');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function codec() { const G = {}; new Function('G', source('js/net/codec.js'))(G); return G.NetCodec; }
const C = codec();
// Mensajes por la base de datos: rooms/{sala}/q/{para}/{remitente}_00..99 (database.rules.json).
// Devuelve la ruta del destinatario, sin el hueco.
function slotted(p) {
  const i = p.lastIndexOf('/');
  assert.match(p.slice(i + 1), /^[A-Za-z0-9]{1,64}_[0-9][0-9]$/);
  return p.slice(0, i);
}

test('host/client frames, events, pauses and Unicode round-trip exactly', () => {
  for (const f of [client(), frame(0, 0), frame(100, 40), frame(600, 400)]) {
    const b = C.encode(f); assert.ok(b); assert.deepEqual(C.decode(b), f);
  }
});
test('integer limits and decimals retain exact JS values, including high HP', () => {
  const values = [0, 127, 128, 16383, 16384, 2 ** 32, Number.MAX_SAFE_INTEGER,
    -Number.MAX_SAFE_INTEGER, 0.01, -0.01, 1.57, 1e-100, 1e30, Math.PI, Number.MAX_VALUE];
  assert.deepEqual(C.decode(C.encode(values)), values);
});
test('unsupported values safely fall back rather than silently changing data', () => {
  const cycle = []; cycle.push(cycle);
  for (const v of [undefined, 1n, new Date(), cycle, '\ud800', '\udc00']) {
    assert.equal(C.encode(v), null);
  }
  assert.equal(C.encode('x'.repeat(C.MAX_BYTES)), null);
});
test('-0, NaN, Infinity and undefined arrive exactly as they would through JSON', () => {
  const r2 = v => Math.round(v * 100) / 100;
  for (const v of [-0, NaN, Infinity, [r2(-0.003), Math.round(-0.2)], { x: undefined, y: 1, f() {} },
    [undefined, NaN, -Infinity, () => 1], { k: 'f', p: [-0, 1], ev: [['c', 'ember', 3, r2(-0.001), undefined]] }]) {
    const b = C.encode(v); assert.ok(b);
    const got = C.decode(b);
    assert.deepEqual(got, JSON.parse(JSON.stringify(v)));
    assert.equal(JSON.stringify(got), JSON.stringify(v));
  }
});
test('object keys cannot mutate prototypes', () => {
  const value = JSON.parse('{"__proto__":{"polluted":true},"constructor":"safe"}');
  const decoded = C.decode(C.encode(value));
  assert.deepEqual(decoded, value); assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf(decoded), Object.prototype);
});
test('truncation, trailing bytes, versions, tags, UTF-8 and lengths are rejected', () => {
  const b = new Uint8Array(C.encode(frame(3, 2)));
  for (let i = 0; i < b.length; i++) assert.throws(() => C.decode(b.slice(0, i).buffer));
  for (const bad of [[80, 83, 2, 0], [80, 83, 1, 255], [80, 83, 1, 8, 2, 255, 255],
    [80, 83, 1, 9, 255, 255, 255, 127], [80, 83, 1, 3, 128, 0],
    [80, 83, 1, 3, ...Array(8).fill(255)], [...b, 0]]) {
    assert.throws(() => C.decode(Uint8Array.from(bad).buffer));
  }
  assert.throws(() => C.decode(new ArrayBuffer(C.MAX_BYTES + 1)));
  assert.throws(() => C.decode('not binary'));
});
test('bounded deterministic random numeric payloads round-trip', () => {
  let seed = 1234;
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  for (let i = 0; i < 500; i++) {
    const f = frame(rand() % 8, rand() % 5, rand());
    f.ev.push(['h', rand(), (rand() - 2 ** 31) / 100, rand() / 31]);
    assert.deepEqual(C.decode(C.encode(f)), f);
  }
});

function network() {
  const pcs = [], relay = [], G = { NetCodec: codec(), DB: { fb: { uid: 'host', rtdb: {
    ref: p => ({ on() {}, off() {}, set: s => { relay.push([slotted(p), s]); return Promise.resolve(); } })
  } } } };
  class PC {
    constructor() { pcs.push(this); }
    createDataChannel() {
      return this.dc = { readyState: 'open', sent: [], send(data) { if (this.fail) throw Error('closed'); this.sent.push(data); }, close() {} };
    }
    createOffer() { return Promise.resolve({ type: 'offer' }); }
    setLocalDescription() { this.localDescription = { toJSON: () => ({ type: 'offer' }) }; return Promise.resolve(); }
    close() {}
  }
  new Function('G', 'RTCPeerConnection', 'setTimeout', 'clearTimeout', source('js/net/net.js'))(G, PC, () => 1, () => {});
  G.Net.open('test', true, 'host'); G.Net.syncMembers(['host', 'a', 'b']);
  for (const pc of pcs) pc.dc.onopen();
  const cap = dc => dc.onmessage({ data: JSON.stringify({ k: 'net-cap', binary: 1 }) });
  return { N: G.Net, pcs, relay, cap };
}

test('game protocol capability rejects old/unknown peers and resets on reconnect', () => {
  const { N, pcs } = network(), dc = pcs[0].dc;
  assert.equal(N.compatible('a'), false);
  dc.onmessage({ data: JSON.stringify({ k: 'net-cap', binary: 1 }) });
  assert.equal(N.compatible('a'), false);
  dc.onmessage({ data: JSON.stringify({ k: 'net-cap', binary: 1, game: N.GAME_VERSION - 1 }) });
  assert.equal(N.compatible('a'), false);
  dc.onmessage({ data: JSON.stringify({ k: 'net-cap', binary: 1, game: 999 }) });
  assert.equal(N.compatible('a'), false);
  dc.onmessage({ data: JSON.stringify({ k: 'net-cap', binary: 1, game: N.GAME_VERSION }) });
  assert.equal(N.compatible('a'), true);
  N.close(); N.open('next', true, 'host'); N.syncMembers(['host', 'a']);
  assert.equal(N.compatible('a'), false);
});
test('negotiation is per peer; old clients and unknown versions keep JSON', () => {
  const { N, pcs, cap } = network(), [a, b] = pcs.map(p => p.dc), f = frame();
  assert.equal(a.binaryType, 'arraybuffer');
  N.send('a', f); assert.equal(typeof a.sent.at(-1), 'string');
  cap(a); b.onmessage({ data: '{"k":"net-cap","binary":99}' });
  N.broadcast(f);
  assert.ok(a.sent.at(-1) instanceof ArrayBuffer); assert.deepEqual(C.decode(a.sent.at(-1)), f);
  assert.deepEqual(JSON.parse(b.sent.at(-1)), f);
  N.send('a', { k: 'start', seed: 12 }); assert.equal(typeof a.sent.at(-1), 'string');
  N.send('a', { k: 'f' }); assert.equal(typeof a.sent.at(-1), 'string'); // binary would be larger
  N.send('a', { k: 'f', ev: [undefined] }); assert.deepEqual(C.decode(a.sent.at(-1)), { k: 'f', ev: [null] });
});
test('mixed formats arrive unchanged; capabilities and corrupt packets never reach gameplay', () => {
  const { N, pcs, cap } = network(), dc = pcs[0].dc, got = [];
  N.on((from, msg) => got.push([from, msg]));
  dc.onmessage({ data: C.encode(frame()) }); assert.equal(got.length, 0);
  cap(dc); assert.equal(got.length, 0);
  dc.onmessage({ data: C.encode(frame()) });
  dc.onmessage({ data: JSON.stringify(client()) });
  dc.onmessage({ data: C.encode({ k: 'start' }) });
  dc.onmessage({ data: new ArrayBuffer(0) });
  assert.deepEqual(got, [['a', frame()], ['a', client()]]);
  assert.equal(N.stats.binaryRecv, 1); assert.equal(N.stats.invalidBinary, 3);
});
test('byte counters count successful payloads; failed frames never enable database relay', () => {
  const { N, pcs, cap, relay } = network(), dc = pcs[0].dc, f = frame(); cap(dc);
  N.send('a', f);
  assert.equal(N.stats.sentBytes, C.encode(f).byteLength);
  assert.equal(N.stats.jsonBytes, Buffer.byteLength(JSON.stringify(f)));
  assert.equal(N.stats.binarySent, 1);
  const before = N.stats.sentBytes; dc.fail = true; N.send('a', f);
  assert.equal(N.stats.sentBytes, before); assert.equal(relay.length, 0);
  N.send('a', { k: 'start', seed: 1 }); assert.equal(relay.length, 1);
});
test('reconnect resets capability, so a replaced/old peer never receives binary', () => {
  const { N, pcs, cap } = network(); cap(pcs[0].dc);
  N.close(); N.open('next', true, 'host'); N.syncMembers(['host', 'a']);
  const dc = pcs.at(-1).dc; dc.onopen(); N.send('a', frame());
  assert.equal(typeof dc.sent.at(-1), 'string');
});
test('representative busy host payload saves at least 30%; all savings are lossless', () => {
  for (const n of [30, 100, 300, 600]) {
    const f = frame(n), b = C.encode(f), json = Buffer.byteLength(JSON.stringify(f));
    assert.ok(b.byteLength < json * 0.7, `${n}: ${b.byteLength}/${json}`);
    assert.deepEqual(C.decode(b), f);
  }
});

test('real Coop.tick frames pass through the codec without changing gameplay fields', () => {
  for (const host of [true, false]) {
    const sent = [], G = {};
    G.Net = { uid: host ? 'host' : 'guest', on() {}, onPeer() {}, slow: () => false, busy: () => false,
      send: (uid, f) => sent.push(f), toHost: f => sent.push(f) };
    G.Player = class { constructor() { this.maxHp = 300; } };
    G.DEX_BY = { 25: { dex: 25 } }; G.baseStartOf = () => 'thundershock';
    G.Sprites = { preload() {} }; G.U = { dist2: (x, y, a, b) => (x - a) ** 2 + (y - b) ** 2 };
    G.EnemyMgr = { all: () => [{ id: 123, x: 50, y: -10, hp: 125.1, anim: { cur: 'Walk', dir: 3 }, burn: 1 }] };
    G.Judgment = { netState: () => [12, -23, 1, 4] };
    new Function('G', 'document', source('js/net/coop.js'))(G, { addEventListener() {} });
    const local = { x: 0, y: 0, moveAngle: 1.234, walking: true, hp: 234, maxHp: 300,
      magnet: 78, aim: -1.43, xpMul: 1.2, reviveT: 0, activeGroup: () => [{ id: 'thundershock', lvl: 3 }] };
    G.Coop.begin({ host: 'host', members: [{ uid: 'host', name: 'Aarón', dex: 25 }, { uid: 'guest', name: '皮卡丘', dex: 25 }] }, local,
      { team: () => ({ time: 145.12, level: 7, xp: 123.45, xpNext: 300, kills: 52, bosses: 2, coins: 40, t1: 1, t10: 0 }), choosing: () => false });
    G.Coop.tick(1 / 15);
    assert.equal(sent.length, 1);
    assert.deepEqual(C.decode(C.encode(sent[0])), sent[0]);
    if (host) { assert.deepEqual(sent[0].e, [[123, 50, -10, 126, 1, 3, 1]]); assert.ok('ho' in sent[0]); }
    else { assert.equal(sent[0].p.length, 21); assert.equal(sent[0].p[15], ''); assert.equal(sent[0].p[16], 1); }   // 16.º: a quién mira estando caído; 17.º: zoom (Luminosfera)
  }
});

function turnNetwork(respond, { user = { uid: 'host', getIdToken: async () => 'token' }, host = true } = {}) {
  const pcs = [], calls = [], signals = [], timers = [], G = { NetCodec: codec(), DB: { fb: { uid: host ? 'host' : 'guest', auth: { currentUser: user }, rtdb: {
    ref: p => ({ on(ev, fn) { this.fn = fn; G.listen = fn; }, off() {}, set: s => { signals.push([slotted(p), JSON.parse(s)]); return Promise.resolve(); } })
  } } } };
  class PC {
    constructor(cfg) { this.cfg = cfg; pcs.push(this); }
    createDataChannel() { return this.dc = { readyState: 'connecting', send() {}, close() {} }; }
    createOffer() { return Promise.resolve({ type: 'offer' }); }
    createAnswer() { return Promise.resolve({ type: 'answer' }); }
    setLocalDescription(d) { this.localDescription = { toJSON: () => d }; return Promise.resolve(); }
    setRemoteDescription(d) { this.remoteDescription = d; return Promise.resolve(); }
    addIceCandidate(c) { (this.added = this.added || []).push(c); return Promise.resolve(); }
    fail() { this.connectionState = 'failed'; this.onconnectionstatechange(); }
    close() {}
  }
  const setTimeout = (fn, ms) => { timers.push(ms); if (ms === 0) Promise.resolve().then(fn); return timers.length; };
  const fetch = async (url, opt) => { calls.push([url, opt]); return respond(); };
  new Function('G', 'RTCPeerConnection', 'setTimeout', 'clearTimeout', 'fetch', source('js/net/net.js'))(G, PC, setTimeout, () => {}, fetch);
  const offer = (t) => G.listen({ val: () => JSON.stringify({ f: 'host', sig: t ? { sdp: { type: 'offer' }, t: 1 } : { sdp: { type: 'offer' } } }), ref: { remove: () => Promise.resolve() } });
  const deliver = sig => G.listen({ val: () => JSON.stringify({ f: 'host', sig }), ref: { remove: () => Promise.resolve() } });
  return { N: G.Net, pcs, calls, signals, timers, offer, deliver };
}
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };
const turnReply = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });
const goodTurn = () => turnReply({ expiresAt: Date.now() / 1000 + 7200, iceServers: [
  { urls: ['turn:turn.pokesurvivor.com:3478?transport=udp', 'turn:evil.example:3478', 'stun:x'], username: 'u', credential: 'c' },
  { urls: ['turn:turn.pokesurvivor.com:3478?transport=tcp'], username: '', credential: 'c' }] });

test('own TURN: first try is direct only; a failed pair retries at once with clean TURN servers', async () => {
  const { N, pcs, calls, signals } = turnNetwork(goodTurn);
  N.open('room', true, 'host'); N.syncMembers(['host', 'a', 'b']); await settle();
  assert.equal(calls.length, 1, 'credentials are fetched on entering, so a retry never waits for them');
  assert.equal(pcs.length, 2);
  for (const pc of pcs) assert.equal(pc.cfg.iceServers.length, 1);
  assert.ok(signals.every(([, m]) => !m.sig.sdp || !m.sig.t));
  pcs[0].fail(); await settle();
  assert.equal(calls.length, 1, 'the retry reuses the ones just fetched');
  assert.equal(calls[0][0], 'https://ice.pokesurvivor.com/v1/ice');
  assert.equal(calls[0][1].method, 'POST'); assert.equal(calls[0][1].headers.Authorization, 'Bearer token');
  const retry = pcs[2];
  assert.equal(retry.cfg.iceServers[0].urls[0], 'stun:stun.l.google.com:19302');
  assert.deepEqual(retry.cfg.iceServers.slice(1), [{ urls: ['turn:turn.pokesurvivor.com:3478?transport=udp'], username: 'u', credential: 'c' }]);
  const offers = signals.filter(([p, m]) => p.endsWith('/a') && m.sig.sdp);
  assert.equal(offers.at(-1)[1].sig.t, 1);
  assert.equal(pcs.length, 3, 'only the failed pair reserves TURN');
});
test('own TURN: refused or broken answers still ask the guest for theirs, then wait as before', async () => {
  for (const respond of [() => turnReply({ error: 'user_denied' }, 403), () => { throw Error('offline'); },
    () => turnReply({ expiresAt: 1, iceServers: [] })]) {
    const { N, pcs, calls, timers, signals } = turnNetwork(respond);
    N.open('room', true, 'host'); N.syncMembers(['host', 'a']); await settle();
    pcs[0].fail(); await settle();
    assert.equal(calls.length, 1); assert.equal(pcs.length, 2); assert.equal(pcs[1].cfg.iceServers.length, 1);
    assert.equal(signals.filter(([, m]) => m.sig.sdp).at(-1)[1].sig.t, 1, 'the guest may have TURN');
    assert.equal(timers.at(-1), 15000, 'and waits the TURN time for it');
    pcs[1].fail(); await settle();
    assert.equal(timers.at(-1), 15000); assert.equal(pcs.length, 2); assert.equal(calls.length, 1);
  }
});
test('own TURN: a server that failed is asked again soon (not after a minute); a refused account, in half an hour', async () => {
  const realNow = Date.now;
  try {
    for (const [respond, wait] of [[() => { throw Error('timeout'); }, 10000], [() => turnReply({}, 502), 10000],
      [() => turnReply({ error: 'user_denied' }, 403), 1800000]]) {
      let now = 1e12; Date.now = () => now;
      const { N, calls } = turnNetwork(respond);
      N.open('room', true, 'host'); await settle();
      assert.equal(calls.length, 1);
      now += wait - 1; N.close(); N.open('room2', true, 'host'); await settle();
      assert.equal(calls.length, 1);
      now += 2; N.close(); N.open('room3', true, 'host'); await settle();
      assert.equal(calls.length, 2);
    }
  } finally { Date.now = realNow; }
});
test('own TURN: guests have theirs ready on entering and use it only when the host asks for it', async () => {
  const { N, pcs, calls, offer, timers } = turnNetwork(goodTurn, { user: { uid: 'guest', getIdToken: async () => 'token' }, host: false });
  N.open('room', false, 'host'); await settle();
  assert.equal(calls.length, 1);
  offer(false); await settle();
  assert.equal(pcs[0].cfg.iceServers.length, 1); assert.equal(timers.at(-1), 9000);
  offer(true); await settle();
  assert.equal(calls.length, 1); assert.equal(pcs[1].cfg.iceServers.length, 2); assert.equal(timers.at(-1), 15000);
});
test('own TURN: a guest without it still waits the TURN time when the host brings one', async () => {
  const { N, pcs, offer, timers } = turnNetwork(() => turnReply({ error: 'user_denied' }, 403), { user: { uid: 'guest', getIdToken: async () => 'token' }, host: false });
  N.open('room', false, 'host'); await settle();
  offer(true); await settle();
  assert.equal(pcs[0].cfg.iceServers.length, 1); assert.equal(timers.at(-1), 15000);
});
test('own TURN: players without an account never ask, but the guest is still asked for theirs', async () => {
  for (const user of [null, { uid: 'anon', isAnonymous: true }]) {
    const { N, pcs, calls, timers, signals } = turnNetwork(() => assert.fail('no request'), { user });
    N.open('room', true, 'host'); N.syncMembers(['host', 'a']); await settle();
    pcs[0].fail(); await settle();
    assert.equal(calls.length, 0); assert.equal(pcs.length, 2); assert.equal(pcs[1].cfg.iceServers.length, 1);
    assert.equal(signals.filter(([, m]) => m.sig.sdp).at(-1)[1].sig.t, 1);
    pcs[1].fail(); await settle();
    assert.equal(timers.at(-1), 15000); assert.equal(pcs.length, 2);
  }
});
test('own TURN: a pair that needed it starts with it next time, and after 2 such guests everyone does', async () => {
  const { N, pcs } = turnNetwork(goodTurn);
  N.open('room', true, 'host'); N.syncMembers(['host', 'a']); await settle();
  pcs[0].fail(); await settle();
  N.close(); N.open('room2', true, 'host'); N.syncMembers(['host', 'a', 'b']); await settle();
  const [a2, b1] = pcs.slice(-2);
  assert.equal(a2.cfg.iceServers.length, 2, 'a remembered for the whole session');
  assert.equal(b1.cfg.iceServers.length, 1, 'b still tries direct first');
  b1.fail(); await settle();
  N.syncMembers(['host', 'a', 'b', 'c']); await settle();
  assert.equal(pcs.at(-1).cfg.iceServers.length, 2, 'two failures: own network needs TURN');
});

function coopWithCuts(host) {
  let peerFn = null, msgFn = null;
  const timers = new Map(), lost = [], said = [], dropped = [];
  let mode = 'direct', nextT = 0;
  const G = {};
  G.Net = { uid: host ? 'host' : 'guest', on(fn) { msgFn = fn; }, onPeer(fn) { peerFn = fn; }, slow: () => false, busy: () => false,
    send() {}, toHost() {}, mode: () => mode };
  G.Player = class { constructor() { this.maxHp = 300; } };
  G.DEX_BY = { 25: { dex: 25 } }; G.baseStartOf = () => 'thundershock';
  G.Sprites = { preload() {} }; G.U = { dist2: () => 0 };
  G.Projectiles = { clearOrbs() {} }; G.Spawner = { say: s => said.push(s) };
  G.Social = { me: { name: 'yo' }, dropMember: u => dropped.push(u) };
  const setT = fn => { timers.set(++nextT, fn); return nextT; };
  new Function('G', 'document', 'setTimeout', 'clearTimeout', source('js/net/coop.js'))(G, { addEventListener() {} }, setT, id => timers.delete(id));
  G.Coop.begin({ host: 'host', members: [{ uid: 'host', name: 'Ana', dex: 25 }, { uid: 'guest', name: 'Bea', dex: 25 }] }, { x: 0, y: 0 },
    { lost: m => lost.push(m), mateLeft() {}, waiting() {} });
  const other = host ? 'guest' : 'host';
  return {
    G, lost, said, dropped, timers,
    cut() { mode = 'failed'; peerFn(other, 'failed'); },
    back() { mode = 'direct'; peerFn(other, 'direct'); },
    expire() { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } },
    bye() { msgFn(other, { k: 'f', ev: [['bye']] }); }
  };
}

test('co-op cut mid-run: the guest waits for the host to reconnect instead of losing the run', () => {
  const c = coopWithCuts(false);
  c.cut();
  assert.equal(c.lost.length, 0);
  assert.ok(c.G.Coop.active);
  c.back();
  assert.equal(c.timers.size, 0);
  c.expire();
  assert.equal(c.lost.length, 0);
  // a second cut that never comes back does end it, after the wait
  c.cut(); c.cut();
  assert.equal(c.timers.size, 1);
  c.expire();
  assert.equal(c.lost.length, 1);
  assert.ok(!c.G.Coop.active);
});

test('co-op cut mid-run: the host keeps the guest while it reconnects and removes it only if it never does', () => {
  const c = coopWithCuts(true);
  c.cut();
  assert.equal(c.G.Coop.puppets().length, 1);
  assert.ok(c.G.Coop.keeps('guest'));
  c.back();
  assert.ok(c.said.some(s => s.includes('ha vuelto')));
  c.cut(); c.expire();
  assert.equal(c.G.Coop.puppets().length, 0);
  assert.deepEqual(c.dropped, ['guest']);
  // leaving on purpose during the wait never removes them from the room
  const d = coopWithCuts(true);
  d.cut(); d.bye(); d.expire();
  assert.deepEqual(d.dropped, []);
  assert.equal(d.G.Coop.puppets().length, 0);
});

test('co-op orbs: the host applies a guest orb only if the guest really has it, and buffs reach those nearby', () => {
  let msgFn = null;
  const G = {}, slept = [], slowed = [];
  G.Net = { uid: 'host', on(fn) { msgFn = fn; }, onPeer() {}, slow: () => false, busy: () => false, send() {}, toHost() {}, mode: () => 'direct' };
  G.Player = class { constructor() { this.maxHp = 300; } };
  G.DEX_BY = { 25: { dex: 25 } }; G.baseStartOf = () => 'thundershock';
  G.Sprites = { preload() {} };
  G.U = { dist2: (x, y, a, b) => (x - a) ** 2 + (y - b) ** 2, norm: (x, y) => { const d = Math.hypot(x, y) || 1; return [x / d, y / d]; },
    pick: a => a[0] };
  G.FX = { ring() {}, dmgText() {} }; G.Audio = { sfx() {} }; G.Spawner = { say() {} }; G.T = s => s;
  G.Camera = { VIEW_W: 768, MIN_VIEW_H: 420, zoom: 1, zoomTo: 1 };
  const foe = (id, x, boss) => ({ id, x, y: 0, boss, applySleep: d => slept.push([id, d]), applySlow: (f, d) => slowed.push([id, f, d]) });
  G.EnemyMgr = { all: () => [foe(1, 100, false), foe(2, 120, true), foe(3, 5000, false)] };
  const local = { x: 0, y: 0, dead: false, bodyH: 20, critChance: 0, spdMul: 1 };
  G.Game = { player: local, state: 'playing' };
  new Function('G', source('js/systems/orbs.js'))(G);
  new Function('G', 'document', source('js/net/coop.js'))(G, { addEventListener() {} });
  G.Coop.begin({ host: 'host', members: [{ uid: 'host', name: 'Ana', dex: 25 }, { uid: 'guest', name: 'Bea', dex: 25 }] }, local,
    { lost() {}, mateLeft() {}, waiting() {} });
  const guest = G.Coop.puppets()[0];
  const use = (id, x = 0) => msgFn('guest', { k: 'f', ev: [['ou', id, x, 0, 1]] });

  use('slumber');                                   // no la tiene: no pasa nada
  assert.deepEqual(slept, []);
  assert.ok(G.Orbs.add(guest, 'slumber'));          // la coge (el anfitrión lleva la cuenta)
  use('slumber');
  assert.deepEqual(slept, [[1, 4], [2, 1]]);         // los de su pantalla; el jefe, 1 s; el lejano, nada
  use('slumber');                                   // ya la ha gastado
  assert.equal(slept.length, 2);

  G.Orbs.add(guest, 'quick');
  use('quick', 5000);                               // lejos del anfitrión: a él no le llega
  assert.equal(local.spdMul, 1);
  G.Orbs.add(guest, 'quick');
  use('quick', 100);                                // a menos de media pantalla: también para el anfitrión
  assert.equal(local.spdMul, 1.4);

  for (let i = 0; i < 3; i++) G.Orbs.add(guest, 'slow');
  assert.ok(!G.Orbs.canTake(guest, 'slow'));         // 3 de cada como mucho
  for (const id of ['focus', 'luminous']) G.Orbs.add(guest, id);
  assert.ok(G.Orbs.canTake(guest, 'blowback'));      // (las dos Rapidosferas ya se gastaron: queda 1 hueco)
  G.Orbs.add(guest, 'quick');
  assert.ok(!G.Orbs.canTake(guest, 'blowback'));     // y 4 huecos
});

test('connection candidates travel together in one database message, and both formats are understood', async () => {
  const { N, pcs, signals, offer, deliver } = turnNetwork(goodTurn, { user: { uid: 'guest', getIdToken: async () => 'token' }, host: false });
  N.open('room', false, 'host');
  offer(false); await settle();
  const pc = pcs[0], before = signals.length;
  for (const n of [1, 2, 3]) pc.onicecandidate({ candidate: { toJSON: () => ({ candidate: 'c' + n }) } });
  assert.equal(signals.length, before, 'they wait to go together');
  pc.onicecandidate({ candidate: null });
  assert.equal(signals.length, before + 1, 'one message');
  assert.deepEqual(signals.at(-1)[1].sig.cs.map(c => c.candidate), ['c1', 'c2', 'c3']);
  deliver({ cs: [{ candidate: 'h1' }, { candidate: 'h2' }] });   // de esta versión
  deliver({ c: { candidate: 'h3' } });                          // de las de antes
  await settle();
  assert.deepEqual(pc.added.map(c => c.candidate).sort(), ['h1', 'h2', 'h3']);   // (el orden da igual)
});

function coopSums(host, mySum) {
  let msgFn = null; const got = {};
  const G = {};
  G.Net = { uid: host ? 'host' : 'guest', on(fn) { msgFn = fn; }, onPeer() {}, slow: () => false, busy: () => false, send() {}, toHost() {}, mode: () => 'direct' };
  G.Player = class { constructor() { this.maxHp = 300; } };
  G.DEX_BY = { 25: { dex: 25 }, 7: { dex: 7 } }; G.baseStartOf = () => 'thundershock';
  G.Moves = { BY_ID: { thundershock: {}, tackle: {} } }; G.Items = { BY: { leftovers: {} } };
  G.Sprites = { preload() {} }; G.U = { dist2: () => 0 };
  G.Projectiles = { clearOrbs() {} }; G.Spawner = { say() {} }; G.Social = { me: { name: 'yo' }, dropMember() {} };
  new Function('G', 'document', 'setTimeout', 'clearTimeout', source('js/net/coop.js'))(G, { addEventListener() {} }, () => 0, () => {});
  G.Coop.begin({ host: 'host', members: [{ uid: 'host', name: 'Ana', dex: 25 }, { uid: 'guest', name: 'Bea', dex: 7 }] }, { x: 0, y: 0 },
    { mySum: () => mySum, over: d => { got.over = d; }, syncTeam() {}, hold() {}, away() {}, lost() {}, mateLeft() {}, waiting() {} });
  return { G, got, from: (u, msg) => msgFn(u, msg) };
}

test('co-op run summary: each player sees everyone, and what arrives is cleaned', () => {
  const mine = { dex: 25, sh: false, lv: 30, t: 900, it: null, mv: [['thundershock', 5, 12000, 0, 1]] };
  // Anfitrión: el resumen del invitado llega con basura y se queda sólo lo válido.
  const h = coopSums(true, mine);
  h.from('guest', { k: 'f', ev: [['sm', { dex: 7, sh: true, lv: 1e9, t: 900, it: '<img onerror=x>',
    mv: [['tackle', 3, 5000, 10, 0], ['<script>', 1, 1, 1, 0], 'x', ['thundershock', 2, -50, 0, 0]], extra: 'nope' }]] });
  const s = h.G.Coop.sums();
  assert.deepEqual(s.host, mine);
  assert.deepEqual(s.guest, { dex: 7, sh: true, lv: 9999, t: 900, it: null, sk: '', mv: [['tackle', 3, 5000, 10, 0], ['thundershock', 2, 0, 0, 0]] });
  // Invitado: al acabar le llegan los de todos (y sólo de quien está en la partida); el suyo, el de su juego.
  const g = coopSums(false, { dex: 7, sh: false, lv: 30, t: 900, it: 'leftovers', mv: [] });
  g.from('host', { k: 'f', ev: [['ov', { why: 'host', sums: { host: mine, guest: { dex: 25, lv: 1, t: 1, mv: [] }, intruso: mine } }]] });
  assert.equal(g.got.over.why, 'host');
  const all = g.G.Coop.sums();
  assert.deepEqual(Object.keys(all).sort(), ['guest', 'host']);
  assert.deepEqual(all.host, { ...mine, sk: '' });
  assert.equal(all.guest.it, 'leftovers');
});

test('co-op: a lost "I have picked" or "I am done choosing" message no longer freezes the run for everyone', () => {
  const calls = { resume: 0, hold: [] };
  const r = coopSums(true, null);
  r.G.Judgment = { netState: () => null }; r.G.EnemyMgr = { all: () => [] };
  const local = { x: 0, y: 0, moveAngle: 0, walking: false, hp: 300, maxHp: 300, magnet: 78, aim: 0, xpMul: 1, activeGroup: () => [] };
  r.G.Coop.begin({ host: 'host', members: [{ uid: 'host', name: 'Ana', dex: 25 }, { uid: 'guest', name: 'Bea', dex: 7 }] }, local,
    { levelStart() {}, waiting() {}, resume: () => calls.resume++, hold: names => calls.hold.push(names.join(',')), mateLeft() {}, lost() {},
      team: () => ({ time: 0, level: 1, xp: 0, xpNext: 10, kills: 0, bosses: 0, coins: 0, t1: 0, t10: 0 }), summary: () => ({}) });
  // Ronda de cartas: el anfitrión elige; el aviso del invitado ('lp') se pierde.
  r.G.Coop.levelStart(2);
  r.G.Coop.localPicked();
  assert.equal(calls.resume, 0, 'still waiting for the guest');
  r.from('guest', { k: 'f', ev: [], w: 1, h: 0 });          // su siguiente mensaje normal: ya eligió la ronda 1
  assert.equal(calls.resume, 1, 'the run goes on');
  // Fusión: el aviso de "he terminado" ('he') se pierde; el estado del mensaje manda.
  r.from('guest', { k: 'f', ev: [['hs']], w: 1, h: 1 });
  assert.equal(calls.hold.at(-1), 'Bea');
  r.from('guest', { k: 'f', ev: [], w: 1, h: 0 });
  assert.equal(calls.hold.at(-1), '', 'nobody is choosing any more');
  // Una versión vieja (sin h ni w) sigue igual que antes: sólo cuentan sus avisos.
  r.from('guest', { k: 'f', ev: [['hs']] });
  r.from('guest', { k: 'f', ev: [] });
  assert.equal(calls.hold.at(-1), 'Bea');
});

function coopJam(host) {
  const sent = [], G = {};
  let jam = false;
  G.Net = { uid: host ? 'host' : 'guest', on() {}, onPeer() {}, slow: () => false, busy: () => jam,
    send: (uid, f) => sent.push(f), toHost: f => sent.push(f) };
  G.Player = class { constructor() { this.maxHp = 300; } };
  G.DEX_BY = { 25: { dex: 25 } }; G.baseStartOf = () => 'thundershock';
  G.Sprites = { preload() {} }; G.U = { dist2: () => 0 };
  G.EnemyMgr = { all: () => [] }; G.Judgment = { netState: () => null }; G.Ranking = { mySeal: () => null };
  G.Social = { me: { name: 'yo' } };
  new Function('G', 'document', source('js/net/coop.js'))(G, { addEventListener() {} });
  const local = { x: 0, y: 0, moveAngle: 0, walking: false, hp: 300, maxHp: 300, magnet: 78, aim: 0, xpMul: 1, activeGroup: () => [] };
  G.Coop.begin({ host: 'host', members: [{ uid: 'host', name: 'Ana', dex: 25 }, { uid: 'guest', name: 'Bea', dex: 25 }] }, local,
    { team: () => ({ time: 0, level: 1, xp: 0, xpNext: 10, kills: 0, bosses: 0, coins: 0, t1: 0, t10: 0 }), choosing: () => false, levelStart() {}, waiting() {} });
  return { G, sent, jam: v => { jam = v; } };
}

test('co-op jammed connection: nothing piles up behind (the 4-minute delay); events wait and none are lost', () => {
  const h = coopJam(true);
  h.G.Coop.tick(1); h.sent.length = 0;
  h.jam(true);
  for (let i = 0; i < 700; i++) h.G.Coop.say('e' + i, 1);
  for (let i = 0; i < 30; i++) h.G.Coop.tick(1 / 15);
  h.G.Coop.levelStart(2);                                   // también lo que se manda al momento
  assert.equal(h.sent.length, 0, 'nothing is added while the channel still has a backlog');
  h.jam(false);
  h.G.Coop.tick(1 / 15); h.G.Coop.tick(1 / 15);
  const evs = h.sent.flatMap(f => f.ev).filter(e => e[0] === 'say').map(e => e[1]);
  assert.equal(h.sent[0].ev.length, 500, 'a huge backlog goes in several messages');
  assert.deepEqual(evs, Array.from({ length: 700 }, (_, i) => 'e' + i), 'all of them, in order');

  const g = coopJam(false);
  g.G.Coop.tick(1); g.sent.length = 0;
  g.jam(true);
  g.G.Coop.status({ id: 7 }, 'b', 3);
  g.G.Coop.localPicked();
  g.G.Coop.tick(1);
  assert.equal(g.sent.length, 0);
  g.jam(false); g.G.Coop.tick(1);
  assert.deepEqual(g.sent[0].ev.map(e => e[0]), ['s', 'lp']);
  g.jam(true); g.G.Coop.leave();
  assert.deepEqual(g.sent.at(-1).ev.at(-1), ['bye'], 'leaving is always said');
});

test('net busy: only an open channel with a big backlog counts as busy', async () => {
  const { N, pcs } = turnNetwork(goodTurn);
  N.open('room', true, 'host'); N.syncMembers(['host', 'a']); await settle();
  const dc = pcs[0].dc;
  assert.equal(N.busy('a'), false);
  dc.readyState = 'open'; dc.bufferedAmount = 64 * 1024;
  assert.equal(N.busy('a'), false);
  dc.bufferedAmount = 64 * 1024 + 1;
  assert.equal(N.busy('a'), true);
  assert.equal(N.busy('nadie'), false);
});
