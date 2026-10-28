/* Optional browser integration: npm install --prefix tools/cache/browser --no-save --package-lock=false playwright
 * node tools/test_mega_browser.cjs (installed Edge on Windows; PLAYWRIGHT_CHANNEL=chrome supported).
 * Uses an isolated browser profile, local guest save and explicit debug mode. No cloud traffic.
 */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('./cache/browser/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(__dirname, 'cache', 'mega-browser');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(data);
  });
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true, serviceWorkers: 'block' });
    const url = `http://127.0.0.1:${server.address().port}`;
    await ctx.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
    await page.goto(url + '/dev.html?debug=1');
    await page.waitForFunction(() => window.G?.Game && G.DB && document.getElementById('boot').classList.contains('hidden'));
    await page.keyboard.press('Enter');
    await page.evaluate(() => {
      G.DB.playAsGuest(); G.DB.grant(448, 'test'); G.DB.save.partner = 448;
      G.Game.startRun(); G.Game.togglePause(); G.UI.hideAll();
    });
    await page.evaluate(() => G.Forms.preload(G.Game.player));
    assert.equal(await page.evaluate(() => G.Game.player.formId), 'lucario');
    // Collection eligibility badge is visible for both owned and unowned entries.
    await page.evaluate(() => { G.Game.toUI(); G.MenuUI.open(); });
    assert.ok(await page.locator('#menu-partner-info .mega-badge').count());
    await page.evaluate(() => G.MenuUI.openDex());
    await page.locator('#dex-q').fill('448'); // Number search also finds unowned Pokémon.
    await page.waitForFunction(() => document.querySelector('#dex-grid .cell b')?.textContent === 'Lucario');
    assert.equal(await page.locator('#dex-grid .cell .mega-badge').count(), 1);
    await page.locator('#dex-grid .cell').first().click();
    assert.equal(await page.locator('#dex-detail .mega-badge').count(), 1);
    await page.screenshot({ path: path.join(out, 'mega-collection.png') });
    const centering = await page.evaluate(() => [...document.querySelectorAll('#dex-grid .mon-rarity, #dex-detail .mon-rarity')].map(row => {
      const r = row.getBoundingClientRect(), a = row.firstElementChild.getBoundingClientRect(), b = row.lastElementChild.getBoundingClientRect();
      return Math.abs((a.left + b.right) / 2 - (r.left + r.right) / 2);
    }));
    assert.ok(centering.every(offset => offset < 1), 'rarity and bracelet are centered together');
    await page.locator('#dex-detail .mega-badge').hover();
    await page.locator('#mega-tip:not(.hidden)').waitFor();
    assert.equal(await page.locator('#mega-tip p').textContent(), 'Lucario can evolve into Mega Lucario by finding Lucarionite during a run.');
    await page.screenshot({ path: path.join(out, 'mega-tooltip.png') });
    // Future forms use the same template, pulling names directly from the registry.
    await page.evaluate(() => {
      const f = G.Forms.get('lucario-mega'); window.tooltipFormNames = [f.name, f.stoneName];
      f.name = 'Mega Test'; f.stoneName = 'Test Stone'; document.querySelector('#dex-detail .mega-badge').click();
    });
    assert.match(await page.locator('#mega-tip p').textContent(), /Mega Test by finding Test Stone/);
    await page.evaluate(() => {
      const f = G.Forms.get('lucario-mega'); [f.name, f.stoneName] = tooltipFormNames;
      document.querySelector('#dex-detail .mega-badge').focus();
    });
    assert.equal(await page.locator('#dex-detail .mega-badge').getAttribute('aria-describedby'), 'mega-tip');
    await page.keyboard.press('Escape');
    await page.locator('#mega-tip.hidden').waitFor({ state: 'attached' });
    assert.equal(await page.evaluate(() => G.UI.isOpen('scr-dex')), true);
    await page.mouse.move(0, 0);

    await page.evaluate(() => { delete G.DB.save.owned[448]; G.MenuUI.openDex(); });
    assert.equal(await page.locator('#dex-grid .cell .mega-badge').count(), 1);
    await page.locator('#dex-grid .cell').first().click();
    assert.equal(await page.locator('#dex-detail .mega-badge').count(), 1);
    await page.screenshot({ path: path.join(out, 'mega-collection-unowned.png') });
    await page.setViewportSize({ width: 568, height: 320 });
    await page.locator('#dex-detail .mega-badge').tap();
    await page.locator('#mega-tip:not(.hidden)').waitFor();
    const tipBounds = await page.locator('#mega-tip').boundingBox();
    assert.ok(tipBounds.x >= 0 && tipBounds.y >= 0 && tipBounds.x + tipBounds.width <= 568 && tipBounds.y + tipBounds.height <= 320);
    await page.screenshot({ path: path.join(out, 'mega-tooltip-mobile.png') });
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.evaluate(() => G.DB.grant(448, 'test'));
    await page.evaluate(() => { G.Game.startRun(); G.Game.togglePause(); G.UI.hideAll(); });
    await page.evaluate(() => {
      const p = G.Game.player;
      for (const id of G.Moves.poolFor(p.mon)) { if (p.slots.length >= 4) break; p.addMove(id); }
      p.equip('quickclaw'); p.addMaxHp(40); p.hp = p.maxHp * .4; p.addBuff('spd', .1, 8, 5);
      p.level = 12; p.xp = 123; p.coins = 77; p.invuln = 999;
      G.Rift.debugOpenMega();
      const r = G.Rift.rift; p.x = r.x - 120; p.y = r.y + 25;
      G.Camera.x = p.x; G.Camera.y = p.y; G.Rift.update(.5, p, G.Game.st.time);
    });
    await page.screenshot({ path: path.join(out, 'enhanced-rift.png') });
    await page.evaluate(() => {
      const p = G.Game.player, r = G.Rift.rift;
      p.x = r.x; p.y = r.y - 10;
      G.Rift.update(.01, p, G.Game.st.time);
      window.beforeMega = { p, moves: p.moves, slots: p.slots, buffs: p.buffs, nature: p.nature, level: p.level, xp: p.xp,
        xpNext: p.xpNext, item: p.item, cd: p.cdMul, coins: p.coins, ratio: p.hp / p.maxHp, t: p.moves[0].t };
      G.Rift.debugWin(); G.Rift.update(.01, p, G.Game.st.time);
    });
    assert.equal(await page.evaluate(() => G.Game.player.megaStone), null);
    assert.equal(await page.evaluate(() => G.Game.player.formId), 'lucario');
    await page.evaluate(() => G.Game.togglePause());
    await page.locator('#scr-mega:not(.hidden)').waitFor();
    await page.waitForFunction(() => !document.getElementById('mega-cards').classList.contains('guard'));
    await page.locator('#mega-art img').evaluate(img => img.decode());
    assert.equal(await page.evaluate(() => G.Game.state), 'choice');
    await page.screenshot({ path: path.join(out, 'mega-reward.png') });
    await page.setViewportSize({ width: 568, height: 320 });
    await page.screenshot({ path: path.join(out, 'mega-reward-mobile.png') });
    await page.setViewportSize({ width: 1280, height: 720 });
    // Claim and pause in the same task so combat cannot alter the preservation snapshot.
    await page.evaluate(() => {
      document.getElementById('mega-claim').click();
      if (G.Game.state !== 'playing') throw Error('claim did not resume run');
      G.Game.togglePause(); G.UI.hideAll();
    });
    const result = await page.evaluate(() => {
      const p = G.Game.player, b = window.beforeMega;
      return { identity: b.p === p, moves: b.moves === p.moves, slots: b.slots === p.slots, buffs: b.buffs === p.buffs,
        state: ['nature', 'level', 'xp', 'xpNext', 'item', 'coins'].every(k => p[k] === b[k]),
        cooldown: b.cd === p.cdMul && b.t === p.moves[0].t, hp: Math.abs(b.ratio - p.hp / p.maxHp) < 1e-9,
        form: p.formId, stone: p.megaStone, ability: p.abilId, sprite: p.anim.dex };
    });
    assert.deepEqual(result, { identity: true, moves: true, slots: true, buffs: true, state: true, cooldown: true, hp: true,
      form: 'lucario-mega', stone: 'lucarionite', ability: 'adaptability', sprite: '448-mega' });
    await page.evaluate(async () => {
      const p = G.Game.player; await G.Sprites.preload([p.spriteKey], 8000, p.shiny);
      const stone = new Image(); stone.src = G.Icons.url(p.megaStone); await stone.decode();
      G.Rift.update(6, p, G.Game.st.time); G.Camera.x = p.x; G.Camera.y = p.y;
      G.Game.flash('#fff', 0); G.FX.clear(); p.invuln = 0;
    });
    // Let a rendered frame catch up; no simulation runs while paused.
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: path.join(out, 'mega-lucario.png') });
    await page.setViewportSize({ width: 568, height: 320 });
    await page.evaluate(() => { G.Settings.set('pad', { bar: [.99, .99] }); });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: path.join(out, 'mega-mobile.png') });
    // Move selection still uses four slots; the stone cannot consume touch input.
    await page.evaluate(() => { G.Game.togglePause(); G.Game.player.invuln = 999; G.EnemyMgr.clear(); });
    const button = await page.evaluate(() => {
      const p = G.Game.player, b = G.Hotbar.layout(innerWidth, innerHeight, p.slots.length, true, G.Touch.safeArea(), G.Touch.spot('bar'), p.maxMoves);
      return { x: b.sx + b.size + b.gap + b.size / 2, y: b.y + b.size / 2 };
    });
    await page.touchscreen.tap(button.x, button.y);
    await page.waitForFunction(() => G.Game.player.active === 1);
    await page.keyboard.press('4'); await page.waitForFunction(() => G.Game.player.active === 3);
    await page.evaluate(() => {
      const pad = { id: 'Test standard gamepad', connected: true, axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
      G.Pad.poll(.016); pad.buttons[5] = { pressed: true, value: 1 }; G.Pad.poll(.016);
      pad.buttons[5] = { pressed: false, value: 0 };
    });
    await page.waitForFunction(() => G.Game.player.active === 0);
    await page.evaluate(() => { Object.defineProperty(navigator, 'getGamepads', { value: () => [] }); G.Game.togglePause(); G.UI.hideAll(); });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => G.LayoutUI.open());
    await page.screenshot({ path: path.join(out, 'mega-layout.png') });
    await page.evaluate(() => {
      G.LayoutUI.close(); G.Game.startRun();
      if (G.Game.player.formId !== 'lucario' || G.Game.player.megaStone) throw Error('new run retained Mega state');
      G.Game.togglePause(); G.UI.hideAll(); G.Game.debugSetTime(899); G.Game.togglePause();
      G.Game.player.invuln = 999;
    });
    await page.waitForFunction(() => G.Rift.schedule[0].status !== 'waiting', null, { timeout: 15000 }).catch(async e => { console.log(await page.evaluate(() => ({ state: G.Game.state, time: G.Game.st.time, schedule: G.Rift.schedule })), errors); throw e; });
    await page.evaluate(() => {
      G.Game.togglePause(); G.DB.save.partner = 25; G.Game.startRun(); G.Game.togglePause(); G.UI.hideAll();
      G.Rift.debugMegaArena(); G.Rift.debugWin(); G.Rift.update(.01, G.Game.player, G.Game.st.time);
      if (G.Game.player.megaStone || G.Game.player.bonds !== 1) throw Error('Pikachu fallback failed');
      G.Rift.update(6, G.Game.player, G.Game.st.time);
    });
    // A level-up takes priority; the pending stone survives it and needs an explicit tap.
    await page.evaluate(() => {
      G.DB.save.partner = 448; G.Game.startRun(); G.Rift.debugMegaArena(); G.Rift.debugWin();
      G.Rift.update(.01, G.Game.player, G.Game.st.time); G.Pickups.clear(); G.Game.debugLevelUp();
    });
    await page.locator('#scr-levelup:not(.hidden)').waitFor();
    assert.equal(await page.evaluate(() => G.UI.isOpen('scr-mega')), false);
    assert.equal(await page.evaluate(() => G.Game.player.formId), 'lucario');
    await page.waitForFunction(() => !document.getElementById('cards').classList.contains('guard'));
    await page.evaluate(() => G.RunUI.pick(0));
    await page.locator('#scr-mega:not(.hidden)').waitFor();
    await page.waitForFunction(() => !document.getElementById('mega-cards').classList.contains('guard'));
    await page.locator('#mega-claim').tap();
    await page.waitForFunction(() => G.Game.player.formId === 'lucario-mega');
    // Leaving an unclaimed reward for a new run cannot transform the new player.
    await page.evaluate(() => { G.Game.startRun(); G.Forms.queueMega(G.Game.player); });
    await page.locator('#scr-mega:not(.hidden)').waitFor();
    await page.evaluate(() => {
      const old = document.getElementById('mega-claim');
      G.Game.startRun(); old.click();
      if (G.Game.player.pendingMegaForm || G.Game.player.formId !== 'lucario') throw Error('stale reward leaked into a fresh run');
      G.Game.togglePause(); G.UI.hideAll();
    });
    // Real Game choice flow with a simulated co-op transport: interrupt a reward
    // with a level-up, queue an item behind it, and wait for a teammate afterward.
    await page.evaluate(() => {
      window.originalCoop = G.Coop; window.rewardHolds = { start: 0, end: 0 };
      G.Coop = Object.assign({}, G.Coop, {
        active: true, isHost: false, members: [], tick() {}, puppets: () => [], players: () => [G.Game.player],
        begin(cfg, p, api) { window.rewardApi = api; },
        holdStart() { rewardHolds.start++; }, holdEnd() { rewardHolds.end++; },
        localPicked() { rewardApi.resume(); }
      });
      G.Game.startRun({ seed: 123, hw: false }); G.Game.player.equip('quickclaw');
      G.Forms.queueMega(G.Game.player);
    });
    await page.locator('#scr-mega:not(.hidden)').waitFor();
    await page.evaluate(() => rewardApi.levelStart(2));
    await page.locator('#scr-levelup:not(.hidden)').waitFor();
    assert.equal(await page.evaluate(() => G.UI.isOpen('scr-mega')), false);
    await page.waitForFunction(() => !document.getElementById('cards').classList.contains('guard'));
    await page.evaluate(() => G.RunUI.pick(0));
    await page.locator('#scr-mega:not(.hidden)').waitFor();
    await page.evaluate(() => { rewardApi.hold(['Friend']); rewardApi.item('leftovers'); });
    assert.equal(await page.evaluate(() => G.UI.isOpen('scr-item')), false);
    await page.waitForFunction(() => !document.getElementById('mega-cards').classList.contains('guard'));
    await page.locator('#mega-claim').tap();
    await page.locator('#scr-item:not(.hidden)').waitFor();
    await page.waitForFunction(() => !document.getElementById('item-cards').classList.contains('guard'));
    await page.locator('#item-cards .card').nth(1).tap();
    await page.waitForFunction(() => G.Game.state === 'held');
    assert.deepEqual(await page.evaluate(() => rewardHolds), { start: 3, end: 3 });
    assert.equal(await page.evaluate(() => G.Game.player.megaStone), 'lucarionite');
    await page.evaluate(() => {
      rewardApi.hold([]);
      if (G.Game.state !== 'playing') throw Error('co-op remained paused after all choices');
      G.Coop = originalCoop; G.Game.startRun(); G.Game.togglePause(); G.UI.hideAll();
    });
    assert.equal(await page.evaluate(() => G.DB.commit()), false);
    assert.equal(await page.evaluate(() => G.DB.online), false);
    // Production build must keep G private even with the test flag.
    const prod = await ctx.newPage();
    prod.on('pageerror', e => errors.push('production: ' + e.message));
    await prod.goto(url + '/index.html?debug=1');
    await prod.waitForFunction(() => document.getElementById('boot').classList.contains('hidden'));
    assert.equal(await prod.evaluate(() => typeof window.G), 'undefined');
    await prod.keyboard.press('Enter');
    await prod.locator('#btn-guest').waitFor({ state: 'visible' });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ result, errors, screenshots: 10 }, null, 2));
    console.log('Browser integration passed: portal → arena → victory → Mega → new run; Pikachu fallback; mobile; production privacy.');
    console.log(out);
  } finally { await browser.close(); server.close(); }
})().catch(err => { console.error(err); server.close(); process.exitCode = 1; });
