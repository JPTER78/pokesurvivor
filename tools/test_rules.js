/* Pruebas de las reglas del ranking (firestore.rules) con el emulador de Firestore.
 *
 *   npm i firebase-tools @firebase/rules-unit-testing firebase     (sólo para esto)
 *   node tools/export_data.js                                      (si no existe tools/cache/gamedata.json)
 *   npx firebase emulators:exec --only firestore --project demo-ps "node tools/test_rules.js"
 *
 * (con un firebase.json que apunte a firestore.rules; el del repo vale)
 * Comprueba que una marca honesta con su resumen y su grabación entra, y que
 * cada trampa (vida máxima que no cuadra, mejora por encima de su tope, daño
 * imposible, sin grabación, de otro modo de juego...) se rechaza.
 */
const fs = require('fs'), path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');

const ROOT = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'cache', 'gamedata.json'), 'utf8'));
const MON = data.dex.find(m => m.dex === 1);                       // Bulbasaur: vida 90, ataque 1,06
const STRICT = new Date(2026, 9, 20) <= new Date();                 // desde esta fecha el resumen es obligatorio (firestore.rules)

let ok = 0, bad = 0;
const check = async (name, promise, expectOk) => {
  let pass;
  try { await (expectOk ? assertSucceeds(promise) : assertFails(promise)); pass = true; } catch (e) { pass = false; console.log('   ', e.message.split('\n')[0]); }
  console.log(pass ? '  ok  ' : ' FALLA', name);
  pass ? ok++ : bad++;
};

