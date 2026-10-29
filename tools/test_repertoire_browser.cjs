/* Optional browser integration: npm install --prefix tools/cache/browser --no-save --package-lock=false playwright
 * node tools/test_mega_browser.cjs (installed Edge on Windows; PLAYWRIGHT_CHANNEL=chrome supported).
 * Uses an isolated browser profile, local guest save and explicit debug mode. No cloud traffic.
 */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('./cache/browser/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(__dirname, 'cache', 'repertoire-browser');
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
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const ctx=await browser.newContext({serviceWorkers:'block'}),url=`http://127.0.0.1:${server.address().port}`;
  await ctx.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/dev.html?debug=1');await page.waitForFunction(()=>window.G?.Game&&document.getElementById('boot').classList.contains('hidden'));
  await page.keyboard.press('Enter');
  await page.evaluate(()=>{G.DB.playAsGuest();G.DB.grant(4,'test');G.DB.save.partner=4;G.MenuUI.open();});
  await page.locator('[data-go=upgrades]').click();assert.equal(await page.locator('[data-repertoire]').count(),0);
  await page.evaluate(()=>{G.DB.upgradesOf(4).moves=1;G.DB.upgradesOf(4).start2=1;G.DB.save.pstart2[4]=G.startChoices(4).find(id=>id!==G.startMoveOf(4));G.MenuUI.open();});
  await page.locator('[data-go=upgrades]').click();assert.equal(await page.locator('[data-repertoire]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-repertoire]').click();assert.equal(await page.locator('[data-repertoire]').getAttribute('aria-pressed'),'false');
  await page.evaluate(()=>G.Game.startRun());assert.equal(await page.evaluate(()=>G.Game.player.moves.length),1);
  await page.evaluate(()=>{G.Game.toUI();G.MenuUI.open();});await page.locator('[data-go=upgrades]').click();
  await page.locator('[data-repertoire]').click();
  await page.screenshot({path:path.join(out,'toggle.png')});
  await page.evaluate(()=>G.Game.startRun());assert.equal(await page.evaluate(()=>G.Game.player.moves.length),2);
  assert.equal(await page.evaluate(()=>G.Game.player.hasMove(G.DB.save.pstart2[4])),true);
  assert.equal(await page.evaluate(()=>G.DB.upgradesOf(4).moves),1);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,offMoves:1,onMoves:2,selectedMovePreserved:true,errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
