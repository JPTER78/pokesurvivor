const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game, load } = require('./mega-fixtures.cjs');

test('threshold crossings produce three independent rifts exactly once, including large time jumps', () => {
  const { G, p } = game();
  G.EnemyMgr.bossAlive = () => true;
  G.Rift.update(.1, p, 899); assert.ok(G.Rift.schedule.every(e => e.status === 'waiting'));
  G.Rift.update(.2, p, 1501); assert.deepEqual(G.Rift.schedule.map(e => e.status), ['queued', 'queued', 'queued']);
  G.EnemyMgr.bossAlive = () => false;
  for (const at of [900, 1200, 1500]) {
    G.Rift.update(.1, p, 1502); assert.equal(G.Rift.rift.eventAt, at); assert.equal(G.Rift.rift.kind, 'mega');
    assert.ok(G.Rift.rift.ttl > 59);
    G.Rift.update(61, p, 1563);
  }
  assert.deepEqual(G.Rift.schedule.map(e => e.status), ['expired', 'expired', 'expired']);
  G.Rift.update(0, p, 899); G.Rift.update(0, p, 1501); assert.equal(G.Rift.rift, null);
  G.Rift.reset(); assert.ok(G.Rift.schedule.every(e => e.status === 'waiting'));
});

test('placement failure retries without consuming an event and takes precedence over normal spawns', () => {
  const { G, p } = game(); G.World.isFree = () => false;
  G.Rift.update(.1, p, 901); assert.equal(G.Rift.rift, null); assert.equal(G.Rift.schedule[0].status, 'queued');
  G.World.isFree = () => true; G.Rift.update(1.1, p, 902);
  assert.equal(G.Rift.rift.kind, 'mega'); assert.equal(G.Rift.schedule[0].status, 'spawned');
});

test('existing normal portals and busy arenas queue rather than lose scheduled enhanced rifts', () => {
  const { G, p } = game(); G.Rift.debugOpen(); assert.equal(G.Rift.rift.kind, 'normal'); assert.equal(G.Rift.rift.ttl, 45);
  G.Rift.update(.1, p, 901); assert.equal(G.Rift.schedule[0].status, 'queued');
  p.x = G.Rift.rift.x; p.y = G.Rift.rift.y - 10; G.Rift.update(.1, p, 902);
  assert.equal(G.Rift.arena.kind, 'normal');
  G.Rift.update(.1, p, 1201); assert.equal(G.Rift.schedule[1].status, 'queued');
  const id = G.Rift.arena.id;
  G.Rift.onEvent(['aw', id]); assert.equal(p.bonds, 1); assert.equal(p.megaStone, null);
  G.Rift.update(6, p, 1207); assert.equal(G.Rift.inArena, false);
  G.Rift.update(.1, p, 1208); assert.equal(G.Rift.rift.eventAt, 900);
});

test('enhanced boss scaling composes with time and co-op scaling, preserving normal bosses', () => {
  const a = game(), b = game();
  // Fix selection/randomness so the same legendary is compared.
  const original = Math.random; Math.random = () => .5;
  try {
    for (const c of [a, b]) c.G.Game.everyone = () => [c.p, { dead: false, x: 0, y: 0 }];
    a.G.Rift.debugArena(); b.G.Rift.debugMegaArena();
    const normal = [...a.enemies.values()][0].def, mega = [...b.enemies.values()][0].def;
    assert.equal(mega.hp, Math.round(9_000_000 * 1.3 * 1.4));
    assert.equal(normal.hp, Math.round((3200 + 900 * 9) * 1.3 * 1.4));
    for (const [key, k] of [['dmg', 1.5], ['shotDmg', 1.5], ['spd', 1.1]]) assert.equal(mega[key], normal[key] * k, key);
    assert.equal(mega.attackFrequency, 1.2); assert.equal(mega.shotCd, normal.shotCd / 1.2);
    assert.equal(b.G.Rift.timeLeft, 120); assert.ok(normal.hp > 3200 + 900 * 9);
  } finally { Math.random = original; }
});

