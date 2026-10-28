const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game, load } = require('./mega-fixtures.cjs');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('Mega transformation preserves player identity and every unrelated run property', () => {
  const { G, p } = game();
  const move = { id: 'aura-sphere', lvl: 6, t: .47, cd: 2, evolved: true };
  Object.assign(p, { moves: [move], slots: [[move]], active: 0, level: 27, xp: 800, xpNext: 2000,
    coins: 78, kills: 2400, t1: 9, t10: 3, rerolls: 2, svx: 10, svy: -9, dmgDealt: 12123,
    x: 18, y: -45, arbitraryFutureState: { answer: 42 } });
  p.equip('quickclaw'); p.addMaxHp(30); p.statsTaken = { hp: 2, def: 3 }; p.addBuff('spd', .1, 10, 5);
  p.hp = p.maxHp * .4; p.anim.dir = 7;
  const before = { ...p }, mon = { ...p.mon };
  assert.equal(G.Forms.transform(p, 'lucario-mega'), true);
  assert.equal(G.Game.player, p);
  const changed = new Set(['mon', 'formId', 'spriteKey', 'scale', 'r', 'bodyH', 'anim', 'baseAtk', 'baseSpd', 'maxHp', 'hp', 'abil', 'abilId', '_abilityOff', 'transformation']);
  for (const k of Object.keys(before)) if (!changed.has(k)) assert.equal(p[k], before[k], k);
  assert.equal(p.anim.dir, 7); assert.equal(p.anim.dex, '448-mega'); assert.ok(p.shiny);
  near(p.hp / p.maxHp, .4); assert.equal(p.maxHp, before.maxHp);
  assert.equal(p.baseSpecies, 448); assert.equal(p.dex, 448);
  assert.equal(p.nature, mon.nature); assert.equal(p.mon.nature, mon.nature);
  assert.equal(p.mon.pa, 1.5 * 1.1); assert.equal(p.mon.sa, 1.47 * .9);
  assert.equal(p.mon.spd, 125); assert.equal(p.mon.df, 88); assert.equal(p.mon.sd, 70);
  assert.deepEqual(p.mon.types, ['fighting', 'steel']); assert.equal(p.abilId, 'adaptability');
  assert.equal(p.abil.out(p, { type: 'fighting' }), 1.25);
  assert.equal(p.abil.out(p, { type: 'steel' }), 1.25);
  assert.equal(p.abil.out(p, { type: 'water' }), 1);
  near(p.atkFor({ type: 'fighting', cat: 'physical' }), p.mon.pa * p.atkMul);
  assert.deepEqual(G.DEX_BY[448].types, mon.types);
  const anim = p.anim;
  assert.equal(G.Forms.transform(p, 'lucario-mega'), true); assert.equal(p.anim, anim);
  const snapshot = { ...p };
  for (const invalid of ['missing', '__proto__', 'constructor']) assert.equal(G.Forms.transform(p, invalid), false);
  assert.deepEqual({ ...p }, snapshot);
  assert.ok(G.Forms.revert(p)); assert.equal(p.formId, 'lucario'); assert.equal(p.abilId, 'steadfast');
  assert.equal(p.baseAtk, mon.atk); near(p.hp / p.maxHp, .4); assert.equal(p.item, 'quickclaw');
});

