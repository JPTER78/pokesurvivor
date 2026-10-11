/* Network regressions. Runs the real game modules in isolated peers with virtual
 * time and mocked browser/Firebase boundaries. No production connections.
 * node tools/test-coop.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const noop = () => {};
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function load(ctx, file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
}
function base() {
  let time = 1000, nextTimer = 1;
  const timers = new Map();
  const G = {
    U: { dist2: (x, y, a, b) => (x - a) ** 2 + (y - b) ** 2,
      clamp: (x, a, b) => Math.max(a, Math.min(b, x)), rand: a => a,
      damp: (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt)) },
    DEX_BY: { 25: { dex: 25, name: 'Pikachu', hp: 100, spd: 100, atk: 10, types: ['electric'] } },
    Sprites: { PX: 1, preload: noop, hasShiny: () => false, hovers: () => false,
      bodyRadius: () => 10, bodyHeight: () => 20, dirFromAngle: () => 0,
      Animator: class { constructor() { this.cur = 'Idle'; this.dir = 0; }
        update() {} loop() {} play() {} busy() { return false; } } },
    startMoveOf: () => '', Moves: { BY_ID: {} },
    Spawner: { say: noop }, Projectiles: { clearOrbs: noop, clear: noop },
    Combat: { clearFields: noop }, Hazards: { clear: noop },
    FX: { dmgText: noop, ring: noop, spark: noop, burst: noop }, Audio: { sfx: noop },
    World: { biome: 0, setArena: noop, setBiome: noop, breakAt: noop },
    Tiles: { T: 16, ARENA_THEMES: {}, arenaBiome: () => 0 },
    Camera: {}, Weather: { clear: noop }, Progress: { event: noop }, Pickups: { pullAll: noop },
    Social: { me: { name: 'Player' }, room: { host: 'host' } }, Flow: {}
  };
  const ctx = vm.createContext({ G, console, document: { hidden: false }, performance: { now: () => time },
    setTimeout: () => 1, clearTimeout: noop,
    setInterval: fn => { const id = nextTimer++; timers.set(id, fn); return id; },
    clearInterval: id => timers.delete(id) });
  return { ctx, G, timers, advance: ms => { time += ms; }, fire: () => [...timers.values()].forEach(fn => fn()) };
}
const cfg = { session: 'run-test', protocol: 2, seed: 42, host: 'host',
  members: [{ uid: 'host', dex: 25, name: 'Host' }, { uid: 'guest', dex: 25, name: 'Guest' }] };
function coop(host = false) {
  const b = base(), { ctx, G } = b, sent = [], callbacks = {};
  const data = { waiting: [], resumed: 0, lost: [], removed: [], shiny: 0, levels: 0 };
  G.Social.removeRoomMember = uid => data.removed.push(uid);
  G.Net = { uid: host ? 'host' : 'guest', on: fn => { callbacks.message = fn; }, onPeer: fn => { callbacks.peer = fn; },
    send: (to, msg) => sent.push({ to, msg: JSON.parse(JSON.stringify(msg)) }),
    toHost: msg => sent.push({ to: 'host', msg: JSON.parse(JSON.stringify(msg)) }),
    slow: () => false, viaTurn: () => false };
  load(ctx, 'js/entities/player.js'); load(ctx, 'js/entities/enemy.js'); load(ctx, 'js/net/coop.js');
  const local = new G.Player(G.DEX_BY[25]);
  const state = { time: 0, level: 1, xp: 0, xpNext: 100, kills: 0, bosses: 0, coins: 0, t1: 0, t10: 0 };
  const api = { team: () => state, syncTeam: s => Object.assign(state, s),
    levelStart: () => { data.levels++; }, waiting: names => { data.waiting = names; },
    resume: () => { data.resumed++; }, lost: message => data.lost.push(message),
    shiny: () => { data.shiny++; }, over: noop };
  G.Coop.begin(cfg, local, api);
  G.Game = { player: local, everyone: () => G.Coop.players(), flash: noop, offerBond: noop };
  return { ...b, local, state, sent, data, api,
    receive: msg => callbacks.message(host ? 'guest' : 'host', msg),
    peerClosed: () => callbacks.peer(host ? 'guest' : 'host', 'closed'),
    tick: () => G.Coop.tick(), restart: session => G.Coop.begin({ ...cfg, session }, local, api) };
}
function frame({ seq = 1, world = 0, ack = 0, ev = [], e = [], p = {}, ...rest } = {}) {
  return { k: 'f', session: cfg.session, seq, world, ack,
    t: 10, lv: 1, xp: 0, xn: 100, ki: 0, bo: 0, co: 0, tk: [0, 0], p, e, ev, ...rest };
}
const playerState = x => [x, 0, 0, 1, 100, 100, 0, '', 1, 78, 0, 1, 0];
const enemy = (id, x = 0) => [id, x, 0, 100, 0, 0, 0, 25, 0, 0, 100, 10, 'melee'];
const spawn = (id, x = 0) => ['ne', id, 25, x, 0, 0, 0, 100, 10, 'melee'];
const latest = peer => peer.sent.at(-1).msg;

// P1: snapshots cannot rewind state, events remain reliable across both transports.
test('late host snapshots cannot rewind counters or remote positions', () => {
  const c = coop();
  c.receive(frame({ seq: 2, t: 20, ki: 5, p: { host: playerState(500) } }));
  c.receive(frame({ seq: 1, t: 10, ki: 1, p: { host: playerState(100) } }));
  assert.equal(c.state.time, 20); assert.equal(c.state.kills, 5);
  assert.equal(c.G.Coop.mate('host').pl.net.x, 500);
});
test('late client snapshots cannot move a host puppet backwards', () => {
  const c = coop(true);
  c.receive(frame({ seq: 2, p: playerState(500) }));
  c.receive(frame({ seq: 1, p: playerState(100) }));
  assert.equal(c.G.Coop.mate('guest').pl.net.x, 500);
});
test('another run and legacy unsequenced frames are ignored', () => {
  const c = coop();
  c.receive(frame({ session: 'previous-run', t: 100, ev: [[1, 0, ['sh', 25]]] }));
  const legacy = frame({ t: 100 }); delete legacy.seq; c.receive(legacy);
  assert.equal(c.state.time, 0); assert.equal(c.data.shiny, 0);
});
test('host events survive a lost frame and are applied exactly once before ack', () => {
  const h = coop(true), g = coop();
  h.G.Coop.broadcast(['sh', 25]); h.tick(); const dropped = latest(h);
  h.advance(100); h.tick(); const retry = latest(h);
  assert.deepEqual(retry.ev, dropped.ev);
  g.receive(retry); g.receive(dropped); assert.equal(g.data.shiny, 1);
  g.tick(); h.receive(latest(g)); h.advance(100); h.tick();
  assert.equal(latest(h).ev.length, 0);
});
test('client events survive retries and do not repeat their world effects', () => {
  const h = coop(true), g = coop(); let broken = 0;
  h.G.World.breakAt = () => { broken++; };
  g.G.Coop.toHost(['pb', 1, 2]); const first = latest(g);
  g.advance(100); g.tick(); const second = latest(g);
  h.receive(second); h.receive(first); assert.equal(broken, 1);
  h.tick(); g.receive(latest(h)); g.advance(100); g.tick();
  assert.equal(latest(g).ev.length, 0);
});
test('event gaps are not acknowledged until missing events arrive', () => {
  const g = coop(); g.receive(frame({ ev: [[2, 0, ['sh', 25]]] }));
  g.tick(); assert.equal(latest(g).ack, 0); assert.equal(g.data.shiny, 0);
  g.receive(frame({ seq: 2, ev: [[1, 0, ['sh', 25]], [2, 0, ['sh', 25]]] }));
  assert.equal(g.data.shiny, 2); g.advance(100); g.tick(); assert.equal(latest(g).ack, 2);
});
test('previous-world combat is acknowledged but cannot damage a new-world enemy', () => {
  const h = coop(true); let hits = 0;
  h.G.Coop.advanceWorld(); h.G.EnemyMgr.get = () => ({ hurt: () => { hits++; } });
  h.receive(frame({ p: playerState(9000), ev: [[1, 0, ['h', 42, 50]]] }));
  assert.equal(hits, 0); assert.notEqual(h.G.Coop.mate('guest').pl.net.x, 9000);
  h.tick(); assert.equal(latest(h).ack, 1);
});

// P1: rift exit is a host event, not an independently running guest timer.
test('a full enemy snapshot repairs a missing spawn event', () => {
  const c = coop(); c.receive(frame({ e: [enemy(42, 200)] }));
  assert.equal(c.G.EnemyMgr.get(42).x, 200);
});
test('guest waits for host exit and keeps restored enemies despite a delayed win packet', () => {
  const c = coop(); load(c.ctx, 'js/systems/rift.js');
  const arena = { tx: 5000, ty: 5000, r: 11, dex: 25, type: 'electric' };
  const entry = [[1, 1, ['arena', arena]], [2, 1, ['aw']]];
  c.receive(frame({ seq: 1, world: 1, ev: entry }));
  c.G.Rift.update(10, c.local, 100); assert.equal(c.G.Rift.inArena, true);
  const exit = [...entry, [3, 2, ['arend']], [4, 2, spawn(42, 200)]];
  c.receive(frame({ seq: 3, world: 2, ev: exit, e: [enemy(42, 200)] }));
  assert.equal(c.G.Rift.inArena, false); assert.equal(c.G.EnemyMgr.get(42).x, 200);
  c.receive(frame({ seq: 2, world: 1, ev: entry, e: [enemy(99, 80000)] }));
  c.G.Rift.update(10, c.local, 0);
  assert.ok(c.G.EnemyMgr.get(42)); assert.equal(c.G.EnemyMgr.get(99), undefined);
  assert.equal(c.local.bonds, 1);
});
test('arena teleports use a shared formation and update puppet network targets', () => {
  const h = coop(true), g = coop();
  const arena = { tx: 5000, ty: 5000, r: 11, dex: 25, type: 'electric' };
  for (const c of [h, g]) { load(c.ctx, 'js/systems/rift.js'); c.G.Rift.onEvent(['arena', arena]); }
  assert.equal(h.local.x, g.G.Coop.mate('host').pl.x);
  assert.equal(g.local.x, h.G.Coop.mate('guest').pl.x);
  const p = g.G.Coop.mate('host').pl, x = p.x;
  p.netUpdate(1 / 60); assert.equal(p.x, x);
});
test('host exit broadcasts cleanup before restoring its stashed enemies', () => {
  const h = coop(true), g = coop();
  for (const c of [h, g]) load(c.ctx, 'js/systems/rift.js');
  const e = h.G.EnemyMgr.add(new h.G.Enemy({ dex: 25, hp: 100, spd: 50, dmg: 10, xp: 0,
    behavior: 'melee' }, 0, 0, { hp: 1, spd: 1, dmg: 1 }));
  h.G.Coop.advanceWorld();
  const arena = { tx: 5000, ty: 5000, r: 11, dex: 25, type: 'electric' };
  h.G.Coop.broadcast(['arena', arena]); h.G.Rift.onEvent(['arena', arena]);
  h.G.Coop.broadcast(['aw']); h.G.Rift.onEvent(['aw']);
  h.G.Rift.update(6, h.local, 0); h.tick(); const packet = latest(h);
  const exit = packet.ev.findIndex(x => x[2][0] === 'arend');
  const restore = packet.ev.findIndex((x, i) => i > exit && x[2][0] === 'ne');
  assert.ok(exit >= 0 && restore > exit); assert.equal(packet.world, 2);
  g.receive(packet); assert.equal(g.G.Rift.inArena, false); assert.ok(g.G.EnemyMgr.get(e.id));
});
test('solo rift still finishes using its local countdown', () => {
  const c = coop(); c.G.Coop.end(); c.G.Game.everyone = () => [c.local];
  load(c.ctx, 'js/systems/rift.js');
  c.G.Rift.onEvent(['arena', { tx: 5000, ty: 5000, r: 11, dex: 25, type: 'electric' }]);
  c.G.Rift.onEvent(['aw']); c.G.Rift.update(6, c.local, 0);
  assert.equal(c.G.Rift.inArena, false);
});

// P1: real-time heartbeat, coordinated hold, grace and waiting recovery.
test('heartbeat runs without rendering and stops when a run ends', () => {
  const h = coop(true); assert.equal(h.timers.size, 1);
  h.advance(250); h.fire(); assert.equal(h.sent.length, 1);
  h.G.Coop.end(); assert.equal(h.timers.size, 0);
  h.advance(250); h.fire(); assert.equal(h.sent.length, 1);
});
test('host hiding pauses peers while heartbeats keep running, then resumes', () => {
  const h = coop(true), g = coop(); h.ctx.document.hidden = true;
  h.fire(); g.receive(latest(h));
  assert.equal(h.G.Coop.paused, true); assert.equal(g.G.Coop.paused, true);
  h.ctx.document.hidden = false; h.advance(100); h.fire(); g.receive(latest(h));
  assert.equal(h.G.Coop.paused, false); assert.equal(g.G.Coop.paused, false);
});
test('temporary peer silence pauses rather than dropping membership, and recovers', () => {
  const h = coop(true); h.advance(4000); h.fire();
  assert.equal(h.G.Coop.paused, true); assert.equal(h.G.Coop.mate('guest').connected, true);
  h.receive(frame({ p: playerState(40) })); assert.equal(h.G.Coop.paused, false);
  assert.equal(h.data.removed.length, 0);
});
test('a silent peer expires after grace and releases the level-up barrier', () => {
  const h = coop(true); h.G.Coop.levelStart(2); h.G.Coop.localPicked();
  h.advance(31000); h.fire();
  assert.equal(h.G.Coop.mate('guest').connected, false);
  assert.equal(h.data.resumed, 1); assert.deepEqual(h.data.removed, ['guest']);
});
test('a visible player choosing a card is not kicked while heartbeats arrive', () => {
  const h = coop(true), g = coop(); h.G.Coop.levelStart(2); g.receive(latest(h));
  h.G.Coop.localPicked();
  for (let i = 0; i < 40; i++) {
    g.advance(1000); g.fire(); h.advance(1000); h.receive(latest(g));
    h.fire(); g.receive(latest(h));
  }
  assert.equal(h.G.Coop.mate('guest').connected, true); assert.equal(h.data.resumed, 0);
  g.G.Coop.localPicked(); h.receive(latest(g)); assert.equal(h.data.resumed, 1);
});
test('late pick from an earlier level-up cannot release the next barrier', () => {
  const h = coop(true);
  h.G.Coop.levelStart(2); h.G.Coop.localPicked();
  h.receive(frame({ ev: [[1, 0, ['lp', 1]]] })); assert.equal(h.data.resumed, 1);
  h.G.Coop.levelStart(3); h.G.Coop.localPicked();
  h.receive(frame({ seq: 2, ev: [[2, 0, ['lp', 1]]] })); assert.equal(h.data.resumed, 1);
  h.receive(frame({ seq: 3, ev: [[3, 0, ['lp', 2]]] })); assert.equal(h.data.resumed, 2);
});
test('guest pauses during host silence, recovers within grace, and ends after timeout', () => {
  const g = coop(); g.advance(4000); g.fire();
  assert.equal(g.G.Coop.paused, true); assert.equal(g.G.Coop.active, true);
  g.receive(frame()); assert.equal(g.G.Coop.paused, false);
  g.advance(31000); g.fire(); assert.equal(g.G.Coop.active, false); assert.equal(g.data.lost.length, 1);
});
test('run restart resets event acknowledgments and cleans up the old timer', () => {
  const g = coop(); g.receive(frame({ ev: [[1, 0, ['sh', 25]]] }));
  g.restart('new-run'); assert.equal(g.timers.size, 1);
  g.receive(frame({ session: 'new-run', ev: [[1, 0, ['sh', 25]]] }));
  assert.equal(g.data.shiny, 2);
});

test('stale snapshots cannot postpone the host-silence deadline', () => {
  const g = coop(); g.receive(frame({ seq: 2 }));
  g.advance(29000); g.receive(frame({ seq: 1 }));
  g.advance(2000); g.fire(); assert.equal(g.G.Coop.active, false);
});
test('remaining players stop simulating a teammate removed by the host', () => {
  const h = coop(true), third = coop();
  const members = [...cfg.members, { uid: 'third', dex: 25, name: 'Third' }];
  h.G.Coop.begin({ ...cfg, members }, h.local, h.api);
  third.G.Net.uid = 'third'; third.G.Coop.begin({ ...cfg, members }, third.local, third.api);
  assert.equal(third.G.Coop.puppets().length, 2);
  h.peerClosed(); h.tick();
  const packet = h.sent.find(x => x.to === 'third').msg;
  third.receive(packet); assert.equal(third.G.Coop.mate('guest').connected, false);
  assert.equal(third.G.Coop.puppets().length, 1);
});

async function net() {
  const b = base(), { ctx, G } = b, pcs = [], writes = [];
  G.DB = { fb: { uid: 'host', rtdb: { ref: () => ({ on: noop, off: noop,
    push: raw => { writes.push(raw); return Promise.resolve(); } }) } } };
  ctx.RTCPeerConnection = class {
    constructor() { pcs.push(this); this.connectionState = 'new'; }
    createDataChannel() { return this.dc = { readyState: 'connecting', sends: 0,
      send: () => { this.dc.sends++; }, close: noop }; }
    async createOffer() { return {}; }
    async setLocalDescription() { this.localDescription = { toJSON: () => ({ type: 'offer' }) }; }
    async getStats() { return new Map(); }
    close() {}
  };
  load(ctx, 'js/net/net.js'); G.Net.open('room', true, 'host'); G.Net.syncMembers(['host', 'guest']);
  for (let i = 0; i < 12; i++) await Promise.resolve();
  const pc = pcs[0]; pc.dc.readyState = 'open'; pc.dc.onopen();
  return { G, pc, writes };
}
test('failed or disconnected WebRTC uses relay even if the data channel still looks open', async () => {
  for (const state of ['failed', 'disconnected']) {
    const n = await net(); n.pc.connectionState = state; n.pc.onconnectionstatechange();
    assert.equal(n.G.Net.mode('guest'), 'relay');
    const before = n.writes.length; n.G.Net.send('guest', frame());
    assert.equal(n.pc.dc.sends, 0); assert.equal(n.writes.length, before + 1);
  }
});
test('a recovered open WebRTC transport becomes direct again', async () => {
  const n = await net(); n.pc.connectionState = 'disconnected'; n.pc.onconnectionstatechange();
  n.pc.connectionState = 'connected'; n.pc.onconnectionstatechange();
  n.G.Net.send('guest', frame()); assert.equal(n.G.Net.mode('guest'), 'direct'); assert.equal(n.pc.dc.sends, 1);
});

async function social({ create = true, uid = 'host' } = {}) {
  const b = base(), { ctx, G } = b, records = [], callbacks = new Map(), disconnects = new Map();
  const store = {};
  function get(name) { return name.split('/').reduce((v, key) => v && v[key], store); }
  function put(name, value) {
    const keys = name.split('/'), key = keys.pop(); let parent = store;
    for (const part of keys) parent = parent[part] || (parent[part] = {});
    if (value == null) delete parent[key]; else parent[key] = value;
  }
  const ref = name => ({ key: 'room', push: () => ({ key: 'room' }),
    set: async value => { put(name, value); records.push(['set', name, value]); },
    update: async value => { put(name, { ...get(name), ...value }); records.push(['update', name, value]); },
    remove: async () => { put(name, null); records.push(['remove', name]); },
    get: async () => ({ val: () => get(name), numChildren: () => Object.keys(get(name) || {}).length }),
    on: (event, fn) => { callbacks.set(name, fn); }, off: () => callbacks.delete(name),
    onDisconnect: () => ({
      update: async value => { disconnects.set(name, value); records.push(['register', name, value]); },
      cancel: async () => { disconnects.delete(name); records.push(['cancel', name]); }
    }) });
  const collection = () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ name: 'Host' }) }) }),
    where: () => ({ onSnapshot: () => noop }) });
  G.DB = { online: true, user: 'Host', onLeave: noop, ownsShiny: () => false, save: { partner: 25 },
    fb: { uid, fs: { collection }, rtdb: { ref, goOnline: noop, goOffline: noop } } };
  ctx.firebase = { database: { ServerValue: { TIMESTAMP: 1 } } };
  ctx.document.addEventListener = noop; ctx.window = { addEventListener: noop };
  load(ctx, 'js/net/social.js'); await G.Social.start(); if (create) await G.Social.createRoom();
  return { ...b, records, callbacks, disconnects, put, get, connect: () => callbacks.get('.info/connected')({ val: () => true }) };
}
test('Firebase disconnect updates presence, preserves the room, and rearms on reconnect', async () => {
  const s = await social(); await s.connect(); await s.connect();
  assert.equal(s.G.Social.room.id, 'room');
  assert.equal(s.disconnects.has('rooms/room'), false);
  assert.equal(s.disconnects.get('rooms/room/m/host').online, false);
  assert.equal(s.records.filter(x => x[0] === 'register').length, 2);
  assert.equal(s.records.filter(x => x[0] === 'remove').length, 0);
  assert.equal(s.records.at(-1)[2].online, true);
});
test('explicit room leave cancels presence and removes the room', async () => {
  const s = await social(); await s.connect(); await s.G.Social.leaveRoom();
  assert.equal(s.G.Social.room, null); assert.equal(s.disconnects.size, 0);
  assert.ok(s.records.some(x => x[0] === 'remove' && x[1] === 'rooms/room'));
  assert.equal(s.callbacks.size, 0);
});

test('a guest cannot join an abandoned lobby or leak its new membership', async () => {
  const s = await social({ create: false, uid: 'guest' });
  s.put('rooms/room', { host: 'host', open: true, m: { host: { online: false, offlineAt: 1 } } });
  const result = await s.G.Social.joinRoom('room');
  assert.equal(result.ok, false); assert.equal(s.get('rooms/room/m/guest'), undefined);
  assert.equal(s.G.Social.room, null); assert.ok(s.get('rooms/room'));
});
test('a guest can still join a lobby during a brief host Firebase reconnect', async () => {
  const s = await social({ create: false, uid: 'guest' });
  s.put('rooms/room', { host: 'host', open: true, m: { host: { online: false, offlineAt: Date.now() } } });
  assert.equal((await s.G.Social.joinRoom('room')).ok, true);
  assert.equal(s.G.Social.room.host, 'host');
});
test('leaving while disconnect registration is pending cannot leave a ghost registration', async () => {
  const s = await social();
  const pending = s.connect(); await s.G.Social.leaveRoom(); await pending;
  assert.equal(s.disconnects.size, 0); assert.equal(s.get('rooms/room'), undefined);
  assert.equal(s.records.filter(x => x[0] === 'update').length, 0);
});

(async () => {
  for (const [name, fn] of tests) { await fn(); console.log('PASS:', name); }
  console.log(`\n${tests.length} network regression tests passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
