// Mejoras temporales (Player.addBuff): una habilidad no puede borrar lo que ya llevas (#352).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const G = {};
new Function('G', source('js/entities/player.js'))(G);
const addBuff = G.Player.prototype.addBuff;
const pl = () => ({ buffs: { spd: { n: 0, t: 0, amount: 0 } } });

test('Weak Armor no longer wipes Agility charges: 3 charges stay 3 (and last as long as the longer one)', () => {
  const p = pl();
  for (let i = 0; i < 3; i++) addBuff.call(p, 'spd', 0.1, 7, 5);   // Agilidad x3 (moves.js)
  p.buffs.spd.t = 1;                                                // a punto de acabarse
  addBuff.call(p, 'spd', 0.2, 3, 1);                                // golpe físico con Armadura Frágil
  assert.deepEqual(p.buffs.spd, { n: 3, t: 3, amount: 0.1 });
});

test('stacking still works as before when the new one is at least as good', () => {
  const p = pl();
  addBuff.call(p, 'spd', 0.2, 3, 1);                                // Armadura Frágil sola
  assert.deepEqual(p.buffs.spd, { n: 1, t: 3, amount: 0.2 });
  addBuff.call(p, 'spd', 0.1, 7, 5);                                // y luego Agilidad: 2 cargas, lo mismo que antes
  assert.deepEqual(p.buffs.spd, { n: 2, t: 7, amount: 0.1 });
  addBuff.call(p, 'spd', 0.1, 7, 5);
  assert.equal(p.buffs.spd.n, 3);
  const q = pl();
  for (let i = 0; i < 4; i++) addBuff.call(q, 'spd', 0.1, 3, 2);   // Firmeza: se acumula hasta 2
  assert.deepEqual(q.buffs.spd, { n: 2, t: 3, amount: 0.1 });
});

test('Assault Vest does not count toward the 70% cap of the Armor cards, and taking it off loses nothing (#340)', () => {
  const H = {};
  new Function('G', source('js/data/items.js'))(H);
  new Function('G', source('js/systems/levelup.js'))(H);
  const card = H.LevelUp.STATS.find(c => c.id === 'def'), vest = H.Items.BY.assaultvest;
  const p = { dmgReduce: 0, itemReduce: 0, buffs: { def: { n: 0, t: 0, amount: 0 } } };
  Object.defineProperty(p, 'reduction', Object.getOwnPropertyDescriptor(G.Player.prototype, 'reduction'));
  vest.on(p);
  for (let i = 0; i < 12; i++) card.apply(p);
  assert.equal(Math.round(p.dmgReduce * 100), 70, 'the cards alone reach 70%');
  assert.equal(Math.round(p.reduction * 100), 80, 'with the vest on top (overall limit 80%)');
  vest.off(p);
  assert.equal(Math.round(p.reduction * 100), 70, 'taking the vest off keeps the cards');
});
