const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

const ctx = { G: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/data/moves.js'), 'utf8'), ctx, { filename: 'js/data/moves.js' });
const M = ctx.G.Moves;

// Cuántos lanza de verdad, como en systems/combat.js: Math.max(mínimo, m.count | 0).
// Sin `count` en los datos vale el mínimo, y una mejora "+1" (count: 1) se quedaba en lo mismo.
const MIN = { nova: 3, cone: 2, quake: 0 };
const shots = m => Math.max(MIN[m.kind] ?? 1, m.count | 0);

test('cada mejora que suma count lanza uno más de verdad', () => {
  const bad = [];
  for (const def of Object.values(M.BY_ID)) {
    for (let lvl = 2; lvl <= def.maxLvl; lvl++) {
      const up = def.ups[lvl - 2];
      if (!up || !up.m.count) continue;
      const before = shots(M.instance(def.id, lvl - 1)), after = shots(M.instance(def.id, lvl));
      if (after <= before) bad.push(`${def.id} Nv.${lvl - 1}->${lvl} "${up.t}": ${before} -> ${after}`);
    }
    const top = M.instance(def.id, def.maxLvl), before = shots(top);
    const adds = M.evolve(top) && top.count !== M.instance(def.id, def.maxLvl).count;
    if (adds && shots(top) <= before) bad.push(`${def.id} evolución: ${before} -> ${shots(top)}`);
  }
  assert.deepEqual(bad, []);
});
