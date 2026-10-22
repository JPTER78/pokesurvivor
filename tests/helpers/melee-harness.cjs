'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../..',p),'utf8');
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

module.exports = { enemy, melee, ranged, scenario };
