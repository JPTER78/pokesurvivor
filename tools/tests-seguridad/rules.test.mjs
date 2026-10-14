import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, updateDoc, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore';
import { ref, set, push, update } from 'firebase/database';
import fs from 'fs';

// Uso (desde la raíz del repo):
//   cd tools/tests-seguridad && npm install && npm run reglas
//   npm run reglas:estricta   (con la regla final de la cola de mensajes)
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = process.argv[2] === 'estricta' ? 'strict' : 'new';
const rulesFs = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
const rulesDb = fs.readFileSync(path.join(ROOT, dir === 'strict' ? 'docs/seguridad/database.rules.strict.json' : 'database.rules.json'), 'utf8');
const ADMIN = 'rshaa5gKD3fXw6lE4PPXITbowaG2';
const env = await initializeTestEnvironment({
  projectId: 'demo-ps',
  firestore: { host: '127.0.0.1', port: 8080, rules: rulesFs },
  database: { host: '127.0.0.1', port: 9000, rules: rulesDb }
});
await env.clearFirestore();
const res = [];
async function t(name, expect, fn) {
  let ok;
  try { await (expect === 'allow' ? assertSucceeds(fn()) : assertFails(fn())); ok = true; } catch (e) { ok = false; }
  res.push({ name, expect, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + '[' + expect + '] ' + name);
}

await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  const ago = new Date(Date.now() - 200000);
  for (const [u, n] of [['alice', 'Alice'], ['bob', 'Bob']]) {
    await setDoc(doc(db, 'profiles', u), { name: n, lower: n.toLowerCase(), at: Timestamp.now() });
    await setDoc(doc(db, 'names', n.toLowerCase()), { uid: u });
    await setDoc(doc(db, 'saves', u), { save: { coins: 5 }, v: 1, updatedAt: Timestamp.now() });
    await setDoc(doc(db, 'runs', u), { startedAt: Timestamp.fromDate(ago), mode: 's' });
  }
});
const A = env.authenticatedContext('alice').firestore();
const B = env.authenticatedContext('bob').firestore();
const AD = env.authenticatedContext(ADMIN).firestore();
const entry = (o = {}) => Object.assign({ t: 100, uids: ['alice'], names: ['Alice'], dex: [25], shiny: [false], lv: 5, kills: 100, at: serverTimestamp() }, o);

// ---- ranking: marcas ----
await t('marca legítima en el ranking', 'allow', () => setDoc(doc(A, 'lb/s_d1/e/alice'), entry()));
await t('apodo con HTML en la marca', 'deny', () => setDoc(doc(A, 'lb/s_d2/e/alice'), entry({ names: ['<img src=x onerror=alert(1)>'] })));
await t('dex con texto en la marca', 'deny', () => setDoc(doc(A, 'lb/s_d3/e/alice'), entry({ dex: ['<b>'] })));
await t('shiny no booleano', 'deny', () => setDoc(doc(A, 'lb/s_d4/e/alice'), entry({ shiny: ['x'] })));
await t('marca de grupo con los uid ordenados', 'allow', () => setDoc(doc(A, 'lb/g_d1/e/alice_bob'), entry({ uids: ['alice', 'bob'], names: ['Alice', 'Bob'], dex: [25, 4], shiny: [false, false] })));
await t('la misma marca de grupo con los uid en otro orden', 'deny', () => setDoc(doc(A, 'lb/g_d2/e/bob_alice'), entry({ uids: ['bob', 'alice'], names: ['Bob', 'Alice'], dex: [4, 25], shiny: [false, false] })));
await t('lv como texto', 'deny', () => setDoc(doc(A, 'lb/s_d5/e/alice'), entry({ lv: '<svg onload=alert(1)>' })));

// ---- ranking: resumen del top (XSS por lv/kills del resumen) ----
const topRow = (o = {}) => Object.assign({ t: 100, uids: ['alice'], names: ['Alice'], dex: [25], lv: 5, kills: 100 }, o);
const summary = async (db, board, row) => {
  const b = writeBatch(db);
  b.set(doc(db, `lb/${board}/e/alice`), entry());
  b.set(doc(db, `lbs/${board}`), { top: { alice: row }, me: 'alice', ev: '' });
  return b.commit();
};
await t('resumen legítimo', 'allow', () => summary(A, 's_w1', topRow()));
await t('resumen con lv de texto (XSS)', 'deny', () => summary(A, 's_w2', topRow({ lv: '<img src=x onerror=alert(1)>' })));
await t('resumen con kills de texto (XSS)', 'deny', () => summary(A, 's_w3', topRow({ kills: '<img src=x onerror=alert(1)>' })));
await t('resumen con lv distinto al validado', 'deny', () => summary(A, 's_w4', topRow({ lv: 9 })));
await t('resumen con campo extra', 'deny', () => summary(A, 's_w5', topRow({ x: 'y' })));

