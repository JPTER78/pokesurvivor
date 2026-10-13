/* Real file:// and offline-font checks using an isolated browser profile. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname,'..');
(async()=>{
  const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
  try {
    const context = await browser.newContext({locale:'en-US',serviceWorkers:'block'});
    const external=[], errors=[];
    await context.route('http**://**/*',route=>{external.push(route.request().url());return route.abort();});
    await context.addInitScript(()=>{
      window.G={};Object.defineProperty(window.G,'FIREBASE_CONFIG',{get:()=>null,set:()=>{}});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(ROOT,'index.html')).href);
    await page.waitForFunction(()=>window.G&&G.Flow&&document.getElementById('boot').classList.contains('hidden'));
    assert.equal(await page.evaluate(()=>G.I18n.lang),'en');
    await page.goto(pathToFileURL(path.join(ROOT,'zh/index.html')).href);
    await page.waitForFunction(()=>window.G&&G.Flow&&document.getElementById('boot').classList.contains('hidden'));
    assert.equal(await page.evaluate(()=>G.I18n.lang),'zh-CN');
    const count=await page.evaluate(async()=> (await document.fonts.load('16px PSChinese','妙蛙种子')).length);
    assert.ok(count>0,'font loads from file://');
    assert.equal(await page.evaluate(()=>G.I18n.pageUrl('guide')),'zh/guide/index.html');
    await page.goto(pathToFileURL(path.join(ROOT,'zh/guide/index.html')).href);
    assert.match(await page.locator('h1').textContent(),/游戏攻略/);
    assert.equal(errors.length,0,errors.join('\n'));
    assert.equal(external.length,0,external.join('\n'));
    fs.mkdirSync(path.join(ROOT,'test-results'),{recursive:true});
    fs.writeFileSync(path.join(ROOT,'test-results/offline.json'),JSON.stringify({checks:6,errors,external},null,2),'utf8');
    console.log('PASS: file:// upstream defaults, explicit Chinese entry, local fonts, help link, guide, zero external requests');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
