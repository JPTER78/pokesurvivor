const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../js/core/db.js'), 'utf8').replace(/\r\n/g, '\n');
const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
const injection = [
  '  function __testSetup(v) {',
  '    mode = "cloud"; uid = key = v.uid; user = v.save.name; guest = false;',
  '    save = v.save; fs = v.firestore;',
  '  }',
  '  return { __testSetup,'
].join('\n');
function create(granted=true, migrated=false, sus=false) {
  const local = new Map();
  const target = { v: 3, name: 'EntrenadorTiliko', created: 100, updated: 200,
    coins: 500, owned: { 1: { at: 1 } }, shiny: {}, partner: 1,
    pupg: {1: { hp: 1}}, upgrades: {}, stats: {runs: 1}, tickets: {t1:0,t10:0},
    ach: {}, pity: {}, challenges: {} };
  const remote = JSON.parse(JSON.stringify(target));
  if (migrated) remote.migrationImported=true;
  const doc = {save:remote, sus};
  let txs = 0;
  const firebase = { firestore: { FieldValue: { serverTimestamp: () => 'server-clock' } } };
  const store = {
    collection(name) {
      if (name === 'migrationGrants') return { doc: uid => {
        assert.equal(uid, 'u1');
        return { get: async () => ({ exists: granted,
          data: () => ({ approved: true, expiresAt: { toMillis: () => Date.now()+3600000 } }) }) };
      } };
      if (name === 'saves') return { doc: uid => {
        assert.equal(uid, 'u1');
        return { collection: 'save', uid };
      } };
      throw Error('colección inesperada ' + name);
    },
    async runTransaction(cb) {
      txs++;
      let staged;
      const snap = { exists: true, data: () => JSON.parse(JSON.stringify(doc)) };
      const tx = { get: async ref => {assert.equal(ref.uid, 'u1');return snap;},
        set(ref, value) { assert.equal(ref.uid,'u1'); staged=value; } };
      await cb(tx);
      assert.ok(staged, 'la transacción debe escribir un guardado');
      Object.assign(doc, JSON.parse(JSON.stringify(staged)));
      return true;
    }
  };
  const G = {
    DEX_BY: { 1: {name:'Bulbasaur'}, 25: {name:'Pikachu'} },
    Upgrades: { BY: { hp: { max: 5 } } },
    Challenges: { mergeProgress(a,b) { return { ...a, ...b }; } }
  };
  const globals = { G, firebase, navigator: { onLine: true }, Date, setTimeout, clearTimeout,
    localStorage: { getItem: k => local.get(k) || null, setItem(k,v){local.set(k,v);} },
    window: {}, console, JSON };
  const patched = code.replace('  return {\n    ready, register,', injection + '\n    ready, register,');
  assert.notEqual(patched, code, 'Debe inyectarse el entorno privado para el test');
  vm.runInNewContext(patched, globals);
  G.DB.__testSetup({uid:'u1',save:target,firestore:store});
  return {G,doc,target,local, get txs(){ return txs; }};
}
function incoming() {
  return {v:3,name:'NombreOriginal',created:1,updated: Date.now()-1000,
    coins:800, owned:{25:{at:99}},shiny:{},partner:25,
    pupg:{25:{hp:2}},upgrades:{},stats:{runs:6},
    tickets:{t1:3,t10:1},ach:{},pity:{}};
}
test('Sin permiso de administrador no hay importación ni escritura', async () => {
  const f=create(false);
  await assert.rejects(f.G.DB.importExternalSave(incoming()), /autorización/);
  assert.equal(f.txs,0);assert.equal(f.doc.save.coins,500);assert.equal(f.target.coins,500);
});
test('Permiso válido: importa una sola vez, fusiona y conserva identidad', async () => {
  const f=create();
  await f.G.DB.importExternalSave(incoming());
  assert.equal(f.txs,1);
  assert.equal(f.doc.save.migrationImported,true);
  assert.equal(f.doc.save.name,'EntrenadorTiliko');
  assert.equal(f.doc.save.created,100);
  assert.equal(f.doc.save.coins,800);
  assert.ok(f.doc.save.owned[1]);
  assert.ok(f.doc.save.owned[25]);
  assert.equal(f.doc.save.pupg[25].hp,2);
  assert.equal(f.G.DB.save.migrationImported,true);
  assert.equal(f.G.DB.syncState,'ok');
  await assert.rejects(f.G.DB.importExternalSave(incoming()),/ya utilizó/);
  assert.equal(f.txs,1);
});
test('Partida ya migrada no admite segunda migración, incluso con permiso', async () => {
  const f=create(true,true);
  await assert.rejects(f.G.DB.importExternalSave(incoming()),/ya utilizó|ya se utilizó/);
  assert.equal(f.doc.save.coins,500);assert.equal(f.txs,1);
});
test('Marca sospechosa existente nunca se borra', async () => {
  const f=create(true,false,true);
  await f.G.DB.importExternalSave(incoming());
  assert.equal(f.doc.sus,true);
});
test('Las reglas exigen grant administrativo y mantienen protección del ranking', () => {
  assert.match(rules,/match \/migrationGrants\/\{uid\}/);
  assert.match(rules,/allow get: if signedIn\(\) && me\(\) == uid;/);
  assert.match(rules,/allow list, create, update, delete: if false;/);
  assert.match(rules,/authorizedMigration\(uid\)/);
  assert.match(rules,/migrationImported.*== false/);
  assert.match(rules,/migrationImported.*== true/);
  assert.match(rules,/freshSave\(request\.resource\.data\.save\)/);
  assert.match(rules,/possibleSave\(resource\.data\.save,/);
  assert.match(rules,/get\('sus', false\) == false/);
});
