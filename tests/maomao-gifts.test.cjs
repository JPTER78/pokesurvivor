const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const dbCode = fs.readFileSync(path.join(root, 'js/core/db.js'), 'utf8').replace(/\r\n/g, '\n');
const giftCode = fs.readFileSync(path.join(root, 'js/data/gift-codes.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
function fixture(mode='cloud', fail=false) {
  const cache = new Map();
  const saved = {v:3, name:'Entrenador', created:100, updated:200, coins:500,
    owned:{1:{at:100,from:'starter'}}, shiny:{}, partner:1, stats:{runs:0},
    tickets:{t1:0,t10:0}, pupg:{}, upgrades:{}, ach:{}, pity:{}, challenges:{}};
  const remote = JSON.parse(JSON.stringify(saved));
  const doc = {save:remote, v:3};
  let writes = 0, transactions = 0;
  const store = {
    collection(name) {
      assert.equal(name, 'saves');
      return { doc(id) { assert.equal(id,'user1');return { id }; } };
    },
    async runTransaction(cb) {
      transactions++;
      let candidate = null;
      const tx = {
        get: async ref => { assert.equal(ref.id,'user1');return {exists:true,data:()=>JSON.parse(JSON.stringify(doc))}; },
        set: (ref, data) => { assert.equal(ref.id,'user1');candidate=data; }
      };
      await cb(tx);
      if (fail) throw Object.assign(new Error('permission-denied'),{code:'permission-denied'});
      if (candidate) {writes++;Object.assign(doc,JSON.parse(JSON.stringify(candidate)));}
    }
  };
  const G = {
    DEX_BY:{1:{name:'Bulbasaur'},10001:{name:'Maomao'}},
    Challenges:{mergeProgress(a,b){return {...a,...b};}},
    Game:{state:'ui'},
    Upgrades:{BY:{}}
  };
  const firebase={firestore:{FieldValue:{serverTimestamp:()=> 'SERVER_TS'}}};
  const ctx = {G, Date, JSON, URLSearchParams, navigator:{onLine:true},
    setTimeout, clearTimeout, console, firebase, localStorage:{
      getItem:k=>cache.get(k)||null,
      setItem:(k,v)=>{cache.set(k,v);return true;},
      removeItem:k=>cache.delete(k)
    }};
  vm.runInNewContext(giftCode,ctx);
  const injection = `  function __testSetup(v) {
    mode = v.mode; uid = v.mode === 'cloud' ? 'user1' : null;
    key = 'user1'; user='Entrenador'; guest=false; save=v.save; fs=v.firestore;
  }
  return { __testSetup,`;
  const injected=dbCode.replace('  return {\n    ready, register,',injection+'\n    ready, register,');
  assert.notEqual(injected,dbCode);
  vm.runInNewContext(injected,ctx);
  G.DB.__testSetup({mode,save:saved,firestore:store});
  return {G,doc,saved,cache,get writes(){return writes;},get transactions(){return transactions;}};
}

test('Código MAO25 de 5 caracteres, sin distinguir minúsculas',()=>{
 const f=fixture('local');
 assert.equal(f.G.GiftCodes.normalize(' mao25 '),'MAO25');
 assert.equal(f.G.GiftCodes.isMaomao('MAO25'),true);
 assert.equal(f.G.GiftCodes.isMaomao('MAO2'),false);
 assert.equal(f.G.GiftCodes.isMaomao('MAO26'),false);
});
test('Cuenta local: recibe a Mao Mao una vez y se guarda en el navegador',async()=>{
 const f=fixture('local');
 const a=await f.G.DB.redeemGift('mao25');
 assert.equal(a.ok,true);assert.equal(a.local,true);assert.equal(a.already,false);
 assert.equal(f.saved.owned[10001].from,'gift');
 assert.equal(f.saved.gifts.maomao,'MAO25');
 assert.ok(f.cache.has('ps.save.user1'));
 const b=await f.G.DB.redeemGift('MAO25');
 assert.equal(b.already,true);
 assert.equal(Object.keys(f.saved.owned).length,2);
});
test('Código inválido o partida en curso: ningún cambio',async()=>{
 const f=fixture();
 await assert.rejects(f.G.DB.redeemGift('OTRO'),/inválido/);
 assert.equal(f.writes,0);
 f.G.Game.state='playing';
 await assert.rejects(f.G.DB.redeemGift('MAO25'),/Sal de la partida/);
 assert.equal(f.writes,0);
});
test('Firebase: el código se confirma de forma atómica, sólo cambia el premio',async()=>{
 const f=fixture();
 const result=await f.G.DB.redeemGift('MAO25');
 assert.equal(result.ok,true);assert.equal(result.already,false);
 assert.equal(f.writes,1);
 assert.equal(f.doc.save.gifts.maomao,'MAO25');
 assert.equal(f.doc.save.owned[10001].from,'gift');
 assert.equal(f.doc.save.coins,500);
 assert.equal(f.doc.save.partner,1);
 assert.equal(f.G.DB.save.owned[10001].from,'gift');
 const again=await f.G.DB.redeemGift('MAO25');
 assert.equal(again.already,true);assert.equal(f.writes,1);
});
test('Código reutilizable por dos cuentas independientes',async()=>{
 const a=fixture(),b=fixture();
 await a.G.DB.redeemGift('MAO25');await b.G.DB.redeemGift('MAO25');
 assert.equal(a.writes,1);assert.equal(b.writes,1);
});
test('Firebase rechaza canje: no se modifica el guardado local ni la nube',async()=>{
 const f=fixture('cloud',true);
 await assert.rejects(f.G.DB.redeemGift('MAO25'),/permission-denied/);
 assert.equal(f.writes,0);assert.equal(f.saved.owned[10001],undefined);
 assert.equal(f.saved.gifts,undefined);
});
test('Mezcla de partidas conserva el Pokémon y la marca de canje',async()=>{
 const f=fixture('local');
 await f.G.DB.redeemGift('MAO25');
 const old={...JSON.parse(JSON.stringify(f.saved)),updated:5000,gifts:{},owned:{1:{at:100}}};
 const merged=f.G.DB.merge(old,f.saved);
 assert.ok(merged.owned[10001]);assert.equal(merged.gifts.maomao,'MAO25');
});
test('Reglas Firebase impiden creación, cambios arbitrarios y canje falso de especiales',()=>{
 assert.match(rules,/function authorizedGift\(\)/);
 assert.match(rules,/function giftUnchanged\(\)/);
 assert.match(rules,/== 'MAO25'/);
 assert.match(rules,/next\.diff\(old\)\.affectedKeys\(\)\.hasOnly\(\['owned', 'gifts', 'updated'\]\)/);
 assert.match(rules,/!\('10001' in request\.resource\.data\.save\.get\('owned', \{\}\)\)/);
 assert.match(rules,/giftUnchanged\(\) &&/);
});
test('Botón y pantalla del regalo integrados y fuera del catálogo de gacha',()=>{
 const html=fs.readFileSync(path.join(root,'dev.html'),'utf8');
 const menu=fs.readFileSync(path.join(root,'js/ui/menu.js'),'utf8');
 const mon=fs.readFileSync(path.join(root,'js/data/maomao-preview.js'),'utf8');
 assert.match(html,/data-go="gifts"/);
 assert.match(html,/id="gift-form"/);
 assert.match(html,/js\/data\/gift-codes\.js/);
 assert.match(html,/js\/ui\/gifts-ui\.js/);
 assert.match(menu,/Especial/);
 assert.match(mon,/start: 'poison-sting'/);
 assert.match(mon,/G\.DEX_BY\[10001\]/);
 assert.doesNotMatch(mon,/G\.DEX\.push/);
});
