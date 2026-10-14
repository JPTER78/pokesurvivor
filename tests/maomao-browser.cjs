const {chromium}=require(process.env.PLAYWRIGHT_MODULE || process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const server=require('node:child_process').spawn('python',['-m','http.server','8765','--bind','127.0.0.1'],{cwd:require('node:path').join(__dirname,'..'),stdio:['ignore','ignore','ignore']});
 process.on('exit',()=>server.kill());
 for(let i=0;i<50;i++){try{await fetch('http://127.0.0.1:8765/dev.html');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const viewport of [{width:1100,height:720},{width:844,height:390}]){
  const context=await browser.newContext({viewport,locale:'es-MX',serviceWorkers:'block',isMobile:viewport.width===844,hasTouch:viewport.width===844});
  const page=await context.newPage();const errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400 && r.url().includes('/10001/'))missing.push(r.url());});
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8765/dev.html?maomao=1');
  await page.waitForFunction(()=>window.G?.DB && document.getElementById('boot').classList.contains('hidden'));
  await page.waitForTimeout(150);
  if(await page.locator('#tap-start').isVisible()) await page.locator('#tap-start').click();
  await page.evaluate(()=>{
   G.DB.playAsGuest();G.DB.grant(1,'starter');G.DB.save.partner=1;
   G.Flow.goMenu();document.getElementById('tap-start').classList.add('hidden');
   window.beforeStorage=JSON.stringify({...localStorage});window.originalPartner=G.DB.save.partner;
   window.rankingCalls=[];G.Ranking.runStarted=()=>rankingCalls.push('start');G.Ranking.submitSolo=()=>rankingCalls.push('submit');
  });
  await page.locator('#btn-maomao-preview').click();
  await page.waitForFunction(()=>G.Game.state==='playing' && G.Game.player.dex===10001);
  await page.waitForTimeout(700);
  const info=await page.evaluate(async()=>{
   const p=G.Game.player;await G.Sprites.preload([p.dex]);
   const sheets=G.Sprites.ANIMS.map(a=>({name:a,ready:G.Sprites.sheet(p.dex,a).ready}));
   return {name:p.mon.name,types:p.mon.types,rarity:p.mon.rarity,start:p.moves[0].id,pool:G.Moves.poolFor(p.mon),sheets,
    inDex:G.DEX.some(m=>m.dex===10001),partner:G.DB.save.partner};
  });
  assert.equal(info.name,'Maomao');assert.deepEqual(info.types,['poison','grass']);assert.equal(info.rarity,5);
  assert.equal(info.start,'poison-sting');assert.equal(info.inDex,false);assert.equal(info.partner,1);
  assert.ok(info.sheets.every(s=>s.ready),'hojas ausentes '+JSON.stringify(info.sheets));
  if(viewport.width===1100){
   const x=await page.evaluate(()=>G.Game.player.x);await page.keyboard.down('d');await page.waitForTimeout(250);await page.keyboard.up('d');
   assert.ok(await page.evaluate(()=>G.Game.player.x)>x);
  }else{
   const x=await page.evaluate(()=>G.Game.player.x);const cdp=await context.newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:260,y:210}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:310,y:210}]});await page.waitForTimeout(250);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert.notEqual(await page.evaluate(()=>G.Game.player.x),x);
  }
  // Real automatic combat: stationary target nearby, no manually invoking the hit.
  const combat=await page.evaluate(()=>{
   G.EnemyMgr.clear();const p=G.Game.player;
   p.hp=p.maxHp;p.invuln=10;p.addMove('toxic');p.addMove('vine-whip');p.setActive(0);
   const e=new G.Enemy({dex:1,hp:5000,spd:0,dmg:0,xp:1,behavior:'chase'},p.x+70,p.y,{hp:1,spd:1,dmg:1});G.EnemyMgr.add(e);
   window.maoTarget=e;return {hp:e.hp};
  });
  await page.waitForTimeout(1800);
  assert.ok(await page.evaluate(()=>maoTarget.hp)<combat.hp,'ataque automatico no golpea');
  await page.evaluate(()=>{G.Game.player.setActive(1);});await page.waitForTimeout(350);
  await page.evaluate(()=>{G.Game.player.setActive(2);});await page.waitForTimeout(350);
  // Render all facing rows and all animations with real Sprite Animator.
  await page.evaluate(()=>{const p=G.Game.player;for(const a of G.Sprites.ANIMS)for(let d=0;d<8;d++){
   const c=document.createElement('canvas');c.width=160;c.height=160;const an=new G.Sprites.Animator(p.dex);an.dir=d;an.play(a);an.update(.1);an.draw(c.getContext('2d'),80,110);
  }});
  await page.screenshot({path:'/tmp/maomao-game-'+viewport.width+'.png'});
  await page.evaluate(()=>G.Game.quit());
  assert.deepEqual(await page.evaluate(()=>rankingCalls),[]);
  assert.equal(await page.evaluate(()=>G.DB.save.partner),1);
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})===beforeStorage),true,'prueba modifica guardado persistente');
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  console.log(JSON.stringify({viewport,info,combat:true,errors}));
  await context.close();
 }
 // Compiled release: follow the real guest UI without accessing internal G.
 const built=await browser.newContext({viewport:{width:1100,height:720},locale:'es-MX',serviceWorkers:'block'});
 const p=await built.newPage();const builtErrors=[];p.on('pageerror',e=>builtErrors.push(e.message));
 await p.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await p.goto('http://127.0.0.1:8765/?maomao=1');
 await p.locator('#tap-start').click();await p.locator('#btn-guest').click();
 for(let i=0;i<8;i++) await p.locator('#test-a button').first().click();
 await p.locator('#res-ok').click();await p.locator('#btn-maomao-preview').click();
 await p.waitForTimeout(1200);
 assert.equal(await p.evaluate(()=>window.G===undefined),true);
 assert.ok((await p.locator('body').innerText()).includes('Maomao'));
 assert.deepEqual(builtErrors,[]);console.log(JSON.stringify({compiledGuestFlow:true,errors:builtErrors}));
 await built.close();
 await browser.close(); server.kill();
})().catch(e=>{console.error(e);process.exit(1);});
