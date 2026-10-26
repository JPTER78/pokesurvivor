// Reglas de Firestore (firestore.rules) contra el emulador, perfil público y apodos:
//   npx firebase-tools emulators:exec --only firestore --project demo-ps "node tests/firestore-rules.emu.cjs"
// Desde el 25-10-2026 el apodo (names) sólo se comprueba si cambia: un guardado del
// perfil con el mismo apodo no lo lee (1 lectura menos), pero no se puede poner uno ajeno.
const assert = require('node:assert/strict');
const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const P = 'demo-ps', DOCS = `projects/${P}/databases/(default)/documents`;
const A = 'userAAAAAAAAAAAAAAAAAAAAAAA1', B = 'userBBBBBBBBBBBBBBBBBBBBBBB2', C = 'userCCCCCCCCCCCCCCCCCCCCCCC3';

// Token sin firmar: el emulador lo acepta (sólo pruebas).
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = uid => { const t = Math.floor(Date.now() / 1000);
  return b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ iss: 'https://securetoken.google.com/' + P, aud: P, sub: uid, user_id: uid,
    iat: t, exp: t + 3600, auth_time: t, firebase: { sign_in_provider: 'password' } }) + '.'; };
const str = v => ({ stringValue: v });
async function commit(who, writes) {
  const r = await fetch(`http://${HOST}/v1/${DOCS}:commit`, { method: 'POST',
    headers: { Authorization: 'Bearer ' + (who ? token(who) : 'owner'), 'content-type': 'application/json' }, body: JSON.stringify({ writes }) });
  return r.status;
}
const name = (lower, uid) => ({ update: { name: `${DOCS}/names/${lower}`, fields: { uid: str(uid) } } });
const prof = (uid, nm, extra = {}) => ({ update: { name: `${DOCS}/profiles/${uid}`, fields: Object.assign({ name: str(nm), lower: str(nm.toLowerCase()) }, extra) },
  updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] });
const old = (uid, nm) => ({ update: { name: `${DOCS}/profiles/${uid}`, fields: { name: str(nm), lower: str(nm.toLowerCase()), at: { timestampValue: '2026-01-01T00:00:00Z' } } } });
const del = path => ({ delete: `${DOCS}/${path}` });
const ok = async (who, w, what) => assert.equal(await commit(who, w), 200, 'debería poder: ' + what);
const no = async (who, w, what) => assert.notEqual(await commit(who, w), 200, 'NO debería poder: ' + what);

(async () => {
  await fetch(`http://${HOST}/emulator/v1/projects/${P}/databases/(default)/documents`, { method: 'DELETE' });
  // (Con permisos de administrador: sin reglas.)
  await ok(null, [name('ash', A), old(A, 'Ash'), name('misty', B), old(B, 'Misty')], 'preparar');
  await ok(A, [prof(A, 'Ash', { title: str('Campeón') })], 'guardar su perfil con el mismo apodo');
  // Sin el documento del apodo: si la regla aún lo leyera, esto fallaría.
  await ok(null, [del('names/ash'), old(A, 'Ash')], 'preparar (sin names/ash)');
  await ok(A, [prof(A, 'Ash', { title: str('Otro') })], 'mismo apodo, sin leer names');
  await ok(null, [old(A, 'Ash')], 'preparar');
  await no(A, [prof(A, 'Misty')], 'ponerse un apodo de otro');
  await no(A, [prof(A, 'Brock')], 'ponerse un apodo que no ha reservado');
  await ok(A, [name('brock', A), prof(A, 'Brock')], 'reservar un apodo nuevo y ponérselo');
  await no(C, [prof(C, 'Gary')], 'crear un perfil sin reservar el apodo');
  await ok(C, [name('gary', C), prof(C, 'Gary')], 'crear un perfil con su apodo');
  await no(C, [prof(C, 'Gary', { title: str('x') })], 'dos guardados en menos de 20 s');
  await no(B, [prof(A, 'Brock')], 'escribir el perfil de otro');
  // ---- ranking: el baneo sólo se mira al entrar en un top 50 (25-10-2026) ----
  const int = n => ({ integerValue: String(n) }), arr = vs => ({ arrayValue: { values: vs } }), map = f => ({ mapValue: { fields: f } });
  const entry = (b, uid, t) => ({ update: { name: `${DOCS}/lb/${b}/e/${uid}`, fields: { t: int(t), uids: arr([str(uid)]), names: arr([str('x')]),
    dex: arr([int(25)]), shiny: arr([{ booleanValue: false }]), lv: int(50), kills: int(1000), dmg: int(0) } },
    updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] });
  const top = (b, uid, t) => ({ update: { name: `${DOCS}/lbs/${b}`, fields: { me: str(uid), ev: str(''),
    top: map({ [uid]: map({ t: int(t), uids: arr([str(uid)]), names: arr([str('x')]), dex: arr([int(25)]), lv: int(50), kills: int(1000) }) }) } } });
  const save = (uid, ban) => ({ update: { name: `${DOCS}/saves/${uid}`, fields: { ban: { booleanValue: ban }, v: int(3), save: map({}) } } });
  await ok(null, [save(A, true), save(B, false)], 'preparar (A baneado)');
  await ok(A, [entry('s_all4', A, 900)], 'baneado: su marca fuera del top (sólo cuenta para los puestos)');
  await no(A, [entry('s_all4', A, 1000), top('s_all4', A, 1000)], 'baneado: entrar en el top 50');
  await ok(B, [entry('s_all4', B, 1000), top('s_all4', B, 1000)], 'no baneado: entrar en el top 50');
  await ok(C, [entry('s_d20261025a', C, 800)], 'sin partida en la nube: su marca');
  console.log('reglas de Firestore (perfil, apodos y ranking): todo bien');
})().catch(e => { console.error(e.message); process.exit(1); });
