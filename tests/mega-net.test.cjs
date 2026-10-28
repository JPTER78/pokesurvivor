const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game, load } = require('./mega-fixtures.cjs');

test('real Coop frames carry each player form/stone and apply it through Player.netUpdate', () => {
  const clients = { host: game(25), guest: game(448) }, handlers = {}, sent = [];
  const members = [{ uid: 'host', name: 'Pikachu', dex: 25 }, { uid: 'guest', name: 'Lucario', dex: 448 }];
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
  assert.ok(G.Forms.awardMega(p)); G.Coop.tick(.1);
  const host = clients.host.G, mate = host.Coop.puppets()[0];
  mate.netUpdate(.1);
  assert.equal(mate.formId, 'lucario-mega'); assert.equal(mate.anim.dex, '448-mega');
  assert.equal(mate.megaStone, 'lucarionite'); assert.equal(mate.abilId, 'adaptability'); assert.equal(mate.nature, p.nature);
  const oldAnim = mate.anim; G.Coop.tick(.1); mate.netUpdate(.1); assert.equal(mate.anim, oldAnim);
  host.Coop.tick(.1); const pikachu = G.Coop.puppets()[0]; pikachu.netUpdate(.1);
  assert.equal(pikachu.formId, 'pikachu'); assert.equal(pikachu.megaStone, null);
  for (const msg of sent) assert.deepEqual(G.NetCodec.decode(G.NetCodec.encode(msg)), msg);
});
