const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(require('path').resolve(__dirname, '../../js/net/net.js'), 'utf8');
const pushed = []; let childAdded = null;
const rtdb = { ref: path => ({ on: (ev, fn) => { if (ev === 'child_added') childAdded = fn; }, off() {}, push: v => { pushed.push({ path, v }); return Promise.resolve(); } }) };
const ctx = { console, JSON, Map, Set, Promise, setTimeout, clearTimeout, performance, fetch: () => Promise.reject(new Error('no')),
  RTCPeerConnection: undefined };
ctx.G = { DB: { fb: { rtdb, uid: 'me', emulator: true } } };
vm.createContext(ctx); vm.runInContext(src, ctx);
const got = [];
ctx.G.Net.on((from, msg) => got.push([from, msg]));
const feed = raw => childAdded({ val: () => raw, ref: { remove: () => Promise.resolve() } });
ctx.G.Net.open('room1', false, 'hostuid');
// 1. formato nuevo: el remitente sale de f
feed({ f: 'hostuid', p: JSON.stringify({ d: { k: 'start', host: 'hostuid' } }) });
// 2. formato nuevo, el contenido intenta colar su propio f
feed({ f: 'mallory', p: JSON.stringify({ f: 'hostuid', d: { k: 'start', host: 'hostuid' } }) });
// 3. basura
feed({ f: 5, p: 'x' }); feed({ f: 'a', p: '{no json' }); feed(null); feed(42); feed({ f: 'a', p: '5' });
// 4. formato viejo (texto), mientras ACCEPT_LEGACY
feed(JSON.stringify({ f: 'hostuid', d: { k: 'x' } }));
console.log(JSON.stringify(got));
assert.strictEqual(got.length, 3);
assert.deepStrictEqual(got[0][0], 'hostuid');
assert.deepStrictEqual(got[1][0], 'mallory', 'el remitente es el de f del sobre, no el que diga el contenido');
assert.deepStrictEqual(got[2][0], 'hostuid');
// 5. una oferta de conexión de alguien que no es el anfitrión no crea pareja
feed({ f: 'mallory', p: JSON.stringify({ sig: { sdp: { type: 'offer', sdp: 'x' } } }) });
assert.strictEqual(ctx.G.Net.mode('mallory'), 'closed');
// 6. envío por relé de 'start': formato nuevo
ctx.G.Net.send('guest1', { k: 'start', seed: 1 });
console.log(JSON.stringify(pushed));
assert.strictEqual(pushed.length, 1);
assert.strictEqual(pushed[0].path, 'rooms/room1/q/guest1');
assert.deepStrictEqual(Object.keys(pushed[0].v).sort(), ['f', 'p']);
assert.strictEqual(pushed[0].v.f, 'me');
assert.deepStrictEqual(JSON.parse(pushed[0].v.p), { d: { k: 'start', seed: 1 } });
// 7. datos de partida sin canal directo: no van por el relé (como antes)
ctx.G.Net.send('guest1', { k: 'f' });
assert.strictEqual(pushed.length, 1);
console.log('OK net.test.js: formato de mensajes de net.js');
