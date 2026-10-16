/* Optional integration check: npm install --no-save --package-lock=false playwright
 * node tests/i18n-browser.cjs [dev.html|index.html|en/index.html]
 * A fresh browser profile, disabled Firebase configuration, blocked external
 * requests and blocked service workers keep all test data local.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const entry = process.argv[2] || 'dev.html';
if (entry !== 'dev.html') { require('./i18n-production.cjs'); return; }
const out = process.env.I18N_TEST_OUTPUT || path.join(ROOT, 'test-results', 'i18n');
fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
(async () => {
  let browser;
  const checks = [], errors = [], blocked = [], snapshots = {};
  const check = (name, cond) => { assert.ok(cond, name); checks.push(name); console.log('PASS', name); };
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
    const context = await browser.newContext({ locale: 'zh-TW', viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      blocked.push(route.request().url()); return route.abort();
    });
    await context.addInitScript(() => {
      window.G = {};
      Object.defineProperty(window.G, 'FIREBASE_CONFIG', { get: () => null, set: () => {} });
    });
    // en/ intentionally wins over browser detection on a first visit.
    if (entry.startsWith('en/')) await context.addInitScript(() => {
      if (!localStorage.getItem('ps.lang')) localStorage.setItem('ps.lang', 'zh-Hant');
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const snap = async (name, screenshot = false) => {
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      snapshots[name] = await page.locator('body').innerText();
      fs.writeFileSync(path.join(out, 'snapshots.json'), JSON.stringify(snapshots, null, 2));
      if (screenshot) await page.screenshot({ path: path.join(out, name + '.png'), animations: 'disabled' });
    };
    const start = async () => {
      await page.waitForFunction(() => window.G && G.DB && document.getElementById('boot').classList.contains('hidden'));
      if (await page.locator('#tap-start').isVisible()) await page.locator('#tap-start').click();
    };
    await page.goto(origin + '/' + entry);
    await start();
    check('Traditional Chinese selected; database stays local', await page.evaluate(() => G.I18n.lang === 'zh-Hant' && G.DB.mode === 'local'));
    await snap('login', true);
    check('login translated', snapshots.login.includes('註冊帳號') && snapshots.login.includes('訪客'));
    await page.locator('#f-forgot').click(); await snap('forgot-password', true);
    check('password recovery help is fully translated', snapshots['forgot-password'].includes('若已連結 Gmail') && !snapshots['forgot-password'].includes('Si no lo'));
    await page.locator('[data-tab="register"]').click();
    await page.locator('#f-user').fill('LocaleTester');
    await page.locator('#f-pass').fill('local-test-only');
    await page.locator('#btn-auth').click();
    await page.locator('#test-a .answer').first().waitFor();
    await snap('personality');
    const n = await page.evaluate(() => G.PERSONALITY_TEST.length);
    for (let i = 0; i < n; i++) await page.locator('#test-a .answer').first().click();
    await snap('personality-result');
    await page.locator('#res-other').click();
    await snap('starters');
    await page.locator('#starter-grid .cell').filter({ hasText: '妙蛙種子' }).click();
    await page.locator('#starter-ok').click();
    await page.locator('#scr-menu').waitFor({ state: 'visible' });
    await snap('menu', true);
    check('partner displayed in Chinese, model ID unchanged', await page.evaluate(() => document.getElementById('menu-partner-name').textContent.includes('妙蛙種子') && G.DB.save.partner === 1 && G.DEX_BY[25].name === 'Pikachu'));
    for (const screen of ['dex', 'upgrades', 'gacha', 'goals']) {
      await page.locator(`[data-go="${screen}"]`).click();
      await snap(screen, screen === 'dex' || screen === 'upgrades');
      await page.locator('.scr:not(.hidden) [data-back]').first().click();
    }
    // The translated name can be searched without rewriting dex IDs or stored titles.
    await page.locator('[data-go="goals"]').click();
    await page.locator('#goals-tabs [data-tab="profile"]').click();
    await page.locator('.fav-slot').first().click();
    await page.locator('#fav-q').fill('妙蛙');
    check('favorite search accepts Chinese partial names', await page.locator('#fav-grid .cell').count() === 1);
    await page.locator('#fav-grid .cell').first().click();
    const title = await page.evaluate(() => {
      const a = G.AchDefs.LIST.find(a => a.title);
      G.DB.save.ach[a.id] = Date.now(); G.GoalsUI.render(); return a.title;
    });
    await page.locator('#goals-body select').selectOption(title);
    check('localized profile title keeps its original stored value', await page.evaluate(t => G.DB.save.profile.title === t, title));
    await page.locator('.scr:not(.hidden) [data-back]').first().click();
    // Render multiplayer leaderboard UI with local fixtures, never a backend call.
    await page.evaluate(() => {
      window.__socialOriginal = G.Social; window.__rankingOriginal = G.Ranking; window.__needOnline = G.SocialUI.needOnline;
      G.Social = { ...G.Social, me: { name: 'Pikachu' }, uid: 'viewer', started: true };
      G.SocialUI.needOnline = () => true;
      G.Ranking = { ...G.Ranking, isAdmin: () => false, board: () => 's_a', reported: () => new Set(), report: async () => { window.__reported = true; }, top: async (mode, period, dex) => {
        window.__rankingDex = dex;
        return [{ uids: ['fixture'], names: ['Pikachu'], dex: [25], shiny: [false], t: 120, lv: 20, kills: 12345 }];
      }, myRank: async () => ({ pos: 1, t: 120 }) };
      G.RankingUI.open();
    });
    await page.locator('#rk-poke').fill('皮卡丘'); await page.locator('#rk-poke').blur();
    await page.waitForFunction(() => window.__rankingDex === 25);
    await page.locator('#rk-list .rk-row').waitFor();
    await snap('ranking', true);
    check('Chinese leaderboard filter resolves the same dex ID', await page.evaluate(() => window.__rankingDex === 25));
    check('leaderboard preserves a nickname that matches a species', await page.locator('#rk-list .who b').textContent() === 'Pikachu');
    check('Chinese numeric formatting is used', snapshots.ranking.includes('12,345'));
    let reportDialog = '';
    page.once('dialog', async dialog => { reportDialog = dialog.message(); await dialog.accept(); });
    await page.locator('#rk-list .rk-rep').first().click();
    await page.waitForFunction(() => window.__reported === true);
    check('report confirmation is translated and preserves player nickname', reportDialog === '要檢舉 Pikachu 的紀錄涉嫌作弊嗎？' && await page.evaluate(() => window.__reported));
    await page.evaluate(() => {
      G.Ranking.isAdmin = () => true;
      G.Ranking.reports = async () => [{ board: 's_a', e: 'fixture', n: 2, names: ['Pikachu'], ids: ['local'], t: 2040 }];
      G.Ranking.entryInfo = async () => ({ t: 2040, dex: [25], shiny: [false], lv: 12, kills: 12345 });
      G.Ranking.markedAccounts = async () => [{ name: 'Pikachu', uid: 'Pikachu_123', coins: 12345, t1: 2, t10: 3, owned: 4 }];
      G.ModUI.open();
    });
    await page.locator('#mod-list .mod-row').waitFor(); await snap('moderation', true);
    check('moderation report labels and warning are translated', snapshots.moderation.includes('排行榜管理') && snapshots.moderation.includes('刪除紀錄') && snapshots.moderation.includes('超過 33 分鐘') && snapshots.moderation.includes('12,345'));
    await page.locator('#mod-tabs [data-tab="sus"]').click();
    await page.locator('#mod-list .mod-row').waitFor(); await snap('marked-accounts', true);
    check('banned account labels and details translate while nickname and UID stay intact', snapshots['marked-accounts'].includes('已封禁帳號') && snapshots['marked-accounts'].includes('解除封禁') && snapshots['marked-accounts'].includes('12,345 金幣 · 2 張普通券 · 3 張十連券 · 4 隻寶可夢 · Pikachu_123') && await page.locator('#mod-list b').textContent() === 'Pikachu');
    await page.locator('#mod-back').click();
    check('moderation back button closes its screen', !await page.locator('#scr-mod').isVisible());
    await page.evaluate(() => { G.Social = window.__socialOriginal; G.Ranking = window.__rankingOriginal; G.SocialUI.needOnline = window.__needOnline; G.Flow.goMenu(); });
    await page.evaluate(() => document.getElementById('scr-recover').classList.remove('hidden'));
    await snap('recovery-prompt', true);
    check('Gmail recovery prompt translated', snapshots['recovery-prompt'].includes('擔心失去帳號嗎？') && snapshots['recovery-prompt'].includes('所有進度都會保留'));
    await page.locator('#rec-later').click();
    // Render remaining mission/profile panels and a real local gacha draw.
    await page.locator('[data-go="goals"]').click();
    for (const tab of ['ach', 'profile']) {
      await page.locator(`#goals-tabs [data-tab="${tab}"]`).click(); await snap('goals-' + tab);
    }
    await page.locator('.scr:not(.hidden) [data-back]').first().click();
    await page.evaluate(() => { G.DB.save.tickets.t1 = 1; });
    await page.locator('[data-go="gacha"]').click();
    await page.locator('#pull-1').click();
    await page.locator('#pull-close').waitFor({ state: 'visible', timeout: 30000 });
    await snap('gacha-result', true);
    check('gacha displays a Chinese species name', /[\u3400-\u9fff]/.test(await page.locator('#pull-results b').first().textContent()));
    await page.locator('#pull-close').click();
    await page.locator('.scr:not(.hidden) [data-back]').first().click();
    await page.locator('#btn-news').click(); await snap('news', true);
    check('release notes translated', snapshots.news.includes('繁體中文') && !snapshots.news.includes('Todas las partidas'));
    await page.locator('#news-close').click();
    await page.locator('#btn-settings').click();
    for (const tab of ['sound', 'gfx', 'ctl', 'acc', 'about']) {
      const button = page.locator(`#set-tabs [data-t="${tab}"]`);
      if (await button.count()) await button.click();
      await snap('settings-' + tab, tab === 'gfx');
    }
    // Dynamic DOM and player-entered text share the real MutationObserver.
    const dom = await page.evaluate(async () => {
      const el = document.createElement('div');
      el.innerHTML = '<b translate="no">Pikachu</b><span>Pikachu</span><input placeholder="Nombre" title="Volver">';
      document.body.appendChild(el);
      await new Promise(r => requestAnimationFrame(r));
      const r = [el.children[0].textContent, el.children[1].textContent, el.children[2].placeholder, el.children[2].title];
      el.remove(); return r;
    });
    check('dynamic translations preserve nickname nodes and translate attributes', JSON.stringify(dom) === JSON.stringify(['Pikachu', '皮卡丘', '名稱', '返回']));
    check('ranking autocomplete includes Chinese names', await page.locator('#rk-dl option[value="皮卡丘"]').count() === 1);
    await page.locator('#set-tabs [data-t="gfx"]').click();
    const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('ps.save.'))));
    await page.locator('[data-lang="en"]').click(); await page.waitForLoadState('load'); await start();
    check('switch to English persists preference and save', await page.evaluate(() => G.I18n.lang === 'en' && G.DB.save.partner === 1));
    const after = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('ps.save.'))));
    check('language switch leaves saved progress byte-for-byte intact', JSON.stringify(before) === JSON.stringify(after));
    await snap('english');
    await page.locator('#btn-settings').click(); await page.locator('#set-tabs [data-t="gfx"]').click();
    await page.locator('[data-lang="es"]').click(); await page.waitForLoadState('load'); await start();
    check('switch to Spanish preserves original names', await page.evaluate(() => G.I18n.lang === 'es' && G.T('Volver') === 'Volver' && G.DB.save.partner === 1));
    await page.locator('#btn-settings').click(); await page.locator('#set-tabs [data-t="gfx"]').click();
    await page.locator('[data-lang="zh-Hant"]').click(); await page.waitForLoadState('load'); await start();
    await page.locator('[data-go="play"]').click();
    await page.waitForFunction(() => G.Game.state === 'playing');
    await snap('playing', true);
    await page.keyboard.press('Escape');
    await page.locator('#scr-pause').waitFor({ state: 'visible' });
    await snap('pause', true);
    check('run starts and pause is localized', snapshots.pause.includes('放棄本局'));
    // Synthetic progression exercises real card rendering without long grinding.
    await page.evaluate(() => {
      const p = G.Game.player;
      p.addMove('psychic');
      p.moves.find(m => m.id === 'psychic').lvl = 1;
      G.RunUI.showLevelUp(2, [{ type: 'new', title: G.T('Psíquico', 'move'), tag: 'Psíquico', color: '#f0a', icon: 'move:psychic', desc: G.Moves.BY_ID.psychic.desc }], () => G.UI.hide('scr-levelup'));
    });
    await snap('levelup', true);
    check('move and type remain distinct on the same card', snapshots.levelup.includes('精神強念') && snapshots.levelup.includes('超能力'));
    await page.locator('#cards .card').first().click();
    await page.evaluate(() => G.RunUI.showBond({ mode: 'pair', loose: [G.Moves.instance('psychic', 1), G.Moves.instance('tackle', 1)] }, () => G.UI.hide('scr-bond')));
    await snap('bond', true);
    await page.locator('#bond-cards .card').first().click();
    await snap('bond-step2');
    check('bond prompts and levels are translated', snapshots['bond-step2'].includes('精神強念') && !snapshots['bond-step2'].includes('Nv.'));
    await page.locator('#bond-cards .card').first().click();
    await page.evaluate(() => G.RunUI.showItemChoice('leftovers', 'focussash', () => G.UI.hide('scr-item')));
    await snap('item-choice', true);
    check('held item names use Chinese terminology', snapshots['item-choice'].includes('吃剩的東西') && snapshots['item-choice'].includes('氣勢披帶'));
    await page.locator('#item-cards .card').first().click();
    // Exercise the upstream debug entry in the dev build only, with no network.
    await page.evaluate(() => { G.Judgment.debugStart(); G.Judgment.cineTick(3); });
    await snap('judgment-title', true);
    check('Judgment event starts and translated title is available', await page.evaluate(() => G.Judgment.cinematic && G.T('LA SENTENCIA') === '神之審判' && G.T('DE ARCEUS') === '阿爾宙斯'));
    await page.evaluate(() => { G.Judgment.cineTick(8); });
    await snap('judgment-fight', true);
    check('Judgment arena and HUD localize', await page.evaluate(() => G.Judgment.active && !G.Judgment.cinematic && G.T('Ruinas del Juicio') === '審判遺跡' && G.T('SENTENCIA · 00:00 · JEFES 0') === '審判 · 00:00 · 首領 0'));
    await page.evaluate(() => G.RunUI.showPause(false));
    await page.locator('#btn-quit').click();
    await snap('result', true);
    await page.locator('#btn-again').click();
    await page.setViewportSize({ width: 844, height: 390 });
    await snap('mobile-menu', true);
    await page.locator('#btn-settings').click(); await page.locator('#set-tabs [data-t="gfx"]').click();
    await snap('mobile-settings', true);
    check('mobile language control remains reachable', await page.locator('[data-lang="zh-Hant"]').isVisible());
    await require('./i18n-layout.cjs')(page, check, name => snap(name, true));
    check('no page errors', errors.length === 0);
    check('no external service requests', blocked.length === 0);
    fs.writeFileSync(path.join(out, 'snapshots.json'), JSON.stringify(snapshots, null, 2));
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ entry, checks, errors, blocked }, null, 2));
    console.log(`${checks.length} integration checks passed (${entry}). Screenshots: ${out}`);
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
})();
