// Guardado en la nube con varios aparatos y pestañas: js/core/db.js de verdad,
// con una nube falsa que aplica las reglas de saves (rev + 1 y 20 s entre escrituras).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js/core/db.js'), 'utf8');

let NOW = 1e12, cloud = null, down = false, writes = 0;
const clone = o => JSON.parse(JSON.stringify(o));
const ref = {
  async get() { if (down) throw { code: 'unavailable' }; return { exists: !!cloud, data: () => clone(cloud) }; },
  async set(d, o) {
    const next = Object.assign(cloud ? clone(cloud) : {});
    for (const f of o.mergeFields) next[f] = clone(d[f]);
    next.updatedAt = NOW;
    if (cloud) {
      const had = cloud.rev || 0, now = next.rev || 0;
      if (NOW <= cloud.updatedAt + 20000 || !(now === had + 1 || (had === 0 && now === 0))) throw { code: 'permission-denied' };
    }
    cloud = next; writes++;
  }
};
const TABS = new Map();   // navegador (su localStorage) -> eventos 'storage' de cada pestaña
function tab(store) {
  if (!TABS.has(store)) TABS.set(store, []);
  const mine = [], timers = [], vis = [];
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); for (const fn of TABS.get(store)) if (!mine.includes(fn)) setImmediate(() => fn({ key: k, newValue: String(v) })); },
    removeItem: k => store.delete(k), key: i => [...store.keys()][i], get length() { return store.size; }
  };
  const auth = { setPersistence: async () => {}, useEmulator() {}, onAuthStateChanged: cb => { Promise.resolve().then(() => cb({ uid: 'U1', displayName: 'Ash' })); return () => {}; } };
  const db = { useEmulator() {}, settings() {}, collection: () => ({ doc: () => ref }) };
  const G = { FIREBASE_CONFIG: { apiKey: 'x', projectId: 'p', emulator: true } };
  const ctx = {
    G, localStorage, console: { warn() {}, log: console.log }, TextEncoder, setTimeout: fn => timers.push(fn), clearTimeout() {},
    firebase: { initializeApp() {}, auth: Object.assign(() => auth, { Auth: { Persistence: { LOCAL: 1 } } }),
                firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => 0 } }) },
    location: { protocol: 'https:', hostname: 'localhost' }, navigator: { onLine: true },
    document: { createElement: () => ({}), head: { appendChild: el => setImmediate(el.onload) }, hidden: false,
      addEventListener: (t, fn) => { if (t === 'visibilitychange') vis.push(fn); } },
    window: { addEventListener: (t, fn) => { mine.push(fn); TABS.get(store).push(fn); } }, Date: { now: () => NOW }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const hide = () => { ctx.document.hidden = true; vis.forEach(fn => fn()); };
  return { DB: G.DB, timers, hide, close() { const l = TABS.get(store); for (const fn of mine) l.splice(l.indexOf(fn), 1); } };
}
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };
async function open(store) { const t = tab(store); await t.DB.ready(); await settle(); return t; }
async function act(t, op) {
  NOW += 100000;
  if (op === 'save') await t.DB.saveNow();
  else { t.DB.save.tickets.t1 += op; t.DB.commit(); }
  await settle();
}
const reset = () => { cloud = null; down = false; TABS.clear(); };

test('lo ganado aquí sin guardar se sube aunque otro aparato guardara después', async () => {
  reset();
  const pc = new Map(), mob = new Map();
  let A = await open(pc), B = await open(mob);
  await act(A, 'save');
  await act(A, 8);                       // 8 tickets en el PC, sin pulsar Guardar
  A.close(); A = await open(pc);
  await act(B, 1); await act(B, 'save'); // el móvil guarda después
  A.close(); A = await open(pc);         // vuelve al PC: la nube es "más nueva"
  assert.equal(A.DB.syncState, 'pending');
  await act(A, 'save');
  assert.equal(cloud.save.tickets.t1, 9);
});

test('gastar en un aparato lo ya gastado en otro se perdona una vez: ni crece ni se come lo ganado después', async () => {
  reset();
  const pc = new Map(), mob = new Map();
  let A = await open(pc);
  await act(A, 3); await act(A, 'save');
  let B = await open(mob);               // el móvil ve los 3
  await act(A, -3); await act(A, 'save');
  await act(B, -3); await act(B, 'save'); // los mismos 3, otra vez: la libreta quedaba en -3
  await act(B, 3); await act(B, 3);      // 6 ganados después
  await act(B, 'save');
  assert.equal(B.DB.save.tickets.t1, 6);
  assert.equal(cloud.save.tickets.t1, 6);
  A.close(); A = await open(pc);         // el PC recarga: junta y no vuelve a perdonar
  assert.equal(A.DB.save.tickets.t1, 6);
  await act(A, 1); await act(A, 'save');
  assert.equal(cloud.save.tickets.t1, 7);
  assert.equal((await open(new Map())).DB.save.tickets.t1, 7);
});