test('all three Mega Rift encounters have 9 million solo HP, even when entered late', () => {
  for (const at of [900, 1200, 1500]) {
    const { G, p, enemies } = game();
    for (const earlier of [900, 1200, 1500].filter(t => t < at)) {
      G.Rift.update(.1, p, earlier);
      G.Rift.update(61, p, earlier + 61);
    }
    G.Rift.update(.1, p, at);
    assert.equal(G.Rift.rift.eventAt, at);
    G.Game.st.time = at + 30;
    p.x = G.Rift.rift.x; p.y = G.Rift.rift.y - 10;
    G.Rift.update(.1, p, at + 30);
    const boss = enemies.get(G.Rift.arena.bossId);
    assert.equal(boss.maxHp, 9_000_000);
    // A sustained 300k hit per second survives 29s and wins at 30s.
    for (let second = 0; second < 29; second++) boss.hurt(300_000);
    G.Rift.update(29, p, at + 59);
    assert.equal(G.Rift.arena.phase, 'fight'); assert.equal(p.pendingMegaForm, null);
    boss.hurt(300_000); G.Rift.update(1, p, at + 60);
    assert.equal(G.Rift.arena.phase, 'won'); assert.equal(p.pendingMegaForm, 'lucario-mega');
  }
});

test('victory is idempotent, duplicates/stale resolutions cannot reward a later arena', () => {
  const { G, p } = game(); G.Rift.debugMegaArena(); const id = G.Rift.arena.id;
  G.Rift.onEvent(['aw', id]); assert.equal(p.megaStone, null); assert.equal(p.pendingMegaForm, 'lucario-mega');
  G.Rift.onEvent(['aw', id]); assert.equal(p.bonds, 0); assert.ok(G.Forms.claimMega(p)); assert.equal(p.megaStone, 'lucarionite'); assert.equal(p.formId, 'lucario-mega'); assert.equal(p.bonds, 0);
  G.Rift.onEvent(['aw', id]); assert.equal(p.bonds, 0);
  G.Rift.update(6, p, 906); G.Rift.debugMegaArena();
  G.Rift.onEvent(['aw', id]); assert.equal(p.bonds, 0); assert.equal(G.Rift.arena.phase, 'fight');
  G.Rift.onEvent(['aw', G.Rift.arena.id]); assert.equal(p.bonds, 1);
});

test('ineligible players get Bond; failure gives no stone and later thresholds remain available', () => {
  const a = game(25); a.G.Rift.debugMegaArena(); a.G.Rift.onEvent(['aw', a.G.Rift.arena.id]);
  assert.equal(a.p.bonds, 1); assert.equal(a.p.megaStone, null);
  const { G, p } = game(); G.Rift.update(.1, p, 901);
  p.x = G.Rift.rift.x; p.y = G.Rift.rift.y - 10; G.Rift.update(.1, p, 902);
  G.Rift.update(121, p, 1023); assert.equal(G.Rift.arena.phase, 'lost');
  G.Rift.update(2, p, 1025); assert.equal(p.megaStone, null); assert.equal(p.bonds, 0);
  assert.equal(G.Rift.schedule[0].status, 'lost');
  G.Rift.update(.1, p, 1201); assert.equal(G.Rift.rift.eventAt, 1200);
});