test('every persistent ability is reversible; item/card changes and cooldown progress survive', () => {
  const { G } = game();
  for (const [id, fx] of Object.entries(G.AbilityFX.FX)) {
    if (!fx.start && !fx.cdMul) continue;
    const p = new G.Player(G.Mons.monFor(448), { hp: 25, cdMul: .7 });
    const before = { maxHp: p.maxHp, critChance: p.critChance, regenFlat: p.regenFlat, magnet: p.magnet, baseAtk: p.baseAtk, mon: { ...p.mon } };
    p.setAbility(id); const once = [p.maxHp, p.critChance, p.regenFlat, p.magnet, p.cdMul, p.coinMul];
    p.setAbility(id); assert.deepEqual([p.maxHp, p.critChance, p.regenFlat, p.magnet, p.cdMul, p.coinMul], once, id);
    p.equip('quickclaw'); p.addMaxHp(30); p.regenFlat += 2; p.critChance += .04;
    p.hp = p.maxHp * .4; p.moves = [{ t: .6 }];
    assert.ok(G.Forms.transform(p, 'lucario-mega'), id);
    near(p.cdMul, .7 * .8); near(p.coinMul, 1); near(p.magnet, before.magnet);
    near(p.critChance, before.critChance + .04); near(p.regenFlat, before.regenFlat + 2);
    near(p.maxHp, before.maxHp + 30); near(p.hp / p.maxHp, .4); near(p.moves[0].t, .6);
    assert.ok(G.Forms.revert(p)); assert.equal(p.abilId, id);
    p.setAbility('adaptability'); near(p.maxHp, before.maxHp + 30);
    near(p.baseAtk, before.baseAtk); assert.deepEqual(p.mon, before.mon);
  }
});

test('data-defined forms without ability overrides preserve the ability, nature and proportional HP', () => {
  const { G, p } = game();
  G.FORM_DEFS.push({ id: 'test-form', baseDex: 448, name: 'Test', category: 'alternate', types: ['water'],
    sprite: { key: 448 }, stats: { ...G.DEX_BY[448], hp: 200 } });
  load(G, 'js/systems/forms.js');
  p.hp = p.maxHp * .25; p.setAbility('regenerator');
  assert.ok(G.Forms.transform(p, 'test-form')); assert.equal(p.abilId, 'regenerator');
  assert.equal(p.maxHp, 240); near(p.hp / p.maxHp, .25); near(p.regenFlat, 240 * .006);
  assert.deepEqual(p.mon.types, ['water']); assert.ok(G.Forms.revert(p));
  assert.equal(G.Forms.transform(game(25).p, 'lucario-mega'), false);
});

test('stone is independent of held item, awarded once, and absent in a fresh run', () => {
  const { G, p } = game(); p.equip('leftovers');
  assert.ok(G.Forms.awardMega(p)); assert.equal(p.megaStone, 'lucarionite'); assert.equal(p.item, 'leftovers');
  assert.equal(G.Forms.awardMega(p), false); assert.equal(G.Forms.canMegaEvolve(p), false);
  const q = new G.Player(G.Mons.monFor(448));
  assert.equal(q.formId, 'lucario'); assert.equal(q.megaStone, null); assert.ok(G.Forms.canMegaEvolve(q));
  assert.equal(G.Forms.hasMegaForm(25), false);
});

test('Mega reward is reserved without transforming and can only be claimed once', () => {
  const { G, p } = game(); p.equip('leftovers');
  const before = { hp: p.hp, maxHp: p.maxHp, mon: p.mon, anim: p.anim };
  assert.ok(G.Forms.queueMega(p)); assert.equal(G.Forms.queueMega(p), false);
  assert.equal(p.pendingMegaForm, 'lucario-mega'); assert.equal(p.megaStone, null);
  assert.equal(p.formId, 'lucario');
  for (const k of Object.keys(before)) assert.equal(p[k], before[k], k);
  assert.ok(G.Forms.claimMega(p)); assert.equal(p.pendingMegaForm, null);
  assert.equal(p.item, 'leftovers'); assert.equal(p.megaStone, 'lucarionite');
  assert.equal(G.Forms.claimMega(p), false); assert.equal(G.Forms.queueMega(p), false);
  const q = new G.Player(G.Mons.monFor(448));
  assert.equal(q.pendingMegaForm, null); assert.equal(G.Forms.claimMega(q), false);
  assert.equal(G.Forms.queueMega(game(25).p), false);
});

