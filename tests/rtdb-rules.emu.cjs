// Reglas de la Realtime Database (database.rules.json) contra el emulador:
//   npx firebase-tools emulators:exec --only database --project demo-ps "node tests/rtdb-rules.emu.cjs"
// Lo que hace el juego tiene que pasar; lo del ataque del 23-10-2026 (salas de
// basura, plazas falsas, mensajes enormes o sin tope), no.
const assert = require('node:assert/strict');
const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
const NS = 'demo-ps-default-rtdb';
const TS = { '.sv': 'timestamp' };
const A = 'hostAAAAAAAAAAAAAAAAAAAAAAA1', B = 'guestBBBBBBBBBBBBBBBBBBBBBB2', C = 'guestCCCCCCCCCCCCCCCCCCCCCC3', X = 'attackerXXXXXXXXXXXXXXXXXXX4';

async function req(who, method, path, body) {
  const q = new URLSearchParams({ ns: NS });
  if (who) q.set('auth_variable_override', JSON.stringify({ uid: who }));
  const r = await fetch(`http://${HOST}/${path}.json?${q}`, {
    method, headers: { Authorization: 'Bearer owner' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return r.status;
}
const ok = async (who, m, p, b, what) => assert.equal(await req(who, m, p, b), 200, 'debería poder: ' + what);
const no = async (who, m, p, b, what) => assert.notEqual(await req(who, m, p, b), 200, 'NO debería poder: ' + what);
const member = n => ({ name: n, dex: 25, shiny: false, at: TS });

(async () => {
  await req(null, 'DELETE', '');
  // ---- lo que hace el juego ----
  await ok(A, 'PUT', 'rooms/' + A, { host: A, open: true, at: TS, m: { [A]: member('Ash') } }, 'crear su sala');
  await ok(B, 'PUT', `rin/${A}/${B}`, true, 'invitado: marca rin');
  await ok(B, 'PUT', `rooms/${A}/m/${B}`, member('Misty'), 'invitado: entrar en una sala abierta');
  await ok(C, 'PUT', `rin/${A}/${C}`, true, 'otro invitado: rin');
  await ok(C, 'PUT', `rooms/${A}/m/${C}`, member('Brock'), 'otro invitado: entrar');
  await ok(B, 'GET', `rooms/${A}/m`, undefined, 'invitado: leer la sala');
  await ok(B, 'PATCH', `rooms/${A}/m/${B}`, { dex: 7, shiny: true }, 'invitado: cambiar de Pokémon');
  await ok(B, 'PUT', `rooms/${A}/q/${A}/${B}_00`, JSON.stringify({ f: B, sig: { t: 'offer', sdp: 'x'.repeat(4000) } }), 'invitado → anfitrión');
  await ok(A, 'PUT', `rooms/${A}/q/${B}/${A}_00`, JSON.stringify({ f: A, sig: { c: 'cand' } }), 'anfitrión → invitado');
  await ok(B, 'DELETE', `rooms/${A}/q/${B}/${A}_00`, undefined, 'invitado: borrar lo leído');
  await ok(A, 'PUT', `rooms/${A}/open`, false, 'anfitrión: cerrar la sala al empezar');
  // corte del invitado: el servidor borra su plaza y el anfitrión se la devuelve (keepMates)
  await ok(B, 'DELETE', `rooms/${A}/m/${B}`, undefined, 'onDisconnect del invitado');
  await ok(A, 'PUT', `rooms/${A}/m/${B}`, { name: 'Misty', dex: 7, shiny: true, at: 1 }, 'anfitrión: devolver la plaza');
  // corte del anfitrión: el servidor borra la sala y él la vuelve a escribir con los que había (rejoin)
  await ok(A, 'DELETE', 'rooms/' + A, undefined, 'onDisconnect del anfitrión');
  await ok(A, 'PUT', 'rooms/' + A, { host: A, open: false, at: TS, m: { [A]: member('Ash'), [B]: member('Misty'), [C]: member('Brock') } }, 'rehacer la sala');
  await ok(B, 'PUT', `rooms/${A}/m/${B}`, member('Misty'), 'invitado: volver a poner su plaza (ya existe)');
  // salir
  await ok(C, 'DELETE', `rooms/${A}/m/${C}`, undefined, 'invitado: salir');
  await ok(C, 'DELETE', `rin/${A}/${C}`, undefined, 'invitado: quitar su rin');
  await ok(A, 'DELETE', `rooms/${A}/m/${B}`, undefined, 'anfitrión: echar a alguien (dropMember)');
  await ok(A, 'DELETE', 'rooms/' + A, undefined, 'anfitrión: cerrar su sala');

  // ---- el ataque ----
  await ok(A, 'PUT', 'rooms/' + A, { host: A, open: true, at: TS, m: { [A]: member('Ash') } }, '(sala para probar)');
  await no(X, 'PUT', 'rooms/nuke_' + X + '_1', { host: X, open: true, at: TS, m: { [X]: member('x') } }, 'sala con otro nombre');
  await no(X, 'PUT', 'rooms/' + A, { host: X, open: true, at: TS, m: { [X]: member('x') } }, 'pisar la sala de otro');
  await no(X, 'PUT', 'rooms/' + X, { host: X, open: true, at: TS, m: { [X]: member('x'), FAKE1: member('f') } }, 'sala con plazas falsas');
  await ok(X, 'PUT', 'rooms/' + X, { host: X, open: true, at: TS, m: { [X]: member('x') } }, '(su única sala)');
  await no(X, 'PUT', `rooms/${X}/m/FAKE2`, member('f'), 'añadir una plaza falsa después');
  await no(X, 'PUT', `rooms/${X}/junk`, 'x'.repeat(1000), 'datos que no usa el juego');
  await no(X, 'PUT', `rooms/${X}/m/${X}/junk`, 'x', 'campos de más en su plaza');
  await no(X, 'PUT', `rooms/${X}/m/${X}/name`, 'x'.repeat(100), 'nombre larguísimo');
  await no(X, 'PUT', `rooms/${X}/q/${X}/${X}_00`, 'x'.repeat(200000), 'mensaje de 200.000');
  await no(X, 'PUT', `rooms/${X}/q/${X}/-Nabcdefghij`, 'x', 'mensaje con clave libre (push)');
  await no(X, 'PUT', `rooms/${X}/q/${X}/${X}_100`, 'x', 'hueco 100 o más');
  await no(X, 'PUT', `rooms/${X}/q/${X}/OTRO_00`, 'x', 'hueco a nombre de otro');
  await no(X, 'PUT', `rooms/${X}/q/FAKE3/${X}_00`, 'x', 'mensaje a alguien que no está en la sala');
  await no(X, 'PUT', `rin/nuke_${X}/${X}`, true, 'rin de una sala que no existe');
  await no(X, 'PUT', `rin/${A}/${B}`, true, 'rin a nombre de otro');
  await no(X, 'PUT', 'basura/' + X, 'x', 'fuera de rooms y rin');
  // un invitado no escribe a otro invitado (sólo con el anfitrión)
  await ok(B, 'PUT', `rin/${A}/${B}`, true, '(B en la sala)'); await ok(B, 'PUT', `rooms/${A}/m/${B}`, member('Misty'), '(B en la sala)');
  await ok(C, 'PUT', `rin/${A}/${C}`, true, '(C en la sala)'); await ok(C, 'PUT', `rooms/${A}/m/${C}`, member('Brock'), '(C en la sala)');
  await no(B, 'PUT', `rooms/${A}/q/${C}/${B}_00`, 'x', 'invitado → otro invitado');
  await ok(A, 'PUT', `rooms/${A}/open`, false, '(empieza la partida)');
  await ok(X, 'PUT', `rin/${A}/${X}`, true, '(X pone su rin)');
  await no(X, 'PUT', `rooms/${A}/m/${X}`, member('x'), 'entrar en una sala cerrada');
  console.log('reglas de la Realtime Database: todo bien');
})().catch(e => { console.error(e.message); process.exit(1); });
