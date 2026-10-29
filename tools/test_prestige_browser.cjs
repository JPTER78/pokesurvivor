/* Optional browser integration: npm install --prefix tools/cache/browser --no-save --package-lock=false playwright
 * node tools/test_mega_browser.cjs (installed Edge on Windows; PLAYWRIGHT_CHANNEL=chrome supported).
 * Uses an isolated browser profile, local guest save and explicit debug mode. No cloud traffic.
 */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('./cache/browser/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(__dirname, 'cache', 'prestige-browser');
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
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
 try {
  const ctx=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'});
  const url=`http://127.0.0.1:${server.address().port}`;
  await ctx.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/dev.html?debug=1');
  await page.waitForFunction(()=>window.G?.Game && document.getElementById('boot').classList.contains('hidden'));
  await page.keyboard.press('Enter');
  await page.evaluate(()=>{G.DB.playAsGuest();G.DB.grant(646,'test');G.DB.save.partner=646;G.DB.save.pnat[646]=['hardy',1];G.Game.toUI();G.MenuUI.open();});
  await page.locator('[data-go=upgrades]').click();
  assert.equal(await page.locator('[data-prestige]').isDisabled(),true);
  const max=async()=>{await page.evaluate(()=>{for(const u of G.Upgrades.LIST)G.DB.upgradesOf(646)[u.id]=u.max;G.MenuUI.open();});await page.locator('[data-go=upgrades]').click();};
  await max();await page.locator('[data-prestige]').click();
  assert.match(await page.locator('#prestige-confirm').innerText(),/All your upgrades will be reset to 0/);
  await page.screenshot({path:path.join(out,'confirmation.png')});
  await page.keyboard.press('Escape');assert.equal(await page.locator('#prestige-confirm').count(),0);
  assert.equal(await page.evaluate(()=>G.DB.prestigeOf(646)),0);
  for(let level=1;level<=5;level++){
   if(level>1)await max();
   await page.locator('[data-prestige]').click();
   if(level===5){await page.setViewportSize({width:390,height:640});await page.screenshot({path:path.join(out,'mobile-confirmation.png')});}
   await page.locator('#prestige-confirm [data-confirm]').click();
   assert.equal(await page.evaluate(()=>G.DB.prestigeOf(646)),level);
   assert.equal(await page.evaluate(()=>Object.keys(G.DB.upgradesOf(646)).length),0);
   assert.equal(await page.locator('[data-prestige]').isDisabled(),true);
   assert.equal(await page.evaluate(()=>G.DB.ownsShiny(646)),level===5);
   assert.equal(await page.locator('#prestige-shiny').count(),level===5?1:0);
   if(level===5){
    assert.match(await page.locator('#prestige-shiny').innerText(),/Shiny form unlocked!/);
    assert.equal(await page.locator('#prestige-shiny canvas').count(),1);
    await page.screenshot({path:path.join(out,'shiny-unlocked.png')});
    await page.locator('#prestige-shiny [data-dismiss]').click();
    assert.equal(await page.locator('#prestige-shiny').count(),0);
   }
  }
  assert.match(await page.locator('.prestige-panel').innerText(),/12.5/);
  await page.screenshot({path:path.join(out,'prestige-five.png')});
  await page.evaluate(()=>G.MenuUI.open());assert.match(await page.locator('#menu-partner-info').innerText(),/Prestige 5\/5/);
  await page.evaluate(()=>G.Game.startRun());
  assert.equal(await page.evaluate(()=>G.Game.player.maxHp),Math.round(126*1.125));
  assert.equal(await page.evaluate(()=>G.Game.player.mon.pa),1.42*1.125);
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>{
    G.Game.toUI();const dex=G.DEX.find(m=>m.rarity===3).dex;
    G.DB.grant(dex,'test');G.DB.save.partner=dex;G.DB.save.prestige[dex]=4;
    for(const u of G.Upgrades.LIST)G.DB.upgradesOf(dex)[u.id]=u.max;
    G.MenuUI.open();
  });
  await page.locator('[data-go=upgrades]').click();
  assert.match(await page.locator('.prestige-panel').innerText(),/20%/);
  await page.locator('[data-prestige]').click();
  assert.match(await page.locator('#prestige-confirm').innerText(),/adds 5%.*up to 25%/);
  await page.locator('#prestige-confirm [data-cancel]').click();
  const production=await ctx.newPage();
  production.on('pageerror',e=>errors.push(e.message));
  await production.goto(url+'/index.html');
  await production.waitForFunction(()=>document.getElementById('boot').classList.contains('hidden'));
  assert.equal(await production.evaluate(()=>typeof window.G),'undefined');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,levels:5,cancel:true,shiny:true,errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
