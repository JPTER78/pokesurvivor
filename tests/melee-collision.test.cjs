'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
let id=0;
const enemy=(x,y,r=10,boss=false)=>({id:++id,x,y,r,boss,dead:false,hp:100,types:['normal'],mon:{},bodyH:20,cy(){return this.y;},hurt(n){this.hp-=n;}});
const melee=(radius=60,arc=Math.PI)=>({kind:'melee',radius,arc,cd:1,t:0,dmg:10,type:'normal'});
const ranged=()=>({kind:'projectile',radius:100,speed:250,life:1,size:5,count:1,cd:1,t:0,dmg:10,type:'normal'});
const d2=(x,y,a,b)=>(x-a)**2+(y-b)**2;
function scenario(enemies=[],moves=[melee()],opts={}){
 const casts=[],slashes=[],shots=[],network=[],props=opts.props||[];
 const closest=(list,x,y,r)=>{let best=null,bd=r*r;for(const e of list){if(e.dead)continue;const d=d2(x,y,e.x,e.cy());if(d<bd){best=e;bd=d;}}return best;};
 const G={LIFT:12,U:{dist:(x,y,a,b)=>Math.sqrt(d2(x,y,a,b)),dist2:d2,norm:(x,y)=>{let r=Math.hypot(x,y)||1;return[x/r,y/r];},rand:()=>0,TYPE_COLOR:{normal:'#ccc'}},
 Input:{axis:()=>opts.axis||[0,0]},World:{isLiquid:()=>false,collide(pl){opts.collide?.(pl);},nearestBreakable:()=>opts.prop||null,propsInCircle:(x,y,r)=>props.filter(p=>d2(x,y,p.x,p.y)<=(r+(p.r||0))**2),damageProp:p=>p.hits++,isWall:()=>false},
 Weather:{speedFor:()=>1,mult:()=>1},Judgment:{active:false},Projectiles:{nearest:closest,spawn:p=>shots.push(p),clearOrbs(){}},
 EnemyMgr:{all:()=>enemies,queryCircle:(x,y,r)=>enemies.filter(e=>!e.dead&&d2(x,y,e.x,e.y)<=(r+e.r)**2)},
 FX:{slash:(x,y,a)=>slashes.push(a),spark(){},ring(){}},VFX:{forMove:()=>({})},Sprites:{dirFromAngle:()=>0},
 Coop:{active:!!opts.coop,cast:(pl,m)=>network.push({m,aim:pl.aim})},Types:{mult:()=>1,label:()=>''},Stats:{taken:()=>1},Audio:{sfx(){}}};
 const ctx=vm.createContext({G,Math,performance:{now:()=>100}});vm.runInContext(read('js/entities/player.js'),ctx);vm.runInContext(read('js/systems/combat.js'),ctx);
 const pl=Object.create(G.Player.prototype);
 Object.assign(pl,{x:0,y:0,r:12,bodyH:20,dead:false,flash:0,invuln:0,frozen:false,inLiquid:false,attackFace:0,baseSpd:80,spdMul:1,slowT:0,maxHp:100,hp:100,bellHeal:0,regenFlat:0,atkMul:1,baseAtk:20,cdMul:1,critChance:0,dmgDealt:0,
 buffs:{atk:{n:0,amount:0},spd:{n:0,amount:0},regen:{n:0,amount:0}},mon:{types:['normal']},slots:[moves],active:0,aim:0,target:null,anim:{update(){},loop(){}},cast(m){casts.push({m,aim:this.aim,target:this.target});},onDealt(){},atkFor:()=>1,hasItem:()=>false,handAim:()=>opts.manual??null});
 pl.update(0);return {G,pl,casts,slashes,shots,network,update:dt=>pl.update(dt),attack:(dt=.016)=>G.Combat.tick(dt,pl,0)};
}
test('Hitbox edge: enemy is hittable exactly at radius plus body radius',()=>{const e=enemy(52,0,12),s=scenario([e],[melee(40)]);assert.equal(s.pl.target,e);s.attack();assert.equal(e.hp,90);});
test('Hitbox edge: enemy outside radius plus body radius is not hit',()=>{const e=enemy(52.01,0,12),m=melee(40),s=scenario([e],[m]);s.attack();assert.equal(s.casts.length,0);assert.equal(m.t,.05);});
test('Large enemies can be hit even when their center is out of range',()=>{const e=enemy(85,0,30),s=scenario([e],[melee(60)]);s.attack();assert.equal(e.hp,90);});
test('Targeting margin does not consume cooldown for an out-of-hitbox boss',()=>{const e=enemy(80,0,10,true),m=melee(55),s=scenario([e],[m]);s.attack();assert.equal(s.casts.length,0);assert.equal(m.t,.05);});
test('Nearest hittable enemy wins regardless of enemy list order',()=>{const far=enemy(60,0),near=enemy(20,0),s=scenario([far,near],[melee(70)]);assert.equal(s.pl.target,near);});
test('Multi-hit melee strike damages all enemies inside its arc',()=>{const a=enemy(50,0),b=enemy(45,20),c=enemy(-40,0);const s=scenario([a,b,c],[melee(75,Math.PI/2)],{manual:0});s.attack();assert.equal(a.hp,90);assert.equal(b.hp,90);assert.equal(c.hp,100);});
test('Manual aim remains fixed and excludes targets behind the player',()=>{const a=enemy(-20,0),b=enemy(30,0),s=scenario([a,b],[melee(60,Math.PI/2)],{manual:0});s.attack();assert.equal(a.hp,100);assert.equal(b.hp,90);assert.equal(s.slashes[0],0);});
test('Hit detection includes targets exactly at both arc boundaries',()=>{const a=enemy(40,40),b=enemy(40,-40),s=scenario([a,b],[melee(80,Math.PI/2)],{manual:0});s.attack();assert.equal(a.hp,90);assert.equal(b.hp,90);});
test('A moving enemy entering reach after aiming is acquired before casting',()=>{const a=enemy(140,0),boss=enemy(210,0,10,true),s=scenario([boss,a],[melee(60)]);a.x=45;s.attack();assert.equal(s.casts[0].target,a);assert.equal(a.hp,90);});
test('Enemy leaving reach before attack does not waste cooldown',()=>{const e=enemy(25,0),m=melee(60),s=scenario([e],[m]);e.x=200;s.attack();assert.equal(s.casts.length,0);assert.equal(m.t,.05);});
test('An enemy dying between aim and cast is not a valid target',()=>{const a=enemy(20,0),b=enemy(40,0),s=scenario([a,b],[melee(60)]);a.dead=true;s.attack();assert.equal(s.casts[0].target,b);});
test('An empty crowd leaves melee idle',()=>{const m=melee(),s=scenario([],[m]);s.attack();assert.equal(s.casts.length,0);assert.equal(m.t,.05);});
test('Destructible scenery remains attackable without enemies',()=>{const p={x:20,y:0,r:5,hits:0},s=scenario([],[melee()],{prop:p,props:[p]});s.attack();assert.equal(p.hits,1);});
test('Dead players cannot trigger a melee cast',()=>{const m=melee(),s=scenario([enemy(20,0)],[m]);s.pl.dead=true;s.attack();assert.equal(s.casts.length,0);assert.equal(m.t,0);});
test('Shorter melee can fail while a fused longer melee succeeds',()=>{const e=enemy(0,70),s=scenario([e],[melee(20),melee(90)]);s.attack();assert.equal(s.casts.length,1);assert.equal(s.casts[0].m.radius,90);assert.equal(e.hp,90);});
test('Fused ranged and melee attacks keep their independent aim',()=>{const boss=enemy(220,0,10,true),e=enemy(0,50),s=scenario([boss,e],[ranged(),melee(70)]);s.attack();assert.equal(s.casts.length,2);assert.equal(s.casts[0].target,boss);assert.equal(s.casts[1].target,e);assert.equal(s.pl.target,boss);assert.equal(s.pl.aim,0);});
test('Cooperative casts send the correct individual angle for fused moves',()=>{const boss=enemy(220,0,10,true),e=enemy(0,50),s=scenario([boss,e],[ranged(),melee(70)],{coop:true});s.attack();assert.equal(s.network.length,2);assert.equal(s.network[0].aim,0);assert.ok(Math.abs(s.network[1].aim-Math.PI/2)<1e-8);});
test('A cooperative broadcast exception restores targeting state',()=>{const boss=enemy(220,0,10,true),e=enemy(0,50),s=scenario([boss,e],[ranged(),melee(70)],{coop:true});let n=0;s.G.Coop.cast=()=>{if(++n===2)throw Error('network');};assert.throws(()=>s.attack(),/network/);assert.equal(s.pl.target,boss);assert.equal(s.pl.aim,0);});
test('Stressed targeting remains stable with the 64-enemy crowd cap',()=>{const crowded=Array.from({length:64},(_,i)=>enemy(1000+i,0));const e=enemy(30,0),m=melee(60),s=scenario([...crowded,e],[m]);for(let i=0;i<100;i++){m.t=0;s.attack();}assert.equal(s.casts.length,100);});