(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-ps', firestore: { rules: fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 } });
  const uid = 'u1';
  const stamp = ms => new Date(Date.now() - ms);
  const firebase = require('firebase/compat/app').default;
  require('firebase/compat/firestore');
  const SERVER_TS = () => firebase.firestore.FieldValue.serverTimestamp();

  async function fresh(mode = 's', ago = 2000) {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async c => {
      await c.firestore().doc('runs/' + uid).set({ startedAt: stamp(ago * 1000), mode });
      await c.firestore().doc('saves/' + uid).set({ save: {}, updatedAt: stamp(1000), v: 1 });
    });
    return env.authenticatedContext(uid).firestore();
  }
  const sm = (over = {}) => Object.assign({
    px: 1, up: { atk: 2, hp: 1 }, cs: { atk: 3, hp: 2 }, dd: 200000, pk: 300, dt: 500,
    mh: MON.hp + 8 * 1 + 20 * 2, rid: 'rid1' }, over);
  const entry = (over = {}, smOver = {}, noSm = false) => {
    const e = { t: 1800, uids: [uid], names: ['Ash'], dex: [1], shiny: [false], lv: 60, kills: 9000, at: SERVER_TS() };
    if (!noSm) e.sm = sm(smOver);
    return Object.assign(e, over);
  };
  const replay = (over = {}) => Object.assign({ rid: 'rid1', v: 'dev', t: 1800, mode: 's', h: '{}', log: 'AAAA', n: 1, trunc: false, at: SERVER_TS() }, over);
  const put = async (db, e, board = 's_all2', r = replay(), id = uid) => {
    if (r) await assertSucceeds(db.doc('replays/' + uid).set(r));
    return db.doc(`lb/${board}/e/${id}`).set(e);
  };

  console.log('Marca honesta');
  await check('con resumen y grabación', fresh().then(db => put(db, entry())), true);
  await check('hasta el día obligatorio, sin resumen ni grabación', fresh().then(db => put(db, entry({}, {}, true), 's_all2', null)), !STRICT);

  if (process.env.SAMPLE) {      // SAMPLE=archivo.json: lo que el juego mandó al acabar una partida de verdad (r de Ranking.submitSolo)
    const r = JSON.parse(fs.readFileSync(process.env.SAMPLE, 'utf8'));
    const e = { t: r.t, uids: [uid], names: ['Ash'], dex: [r.dex], shiny: [!!r.shiny], lv: r.lv, kills: r.kills, sm: r.sm, at: SERVER_TS() };
    await check('partida real grabada del juego (' + r.t + ' s, Pokémon ' + r.dex + ')', fresh().then(db => put(db, e, 's_all2', replay({ rid: r.sm.rid, t: r.t, mode: r.rep.hdr.mode, log: r.rep.log, n: r.rep.n, h: JSON.stringify(r.rep.hdr) }))), true);
  }

  // El caso más cargado para el tope de 1.000 expresiones de las reglas: grupo de 4, todas las mejoras y cartas.
  const full = sm({ up: { hp: 10, atk: 10, spd: 8, cd: 8, def: 8, regen: 5, magnet: 6, xp: 8, coins: 8, moves: 1, crit: 10, reroll: 5, ban: 3 },
                    cs: { hp: 20, atk: 20, spd: 8, cd: 10, def: 12, rgn: 3, mag: 6, xp: 8 }, mh: MON.hp + 80 + 400, pk: 100000, dd: 5000000 });
  await check('grupo de 4 con todas las mejoras y cartas', fresh('g').then(db => put(db,
    entry({ t: 1800, lv: 200, uids: [uid, 'u2', 'u3', 'u4'], names: ['a', 'b', 'c', 'd'], dex: [1, 4, 7, 25], shiny: [false, false, false, false] }, full) , 'g_all2', replay({ mode: 'g' }), [uid, 'u2', 'u3', 'u4'].join('_'))), true);

  console.log('Resumen que no cuadra');
  const rej = async (name, e, r) => check(name, fresh().then(db => put(db, e, 's_all2', r)), false);
  await rej('vida máxima distinta de la que da ese Pokémon', entry({}, { mh: MON.hp + 8 + 20 * 2 + 40 }));
  await rej('vida máxima de otro Pokémon', entry({}, { px: 2 }));
  await rej('Pokémon que no es del equipo', entry({}, { px: 4, mh: 88 + 8 + 40 }));
  await rej('mejora por encima de su tope (Fuerza 11)', entry({}, { up: { atk: 11, hp: 1 } }));
  await rej('mejora que no existe', entry({}, { up: { atk: 2, hp: 1, dios: 1 } }));
  await rej('carta de Potencia por encima de su tope (41)', entry({ lv: 100 }, { cs: { atk: 41, hp: 2 } }));
  await rej('más cartas que niveles', entry({ lv: 4 }, { cs: { atk: 3, hp: 2 } }));
  await rej('pico de daño imposible', entry({}, { pk: 5000000 }));
  await rej('daño total mayor que el pico por todos los segundos', entry({ t: 100 }, { pk: 10, dd: 100 * 10 * 100 + 1 }), replay({ t: 100 }));
  await rej('sin que te quiten vida en 30 min', entry({}, { dt: 0 }));
  await rej('dato que no es entero', entry({}, { dd: 1.5 }));
  await rej('campo desconocido en el resumen', entry({}, { godmode: 1 }));

  console.log('Grabación');
  await rej('grabación que no es la de esta partida (rid)', entry({}, { rid: 'otro' }));
  await rej('grabación de otro tiempo', entry(), replay({ t: 1700 }));
  await check('grabación enorme', fresh().then(db => db.doc('replays/' + uid).set(replay({ log: 'A'.repeat(130001) }))), false);
  await check('grabación ajena', fresh().then(db => db.doc('replays/otro').set(replay())), false);
  await check('grabación propia, borrar', fresh().then(async db => { await db.doc('replays/' + uid).set(replay()); await db.doc('replays/' + uid).delete(); }), true);
  await check('leer la de otro', fresh().then(async db => { await env.withSecurityRulesDisabled(c => c.firestore().doc('replays/otro').set(replay())); return db.doc('replays/otro').get(); }), false);

  console.log('Reglas de antes');
  await check('más de 45 min aunque haya pasado el tiempo (sin resumen, hasta el día obligatorio)', fresh('s', 4000).then(db => put(db, entry({ t: 2701, lv: 600, kills: 30000 }, {}, true), 's_all2', null)), false);
  await check('justo 45 min (sin resumen, hasta el día obligatorio)', fresh('s', 4000).then(db => put(db, entry({ t: 2700, lv: 600, kills: 30000 }, {}, true), 's_all2', null)), !STRICT);
  await check('tabla de grupo con una partida en solitario', fresh('s').then(db => put(db, entry({ uids: [uid, 'u2'], names: ['a', 'b'], dex: [1, 4], shiny: [false, false] }, {}), 'g_all2', replay(), uid + '_u2')), false);

  await env.cleanup();
  console.log(`\n${ok} bien, ${bad} mal`);
  process.exit(bad ? 1 : 0);
})();
