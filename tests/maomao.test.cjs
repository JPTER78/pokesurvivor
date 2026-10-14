const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const root=path.join(__dirname,'..');
function fixture(search='?maomao=1'){
 const G={FIREBASE_CONFIG:null,DB:{guest:true},Coop:{active:false},Social:{room:null},Game:{state:'ui'}};
 const ctx=vm.createContext({G,URLSearchParams,location:{search}});
 for(const file of ['js/data/pokedex.js','js/data/sprites-meta.js','js/data/moves.js','js/data/maomao-preview.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
 return {G,ctx};
}
test('Maomao no cambia los catálogos públicos y sólo se registra bajo opción de prueba',()=>{
 const off=fixture('');const on=fixture();assert.equal(off.G.DEX_BY[10001],undefined);
 assert.equal(off.G.SPRITE_META[10001],undefined);assert.equal(on.G.DEX.length,off.G.DEX.length);
 assert.equal(on.G.DEX.some(p=>p.dex===10001),false);
 assert.equal(on.G.MaomaoPreview.mon.rarity,5);assert.equal(on.G.MaomaoPreview.mon.leg,undefined);
 assert.equal(on.G.MaomaoPreview.allowed(),true);
});
test('Repertorio coincide con Veneno/Planta, sin alterar movimientos existentes',()=>{
 const {G}=fixture();const pool=G.Moves.poolFor(G.MaomaoPreview.mon);
 assert.deepEqual([...pool].sort(),[...G.Moves.poolFor(G.DEX_BY[1])].sort());
 assert.equal(G.Moves.startFor(G.MaomaoPreview.mon),'poison-sting');
});
test('Bloquea cuentas persistentes, Firebase, salas, cooperativo y partidas ya iniciadas',()=>{
 const {G}=fixture();
 for(const [obj,key,value] of [[G.DB,'guest',false],[G,'FIREBASE_CONFIG',{}],[G.Coop,'active',true],[G.Social,'room',{}],[G.Game,'state','playing']]){
  const prev=obj[key];obj[key]=value;assert.equal(G.MaomaoPreview.allowed(),false);obj[key]=prev;
 }
});
test('Cada hoja contiene todas las celdas declaradas, con ancla dentro de los límites',()=>{
 const {G}=fixture();const meta=G.SPRITE_META[10001];
 for(const [name,a] of Object.entries(meta.a)){
  const png=fs.readFileSync(path.join(root,'assets/pokemon/10001',name+'.png'));
  assert.equal(png.readUInt32BE(16),a.w*a.n);assert.equal(png.readUInt32BE(20),a.h*a.r);
  assert.equal(a.r,8);assert.equal(a.d.length,a.n);assert.ok(a.d.every(t=>t>0));assert.ok(a.ax<a.w&&a.ay<a.h);
 }
});
test('Entrada de juego rechaza parámetros de prueba inválidos antes de modificar estado',()=>{
 const {G,ctx}=fixture();vm.runInContext(fs.readFileSync(path.join(root,'js/game.js'),'utf8'),ctx);
 let starts=0;G.Challenges={begin(){starts++;}};
 G.Game.startRun(null,null,'otro');G.Game.startRun({seed:1},null,'maomao');G.Game.startRun(null,'extreme-survival-v1','maomao');
 G.DB.guest=false;G.Game.startRun(null,null,'maomao');
 assert.equal(G.Game.state,'ui');assert.equal(starts,0);
});
