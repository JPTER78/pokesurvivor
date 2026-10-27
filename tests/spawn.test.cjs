// Ventanas muy alargadas (#350): los enemigos que salen fuera de la vista tienen que
// poder acercarse, no recolocarse en cada fotograma. (Reproducción del informe.)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function run(w, h) {
  const G = {
    U: { dist2: (x, y, a, b) => (x - a) ** 2 + (y - b) ** 2, rand: (a, b) => (a + b) / 2, pick: a => a[0] },
    Coop: { active: false, isHost: false }, Rift: { inArena: false }, World: { isFree: () => true }
  };
  const math = Object.create(Math);
  math.random = () => 0;
  const ctx = vm.createContext({ G, Math: math });
  for (const f of ['js/core/camera.js', 'js/systems/spawner.js', 'js/entities/enemy.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
  }
  G.Camera.resize(w, h);
  let recycled = 0;
  const ahead = G.Spawner.ahead;
  G.Spawner.ahead = (...a) => { recycled++; return ahead(...a); };
  const player = { x: 0, y: 0, _vx: 0, _vy: 0, kills: 0 };
  const initialX = G.Camera.outerRadius() + 40;
  const enemy = { id: 1, x: initialX, y: 0, r: 8, dead: false, flying: true, lagT: 0, update(dt) { this.x -= 100 * dt; } };
  G.EnemyMgr.add(enemy);
  for (let i = 0; i < 60; i++) G.EnemyMgr.update(1 / 60, [player]);
  return { initialX, finalX: enemy.x, recycled };
}

test('very wide windows: enemies that spawn off screen walk in instead of being moved every frame (#350)', () => {
  for (const [w, h] of [[1920, 1080], [1587, 188], [2400, 120]]) {
    const r = run(w, h);
    assert.equal(r.recycled, 0, w + '×' + h + ': never moved back');
    assert.ok(Math.abs(r.finalX - (r.initialX - 100)) < 1e-6, w + '×' + h + ': it got 100 units closer');
  }
});