// ---- baneo ----
await t('bob no puede crear bans/bob', 'deny', () => setDoc(doc(B, 'bans/bob'), { at: serverTimestamp() }));
await t('admin banea a alice', 'allow', () => setDoc(doc(AD, 'bans/alice'), { at: serverTimestamp() }));
await t('alice baneada no sube marca', 'deny', () => setDoc(doc(A, 'lb/s_d9/e/alice'), entry()));
await t('alice no puede leer bans', 'deny', () => getDoc(doc(A, 'bans/alice')));
await t('alice borra su partida y la recrea sin ban: sigue baneada', 'deny', async () => {
  await deleteDoc(doc(A, 'saves/alice'));
  await setDoc(doc(A, 'saves/alice'), { save: { coins: 0 }, v: 1, updatedAt: serverTimestamp() });
  return setDoc(doc(A, 'lb/s_d10/e/alice'), entry());
});
await t('alice no puede borrar su baneo', 'deny', () => deleteDoc(doc(A, 'bans/alice')));
await t('admin desbanea', 'allow', () => deleteDoc(doc(AD, 'bans/alice')));
await t('alice puede subir marca tras desbanear', 'allow', () => setDoc(doc(A, 'lb/s_d11/e/alice'), entry()));

// ---- perfil ----
const prof = (o = {}) => Object.assign({ name: 'Alice', lower: 'alice', at: serverTimestamp(), favs: [{ dex: 25, shiny: false }], title: 'Hola', best: { solo: 300, group: 0, level: 20, bosses: 3, legends: 1, kills: 500, medals: 4 }, medals: ['a1', 'b2'] }, o);
await t('perfil legítimo', 'allow', () => setDoc(doc(A, 'profiles/alice'), prof()));
await t('perfil con apodo con Ñ y tildes en mayúscula (Ñandú_Ángel)', 'allow', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'names/ñandú_ángel'), { uid: 'alice' }));
  const r = await setDoc(doc(A, 'profiles/alice'), prof({ name: 'Ñandú_Ángel', lower: 'ñandú_ángel' }));
  // (se deja el perfil como estaba para las pruebas siguientes)
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'profiles/alice'), { name: 'Alice', lower: 'alice', at: Timestamp.now() }));
  return r;
});
await t('perfil con level de texto (XSS)', 'deny', () => setDoc(doc(A, 'profiles/alice'), prof({ best: { level: '<img src=x onerror=alert(1)>' } })));
await t('perfil con clave extra en best', 'deny', () => setDoc(doc(A, 'profiles/alice'), prof({ best: { solo: 1, hack: 1 } })));
await t('perfil con nombre HTML', 'deny', () => setDoc(doc(A, 'profiles/alice'), prof({ name: '<b>x</b>', lower: '<b>x</b>' })));
await t('perfil con favs de texto', 'deny', () => setDoc(doc(A, 'profiles/alice'), prof({ favs: [{ dex: '<i>', shiny: false }] })));
await t('perfil con medalla gigante', 'deny', () => setDoc(doc(A, 'profiles/alice'), prof({ medals: ['x'.repeat(100)] })));
await t('perfil con best.kills absurdo', 'deny', () => setDoc(doc(A, 'profiles/alice'), prof({ best: { kills: 1e30 } })));

// ---- apodos ----
await t('reservar apodo normal', 'allow', () => setDoc(doc(A, 'names/alice2'), { uid: 'alice' }));
await t('reservar apodo con HTML', 'deny', () => setDoc(doc(A, 'names/<img src=x>'), { uid: 'alice' }));
await t('apodo con ñ y tilde', 'allow', () => setDoc(doc(A, 'names/ñandú'), { uid: 'alice' }));

// ---- amigos ----
const fr = (o = {}) => Object.assign({ users: ['alice', 'bob'], from: 'alice', to: 'bob', status: 'pending', names: { alice: 'Alice', bob: 'Bob' }, at: serverTimestamp() }, o);
await t('amistad con apodos falsos', 'deny', () => setDoc(doc(A, 'friendships/alice_bob'), fr({ names: { alice: 'Admin_Oficial', bob: 'Bob' } })));
await t('amistad con apodo HTML', 'deny', () => setDoc(doc(A, 'friendships/alice_bob'), fr({ names: { alice: 'Alice', bob: '<b>x' } })));
await t('amistad legítima', 'allow', () => setDoc(doc(A, 'friendships/alice_bob'), fr()));
await t('aceptar con apodo falso', 'deny', () => updateDoc(doc(B, 'friendships/alice_bob'), { status: 'ok', at: serverTimestamp(), 'names.bob': 'Falso' }));
await t('aceptar cambiando el apodo del otro', 'deny', () => updateDoc(doc(B, 'friendships/alice_bob'), { status: 'ok', at: serverTimestamp(), 'names.alice': 'Falso' }));
await t('aceptar legítimo', 'allow', () => updateDoc(doc(B, 'friendships/alice_bob'), { status: 'ok', at: serverTimestamp(), 'names.bob': 'Bob' }));

