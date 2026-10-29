/* Optional browser integration: npm install --prefix tools/cache/browser --no-save --package-lock=false playwright
 * node tools/test_mega_browser.cjs (installed Edge on Windows; PLAYWRIGHT_CHANNEL=chrome supported).
 * Uses an isolated browser profile, local guest save and explicit debug mode. No cloud traffic.
 */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('./cache/browser/node_modules/playwright')); }
const root = path.resolve(__dirname, '..'), out = path.join(__dirname, 'cache', 'form-cinematic');
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
  const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:720}}),url=`http://127.0.0.1:${server.address().port}`;
  await ctx.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/dev.html?debug=1');await page.waitForFunction(()=>window.G?.Game&&document.getElementById('boot').classList.contains('hidden'));await page.keyboard.press('Enter');
  await page.evaluate(()=>G.DB.playAsGuest());
  for(const [dex,form,shiny,width,height] of [[448,'lucario-mega',false,1280,720],[646,'kyurem-black',true,1280,720],[646,'kyurem-black',true,390,740],[646,'kyurem-white',false,568,320]]){
   await page.setViewportSize({width,height});
   await page.evaluate(({dex,shiny})=>{G.DB.grant(dex,'test');if(shiny)G.DB.grantShiny(dex,'test');G.DB.save.partner=dex;G.DB.save.partnerShiny=shiny;G.Game.startRun();G.Game.player.equip('quickclaw');G.Forms.queueReward(G.Game.player);},{dex,shiny});
   await page.locator('#scr-mega:not(.hidden)').waitFor();await page.waitForFunction(()=>!document.getElementById('mega-cards').classList.contains('guard'));
   await page.locator(`[data-form="${form}"]`).click();
   await page.waitForFunction(()=>G.FormScene.stage==='transform');
   const before=await page.evaluate(()=>({time:G.Game.st.time,p:G.Game.player.formId,hp:G.Game.player.hp,cd:G.Game.player.moves[0].t}));
   assert.equal(await page.evaluate(()=>G.Game.state),'choice');
   const spriteBefore=await page.locator('.fc-sprites').boundingBox();
   const itemPlacement=await page.evaluate(()=>{
    const name=document.querySelector('.fc-content h2').getBoundingClientRect();
    const item=document.querySelector('.fc-item').getBoundingClientRect();
    const sprite=document.querySelector('.fc-sprites').getBoundingClientRect();
    return {nameBottom:name.bottom,itemTop:item.top,itemBottom:item.bottom,spriteTop:sprite.top};
   });
   assert.ok(itemPlacement.itemTop>=itemPlacement.nameBottom-1);
   assert.ok(itemPlacement.itemBottom<=itemPlacement.spriteTop+1);
   await page.screenshot({path:path.join(out,form+'-'+width+'-transform.png')});
   await page.waitForFunction(()=>G.FormScene.stage==='result');
   assert.equal(await page.evaluate(()=>G.Game.player.formId),form);
   assert.equal(await page.evaluate(()=>G.Game.st.time),before.time);
   assert.equal(await page.evaluate(()=>G.Game.player.moves[0].t),before.cd);
   assert.equal(await page.locator('.fc-stat').count(),6);
   assert.equal(await page.locator('.fc-item').evaluate(el=>getComputedStyle(el).opacity),'1');
   assert.equal(await page.locator('.fc-types .type').count(),await page.evaluate(()=>G.Game.player.mon.types.length));
   const spriteSize=await page.evaluate(()=>{
    const height=cv=>{
     const pixels=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
     let top=cv.height,bottom=0;
     for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++)if(pixels[(y*cv.width+x)*4+3]>8){top=Math.min(top,y);bottom=Math.max(bottom,y);}
     return bottom-top;
    };
    return {old:height(document.querySelector('.fc-old')),next:height(document.querySelector('.fc-new'))};
   });
   assert.ok(spriteSize.next>=spriteSize.old*.95,'new sprite should not appear smaller than base');
   const spriteAfter=await page.locator('.fc-sprites').boundingBox();
   for(const k of ['x','y','width','height'])assert.ok(Math.abs(spriteAfter[k]-spriteBefore[k])<1,`sprite moved: ${k}`);
   const bounds=await page.locator('.fc-continue').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=height);
   await page.screenshot({path:path.join(out,form+'-'+width+'-result.png')});
   await page.locator('.fc-continue').click();await page.waitForFunction(()=>!G.FormScene.active);
   assert.ok(['playing','levelup'].includes(await page.evaluate(()=>G.Game.state)));
  }
  // Cancellation cannot later claim a reward for a replacement Player.
  await page.evaluate(()=>{G.Game.startRun();G.Forms.queueReward(G.Game.player);});
  await page.locator('#scr-mega:not(.hidden)').waitFor();await page.waitForFunction(()=>!document.getElementById('mega-cards').classList.contains('guard'));await page.locator('#mega-claim').click();
  await page.evaluate(()=>{G.Game.startRun();for(let i=0;i<200;i++)G.FormScene.update(.05);});
  assert.equal(await page.locator('#form-cinematic').count(),0);assert.equal(await page.evaluate(()=>G.Game.player.formId),'kyurem');
  // Reduced motion avoids the alternating silhouette phase.
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>G.Forms.queueReward(G.Game.player));await page.locator('#scr-mega:not(.hidden)').waitFor();await page.waitForFunction(()=>!document.getElementById('mega-cards').classList.contains('guard'));await page.locator('#mega-claim').click();
  await page.waitForFunction(()=>G.FormScene.stage==='result');assert.equal(await page.evaluate(()=>G.Game.player.formId),'kyurem-black');
  await page.locator('.fc-continue').click();await page.waitForFunction(()=>!G.FormScene.active);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,forms:4,shiny:true,mobile:true,landscape:true,pausedClock:true,cancel:true,reducedMotion:true,errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