test('Huge enemy hitboxes remain hittable beyond the legacy center-distance margin',()=>{
  const target=enemy(110,0,55),s=scenario([target],[melee(60)]);
  assert.equal(s.pl.target,target);s.attack();
  assert.equal(s.casts.length,1);assert.equal(target.hp,90);
});
test('Melee updates its aim when the same enemy changes direction before casting',()=>{
  const target=enemy(30,0),s=scenario([target],[melee(70)]);
  target.x=-40;s.attack();
  assert.equal(s.casts.length,1);
  assert.ok(Math.abs(Math.abs(s.casts[0].aim)-Math.PI)<1e-8);
  assert.equal(target.hp,90);
  assert.equal(s.pl.aim,0);
});


test('Movement: approaching an enemy triggers melee once it enters hit range', () => {
  const target = enemy(130, 0);
  const move = melee(55);
  const options = { axis: [1, 0] };
  const s = scenario([target], [move], options);

  s.attack();
  assert.equal(s.casts.length, 0);
  for (let frame = 0; frame < 30 && !s.casts.length; frame++) {
    s.update(0.05);
    s.attack(0.05);
  }

  assert.ok(s.pl.x > 0);
  assert.equal(s.casts.length, 1);
  assert.equal(s.casts[0].target, target);
  assert.equal(target.hp, 90);
});

