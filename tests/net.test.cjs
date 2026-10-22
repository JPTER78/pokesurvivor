const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { frame, client } = require('./net-fixtures.cjs');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function codec() { const G = {}; new Function('G', source('js/net/codec.js'))(G); return G.NetCodec; }
const C = codec();

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
    ref: p => ({ on() {}, off() {}, push: s => { relay.push([p, s]); return Promise.resolve(); } })
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
    G.Net = { uid: host ? 'host' : 'guest', on() {}, onPeer() {}, slow: () => false,
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
    else {
      assert.equal(sent[0].p.length, 17);
      assert.equal(sent[0].p[15], '');   // 16.º: a quién mira estando caído
      assert.equal(sent[0].p[16], 0);    // 17.º: si ha salido de la ventana (pauseAway)
    }
  }
});

function turnNetwork(respond, { user = { uid: 'host', getIdToken: async () => 'token' }, host = true } = {}) {
  const pcs = [], calls = [], signals = [], timers = [], G = { NetCodec: codec(), DB: { fb: { uid: host ? 'host' : 'guest', auth: { currentUser: user }, rtdb: {
    ref: p => ({ on(ev, fn) { this.fn = fn; G.listen = fn; }, off() {}, push: s => { signals.push([p, JSON.parse(s)]); return Promise.resolve(); } })
  } } } };
  class PC {
    constructor(cfg) { this.cfg = cfg; pcs.push(this); }
    createDataChannel() { return this.dc = { readyState: 'connecting', send() {}, close() {} }; }
    createOffer() { return Promise.resolve({ type: 'offer' }); }
    createAnswer() { return Promise.resolve({ type: 'answer' }); }
    setLocalDescription(d) { this.localDescription = { toJSON: () => d }; return Promise.resolve(); }
    setRemoteDescription(d) { this.remoteDescription = d; return Promise.resolve(); }
    addIceCandidate() { return Promise.resolve(); }
    fail() { this.connectionState = 'failed'; this.onconnectionstatechange(); }
    close() {}
  }
  const setTimeout = (fn, ms) => { timers.push(ms); if (ms === 0) Promise.resolve().then(fn); return timers.length; };
  const fetch = async (url, opt) => { calls.push([url, opt]); return respond(); };
  new Function('G', 'RTCPeerConnection', 'setTimeout', 'clearTimeout', 'fetch', source('js/net/net.js'))(G, PC, setTimeout, () => {}, fetch);
  const offer = (t) => G.listen({ val: () => JSON.stringify({ f: 'host', sig: t ? { sdp: { type: 'offer' }, t: 1 } : { sdp: { type: 'offer' } } }), ref: { remove: () => Promise.resolve() } });
  return { N: G.Net, pcs, calls, signals, timers, offer };
}
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };
const turnReply = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });
const goodTurn = () => turnReply({ expiresAt: Date.now() / 1000 + 7200, iceServers: [
  { urls: ['turn:turn.pokesurvivor.com:3478?transport=udp', 'turn:evil.example:3478', 'stun:x'], username: 'u', credential: 'c' },
  { urls: ['turn:turn.pokesurvivor.com:3478?transport=tcp'], username: '', credential: 'c' }] });

test('own TURN: first try is direct only; a failed pair retries at once with clean TURN servers', async () => {
  const { N, pcs, calls, signals } = turnNetwork(goodTurn);
  N.open('room', true, 'host'); N.syncMembers(['host', 'a', 'b']); await settle();
  assert.equal(calls.length, 0, 'nothing is asked while direct may work');
  assert.equal(pcs.length, 2);
  for (const pc of pcs) assert.equal(pc.cfg.iceServers.length, 1);
  assert.ok(signals.every(([, m]) => !m.sig.sdp || !m.sig.t));
  pcs[0].fail(); await settle();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://ice.pokesurvivor.com/v1/ice');
  assert.equal(calls[0][1].method, 'POST'); assert.equal(calls[0][1].headers.Authorization, 'Bearer token');
  const retry = pcs[2];
  assert.equal(retry.cfg.iceServers[0].urls[0], 'stun:stun.l.google.com:19302');
  assert.deepEqual(retry.cfg.iceServers.slice(1), [{ urls: ['turn:turn.pokesurvivor.com:3478?transport=udp'], username: 'u', credential: 'c' }]);
  const offers = signals.filter(([p, m]) => p.endsWith('/a') && m.sig.sdp);
  assert.equal(offers.at(-1)[1].sig.t, 1);
  assert.equal(pcs.length, 3, 'only the failed pair reserves TURN');
});
test('own TURN: refused or broken answers retry with STUN only and then wait as before', async () => {
  for (const respond of [() => turnReply({ error: 'user_denied' }, 403), () => { throw Error('offline'); },
    () => turnReply({ expiresAt: 1, iceServers: [] })]) {
    const { N, pcs, calls, timers } = turnNetwork(respond);
    N.open('room', true, 'host'); N.syncMembers(['host', 'a']); await settle();
    pcs[0].fail(); await settle();
    assert.equal(calls.length, 1); assert.equal(pcs.length, 2); assert.equal(pcs[1].cfg.iceServers.length, 1);
    pcs[1].fail(); await settle();
    assert.equal(timers.at(-1), 15000); assert.equal(pcs.length, 2); assert.equal(calls.length, 1);
  }
});
test('own TURN: guests use it only when the host asks for it', async () => {
  const { N, pcs, calls, offer } = turnNetwork(goodTurn, { user: { uid: 'guest', getIdToken: async () => 'token' }, host: false });
  N.open('room', false, 'host');
  offer(false); await settle();
  assert.equal(calls.length, 0); assert.equal(pcs[0].cfg.iceServers.length, 1);
  offer(true); await settle();
  assert.equal(calls.length, 1); assert.equal(pcs[1].cfg.iceServers.length, 2);
});
test('own TURN: players without an account never ask and keep the old retry', async () => {
  for (const user of [null, { uid: 'anon', isAnonymous: true }]) {
    const { N, pcs, calls, timers } = turnNetwork(() => assert.fail('no request'), { user });
    N.open('room', true, 'host'); N.syncMembers(['host', 'a']); await settle();
    pcs[0].fail(); await settle();
    assert.equal(calls.length, 0); assert.equal(pcs.length, 1); assert.equal(timers.at(-1), 15000);
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
  G.Net = { uid: host ? 'host' : 'guest', on(fn) { msgFn = fn; }, onPeer(fn) { peerFn = fn; }, slow: () => false,
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
