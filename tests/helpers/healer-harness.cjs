'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const FILE = 'js/entities/enemy.js';
const source = () => fs.readFileSync(path.join(__dirname, '../..', FILE), 'utf8');
function scenario(js, { hp=2000, power=1.4, boss=false, rd=120, targets=null }={}) {
  const clock={time:0}, effects={bursts:0};
  const victims=targets || [{x:0,y:0,bodyH:16,hp:0,maxHp:hp,dead:false,boss,rd}];
  const G={Game:{st:clock,everyone:()=>[{atk:100*power,baseAtk:100}]},
    FX:{burst:()=>effects.bursts++,ring(){}}, Coop:{isHost:false},
    Camera:{sees:()=>false},Audio:{sfx(){}}};
  vm.runInNewContext(js,{G,Math,Map,Set,console},{filename:FILE});
  G.EnemyMgr.queryCircle=()=>victims;
  const healer={x:0,y:0,bodyH:16,anim:{play(){}}};
  function cast(n=1){for(let i=0;i<n;i++) G.Enemy.prototype.healAround.call(healer);}
  return {G,clock,victims,effects,cast};
}
module.exports={FILE,source,scenario};
