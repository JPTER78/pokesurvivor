const {test}=require('node:test');
const assert=require('node:assert/strict');
const {game,load}=require('./mega-fixtures.cjs');
function setup(){
 const {G}=game(646);
 load(G,'js/data/upgrades.js');
 load(G,'js/core/db.js');
 G.DB.playAsGuest(); G.DB.grant(646,'test'); G.DB.grant(448,'test'); G.Game.state='ui';
 return G;
}
function max(G,d=646){for(const u of G.Upgrades.LIST)G.DB.upgradesOf(d)[u.id]=u.max;}
const clone=o=>JSON.parse(JSON.stringify(o));
test('prestige requires all upgrades, resets only selected Pokemon, caps at five and grants shiny',()=>{
 const G=setup(),s=G.DB.save; max(G,448); const other=clone(s.pupg[448]);
 s.coins=4567;s.ptm[646]=['flamethrower'];s.pnat[646]=['hardy',1];
 assert.equal(G.DB.prestigePokemon(646,0),false);
 for(let n=0;n<5;n++){
  max(G); if(n===0){G.DB.upgradesOf(646).start2=0;assert.equal(G.DB.canPrestige(646),false);max(G);}
  G.Game.state='playing';assert.equal(G.DB.prestigePokemon(646,n),false);G.Game.state='ui';
  assert.equal(G.DB.prestigePokemon(646,n),true);
  assert.equal(G.DB.prestigeOf(646),n+1); assert.deepEqual(s.pupg[646],{});
  assert.equal(G.DB.prestigePokemon(646,n),false);
  assert.equal(G.DB.ownsShiny(646),n===4);
 }
 max(G);assert.equal(G.DB.canPrestige(646),false);assert.equal(G.DB.prestigePokemon(646,5),false);
 assert.deepEqual(s.pupg[448],other);assert.equal(s.coins,4567);assert.deepEqual(s.ptm[646],['flamethrower']);
});
test('stale saves cannot resurrect spent upgrades; same-generation purchases still merge',()=>{
 const G=setup();max(G);const before=clone(G.DB.save);G.DB.prestigePokemon(646,0);
 G.DB.upgradesOf(646).hp=2;const after=clone(G.DB.save);before.updated=Date.now()+10000;
 for(const [a,b] of [[before,after],[after,before]]){
  const m=G.DB.merge(a,b);assert.equal(m.prestige[646],1);assert.deepEqual(m.pupg[646],{hp:2});
  assert.deepEqual(G.DB.merge(m,b).pupg[646],{hp:2});
 }
 const other=clone(after);other.pupg[646]={atk:3};
 assert.deepEqual(G.DB.merge(after,other).pupg[646],{hp:2,atk:3});
 const concurrent=clone(before);concurrent.prestige={646:1};concurrent.pupg[646]={};
 assert.equal(G.DB.merge(after,concurrent).prestige[646],1);
});
test('prestige scales all six base stats additively, survives fusion and reversion without double counting',()=>{
 const G=setup();G.DB.save.pnat[646]=['hardy',1];const base=G.Mons.monFor(646);
 G.DB.save.prestige[646]=5;const mon=G.Mons.monFor(646);
 assert.equal(mon.hp, Math.round(base.hp*1.125));
 for(const k of ['pa','sa','df','sd','spd'])assert.ok(Math.abs(mon[k]-base[k]*1.125)<1e-9,k);
 const p=new G.Player(mon,{hp:80,atkMul:1.4});p.hp=p.maxHp/2;
 assert.ok(G.Forms.transform(p,'kyurem-black',{silent:true}));
 assert.equal(p.mon.pa,1.64*1.125);assert.equal(p.mon.sa,1.36*1.125);assert.equal(p.maxHp,Math.round(126*1.125)+80);
 assert.equal(p.hp/p.maxHp,.5);assert.ok(G.Forms.revert(p));assert.equal(p.mon.pa,mon.pa);
 assert.ok(G.Forms.transform(p,'kyurem-white',{silent:true}));assert.equal(p.mon.sa,1.64*1.125);
 const remote=new G.Player(G.DEX_BY[646]);G.Forms.applyRemote(remote,{nature:'hardy',prestige:5,form:'kyurem-black',stone:'dna_splicers',ability:'teravolt'});
 assert.equal(remote.mon.pa,1.64*1.125);const pa=remote.mon.pa;
 G.Forms.applyRemote(remote,{nature:'hardy',prestige:5,form:'kyurem-black',stone:'dna_splicers',ability:'teravolt'});assert.equal(remote.mon.pa,pa);
 assert.equal(G.DEX_BY[646].pa,base.pa);
});

 test('prestige HP rounds to the nearest whole number at every level',()=>{
  const G=setup();G.DB.save.pnat[646]=['hardy',1];
  for(let level=0;level<=5;level++){
   G.DB.save.prestige[646]=level;
   const mon=G.Mons.monFor(646);
   assert.equal(mon.hp,Math.round(126*(1+level*.025)));
   const p=new G.Player(mon,{hp:80});
   assert.equal(p.maxHp,mon.hp+80);
   for(const form of ['kyurem-black','kyurem-white']){
    G.Forms.transform(p,form,{silent:true});
    assert.equal(p.maxHp,mon.hp+80);assert.ok(Number.isInteger(p.maxHp));
   }
  }
 });

test('prestige rates follow base species rarity across all tiers and forms',()=>{
 const G=setup();
 for(let rarity=1;rarity<=5;rarity++){
  const base=G.DEX.find(m=>m.rarity===rarity),step=rarity<=3?.05:.025;
  assert.equal(G.Mons.prestigeRate(base.dex),step);
  for(let level=0;level<=5;level++){
   const boosted=G.Mons.applyPrestige({...base},level),factor=1+level*step;
   for(const k of ['pa','sa','df','sd','spd'])assert.equal(boosted[k],base[k]*factor);
   assert.equal(boosted.hp,Math.round(base.hp*factor));
  }
 }
 const dex=448;G.DB.save.prestige[dex]=5;G.DB.save.pnat[dex]=['hardy',1];
 const p=new G.Player(G.Mons.monFor(dex));
 G.Forms.transform(p,'lucario-mega',{silent:true});
 const factor=1+G.Mons.prestigeRate(dex)*5;
 assert.equal(p.mon.pa,G.Forms.get('lucario-mega').stats.pa*factor);
 assert.equal(p.mon.hp,Math.round(G.Forms.get('lucario-mega').stats.hp*factor));
});