// ---- presencia ----
await t('presencia con id de sala largo', 'deny', () => setDoc(doc(A, 'pres/alice'), { at: serverTimestamp(), room: '-Nabcdefghijklmnopqrs', play: false, on: true }));
await t("presencia con room '1'", 'allow', () => setDoc(doc(A, 'pres/alice'), { at: serverTimestamp(), room: '1', play: false, on: true }));
await t("presencia con room ''", 'allow', () => setDoc(doc(A, 'pres/alice'), { at: serverTimestamp(), room: '', play: false, on: true }));

// ---- partida ----
await t('guardado normal', 'allow', () => setDoc(doc(A, 'saves/alice'), { save: { coins: 1234, tickets: { t1: 2, t10: 0 } }, v: 1, updatedAt: serverTimestamp() }));
await t('monedas absurdas', 'deny', () => setDoc(doc(A, 'saves/alice'), { save: { coins: 1e300 }, v: 1, updatedAt: serverTimestamp() }));

// ---- reportes ----
await t('reporte con nombres HTML', 'deny', () => setDoc(doc(B, 'reports/s_d1__alice__bob'), { board: 's_d1', e: 'alice', names: ['<img>'], t: 100, by: 'bob', at: serverTimestamp() }));
await t('reporte legítimo', 'allow', () => setDoc(doc(B, 'reports/s_d1__alice__bob'), { board: 's_d1', e: 'alice', names: ['Alice'], t: 100, by: 'bob', at: serverTimestamp() }));

// ================= RTDB =================
const rtA = env.authenticatedContext('alice').database();
const rtB = env.authenticatedContext('bob').database();
const rtC = env.authenticatedContext('carol').database();
const TS = { '.sv': 'timestamp' };
await t('crear sala', 'allow', () => set(ref(rtA, 'rooms/r1'), { host: 'alice', open: true, at: TS, m: { alice: { name: 'Alice', dex: 25, shiny: false, at: TS } } }));
await t('unirse a la sala', 'allow', () => set(ref(rtB, 'rooms/r1/m/bob'), { name: 'Bob', dex: 4, shiny: false, at: TS }));
await t('unirse con nombre largo', 'deny', () => set(ref(rtC, 'rooms/r1/m/carol'), { name: 'x'.repeat(40), dex: 4, shiny: false, at: TS }));
await t('unirse con los campos de presencia de los PR #17/#19 (protocol, online)', 'allow', () => set(ref(rtB, 'rooms/r1/m/bob'), { name: 'Bob', dex: 4, shiny: false, at: TS, protocol: 2, online: true }));
await t('unirse con campo extra', 'deny', () => set(ref(rtC, 'rooms/r1/m/carol'), { name: 'Carol', dex: 4, shiny: false, at: TS, admin: true }));
await t('unirse con dex de texto', 'deny', () => set(ref(rtC, 'rooms/r1/m/carol'), { name: 'Carol', dex: '<b>', shiny: false, at: TS }));
await t('actualizar mi dex', 'allow', () => update(ref(rtB, 'rooms/r1/m/bob'), { dex: 7, shiny: true }));
await t('mensaje nuevo con remitente propio', 'allow', () => set(push(ref(rtB, 'rooms/r1/q/alice')), { f: 'bob', p: JSON.stringify({ sig: { c: {} } }) }));
await t('mensaje nuevo SUPLANTANDO al anfitrión', 'deny', () => set(push(ref(rtB, 'rooms/r1/q/alice')), { f: 'alice', p: JSON.stringify({ sig: { sdp: { type: 'offer' } } }) }));
await t('mensaje nuevo con campo extra', 'deny', () => set(push(ref(rtB, 'rooms/r1/q/alice')), { f: 'bob', p: '{}', x: 1 }));
await t('mensaje nuevo gigante', 'deny', () => set(push(ref(rtB, 'rooms/r1/q/alice')), { f: 'bob', p: 'x'.repeat(200001) }));
await t('mensaje viejo (texto): sólo durante la transición', dir === 'strict' ? 'deny' : 'allow', () => set(push(ref(rtB, 'rooms/r1/q/alice')), JSON.stringify({ f: 'bob', d: { k: 'f' } })));
await t('mensaje viejo (texto) suplantando: SOLO se cierra con la regla estricta', dir === 'strict' ? 'deny' : 'allow', () => set(push(ref(rtB, 'rooms/r1/q/alice')), JSON.stringify({ f: 'alice', sig: { sdp: { type: 'offer' } } })));
await t('un extraño no escribe en la cola', 'deny', () => set(push(ref(rtC, 'rooms/r1/q/alice')), { f: 'carol', p: '{}' }));

await env.cleanup();
const bad = res.filter(r => !r.ok);
console.log(`\nreglas (${dir === 'strict' ? 'estrictas' : 'de transición'}): ${res.length - bad.length}/${res.length} como se esperaba`);
process.exit(bad.length ? 1 : 0);