test('host alone schedules and resolves a shared encounter, each client receives its own reward', () => {
  const host = game(), guest = game(25);
  host.G.Coop.active = guest.G.Coop.active = true; host.G.Coop.isHost = true;
  host.G.Coop.broadcast = ev => guest.G.Rift.onEvent(ev);
  guest.G.Rift.update(.1, guest.p, 1501); assert.equal(guest.G.Rift.rift, null);
  assert.ok(guest.G.Rift.schedule.every(e => e.status === 'waiting'));
  host.G.Rift.update(.1, host.p, 901);
  assert.equal(guest.G.Rift.rift.kind, 'mega'); assert.equal(guest.G.Rift.rift.id, host.G.Rift.rift.id);
  host.p.x = host.G.Rift.rift.x; host.p.y = host.G.Rift.rift.y - 10;
  host.G.Rift.update(.1, host.p, 902); assert.equal(guest.G.Rift.arena.kind, 'mega'); assert.equal(guest.enemies.size, 0);
  guest.G.Rift.update(200, guest.p, 1102); assert.equal(guest.G.Rift.arena.phase, 'fight');
  host.G.Rift.debugWin(); host.G.Rift.update(.1, host.p, 903);
  assert.equal(host.p.megaStone, null); assert.equal(host.p.pendingMegaForm, 'lucario-mega');
  assert.ok(host.G.Forms.claimMega(host.p)); assert.equal(host.p.megaStone, 'lucarionite'); assert.equal(guest.p.bonds, 1);
  guest.G.Rift.onEvent(['aw', guest.G.Rift.arena.id]); assert.equal(guest.p.bonds, 1);
});

test('red portal is generated once per frame variant with a distinct pixel palette', () => {
  const { G } = game(); const canvases = [];
  const document = { createElement: () => {
    const cv = { getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: data => { cv.data = data.data; } }) };
    canvases.push(cv); return cv;
  } };
  load(G, 'js/world/tiles.js', { document });
  for (let i = 0; i < 4; i++) {
    const red = G.Tiles.propSprite(0, 'megaRift', i), purple = G.Tiles.propSprite(0, 'rift', i);
    assert.equal(G.Tiles.propSprite(0, 'megaRift', i), red);
    assert.notDeepEqual(red.data, purple.data);
    let redPixels = 0;
    for (let j = 0; j < red.data.length; j += 4) if (red.data[j + 3] && red.data[j] > red.data[j + 2]) redPixels++;
    assert.ok(redPixels > 100);
  }
});

test('HUD and mobile layout reserve a separate passive slot within safe-area bounds', () => {
  const { G } = game(); load(G, 'js/ui/hotbar.js');
  for (const w of [280, 320, 375, 667, 844, 1280]) for (const spot of [null, [0, 0], [1, 1], [.5, .9]]) {
    const safe = { left: 16, right: 16, bottom: 24, top: 10 };
    const b = G.Hotbar.layout(w, 390, 4, true, safe, spot);
    assert.ok(b.x >= 22); assert.ok(b.megaX >= b.sx + b.totalW);
    assert.ok(b.megaX + b.size <= w - 22); assert.ok(b.y + b.size <= 390 - 30);
  }
});

test('new progression-changing debug hooks are absent outside explicit development', () => {
  const { G } = game(448, false);
  assert.equal(G.Forms.debugMegaEvolve, undefined); assert.equal(G.Rift.debugOpenMega, undefined);
  assert.equal(G.Rift.debugMegaArena, undefined); assert.equal(G.Rift.debugWin, undefined);
  for (const [hostname, search, built, expected] of [['localhost', '?debug=1', false, true], ['localhost', '', false, false],
    ['pokesurvivor.com', '?debug=1', false, false], ['localhost', '?debug=1', true, false]]) {
    const H = { BUILT: built }; load(H, 'js/core/dev.js', { location: { hostname, search } }); assert.equal(H.Dev.enabled, expected);
  }
});

test('Judgment cannot restart the schedule or erase queued encounters at the end of the world', () => {
  const { G, p } = game();
  G.Rift.update(.1, p, 1501); assert.equal(G.Rift.pendingMega, true);
  G.Rift.update(61, p, 1562); G.Rift.update(.1, p, 1563); G.Rift.update(61, p, 1624);
  G.Rift.update(.1, p, 1625); G.Rift.update(61, p, 1686);
  assert.equal(G.Rift.pendingMega, false);
  const schedule = G.Rift.schedule;
  G.Judgment.active = true; G.Rift.closeWorld(); G.Rift.update(1, p, 1801);
  assert.equal(G.Rift.rift, null); assert.deepEqual(G.Rift.schedule, schedule);
});
