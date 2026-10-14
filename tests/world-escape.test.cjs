const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '../js/world/world.js'), 'utf8');
function create(seed) {
  const G = {
    Tiles: {
      T: 16, BIOMES: [{ liquid: 'water', name: 'Pradera' }],
      ARENA_THEMES: { normal: { pools: 0, pillars: 0, clear: 0, props: {} } }
    },
    Sprites: { PX: 2 },
    U: {
      hash(x, y, s) {
        let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647);
        h = Math.imul(h ^ h >>> 13, 1274126177);
        return ((h ^ h >>> 16) >>> 0) / 4294967296;
      },
      clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
      dist2(x1, y1, x2, y2) { return (x1-x2)**2 + (y1-y2)**2; }
    }
  };
  const ctx = { G, Map, Math, Set, Uint8Array };
  vm.runInNewContext(SRC, ctx);
  G.World.reset(seed);
  return G.World;
}
test('Vías horizontales y verticales continuas en semillas positivas y negativas', () => {
  for (const seed of [1, 13, 67329, -71, 2147483647]) {
    const world = create(seed);
    for (let row=-70; row<=70; row++) for(let n=-3;n<=3;n++) {
      assert.equal(world.walkable(n*22, row), true, 'corte vertical en '+[seed,n,row]);
      assert.equal(world.walkable(row, n*22), true, 'corte horizontal en '+[seed,n,row]);
    }
  }
});
test('Corredores de anchura útil: al menos tres tiles consecutivos para cada tramo', () => {
  const world = create(9907);
  for (let n=-3;n<=3;n++) for(let i=-65;i<=65;i+=3) {
    for (const orientation of ['v','h']) {
      let best=0,run=0;
      for(let d=-5;d<=5;d++){
        const x=orientation==='v'?n*22+d:i;
        const y=orientation==='v'?i:n*22+d;
        if(world.walkable(x,y)) {run++;best=Math.max(best,run);} else run=0;
      }
      assert.ok(best>=3,'pasillo demasiado estrecho '+[n,i,orientation,best]);
    }
  }
});
test('La semilla genera el mismo terreno independientemente del orden de chunks', () => {
  const coords = [[0,0],[31,-22],[-31,13],[63,19],[-48,-29],[10,-9],[50,50]];
  const a=create(3), b=create(3);
  const one=coords.map(([x,y])=>a.kindAt(x*32+16,y*32+16));
  const two=[...coords].reverse().map(([x,y])=>b.kindAt(x*32+16,y*32+16)).reverse();
  assert.deepEqual(one,two);
});
test('Las grietas mantienen paredes de cierre y corredor de aparición', () => {
  const world=create(99);
  world.setArena({tx:0,ty:0,r:12,type:'normal'});
  assert.equal(world.kindAt(12*32+16,0), 'wall');
  assert.equal(world.kindAt(0,0), 'floor');
  assert.equal(world.kindAt(0,-3*32+16), 'floor');
});
test('No elimina por completo peligros y obstáculos de los terrenos exteriores', () => {
  const world=create(9921);
  let walls=0, liquids=0, floors=0;
  // Muestra varias regiones lejanas; una sola región puede ser naturalmente seca.
  for (const [cx,cy] of [[-96,-96],[-48,40],[45,-60],[60,65],[100,10]]) {
    for(let y=cy;y<cy+38;y++)for(let x=cx;x<cx+38;x++){
      const t=world.kindAt(x*32+16,y*32+16);
      walls+=+(t==='wall'); liquids+=+(t==='liquid'); floors+=+(t==='floor');
    }
  }
  assert.ok(walls>0,'deben continuar existiendo paredes');
  assert.ok(liquids>0,'deben continuar existiendo líquidos');
  assert.ok(floors>0,'deben continuar existiendo suelos');
});