test('Movement: leaving melee range stops further attacks without locking the cooldown', () => {
  const target = enemy(35, 0);
  const move = melee(55);
  const options = { axis: [1, 0] };
  const s = scenario([target], [move], options);

  s.attack();
  assert.equal(s.casts.length, 1);
  options.axis = [-1, 0];
  for (let frame = 0; frame < 50; frame++) {
    s.update(0.05);
    s.attack(0.05);
  }
  const attacksOutsideRange = s.casts.length;
  for (let frame = 0; frame < 12; frame++) {
    s.update(0.05);
    s.attack(0.05);
  }

  assert.equal(s.casts.length, attacksOutsideRange);
  assert.equal(target.hp, 90);
  assert.ok(move.t <= 0.05);
});

test('Movement: an enemy crossing behind the player is hit in its new direction', () => {
  const target = enemy(35, 0);
  const s = scenario([target], [melee(65, Math.PI / 3)]);
  target.x = -35;

  s.attack();
  assert.equal(s.casts.length, 1);
  assert.ok(Math.abs(Math.abs(s.casts[0].aim) - Math.PI) < 1e-8);
  assert.equal(target.hp, 90);
});

test('Movement: a replacement target is acquired when the old target moves away', () => {
  const oldTarget = enemy(25, 0);
  const incoming = enemy(160, 0);
  const s = scenario([oldTarget, incoming], [melee(55)]);
  oldTarget.x = 160;
  incoming.x = 30;

  s.attack();
  assert.equal(s.casts.length, 1);
  assert.equal(s.casts[0].target, incoming);
  assert.equal(incoming.hp, 90);
  assert.equal(oldTarget.hp, 100);
});

