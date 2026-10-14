/* Optional browser integration checks, kept separate from dependency-free tests.
 * npm install --prefix tools/cache/qa --no-audit --no-fund playwright
 * node tools/cache/qa/node_modules/playwright/cli.js install chromium webkit
 * node tools/tests/browser-smoke.js
 */
const { chromium, webkit } = require('../cache/qa/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  let file = path.resolve(ROOT, '.' + pathname);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

async function geometry(page) {
  await page.waitForFunction(() => {
    const cv = document.getElementById('game'), r = cv.getBoundingClientRect();
    return Math.abs(r.width - visualViewport.width) < 1 && Math.abs(r.height - visualViewport.height) < 1 &&
      cv.width === Math.round(r.width * Math.min(1.5, devicePixelRatio)) && cv.height === Math.round(r.height * Math.min(1.5, devicePixelRatio));
  });
  const m = await page.evaluate(() => {
    const cv = document.getElementById('game'), r = cv.getBoundingClientRect();
    const overlay = document.getElementById('scr-settings').getBoundingClientRect();
    return { width: r.width, height: r.height, bw: cv.width, bh: cv.height, vw: visualViewport.width, vh: visualViewport.height,
      overlay: { x: overlay.x, y: overlay.y, width: overlay.width, height: overlay.height }, x: r.x, y: r.y };
  });
  assert.ok(Math.abs(m.width - m.vw) < 1 && Math.abs(m.height - m.vh) < 1, JSON.stringify(m));
  return m;
}

async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.2', resolve));
  // Loopback address outside the game's cloud allowlist: all QA saves are local.
  const base = 'http://127.0.0.2:' + server.address().port;
  const results = [];
  try {
    for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
      const browser = await engine.launch({ headless: true });
      try {
        for (const mobile of [false, true]) {
          const context = await browser.newContext({ viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 720 },
            deviceScaleFactor: mobile ? 3 : 1, hasTouch: mobile, ...(name === 'webkit' ? { isMobile: mobile } : {}) });
          const page = await context.newPage(), errors = [];
          page.on('pageerror', e => errors.push(e.message));
          await page.goto(base + '/dev.html');
          await page.waitForFunction(() => window.G && G.Viewport.size && document.getElementById('boot').classList.contains('hidden'));
          // Set up a local guest, then exercise the real UI/game/HUD.
          await page.evaluate(() => {
            document.getElementById('tap-start').click();
            G.DB.playAsGuest(); G.DB.save.partner = 7; G.DB.grant(7); G.Flow.goMenu();
          });
          await page.locator('[data-go="settings"]').click();
          await page.waitForTimeout(250);
          const m = await geometry(page);
          assert.deepEqual(m.overlay, { x: m.x, y: m.y, width: m.width, height: m.height });
          await page.locator('#set-close').click();
          await page.locator('[data-go="play"]').click();
          await page.waitForFunction(() => G.Game.state === 'playing');
          await page.evaluate(() => {
            const pl = G.Game.player;
            for (const id of G.Moves.poolFor(pl.mon)) { if (pl.slots.filter(s => s.length).length >= 4) break; if (!pl.hasMove(id)) pl.addMove(id); }
          });
          await page.waitForTimeout(100);
          // Centers come from shared layout; the pointer is dispatched at its actual visual position.
          if (mobile) {
            const p = await page.evaluate(() => { const s = G.Viewport.size, b = G.ControlLayout.pause(s.width, s.height, s.safe, null); return { x: b.x + 20, y: b.y + 20 }; });
            await page.touchscreen.tap(p.x, p.y);
          } else await page.keyboard.press('Escape');
          await page.waitForFunction(() => G.Game.state === 'paused');
          await page.locator('#btn-resume').click();
          if (mobile) {
            await page.evaluate(() => {
              const cv = document.getElementById('game'), r = cv.getBoundingClientRect();
              const touch = (type, id, x, y) => {
                // Windows WebKit has no constructible Touch; inject the event
                // payload to test our handlers. The pause tap above is native.
                const t = { identifier: id, target: cv, clientX: r.left + x, clientY: r.top + y };
                const e = new Event(type, { bubbles: true, cancelable: true });
                Object.defineProperty(e, 'changedTouches', { value: [t] });
                cv.dispatchEvent(e);
              };
              touch('touchstart', 10, 150, 150);
              touch('touchmove', 10, 175, 165);
              if (G.Touch.stick.x !== 175 || G.Touch.stick.y !== 165 || G.Touch.stick.ox !== 150) throw Error('Joystick drift');
              const s = G.Viewport.size, b = G.ControlLayout.bar(s.width, s.height, s.safe, null, G.Game.player.maxMoves);
              touch('touchstart', 11, b.attackX + 63 + 27, b.y + 27);
              if (G.Game.player.active !== 1 || !G.Touch.stick) throw Error('Multitouch attack failed');
              touch('touchend', 11, b.attackX + 90, b.y + 27);
              touch('touchend', 10, 175, 165);
              G.Settings.set('stickMode', 'fixed');
              const f = G.Touch.stickBase(); touch('touchstart', 12, f.x, f.y);
              if (!G.Touch.stick.fixed || G.Touch.stick.ox !== f.x) throw Error('Fixed stick drift');
              touch('touchend', 12, f.x, f.y);
            });
          }
          // Editor uses the same app rectangle; drag, save, then return to gameplay.
          await page.evaluate(() => { G.Game.togglePause(); G.SettingsUI.open(); G.LayoutUI.open(); });
          await page.waitForTimeout(250);
          const pause = page.locator('.lay-pause'), box = await pause.boundingBox();
          await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
          await page.mouse.move(box.x - 80, box.y + 60); await page.mouse.up();
          if (mobile) {
            const before = await pause.boundingBox();
            await page.setViewportSize({ width: 390, height: 844 }); await geometry(page);
            await page.setViewportSize({ width: 844, height: 390 }); await geometry(page);
            const after = await pause.boundingBox();
            assert.ok(Math.abs(before.x - after.x) < 1 && Math.abs(before.y - after.y) < 1, 'Unsaved editor position moved after rotation');
          }
          await page.locator('#lay-save').click();
          assert.ok(await page.evaluate(() => !!G.Settings.get('pad').pause));
          await page.locator('#set-close').click();
          await page.locator('#btn-resume').click();
          if (mobile) {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.waitForFunction(() => !document.getElementById('rotate').classList.contains('hidden'));
            await geometry(page);
            await page.setViewportSize({ width: 844, height: 390 });
            await page.waitForFunction(() => document.getElementById('rotate').classList.contains('hidden'));
          } else await page.setViewportSize({ width: 960, height: 540 });
          await geometry(page);
          await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); document.dispatchEvent(new Event('visibilitychange')); });
          await page.waitForTimeout(500);
          await geometry(page);
          await page.screenshot({ path: path.join(ROOT, 'tools/cache/qa/' + name + (mobile ? '-mobile' : '-desktop') + '.png') });
          assert.deepEqual(errors, []);
          results.push(name + (mobile ? ' mobile' : ' desktop') + ': gameplay, pause, editor, resize/restore OK');
          console.log(results.at(-1));
          await context.close();
        }
        // Real production bundle, normal UI onboarding and service worker.
        const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 3 });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(base + '/');
        await page.waitForFunction(() => document.getElementById('boot').classList.contains('hidden'));
        await page.waitForTimeout(100);
        if (await page.locator('#tap-start').isVisible()) await page.locator('#tap-start').click();
        await page.locator('#btn-guest').click();
        for (let i = 0; i < 20 && !(await page.locator('#scr-result').isVisible()); i++) {
          await page.locator('.answer').first().click(); await page.waitForTimeout(30);
        }
        await page.locator('#res-ok').click();
        await page.locator('[data-go="play"]').click();
        await page.waitForTimeout(300);
        await geometry(page);
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
        assert.deepEqual(errors, []);
        results.push(name + ' production bundle: onboarding, gameplay, DPR, service worker OK');
        console.log(results.at(-1));
        await context.close();
      } finally { await browser.close(); }
    }
    console.log('All ' + results.length + ' browser scenarios passed.');
  } finally { server.close(); }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
