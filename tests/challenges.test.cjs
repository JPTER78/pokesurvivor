const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = f => fs.readFileSync(path.join(root, f), 'utf8');
const ID = 'extreme-survival-v1';
const noop = () => {};
function fixture() {
  const storage = new Map();
  const ctx = vm.createContext({ G: {}, navigator: { onLine: true }, document: { hidden: false, addEventListener: noop },
    location: { protocol: 'file:' }, console, performance: { now: () => ctx.now || 0 },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
    setTimeout: noop, clearTimeout: noop, addEventListener: noop, Uint8Array, TextEncoder, window: {} });
  const load = f => vm.runInContext(source(f), ctx, { filename: f });
  load('js/systems/challenges.js'); load('js/core/db.js'); load('js/entities/player.js');
  return { ctx, G: ctx.G, storage, load };
}
function elapsed(G, seconds) {
  G.Challenges.tick(0, true);
  for (let i = 1; i <= seconds * 10; i++) G.Challenges.tick(i * 100, true);
}
function damageFixture() {
  const f = fixture(), { G } = f;
  G.Types = { mult: () => 0.5, label: () => 'weak' }; G.Weather = { mult: () => 1.2 };
  G.Audio = { sfx: noop }; G.Camera = { kick: noop }; G.FX = { dmgText: noop, burst: noop, ring: noop };
  G.Projectiles = { clearOrbs: noop };
  const p = Object.create(G.Player.prototype);
  Object.assign(p, { hp: 100, maxHp: 100, mon: { types: ['grass'] }, invuln: 0, dead: false,
    dmgReduce: 0.2, buffs: { def: { n: 1, amount: 0.1 } }, x: 0, y: 0, bodyH: 20,
    activeGroup: () => [{kind:'melee'}], hasItem: () => false, anim: { play: noop } });
  return { ...f, p };
}
test('Daño normal, resistencias, clima y defensa se conservan; sólo hostil aumenta 25%', () => {
  const { G, p } = damageFixture();
  p.hurt(20, 'fire', false, true); const normal = 100 - p.hp;
  assert.ok(Math.abs(normal - 6.3) < 1e-9);
  p.hp = 100; p.invuln = 0; G.Challenges.begin(ID); G.Challenges.bindPlayer(p);
  p.hurt(20, 'fire', false, true); assert.ok(Math.abs(100 - p.hp - normal * 1.25) < 1e-9);
  p.hp = 100; p.invuln = 0; p.hurt(20, 'fire'); assert.ok(Math.abs(100 - p.hp - normal) < 1e-9);
  p.hp = 50; p.heal(10); assert.equal(p.hp, 60);
});
test('Invulnerabilidad, mínimo de daño, daño puro y otros jugadores', () => {
  const { G, p } = damageFixture(); G.Challenges.begin(ID); G.Challenges.bindPlayer(p);
  p.invuln = 1; p.hurt(100, null, false, true); assert.equal(p.hp, 100);
  p.invuln = 0; p.hurt(0.01, null, false, true); assert.equal(p.hp, 98.75);
  p.invuln = 0; p.hp = 100; p.hurt(20, null, true, true); assert.equal(p.hp, 75);
  assert.equal(G.Challenges.damageMultiplier({}), 1);
  G.Challenges.begin(); assert.equal(G.Challenges.damageMultiplier(p), 1);
});
for (const [reason,seconds,won] of [['muerte',599,false],['abandono',120,false],['cierre',599,false],['prematuro',599,true]]) {
  test(`${reason} antes de 600 s no completa ni premia`, async () => {
    const { G } = fixture(); await G.DB.register('Testuser', '123456'); const coins = G.DB.save.coins;
    G.Challenges.begin(ID); elapsed(G,seconds); assert.equal(G.Challenges.finish(won).won,false);
    assert.equal(G.DB.save.challenges[ID].completedAt,0); assert.equal(G.DB.save.coins,coins);
  });
}
test('600 segundos: completar una vez, repetir sin premio y resolución idempotente', async () => {
  const { G } = fixture(); await G.DB.register('Testuser','123456'); const coins = G.DB.save.coins;
  G.Challenges.begin(ID); elapsed(G,600); assert.equal(G.Challenges.ready,true);
  const first = G.Challenges.finish(true); assert.equal(first.won,true); assert.ok(first.completedAt);
  assert.equal(G.Challenges.finish(true),null);
  G.Challenges.begin(ID); elapsed(G,600); const second = G.Challenges.finish(true);
  assert.equal(second.completedAt,first.completedAt); assert.equal(G.DB.save.coins,coins);
});
test('Oculta, sin conexión, pausas y suspensión no producen victorias', async () => {
  const { G,ctx } = fixture(); await G.DB.register('Testuser','123456');
  G.Challenges.begin(ID); elapsed(G,590); G.Challenges.tick(1000000,false); G.Challenges.tick(1000100,true);
  assert.ok(Math.abs(G.Challenges.active.time-590)<1e-6); G.Challenges.tick(2000100,true); assert.ok(Math.abs(G.Challenges.active.time-590)<1e-6);
  G.Challenges.suspend(); G.Challenges.tick(3000000,true); assert.ok(Math.abs(G.Challenges.active.time-590)<1e-6);
  G.Challenges.begin(ID); elapsed(G,600); ctx.navigator.onLine=false; assert.equal(G.Challenges.finish(true).won,false);
  ctx.navigator.onLine=true; G.Challenges.begin(ID); elapsed(G,600); ctx.document.hidden=true;
  assert.equal(G.Challenges.finish(true).won,false);
});
test('Commit real en almacenamiento local y recuperación de mejor intento al recargar', async () => {
  const { G } = fixture(); await G.DB.register('Testuser','123456');
  G.Challenges.begin(ID); elapsed(G,215); G.Challenges.finish(false); assert.equal(G.DB.commit(true),true);
  await G.DB.logout(); assert.equal((await G.DB.login('Testuser','123456')).ok,true);
  assert.ok(Math.abs(G.DB.save.challenges[ID].bestTime-215)<1e-6);
});
test('Merge real entre dos copias: máximo, primera fecha, conmutatividad e idempotencia', async () => {
  const { G } = fixture(); await G.DB.register('Testuser','123456');
  const a = JSON.parse(JSON.stringify(G.DB.save)), b = JSON.parse(JSON.stringify(a));
  a.updated=10; a.coins=100; a.challenges[ID]={bestTime:600,completedAt:1000};
  b.updated=20; b.coins=200; b.challenges[ID]={bestTime:300,completedAt:0};
  const merged=G.DB.merge(a,b); assert.equal(merged.challenges[ID].bestTime,600);
  assert.equal(merged.challenges[ID].completedAt,1000); assert.equal(merged.coins,200);
  assert.deepEqual(G.DB.merge(b,a),merged); assert.deepEqual(G.DB.merge(merged,a),merged);
  b.challenges[ID]={bestTime:600,completedAt:2000}; assert.equal(G.DB.merge(a,b).challenges[ID].completedAt,1000);
});
function gameFixture() {
  const f = fixture(), { G,ctx } = f;
  const stub = () => new Proxy({}, {get: (o,k) => k in o ? o[k] : noop});
  for(const name of ['UI','FX','Projectiles','Combat','EnemyMgr','Pickups','Spawner','Rift','Judgment','Events','Weather','Path','Hazards','World','Interact','Sprites','Audio','Progress','Social','Coop','Input','RunUI','Settings']) G[name]=stub();
  G.Coop.active=false; G.Coop.isHost=false; G.Social.room=null; G.Social.me=null;
  G.World.biomeName=()=>''; G.Judgment.summary=()=>null; G.Judgment.cinematic=false; G.Judgment.active=false; G.Rift.inArena=false;
  G.Ranking={runStarted:noop,submitSolo:noop,submitGroup:noop};
  G.DEX_BY={1:{dex:1,types:['grass']}}; G.BIOME_MUSIC=['x']; G.Upgrades={perks:()=>({})}; G.startMoveOf=()=> 'tackle';
  G.Sprites.preload=noop; G.Camera={x:0,y:0,follow:noop,outerRadius:()=>500}; G.UI.$=noop; G.Input.tap=()=>false;
  G.EnemyMgr.all=()=>[]; G.U={mmss:String}; G.SettingsUI={isOpen:false}; G.UI.isOpen=()=>false;
  G.Player=class { constructor(mon) {Object.assign(this,{mon,dex:1,hp:100,maxHp:100,level:1,atkMul:1,spdMul:1,cdMul:1,coinMul:1,coin:0,coins:20,kills:4,bosses:0,t1:1,t10:0,bind:{},moves:[],anim:{update:noop}});}
    hasMove(){return false;} addMove(){} update(){} heal(){} gainXp(){} };
  const instrumented=source('js/game.js').replace('function render() {','function render() { return;')
    .replace('function restore() {','function restore() { return;')
    .replace('init, startRun, everyone,','_frame: frame, _endRun: endRun, init, startRun, everyone,');
  vm.runInContext(instrumented,ctx); return f;
}
test('Flujo integrado: normal sigue sin límite, guarda recursos y envía ranking', async () => {
  const {G,ctx}=gameFixture(); await G.DB.register('Testuser','123456'); G.DB.save.partner=1;
  let starts=0, submits=0; G.Ranking.runStarted=()=>starts++; G.Ranking.submitSolo=()=>submits++;
  G.Game.startRun(); ctx.now=700000; G.Game.debugTime(700); G.Game._frame(ctx.now);
  assert.equal(G.Game.state,'playing'); assert.equal(G.Challenges.active,null); assert.equal(starts,1);
  // debugTime permanece ilegítimo: no falsear clean() para lograr envío.
  G.Game.quit(); assert.equal(submits,0); assert.equal(G.DB.save.stats.bestTime,700);
  assert.equal(G.DB.save.stats.runs,1); assert.ok(G.DB.save.coins>500); assert.equal(G.DB.save.tickets.t1,1);
  G.Game.toUI(); G.Game.startRun(); G.Game.quit(); assert.equal(submits,1);
});
test('Flujo integrado: victoria automática sin ranking ni récord normal; recursos conservados', async () => {
  const {G,ctx}=gameFixture(); await G.DB.register('Testuser','123456'); G.DB.save.partner=1;
  let ranked=0,result; G.Ranking.runStarted=G.Ranking.submitSolo=G.Ranking.submitGroup=()=>ranked++;
  G.RunUI.showOver=r=>result=r; const coins=G.DB.save.coins;
  G.Game.startRun(null,ID); elapsed(G,600); ctx.now=600000; G.Game._frame(ctx.now);
  assert.equal(G.Game.state,'over'); assert.equal(result.challenge.won,true); assert.equal(ranked,0);
  assert.equal(G.DB.save.stats.bestTime,0); assert.equal(G.DB.save.stats.runs,0);
  assert.equal(G.DB.save.coins,coins+21); assert.equal(G.DB.save.tickets.t1,1);
  G.Game.quit(); assert.equal(G.DB.save.coins,coins+21);
});
test('Flujo integrado: morir en grieta falla antes de revivir y no publica ranking', async () => {
  const {G,ctx}=gameFixture(); await G.DB.register('Testuser','123456'); G.DB.save.partner=1;
  let result,riftTicks=0; G.RunUI.showOver=r=>result=r; G.Rift.inArena=true; G.Rift.update=()=>riftTicks++;
  G.Game.startRun(null,ID); elapsed(G,599); G.Combat.resolve=()=>{G.Game.player.dead=true;};
  ctx.now=599000; G.Game._frame(ctx.now); assert.equal(result.challenge.won,false); assert.equal(riftTicks,0);
});
test('Desafío rechazado sin red, con sala o cooperativo; partida normal coop sigue iniciando', async () => {
  const {G,ctx}=gameFixture(); await G.DB.register('Testuser','123456'); G.DB.save.partner=1;
  ctx.navigator.onLine=false; G.Game.startRun(null,ID); assert.equal(G.Game.state,'ui');
  ctx.navigator.onLine=true; G.Social.room={}; G.Game.startRun(null,ID); assert.equal(G.Game.state,'ui');
  G.Social.room=null; G.Game.startRun({seed:1},ID); assert.equal(G.Game.state,'ui');
  let begun=0; G.Coop.begin=()=>begun++; G.Game.startRun({seed:1,host:true,members:[]});
  assert.equal(begun,1); assert.equal(G.Game.state,'playing'); assert.equal(G.Challenges.active,null);
});
test('Impactos reales de combat.js y hazards.js identifican contacto, proyectiles y zonas hostiles', () => {
  const {G,load}=fixture(); const hits=[];
  const p={x:0,y:0,r:10,maxHp:100,hurt:(...args)=>hits.push(args),hasItem:()=>false};
  G.Game={player:p}; G.Coop={isHost:false};
  G.U={dist2:(x,y,a,b)=>(x-a)**2+(y-b)**2,norm:()=>[1,0]};
  G.FX={burst:noop,ring:noop}; G.World={projectileBlock:()=>false}; G.Camera={sees:()=>false,kick:noop};
  const enemy={x:0,y:0,r:10,touchCd:0,dmg:20,atkType:'fire',strike:noop,kx:0,ky:0};
  G.Projectiles={all:()=>[{friendly:false,x:0,y:0,r:2,dmg:15,mtype:'water'}]};
  G.EnemyMgr={queryCircle:()=>[enemy]}; load('js/systems/combat.js'); G.Combat.resolve(0.1,p,0);
  assert.deepEqual(hits[0],[15,'water',false,true]); assert.deepEqual(hits[1],[20,'fire',false,true]);
  load('js/systems/hazards.js'); G.Hazards.add({kind:'zone',x:0,y:0,r:20,delay:0,dmg:30,type:'grass'});
  G.Hazards.update(0.1); assert.deepEqual(hits[2],[30,'grass',false,true]);
});
test('Depuración del reloj no concede una victoria de desafío', async () => {
  const {G,ctx}=gameFixture(); await G.DB.register('Testuser','123456'); G.DB.save.partner=1;
  let result; G.RunUI.showOver=r=>result=r; G.Game.startRun(null,ID); elapsed(G,600);
  G.Game.debugTime(600); ctx.now=600000; G.Game._frame(ctx.now); assert.equal(result.challenge.won,false);
});