test('Collision: wall-limited player movement cannot attack enemies outside reach', () => {
  const target = enemy(88, 0);
  const move = melee(55);
  const options = {
    axis: [1, 0],
    collide: pl => { pl.x = Math.min(pl.x, 20); },
  };
  const s = scenario([target], [move], options);

  for (let frame = 0; frame < 20; frame++) {
    s.update(0.05);
    s.attack(0.05);
  }
  assert.ok(s.pl.x <= 20);
  assert.equal(s.casts.length, 0);
  assert.equal(target.hp, 100);
});

test('Movement: without enemies, automatic aim follows the walking direction', () => {
  const s = scenario([], [melee(60)], { axis: [0, -1] });
  s.update(0.1);

  assert.ok(Math.abs(s.pl.aim + Math.PI / 2) < 1e-8);
  s.attack();
  assert.equal(s.casts.length, 0);
});

test('Movement: immobilization prevents walking but preserves melee attacks', () => {
  const target = enemy(25, 0);
  const s = scenario([target], [melee(60)], { axis: [1, 0] });
  s.pl.frozen = true;
  const x = s.pl.x;

  s.update(0.2);
  s.attack();

  assert.equal(s.pl.x, x);
  assert.equal(s.casts.length, 1);
  assert.equal(target.hp, 90);
});

test('Targeting: switching melee and ranged slots keeps their own target priority', () => {
  const nearby = enemy(30, 0);
  const boss = enemy(210, 0, 10, true);
  const closeMove = melee(60);
  const projectile = ranged();
  const s = scenario([boss, nearby], [closeMove]);
  s.pl.slots.push([projectile]);

  s.attack();
  assert.equal(s.casts[0].target, nearby);

  s.pl.setActive(1);
  s.update(0);
  s.attack();
  assert.equal(s.casts[1].target, boss);
  assert.equal(s.shots.length, 1);

  s.pl.setActive(0);
  closeMove.t = 0;
  s.update(0);
  s.attack();
  assert.equal(s.casts[2].target, nearby);
});

test('Targeting: disabling manual aim restores automatic targeting without stale angles', () => {
  const target = enemy(40, 0);
  const options = { manual: Math.PI / 2 };
  const s = scenario([target], [melee(60, Math.PI / 3)], options);

  s.attack();
  assert.equal(s.casts.length, 1);
  assert.equal(target.hp, 100);

  options.manual = null;
  s.pl.activeMove().t = 0;
  s.update(0);
  s.attack();

  assert.equal(s.casts.length, 2);
  assert.ok(Math.abs(s.casts[1].aim) < 1e-8);
  assert.equal(target.hp, 90);
});

test('Player state: attacks resume after the player returns from a dead state', () => {
  const target = enemy(30, 0);
  const s = scenario([target], [melee(65)]);

  s.pl.dead = true;
  s.attack();
  assert.equal(s.casts.length, 0);

  s.pl.dead = false;
  s.update(0);
  s.attack();
  assert.equal(s.casts.length, 1);
  assert.equal(target.hp, 90);
});

test('Targeting: an enemy entering range is attacked within subsequent retry frames', () => {
  const incoming = enemy(160, 0);
  const move = melee(55);
  const s = scenario([incoming], [move]);

  for (let frame = 0; frame < 12; frame++) s.attack();
  assert.equal(s.casts.length, 0);
  incoming.x = 40;
  for (let frame = 0; frame < 8; frame++) s.attack();

  assert.equal(s.casts.length, 1);
  assert.equal(incoming.hp, 90);
});

test('Targeting: rapidly alternating valid and invalid targets never blocks later hits', () => {
  const target = enemy(140, 0);
  const move = melee(55);
  const s = scenario([target], [move]);

  for (let frame = 0; frame < 40; frame++) {
    target.x = frame % 2 === 0 ? 35 : 140;
    move.t = 0;
    s.update(0);
    s.attack();
  }
  assert.equal(s.casts.length, 20);
});

test('Cooldown: repeated movement frames respect the normal melee recovery time', () => {
  const target = enemy(30, 0);
  const move = melee(60);
  const s = scenario([target], [move], { axis: [0, 1] });

  for (let frame = 0; frame < 10; frame++) {
    s.update(0.01);
    s.attack(0.01);
  }
  assert.equal(s.casts.length, 1);
  assert.ok(move.t > 0.8);
});
