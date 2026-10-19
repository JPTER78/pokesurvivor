/* node --test tools/tests/gacha.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function game(random = () => 0.01) {
  const math = Object.create(Math);
  math.random = random;
  const context = vm.createContext({ G: {}, Math: math });
  for (const file of ['js/data/pokedex.js', 'js/data/sprites-meta.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../..', file), 'utf8'), context);
  }
  const G = context.G;
  G.U = { pick: list => list[Math.floor(random() * list.length)] };
  G.Sprites = { hasShiny: dex => !!G.SPRITE_META[dex]?.sh };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/systems/gacha.js'), 'utf8'), context);
  return G;
}
const save = () => ({ tickets: { t1: 1000, t10: 2 }, owned: {}, shiny: {}, pity: {}, stats: {}, coins: 0 });

test('all-regions pools equal the union of regional pools, for every rarity', () => {
  const G = game();
  assert.equal(G.Gacha.BANNERS.length, 10);
  assert.equal(G.Gacha.BANNERS.filter(b => b.gen === 0).length, 1);
  const generations = new Set();
  for (let rarity = 1; rarity <= 5; rarity++) {
    const all = Array.from(G.Gacha.pool(rarity, 0), p => p.dex).sort((a, b) => a - b);
    const regional = [];
    for (let gen = 1; gen <= 9; gen++) {
      for (const p of G.Gacha.pool(rarity, gen)) {
        assert.equal(p.gen, gen);
        regional.push(p.dex);
        generations.add(p.gen);
      }
    }
    assert.deepEqual(all, regional.sort((a, b) => a - b));
    assert.ok(all.length > 0);
  }
  assert.equal(generations.size, 9);
  for (const dex of G.Gacha.featured(0)) assert.equal(G.DEX_BY[dex].rarity, 5);
});

test('all-regions banner charges the same tickets, guarantees an epic in x10 and isolates pity', () => {
  const G = game(); const s = save();
  s.pity = { 1: 69, 9: 30 };
  const out = G.Gacha.pull(s, 10, 0);
  assert.equal(out.length, 10);
  assert.ok(out.some(p => p.rarity >= 4));
  assert.equal(s.tickets.t1, 990);
  assert.equal(s.pity[0], 10);
  assert.equal(s.pity[1], 69);
  assert.equal(s.pity[9], 30);
  assert.equal(s.stats.pulls, 10);
  G.Gacha.pull(s, 10, 0, 't10');
  assert.equal(s.tickets.t10, 1);
  assert.equal(s.tickets.t1, 990);
  s.tickets = { t1: 0, t10: 0 };
  const before = JSON.stringify(s);
  assert.equal(G.Gacha.pull(s, 1, 0), null);
  assert.equal(JSON.stringify(s), before);
});

test('all-regions and regional legendary guarantees reset only their own counters', () => {
  const G = game(); const s = save();
  s.pity = { 0: 69, 1: 69 };
  assert.equal(G.Gacha.pull(s, 1, 0)[0].rarity, 5);
  assert.equal(s.pity[0], 0);
  assert.equal(s.pity[1], 69);
  const regional = G.Gacha.pull(s, 1, 1)[0];
  assert.equal(regional.rarity, 5);
  assert.equal(G.DEX_BY[regional.dex].gen, 1);
  assert.equal(s.pity[1], 0);
  assert.equal(s.pity[0], 0);
});

test('duplicate refunds and unique shinies also work across all regions', () => {
  const G = game(); const s = save();
  const first = G.Gacha.pull(s, 1, 0)[0];
  assert.ok(s.owned[first.dex]);
  const duplicate = G.Gacha.pull(s, 1, 0)[0];
  assert.equal(duplicate.dex, first.dex);
  assert.equal(duplicate.isNew, false);
  assert.equal(s.coins, G.Gacha.REFUND[duplicate.rarity]);
  G.Gacha.debugForceShiny(2);
  const shiny1 = G.Gacha.pull(s, 1, 0)[0];
  const shiny2 = G.Gacha.pull(s, 1, 0)[0];
  assert.equal(shiny1.shiny, true);
  assert.equal(shiny2.shiny, true);
  assert.notEqual(shiny1.dex, shiny2.dex);
  assert.ok(s.shiny[shiny1.dex] && s.shiny[shiny2.dex]);
});