test('only Mega Lucario Idle runs at half speed, including shiny and after an attack', () => {
  const { G } = game(); load(G, 'js/core/sprites.js');
  for (const shiny of [false, true]) {
    for (const key of [448, '448-mega', 25]) {
      const a = new G.Sprites.Animator(key, 1, shiny);
      a.update(1 / 120); near(a.t, key === '448-mega' ? .25 : .5);
      a.loop('Walk'); a.update(1 / 120); near(a.t, .5);
      a.play('Attack'); a.update(1 / 120); near(a.t, .5);
      a.loop('Idle');
      const m = G.Sprites.animMeta(key, 'Attack', shiny);
      a.update(m.d.reduce((sum, d) => sum + d, 0) / 60);
      assert.equal(a.cur, 'Idle'); a.update(1 / 120);
      near(a.t, key === '448-mega' ? .25 : .5);
    }
  }
});

test('Mega idle rests for a full slow cycle, preserves elapsed time and can be interrupted', () => {
  const { G } = game(); load(G, 'js/core/sprites.js');
  for (const shiny of [false, true]) {
    const a = new G.Sprites.Animator('448-mega', 1, shiny);
    const frames = G.Sprites.animMeta('448-mega', 'Idle', shiny).d.reduce((s, d) => s + d, 0);
    const cycle = frames / 30; // 60 ticks/sec at half-speed.
    a.update(cycle); assert.equal(a.frame, 0); near(a.t, 0); near(a.rest, frames);
    a.update(cycle / 2); assert.equal(a.frame, 0); near(a.t, 0); near(a.rest, frames / 2);
    a.update(cycle / 2); assert.equal(a.frame, 0); near(a.rest, 0);
    a.update(1 / 120); near(a.t, .25);
    const b = new G.Sprites.Animator('448-mega', 1, shiny);
    b.update(cycle * 5.5); assert.equal(b.frame, 0); near(b.rest, frames / 2);
    b.loop('Walk'); assert.equal(b.rest, 0); b.update(1 / 120); near(b.t, .5);
    a.loop('Walk'); a.loop('Idle'); a.update(cycle); assert.ok(a.rest > 0);
    a.play('Attack'); assert.equal(a.rest, 0); a.update(1 / 120); near(a.t, .5);
    const regular = new G.Sprites.Animator(448, 1, shiny);
    const normalCycle = G.Sprites.animMeta(448, 'Idle', shiny).d.reduce((s, d) => s + d, 0) / 60;
    regular.update(normalCycle + 1 / 120); near(regular.t, .5); assert.equal(regular.rest, 0);
  }
});

test('remote form applies validated sprite, nature, ability and stone independently', () => {
  const { G } = game(); const p = new G.Player(G.DEX_BY[448]); p.remote = true;
  const state = { form: 'lucario-mega', stone: 'lucarionite', nature: 'adamant', ability: 'adaptability' };
  G.Forms.applyRemote(p, state); assert.equal(p.anim.dex, '448-mega'); assert.equal(p.abilId, 'adaptability');
  assert.equal(p.nature, 'adamant'); near(p.mon.pa, 1.65); assert.equal(p.megaStone, 'lucarionite');
  const anim = p.anim; G.Forms.applyRemote(p, state); assert.equal(p.anim, anim);
  const q = new G.Player(G.DEX_BY[25]); G.Forms.applyRemote(q, state); assert.equal(q.formId, 'pikachu');
});

test('normal/shiny form sheets have all seven valid animations and a separate asset path', () => {
  const { G } = game(); const fs = require('node:fs'), path = require('node:path');
  const m = G.SPRITE_META['448-mega']; assert.equal(m.path, '448/forms/mega'); assert.ok(m.sh);
  for (const a of ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint']) {
    for (const shiny of [false, true]) {
      const g = shiny && m.sa?.[a] || m.a[a];
      const png = fs.readFileSync(path.join(__dirname, '../assets/pokemon', m.path, shiny ? 's' : '', a + '.png'));
      assert.equal(png.readUInt32BE(16) % g.w, 0); assert.equal(png.readUInt32BE(20), g.h * g.r);
      assert.equal(g.d.length, g.n); assert.ok(g.ax > 0 && g.ay > 0);
    }
  }
});
