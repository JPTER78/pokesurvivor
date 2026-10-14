'use strict';
// ONLY Firestore emulator. No production credentials or live Firebase project.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, deleteDoc, Timestamp, serverTimestamp } = require('firebase/firestore');

const PROJECT = 'demo-tiliko-migration';
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT)
  throw Error('Refused non-demo Google Cloud project');
if (!process.env.FIRESTORE_EMULATOR_HOST)
  throw Error('Firestore emulator required. No production tests allowed.');
const UID = 'migrating_test_uid';
let env;

const deep = x => JSON.parse(JSON.stringify(x));
const original = () => ({
  v:3, name:'UsuarioTiliko', created:Date.now(), updated:Date.now(),
  coins:500, owned:{1:{at:Date.now(),from:'starter'}}, shiny:{}, partner:1,
  partnerShiny:false, pupg:{}, upgrades:{}, stats:{runs:0,missionsDone:0},
  tickets:{t1:0,t10:0}, ach:{}, pity:{}, challenges:{}
});
const migrated = base => ({
  ...deep(base), coins:1000000,
  owned:{...base.owned,25:{at:Date.now(),from:'gacha'},6:{at:Date.now(),from:'gacha'}},
  pupg:{25:{hp:3}},migrationImported:true, updated:Date.now()
});
function db(uid=UID) { return env.authenticatedContext(uid).firestore(); }
async function seed({grant=false, expiresAt=Date.now()+3600000, existing=null}={}) {
  const save=existing||original();
  await env.withSecurityRulesDisabled(async context=>{
    const admin=context.firestore();
    await setDoc(doc(admin,'saves',UID),{save, v:3, updatedAt:Timestamp.now()});
    if(grant) await setDoc(doc(admin,'migrationGrants',UID),{
      approved:true, expiresAt:Timestamp.fromMillis(expiresAt)
    });
  });
  return save;
}
const put = (save,uid=UID) => setDoc(doc(db(uid),'saves',uid),{v:3,save,updatedAt:serverTimestamp()});

before(async () => {
  env=await initializeTestEnvironment({
    projectId:PROJECT,
    firestore:{
      rules:fs.readFileSync(path.join(__dirname,'../../firestore.rules'),'utf8'),
      host:'127.0.0.1',port:8080
    }
  });
});
after(async()=>{if(env)await env.cleanup();});

test('El titular lee su partida pero otra cuenta no',async()=>{
  await env.clearFirestore();
  await seed();
  await assertSucceeds(getDoc(doc(db(),'saves',UID)));
  await assertFails(getDoc(doc(db('otro_uid'),'saves',UID)));
});

test('Sin grant, no se permite un salto imposible de progreso',async()=>{
  await env.clearFirestore();
  const old=await seed();
  await assertFails(put(migrated(old)));
  const snap=await getDoc(doc(db(),'saves',UID));
  assert.equal(snap.data().save.coins,500);
});

test('El titular no puede crear un permiso; ni leer el de otra persona',async()=>{
  await env.clearFirestore();
  await seed({grant:true});
  await assertFails(setDoc(doc(db(),'migrationGrants',UID),{
    approved:true,expiresAt:Timestamp.fromMillis(Date.now()+3600000)
  }));
  await assertFails(getDoc(doc(db('otro_uid'),'migrationGrants',UID)));
  await assertSucceeds(getDoc(doc(db(),'migrationGrants',UID)));
});

test('Grant firmado por administrador y vigente permite migrar exactamente una vez',async()=>{
  await env.clearFirestore();
  const old=await seed({grant:true});
  await assertSucceeds(put(migrated(old)));
  const afterMigration=(await getDoc(doc(db(),'saves',UID))).data().save;
  assert.equal(afterMigration.coins,1000000);
  assert.equal(afterMigration.migrationImported,true);
  assert.equal(afterMigration.created,old.created);
  assert.equal(afterMigration.name,old.name);
  // El mismo grant NO permite otra importación masiva.
  await assertFails(put({...afterMigration,coins:20000000}));
  assert.equal((await getDoc(doc(db(),'saves',UID))).data().save.coins,1000000);
});

test('La marca de migración no se puede borrar en un guardado normal',async()=>{
  await env.clearFirestore();
  const old=await seed({grant:true});
  await assertSucceeds(put(migrated(old)));
  const saved=(await getDoc(doc(db(),'saves',UID))).data().save;
  const without={...saved, migrationImported:false};
  await assertFails(put(without));
  assert.equal((await getDoc(doc(db(),'saves',UID))).data().save.migrationImported,true);
});

test('Una partida ya migrada puede seguir guardando progreso normal',async()=>{
  await env.clearFirestore();
  const old=await seed({grant:true});
  await assertSucceeds(put(migrated(old)));
  const saved=(await getDoc(doc(db(),'saves',UID))).data().save;
  await assertSucceeds(put({...saved, updated:Date.now()+1}));
});

test('Un grant caducado no autoriza importaciones',async()=>{
  await env.clearFirestore();
  const old=await seed({grant:true,expiresAt:Date.now()-60000});
  await assertFails(put(migrated(old)));
});

test('Un grant NO permite borrar la marca sus existente',async()=>{
  await env.clearFirestore();
  const old=await seed({grant:true});
  await env.withSecurityRulesDisabled(async context=>{
    const admin=context.firestore();
    await setDoc(doc(admin,'saves',UID),{save:old,v:3,updatedAt:Timestamp.now(),sus:true});
  });
  await assertFails(put(migrated(old)));
});

test('No se permite crear una partida nueva con la marca de importación utilizada',async()=>{
  await env.clearFirestore();
  const save={...original(),migrationImported:true};
  await assertFails(put(save,'new_uid'));
});

test('El grant vigente impide borrar/recrear el guardado para importar dos veces',async()=>{
  await env.clearFirestore();
  const old=await seed({grant:true});
  await assertSucceeds(put(migrated(old)));
  await assertSucceeds(deleteDoc(doc(db(),'saves',UID)));
  const fresh=original();
  await assertFails(put(fresh));
});