test('dos pestañas del mismo navegador no se pisan', async () => {
  reset();
  const pc = new Map();
  const A = await open(pc), A2 = await open(pc);
  await act(A, 5); await act(A2, 2); await act(A, -1); await act(A2, 4);
  assert.equal(A.DB.save.tickets.t1, 10);
  assert.equal(A2.DB.save.tickets.t1, 10);
  await act(A2, 'save');
  assert.equal(cloud.save.tickets.t1, 10);
});

test('al azar: nunca se pierde lo ganado ni crece más de lo gastado dos veces', async () => {
  for (let seed = 1; seed <= 150; seed++) {
    reset();
    let x = seed; const R = n => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return (x >>> 8) % n; };
    const pc = new Map(), mob = new Map(), stores = [pc, mob, pc];
    const tabs = [await open(pc), await open(mob), await open(pc)];
    let net = 0, spent = 0;
    for (let step = 0; step < 25; step++) {
      const i = R(3), t = tabs[i], op = R(4);
      if (op === 0) { const n = 1 + R(3); net += n; await act(t, n); }
      else if (op === 1 && t.DB.save.tickets.t1 > 0) { const n = 1 + R(t.DB.save.tickets.t1); net -= n; spent += n; await act(t, -n); }
      else if (op === 2) await act(t, 'save');
      else { t.close(); tabs[i] = await open(stores[i]); }
    }
    for (let r = 0; r < 2; r++) for (const t of tabs) { NOW += 400000; await t.DB.saveNow(); await settle(); }
    const fin = await open(new Map());   // otro aparato, sin copia: sólo lo de la nube
    // Lo gastado dos veces (en una copia vieja) se perdona una vez, en led.fix; nada más.
    const got = fin.DB.save.tickets.t1, fix = ((fin.DB.save.led.fix || {}).t1 || [0])[0];
    assert.equal(got, Math.max(0, net + fix), 'seed ' + seed);
    assert.ok(got >= Math.max(0, net) && fix <= spent, 'seed ' + seed);
  }
});

test('si al entrar no se pudo leer la nube, se vuelve a intentar y se junta lo del otro aparato', async () => {
  reset();
  const pc = new Map(), mob = new Map();
  let A = await open(pc);
  await act(A, 2); await act(A, 'save');
  const B = await open(mob);
  await act(B, 5); await act(B, 'save');  // el móvil guarda 5 más
  down = true;                           // el PC abre sin red: sólo su copia (2)
  A.close(); A = await open(pc);
  assert.equal(A.DB.save.tickets.t1, 2);
  assert.equal(A.DB.syncState, 'offline');
  down = false;
  NOW += 100000;
  for (const fn of A.timers.splice(0)) fn();   // el reintento de la lectura
  await settle();
  assert.equal(A.DB.save.tickets.t1, 7);
  assert.equal(A.DB.syncState, 'ok');            // la nube ya lo tenía todo
  await act(A, -7); await act(A, 'save');        // y gasta lo de verdad, sin gastar dos veces
  assert.equal(cloud.save.tickets.t1, 0);
  assert.ok(!cloud.save.led.fix);
});

test('Guardar sin haber cambiado nada no vuelve a escribir en la nube', async () => {
  reset();
  const A = await open(new Map());
  await act(A, 3); await act(A, 'save');
  const n = writes;
  NOW += 100000; A.DB.commit(); await settle();  // se guarda en el navegador sin cambiar nada
  assert.equal(A.DB.syncState, 'pending');
  await act(A, 'save');
  assert.equal(writes, n);
  assert.equal(A.DB.syncState, 'ok');
  await act(A, 1); await act(A, 'save');       // algo nuevo: sí
  assert.equal(writes, n + 1);
  assert.equal(cloud.save.tickets.t1, 4);
});

test('Guardar dos veces seguidas y salir del juego: la segunda se sube al salir', async () => {
  reset();
  const A = await open(new Map());
  await act(A, 3); await act(A, 'save');            // 1.ª subida
  NOW += 5000; A.DB.save.tickets.t1 += 2; A.DB.commit(); await settle();
  const r = await A.DB.saveNow();                   // a los 5 s: tiene que esperar
  assert.equal(r.why, 'wait');
  assert.equal(cloud.save.tickets.t1, 3);
  NOW += 17000; A.hide(); await settle();            // a los 22 s sales del juego
  assert.equal(cloud.save.tickets.t1, 5, 'se ha subido al salir');
});
