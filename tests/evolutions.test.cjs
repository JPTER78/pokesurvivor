// Evolution data used by allied Pokémon (js/data/evolutions.js, built by tools/fetch_evolutions.py).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const ctx = { G: {} };
vm.createContext(ctx);
for (const f of ['js/data/pokedex.js', 'js/data/sprites-meta.js', 'js/data/evolutions.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const { DEX_BY, SPRITE_META, EVOS, PREVO } = ctx.G;
const pairs = Object.entries(EVOS).flatMap(([d, kids]) => kids.map(k => [+d, k]));

test('every evolution links two Pokémon that are in the game', () => {
  for (const [d, k] of pairs) {
    assert.ok(DEX_BY[d], `#${d} is not in the Pokédex`);
    assert.ok(DEX_BY[k], `#${d} evolves into #${k}, which is not in the Pokédex`);
  }
});

test('every evolution target can be drawn', () => {
  for (const [d, k] of pairs) assert.ok(SPRITE_META[k], `#${d} -> #${k} has no sprite`);
});

test('PREVO is the inverse of EVOS', () => {
  for (const [d, k] of pairs) assert.equal(PREVO[k], d, `#${k} should come from #${d}`);
});

test('pre-evolution chains have no loops', () => {
  for (const start of Object.keys(PREVO)) {
    let dex = +start, n = 0;
    while (PREVO[dex]) { dex = PREVO[dex]; assert.ok(++n < 4, `loop starting at #${start}`); }
  }
});

test('missing middle stages are bridged (Pidove -> Unfezant, Smoliv -> Arboliva)', () => {
  assert.equal(JSON.stringify(EVOS[519]), '[521]');      // (arrays from the vm context: compare as text)
  assert.equal(JSON.stringify(EVOS[928]), '[930]');
});

test('regional-form-only evolutions are never offered to a regular form', () => {
  for (const [d, k] of [[52, 863], [222, 864], [264, 862], [211, 904], [550, 902], [215, 903], [562, 867], [194, 980]]) {
    assert.ok(!(EVOS[d] || []).includes(k), `#${d} must not evolve into #${k}`);
    assert.equal(PREVO[k], d, `#${k} still belongs to #${d}'s family`);
  }
  assert.ok(!EVOS[489], 'Phione does not evolve');
});
