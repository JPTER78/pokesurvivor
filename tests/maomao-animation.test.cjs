'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const motion = fs.readFileSync(path.join(root, 'js/data/maomao-animation.js'), 'utf8');
const sprites = fs.readFileSync(path.join(root, 'js/core/sprites.js'), 'utf8').replace(/\r\n/g, '\n');
const html = fs.readFileSync(path.join(root, 'dev.html'), 'utf8');
const preview = fs.readFileSync(path.join(root, 'js/data/maomao-preview.js'), 'utf8');
const match = preview.match(/G\.SPRITE_META\[10001\] = (\{.+\});/);
assert.ok(match, 'No está la geometría original de Mao Mao');
const base = JSON.parse(match[1]);
const EXTRA = { Idle: 4, Walk: 6, Attack: 5, Shoot: 5, Charge: 4, Hurt: 3, Faint: 5 };

function setup(opts = {}) {
  const images = [], surfaces = [];
  const game = { SPRITE_META: {
    10001: JSON.parse(JSON.stringify(base)),
    1: {s:1,a:{Idle:{w:40,h:44,n:1,r:8,d:[40],ax:20,ay:39},
                Walk:{w:40,h:44,n:2,r:8,d:[9,9],ax:20,ay:39}}}
  }, U:{clamp:(v,a,b)=>Math.max(a,Math.min(b,v))} };
  class TestImage {
    constructor(){this.width=0;this.height=0;images.push(this);}
    set src(url){
      this._src=url;
      if (!url) return;
      const m=String(url).match(/pokemon\/(\d+)\/(\w+)\.png/);
      assert.ok(m,'ruta de sprite inesperada: '+url);
      const meta=game.SPRITE_META[m[1]].a[m[2]];
      this.width=meta.w*meta.n;this.height=meta.h*meta.r;
      if(this.onload)this.onload();
    }
    get src(){return this._src||'';}
  }
  const document={createElement(tag){
    assert.equal(tag,'canvas');
    const calls=[];
    const obj={width:0,height:0,calls,
      getContext(){return opts.noContext ? null : {
        imageSmoothingEnabled:true,
        save(){calls.push(['save']);},restore(){calls.push(['restore']);},
        translate(...args){calls.push(['translate',...args]);},
        transform(...args){calls.push(['transform',...args]);},
        drawImage(...args){calls.push(['draw',...args]);}
      };}};
    surfaces.push(obj);return obj;
  }};
  const sandbox={G:game, document, Image:TestImage, performance:{now:()=>0},
    Date, Math, console, setTimeout, clearTimeout};
  const ctx=vm.createContext(sandbox);
  vm.runInContext(motion,ctx);
  vm.runInContext(sprites,ctx);
  return {G:game,ctx,images,surfaces};
}

test('Mao Mao: todas las animaciones tienen 4–6 poses (Hurt 3) y ocho direcciones',()=>{
  const f=setup();
  for(const [anim,n] of Object.entries(EXTRA)){
    const s=f.G.Sprites.sheet(10001,anim);
    const meta=f.G.Sprites.animMeta(10001,anim);
    assert.equal(s.ready,true,anim);
    assert.equal(meta.n,n,anim);
    assert.equal(meta.d.length,n,anim);
    assert.equal(s.img.width,meta.w*n,anim);
    assert.equal(s.img.height,meta.h*8,anim);
    assert.equal(f.G.SPRITE_META[10001].a[anim].n,base.a[anim].n,'no cambiar el origen '+anim);
  }
});
test('Walk crea 48 poses dibujadas con escalado nearest-neighbor',()=>{
 const f=setup();const sheet=f.G.Sprites.sheet(10001,'Walk');
 const all=f.surfaces.find(c=>c===sheet.img);
 assert.ok(all);
 const draw=all.calls.filter(c=>c[0]==='draw');
 assert.equal(draw.length,48);
 assert.ok(all.calls.some(c=>c[0]==='transform'),'diagonales suavizadas');
 assert.ok(all.calls.some(c=>c[0]==='translate'));
 assert.equal(f.G.MaomaoAnimation.DEX,10001);
 const frameX=draw.map(c=>c[6]);
 assert.equal(new Set(frameX).size>2,true,'hay fotogramas intermedios');
});
test('Idle respira, Shoot y Attack incluyen preparación/recuperación, Faint conserva poses',()=>{
 const f=setup();
 const idle=f.G.Sprites.sheet(10001,'Idle');
 const frameDraws=idle.img.calls.filter(x=>x[0]==='draw');
 const heights=[...new Set(frameDraws.map(x=>x.at(-1)))];
 assert.ok(heights.length>=2,'ciclo respiratorio no puede ser estático');
 for (const anim of ['Attack','Shoot','Charge','Hurt','Faint']) {
   const s=f.G.Sprites.sheet(10001,anim);
   assert.ok(s.img.calls.some(x=>x[0]==='draw'));
 }
});
test('Animator recorre frames añadidos y dibuja su fila de dirección correcta',()=>{
 const f=setup();const spr=f.G.Sprites;
 const a=new spr.Animator(10001);a.dir=3;a.loop('Walk');
 const m=spr.animMeta(10001,'Walk');
 const drawn=[];
 const ctx={globalAlpha:1,drawImage(...args){drawn.push(args);}};
 a.update(.18);
 a.draw(ctx,100,150);
 assert.equal(drawn.length,1);
 assert.equal(drawn[0][0],spr.sheet(10001,'Walk').img);
 assert.equal(drawn[0][2],3*m.h);
 assert.equal(drawn[0][1],a.frame*m.w);
 assert.ok(a.frame>=1 && a.frame<m.n);
});
test('El cambio sólo afecta dex 10001; Pokémon normales mantienen su geometría',()=>{
 const f=setup();
 const before=JSON.stringify(f.G.SPRITE_META[1].a);
 const s=f.G.Sprites.sheet(1,'Walk');
 assert.equal(s.ready,true);
 assert.equal(s.img instanceof f.ctx.Image,true);
 assert.equal(f.G.Sprites.animMeta(1,'Walk').n,2);
 assert.equal(JSON.stringify(f.G.SPRITE_META[1].a),before);
});
test('Sin Canvas disponible, conserva los sprites originales en lugar de bloquear el juego',()=>{
 const f=setup({noContext:true});
 const s=f.G.Sprites.sheet(10001,'Walk');
 assert.equal(s.ready,true);
 assert.equal(f.G.Sprites.animMeta(10001,'Walk').n,2);
 assert.equal(s.img instanceof f.ctx.Image,true);
});
test('El empaquetado carga la mejora antes que el motor de sprites',()=>{
 const a=html.indexOf('js/data/maomao-preview.js');
 const b=html.indexOf('js/data/maomao-animation.js');
 const c=html.indexOf('js/core/sprites.js');
 assert.ok(a>=0 && b>a && c>b,'secuencia de carga incorrecta');
 assert.match(preview,/start:\s*'poison-sting'/);
});
