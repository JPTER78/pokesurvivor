'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function enemy(x,y,boss=false,dead=false){
  return {x,y,boss,dead,hp:100,types:['normal'],mon:{},cy(){return this.y;},hurt(n){this.hp-=n;}};
}
const melee=r=>({kind:'melee',radius:r,arc:Math.PI,type:'normal',cd:1,t:0,dmg:10});
const ranged=()=>({kind:'projectile',type:'normal',cd:1,t:0,dmg:10,speed:200,life:1,size:5,count:1});
function scene(enemies,moves,manual=null){
  const casts=[],shots=[],slashes=[],d2=(x,y,a,b)=>(x-a)**2+(y-b)**2;
  const nearest=(arr,x,y,r)=>{let best=null,bd=r*r;for(const e of arr){if(e.dead)continue;
    const d=d2(x,y,e.x,e.cy());if(d<bd){bd=d;best=e;}}return best;};
  const G={LIFT:12,U:{dist:(x,y,a,b)=>Math.sqrt(d2(x,y,a,b)),dist2:d2,
    TYPE_COLOR:{normal:'#ccc'},rand:()=>0,
    norm:(x,y)=>{const n=Math.hypot(x,y)||1;return[x/n,y/n];}},
    Input:{axis:()=>[0,0]},World:{isLiquid:()=>false,collide(){},nearestBreakable:()=>null,propsInCircle:()=>[]},
    Weather:{speedFor:()=>1,mult:()=>1},Judgment:{active:false},
    Projectiles:{nearest,spawn:p=>shots.push(p)},
    EnemyMgr:{all:()=>enemies,queryCircle:(x,y,r)=>enemies.filter(e=>!e.dead&&d2(x,y,e.x,e.y)<=r*r)},
    FX:{slash:(x,y,a)=>slashes.push(a),spark(){}},VFX:{forMove:()=>({})},
    Sprites:{dirFromAngle:()=>0},Coop:{active:false},Types:{mult:()=>1,label:()=>''},Stats:{taken:()=>1}};
  const ctx=vm.createContext({G,Math,performance:{now:()=>100}});
  vm.runInContext(read('js/entities/player.js'),ctx,{filename:'player.js'});
  vm.runInContext(read('js/systems/combat.js'),ctx,{filename:'combat.js'});
  const pl=Object.create(G.Player.prototype);
  Object.assign(pl,{x:0,y:0,r:12,bodyH:20,dead:false,flash:0,invuln:0,frozen:false,
    inLiquid:false,attackFace:0,baseSpd:80,spdMul:1,slowT:0,maxHp:100,hp:100,
    bellHeal:0,regenFlat:0,atkMul:1,baseAtk:20,cdMul:1,critChance:0,dmgDealt:0,
    buffs:{atk:{n:0,amount:0},spd:{n:0,amount:0},regen:{n:0,amount:0}},
    mon:{types:['normal']},slots:[moves],active:0,aim:0,target:null,
    anim:{update(){},loop(){}},cast(m){casts.push({m,target:this.target,aim:this.aim});},
    onDealt(){},atkFor:()=>1,handAim:()=>manual});
  pl.update(0);
  return {pl,casts,shots,slashes,attack:()=>G.Combat.tick(.016,pl,0)};
}
test('Melee prioritizes an in-range enemy over a distant boss',()=>{
  const near=enemy(55,0),boss=enemy(250,0,true),s=scene([boss,near],[melee(90)]);
  assert.equal(s.pl.target,near);s.attack();assert.equal(s.casts.length,1);
  assert.ok(near.hp<100);assert.equal(boss.hp,100);
});
test('Melee waits without spending cooldown when no enemies are in reach',()=>{
  const s=scene([enemy(250,0,true),enemy(160,0)],[melee(70)]);
  s.attack();assert.equal(s.casts.length,0);assert.equal(s.pl.activeMove().t,.05);
});
test('Ranged attacks preserve boss priority',()=>{
  const boss=enemy(210,60,true),s=scene([enemy(35,0),boss],[ranged()]);
  assert.equal(s.pl.target,boss);s.attack();assert.equal(s.casts.length,1);
  assert.equal(s.shots.length,1);
});
test('Manual melee aim preserves the chosen direction',()=>{
  const s=scene([enemy(55,0)],[melee(90)],Math.PI/2);
  s.attack();assert.equal(s.casts.length,1);assert.equal(s.slashes[0],Math.PI/2);
});
test('Fused melee targets nearby enemies without redirecting ranged casts',()=>{
  const near=enemy(0,60),boss=enemy(220,50,true),s=scene([boss,near],[ranged(),melee(90)]);
  const angle=s.pl.aim;assert.equal(s.pl.target,boss);s.attack();
  assert.equal(s.casts.length,2);assert.equal(s.casts[0].target,boss);
  assert.equal(s.casts[1].target,near);assert.equal(s.casts[0].aim,angle);
  assert.equal(s.casts[1].aim,Math.PI/2);assert.equal(s.pl.target,boss);
  assert.equal(s.pl.aim,angle);assert.ok(near.hp<100);
});
test('Fused melee moves check their independent reach',()=>{
  const near=enemy(0,60),boss=enemy(230,0,true),s=scene([boss,near],[melee(20),melee(90)]);
  s.attack();assert.equal(s.casts.length,1);assert.equal(s.casts[0].m.radius,90);
  assert.equal(s.casts[0].target,near);assert.equal(s.pl.target,boss);
});
test('Automatic targeting excludes defeated enemies',()=>{
  const near=enemy(50,0),s=scene([enemy(10,0,false,true),near],[melee(90)]);
  assert.equal(s.pl.target,near);s.attack();assert.equal(s.casts.length,1);
});
