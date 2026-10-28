const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { game } = require('./mega-fixtures.cjs');

for (const variant of ['black', 'white']) {
  test(`${variant} Kyurem: rift reward needs an explicit choice and preserves the run`, () => {
    const { G, p } = game(646);
    p.setAbility('pressure'); p.equip('quickclaw'); p.hp = p.maxHp * .43;
    p.moves = [{ id: 'ice-beam', t: .7 }]; p.slots = [[0]]; p.buffs = [{ id: 'test', t: 8 }];
    p.level = 30; p.xp = 123; p.coins = 99;
    const before = { moves: p.moves, slots: p.slots, buffs: p.buffs, hp: p.maxHp, nature: p.nature, cd: p.cdMul };
    G.Rift.debugMegaArena(); G.Rift.debugWin(); G.Rift.update(.1, p, 900);
    assert.equal(p.formId, 'kyurem'); assert.equal(p.megaStone, null); assert.equal(p.bonds, 0);
    assert.equal(G.Forms.claimReward(p), false, 'neither form is silently selected');
    assert.equal(G.Forms.claimReward(p, 'lucario-mega'), false);
    assert.equal(G.Forms.claimReward(p, '__proto__'), false);
    assert.ok(G.Forms.claimReward(p, 'kyurem-' + variant));
    assert.equal(p.spriteKey, '646-' + variant); assert.equal(p.anim.dex, p.spriteKey);
    assert.equal(p.transformation.kind, 'fusion'); assert.equal(p.megaStone, 'dna_splicers');
    assert.equal(p.abilId, variant === 'black' ? 'teravolt' : 'turboblaze');
    assert.deepEqual(p.mon.types, ['dragon', 'ice']); assert.equal(p.mon.bst, 700);
    const stats = G.Forms.get('kyurem-' + variant).stats;
    assert.ok(Math.abs(p.mon.pa - stats.pa * 1.1) < 1e-9);
    assert.ok(Math.abs(p.mon.sa - stats.sa * .9) < 1e-9); // Keep this fixture's Adamant nature.
    assert.equal(p.moves, before.moves); assert.equal(p.slots, before.slots); assert.equal(p.buffs, before.buffs);
    assert.equal(p.moves[0].t, .7); assert.equal(p.item, 'quickclaw'); assert.equal(p.maxHp, before.hp);
    assert.ok(Math.abs(p.hp / p.maxHp - .43) < 1e-9); assert.equal(p.cdMul, before.cd);
    assert.equal(p.nature, before.nature); assert.equal(p.level, 30); assert.equal(p.xp, 123); assert.equal(p.coins, 99);
    assert.equal(G.Forms.claimReward(p, 'kyurem-' + variant), false);
    assert.equal(G.Forms.queueReward(p), false);
    G.Rift.update(6, p, 906); G.Rift.debugMegaArena(); G.Rift.debugWin(); G.Rift.update(.1, p, 906);
    assert.equal(p.bonds, 1, 'later rifts give a Bond instead of changing forms');
    assert.equal(p.formId, 'kyurem-' + variant);
    const fresh = new G.Player(G.Mons.monFor(646));
    assert.equal(fresh.formId, 'kyurem'); assert.equal(fresh.pendingMegaForm, null); assert.equal(fresh.megaStone, null);
  });

  test(`${variant} Kyurem: normal and shiny sheets have valid geometry and credits`, () => {
    const { G } = game(646), m = G.SPRITE_META['646-' + variant];
    assert.equal(m.path, '646/forms/' + variant); assert.ok(m.sh);
    for (const shiny of [false, true]) for (const anim of ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint']) {
      const meta = shiny && m.sa?.[anim] || m.a[anim];
      const dir = path.join(__dirname, '../assets/pokemon', m.path, shiny ? 's' : '');
      const png = fs.readFileSync(path.join(dir, anim + '.png'));
      assert.equal(png.readUInt32BE(16), meta.w * meta.n); assert.equal(png.readUInt32BE(20), meta.h * meta.r);
      assert.equal(meta.d.length, meta.n); assert.ok(meta.ax > 0 && meta.ay > 0);
      assert.ok(fs.readFileSync(path.join(dir, 'credits.txt'), 'utf8').includes('276369635304275968'));
    }
  });
}

test('Kyurem preloads both choices and cannot claim without winning a rift', async () => {
  const { G, p } = game(646); let requested;
  G.Sprites.preload = (keys, timeout, shiny) => { requested = { keys, shiny }; return Promise.resolve(); };
  await G.Forms.preload(p);
  assert.deepEqual(requested, { keys: ['646-black', '646-white'], shiny: true });
  assert.equal(G.Forms.claimReward(p, 'kyurem-black'), false);
  assert.equal(G.Forms.hasMegaForm(646), false);
  assert.equal(G.Forms.rewardFormsFor(p).length, 2);
  assert.equal(G.Forms.rewardFormsForDex(25).length, 0);
});
