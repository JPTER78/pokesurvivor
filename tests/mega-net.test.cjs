const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game, load } = require('./mega-fixtures.cjs');

for (const [dex, form, sprite, stone, ability] of [[448, 'lucario-mega', '448-mega', 'lucarionite', 'adaptability'],
  [646, 'kyurem-black', '646-black', 'dna_splicers', 'teravolt'], [646, 'kyurem-white', '646-white', 'dna_splicers', 'turboblaze']]) {
test(`real Coop frames carry ${form} and apply it through Player.netUpdate`, () => {
  const clients = { host: game(25), guest: game(dex, true, 5) }, handlers = {}, sent = [];
  const members = [{ uid: 'host', name: 'Pikachu', dex: 25 }, { uid: 'guest', name: 'Guest', dex }];
  for (const [uid, c] of Object.entries(clients)) {
    const G = c.G;
    G.Net = { uid, on: fn => { handlers[uid] = fn; }, onPeer() {}, slow: () => false, busy: () => false,
      send(to, msg) { sent.push(msg); handlers[to](uid, msg); }, toHost(msg) { sent.push(msg); handlers.host(uid, msg); } };
    G.Sprites.Animator.prototype.update = () => {};
    G.Sprites.Animator.prototype.loop = () => {};
    G.Sprites.dirFromAngle = () => 0;
    G.baseStartOf = () => ''; G.Moves = { BY_ID: {} }; G.Judgment.netState = () => null;
    load(G, 'js/net/codec.js');
    load(G, 'js/net/coop.js', { document: { addEventListener() {} } });
    G.Coop.begin({ host: 'host', members }, c.p, {
      team: () => ({ time: 900, level: 1, xp: 0, xpNext: 80, kills: 0, bosses: 0, coins: 0, t1: 0, t10: 0 }),
      syncTeam() {}, choosing: () => false, hold() {}
    });
  }
  const { G, p } = clients.guest;
  assert.ok(G.Forms.queueReward(p)); assert.ok(G.Forms.claimReward(p, form)); G.Coop.tick(.1);
  const host = clients.host.G, mate = host.Coop.puppets()[0];
  mate.netUpdate(.1);
  assert.equal(mate.formId, form); assert.equal(mate.anim.dex, sprite);
  assert.equal(mate.megaStone, stone); assert.equal(mate.abilId, ability); assert.equal(mate.nature, p.nature);
  assert.equal(mate.prestige, 5); assert.equal(mate.mon.pa, p.mon.pa); assert.equal(mate.mon.sd, p.mon.sd);
  const oldAnim = mate.anim; G.Coop.tick(.1); mate.netUpdate(.1); assert.equal(mate.anim, oldAnim);
  host.Coop.tick(.1); const pikachu = G.Coop.puppets()[0]; pikachu.netUpdate(.1);
  assert.equal(pikachu.formId, 'pikachu'); assert.equal(pikachu.megaStone, null);
  for (const msg of sent) assert.deepEqual(G.NetCodec.decode(G.NetCodec.encode(msg)), msg);
});
}
