/* Tests the shipped, obfuscated bundle through DOM and local saves only.
 * Run: node tests/i18n-production.cjs [index.html|en/index.html]
 * Firebase SDK requests are aborted; the real DB falls back to local mode.
 * No game globals are exposed and no production account/service is used.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const entry = process.argv[2] || 'index.html';
assert.ok(['index.html', 'en/index.html'].includes(entry));
const out = process.env.I18N_TEST_OUTPUT || path.join(ROOT, 'test-results', 'i18n-production');
fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(data);
  });
});
(async () => {
  let browser;
  const checks = [], errors = [], blocked = [];
  const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
    const context = await browser.newContext({ locale: 'zh-TW', viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      blocked.push(route.request().url()); return route.abort();
    });
    if (entry.startsWith('en/')) await context.addInitScript(() => {
      if (!localStorage.getItem('ps.lang')) localStorage.setItem('ps.lang', 'zh-Hant');
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const start = async () => {
      await page.waitForFunction(() => document.getElementById('boot').classList.contains('hidden'));
      if (await page.locator('#tap-start').isVisible()) await page.locator('#tap-start').click();
    };
    const snap = name => page.screenshot({ path: path.join(out, name + '.png'), animations: 'disabled' });
    const saves = () => page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('ps.save.'))));
    const waitText = async (selector, text) => page.waitForFunction(([sel, value]) => document.querySelector(sel)?.textContent.includes(value), [selector, text]);
    await page.goto(origin + '/' + entry); await start();
    check('production bundle keeps G private', await page.evaluate(() => typeof window.G === 'undefined'));
    check('Traditional Chinese selected', await page.locator('html').getAttribute('lang') === 'zh-Hant');
    await waitText('#login-mode', '只會儲存在此瀏覽器');
    check('blocked Firebase falls back to local storage', (await page.locator('#login-mode').textContent()).includes('無法連上雲端'));
    await page.locator('#f-forgot').click(); await waitText('#forgot-note', '若已連結 Gmail');
    check('recovery instructions translated', !(await page.locator('#forgot-note').textContent()).includes('Si no lo'));
    await snap('recovery');
    await page.locator('[data-tab="register"]').click();
    await page.locator('#f-user').fill('ProductionTest'); await page.locator('#f-pass').fill('local-test-only');
    await page.locator('#btn-auth').click(); await page.locator('#test-a .answer').first().waitFor();
    let answers = 0;
    while (await page.locator('#test-a .answer').first().isVisible()) {
      assert.ok(++answers < 40, 'personality quiz finishes');
      await page.locator('#test-a .answer').first().click();
    }
    await page.locator('#res-other').click();
    await page.locator('#starter-grid .cell').filter({ hasText: '妙蛙種子' }).click();
    await page.locator('#starter-ok').click(); await page.locator('#scr-menu').waitFor({ state: 'visible' });
    await waitText('#menu-partner-name', '妙蛙種子');
    check('local registration and Chinese starter selection work', (await page.locator('#menu-partner-name').textContent()).includes('妙蛙種子'));
    await snap('menu');
    await page.locator('[data-go="goals"]').click(); await page.locator('#goals-tabs [data-tab="ach"]').click();
    await page.locator('#goals-body .chip').filter({ hasText: '生存' }).click();
    await waitText('#goals-body', '神之審判');
    check('new Judgment achievements translated', (await page.locator('#goals-body').textContent()).includes('挑戰神明'));
    await page.locator('#goals-tabs [data-tab="profile"]').click(); await page.locator('.fav-slot').first().click();
    await page.locator('#fav-q').fill('妙蛙');
    check('Chinese species search works in protected build', await page.locator('#fav-grid .cell').count() === 1);
    await page.locator('#fav-grid .cell').first().click();
    await page.locator('.scr:not(.hidden) [data-back]').first().click();
    await page.locator('#btn-news').click(); await waitText('#news-body', '阿爾宙斯');
    check('new release notes translated', (await page.locator('#news-body').textContent()).includes('Gmail'));
    await page.locator('#news-close').click();
    const before = await saves();
    for (const [lang, name] of [['en', 'Bulbasaur'], ['es', 'Bulbasaur'], ['zh-Hant', '妙蛙種子']]) {
      await page.locator('#btn-settings').click(); await page.locator('#set-tabs [data-t="gfx"]').click();
      await page.locator(`[data-lang="${lang}"]`).click(); await page.waitForLoadState('load'); await start();
      await waitText('#menu-partner-name', name);
      check('switch language to ' + lang, await page.locator('html').getAttribute('lang') === lang);
    }
    check('language switching preserves saved progress byte-for-byte', JSON.stringify(before) === JSON.stringify(await saves()));
    await page.locator('[data-go="play"]').click(); await page.locator('#scr-menu').waitFor({ state: 'hidden' });
    await page.keyboard.press('Escape'); await page.locator('#scr-pause').waitFor({ state: 'visible' });
    await waitText('#scr-pause', '放棄本局'); await snap('pause');
    check('protected game starts and pause is translated', (await page.locator('#scr-pause').textContent()).includes('放棄本局'));
    await page.locator('#btn-quit').click(); await page.locator('#btn-again').waitFor({ state: 'visible' });
    check('run result is translated', /[\u3400-\u9fff]/.test(await page.locator('#btn-again').textContent()));
    await page.locator('#btn-again').click();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator('#btn-settings').click(); await page.locator('#set-tabs [data-t="gfx"]').click();
    await snap('mobile-settings');
    check('mobile language switch remains reachable', await page.locator('[data-lang="zh-Hant"]').isVisible());
    await require('./i18n-layout.cjs')(page, check, name => snap(name, true));
    check('G remains private throughout', await page.evaluate(() => typeof window.G === 'undefined'));
    check('no JavaScript page errors', errors.length === 0);
    check('only expected Firebase SDK loads attempted and blocked', blocked.length > 0 && blocked.every(u => /^https:\/\/www\.gstatic\.com\/firebasejs\/[^/]+\/firebase-app-compat\.js$/.test(u)));
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ entry, checks, errors, blocked }, null, 2));
    console.log(`${checks.length} protected production checks passed (${entry}).`);
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})();
