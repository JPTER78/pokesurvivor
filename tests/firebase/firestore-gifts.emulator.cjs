'use strict';
// Reglas de regalos probadas contra Firestore EMULATOR, nunca producción.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,Timestamp,serverTimestamp}=require('firebase/firestore');
const PROJECT='demo-tiliko-migration';
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Sólo se permite ejecutar con FIRESTORE_EMULATOR_HOST');
if(process.env.GCLOUD_PROJECT&&process.env.GCLOUD_PROJECT!==PROJECT)throw Error('Se requiere proyecto demo');
let env;
const fresh=()=>({v:3,name:'Entrenador',created:Date.now(),updated:Date.now(),coins:500,
 owned:{1:{at:Date.now(),from:'starter'}},shiny:{},partner:1,partnerShiny:false,
 pupg:{},upgrades:{},stats:{runs:0,missionsDone:0},tickets:{t1:0,t10:0},
 ach:{},pity:{},challenges:{},gifts:{}});
const db=uid=>env.authenticatedContext(uid).firestore();
const savePath=uid=>doc(db(uid),'saves',uid);
async function seed(uid, save=fresh(), suspect=false){
 await env.withSecurityRulesDisabled(async ctx=>{
   const data={save,v:3,updatedAt:Timestamp.now()};
   if(suspect)data.sus=true;
   await setDoc(doc(ctx.firestore(),'saves',uid),data);
 });
 return save;
}
const put=(uid,save,sus=false)=>{const value={save,v:3,updatedAt:serverTimestamp()};
 if(sus)value.sus=true;return setDoc(savePath(uid),value);
};
function gift(old,code='MAO25'){
 return {...old,updated:Date.now(),owned:{...old.owned,'10001':{at:Date.now(),from:'gift'}},
 gifts:{...(old.gifts||{}),maomao:code}};
}
before(async()=>{
 env=await initializeTestEnvironment({projectId:PROJECT,
 firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync(path.join(__dirname,'../../firestore.rules'),'utf8')}});
});
after(async()=>{if(env)await env.cleanup();});

test('Una cuenta nueva NO puede empezar con regalo falso, ni siquiera marcada',async()=>{
 await env.clearFirestore();
 const a=fresh();a.owned['10001']={at:Date.now(),from:'gift'};a.gifts={maomao:'MAO25'};
 await assertFails(put('nuevo',a));
 await assertFails(put('nuevo',a,true));
});
test('Una cuenta nueva NO puede crear el shiny custom',async()=>{
 await env.clearFirestore();const a=fresh();a.shiny['10001']={at:Date.now(),from:'wild'};
 await assertFails(put('nuevo',a));
});
test('MAO25 correcto entrega un único regalo sin cambiar el resto del guardado',async()=>{
 await env.clearFirestore();const old=await seed('titular');
 await assertSucceeds(put('titular',gift(old)));
 const got=(await getDoc(savePath('titular'))).data().save;
 assert.equal(got.coins,500);assert.equal(got.partner,1);
 assert.equal(got.gifts.maomao,'MAO25');assert.equal(got.owned['10001'].from,'gift');
});
test('El mismo código MAO25 se puede usar desde DOS cuentas distintas',async()=>{
 await env.clearFirestore();
 for(const uid of ['a','b']){const original=await seed(uid);await assertSucceeds(put(uid,gift(original)));}
 for(const uid of ['a','b'])assert.equal((await getDoc(savePath(uid))).data().save.owned['10001'].from,'gift');
});
test('Código falso, timestamp inventado y premio extra se rechazan',async()=>{
 await env.clearFirestore();const old=await seed('titular');
 await assertFails(put('titular',gift(old,'MAO26')));
 const future=gift(old);future.owned['10001'].at+=60000000;
 await assertFails(put('titular',future));
 const extra=gift(old);extra.coins+=500000;
 await assertFails(put('titular',extra));
 const extraMon=gift(old);extraMon.owned['25']={at:Date.now(),from:'gift'};
 await assertFails(put('titular',extraMon));
});
test('Tras canjear no permite editar, quitar o repetir la marca de regalo',async()=>{
 await env.clearFirestore();const old=await seed('titular');
 await assertSucceeds(put('titular',gift(old)));
 const now=(await getDoc(savePath('titular'))).data().save;
 await assertFails(put('titular',{...now,gifts:{}}));
 await assertFails(put('titular',{...now,owned:{1:old.owned[1]}}));
 await assertFails(put('titular',{...now,gifts:{maomao:'OTRO1'}}));
 await assertFails(put('titular',{...now,owned:{...now.owned,'10001':{at:Date.now()+10,from:'gift'}}}));
});
test('Canje confirmado permite seguir guardando normalmente',async()=>{
 await env.clearFirestore();const old=await seed('titular');
 await assertSucceeds(put('titular',gift(old)));
 const now=(await getDoc(savePath('titular'))).data().save;
 await assertSucceeds(put('titular',{...now,updated:Date.now()+1}));
});
test('Ni siquiera sus=true autoriza inyectar un premio sin el código',async()=>{
 await env.clearFirestore();const old=await seed('titular',fresh(),true);
 const sneaky={...old,owned:{...old.owned,'10001':{at:Date.now(),from:'gacha'}}};
 await assertFails(put('titular',sneaky,true));
 await assertSucceeds(put('titular',gift(old),true));
});
