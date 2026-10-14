'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const cfg=fs.readFileSync(path.join(root,'js/core/firebase-config.js'),'utf8');
const mon=fs.readFileSync(path.join(root,'js/data/maomao-preview.js'),'utf8');
const html=fs.readFileSync(path.join(root,'dev.html'),'utf8');
const hostname='pokesurvivor-tiliko-maomao-cloud-test.pages.dev';
function boot(host,protocol='https:'){
  const ctx={G:{},location:{hostname:host,protocol}};
  vm.runInNewContext(cfg,ctx);
  return ctx.G.FIREBASE_CONFIG;
}
test('Sólo el dominio exacto, vía HTTPS, activa el Firebase de Tiliko',()=>{
  const a=boot(hostname);
  assert.equal(a.projectId,'pokesurvivor-tiliko');
  assert.equal(a.authDomain,'pokesurvivor-tiliko.firebaseapp.com');
  assert.equal(a.databaseURL.includes('tiliko'),true);
  for(const host of ['pokesurvivor-tiliko-import-test.pages.dev','pokesurvivor-free.pages.dev','localhost',
       'other.'+hostname,'pokesurvivor-tiliko-maomao-anim-test.pages.dev'])
    assert.equal(boot(host),null,'No debe abrir Firebase desde '+host);
  assert.equal(boot(hostname,'http:'),null);
});
test('V0.4 contiene login Google, regalos, animaciones y poder 1.35',()=>{
  assert.match(html,/id="btn-google"/);
  assert.match(html,/data-go="gifts"/);
  assert.match(html,/js\/data\/maomao-animation\.js/);
  assert.match(html,/js\/ui\/gifts-ui\.js/);
  assert.match(html,/Mao Mao V0\.4/);
  assert.match(mon,/atk:\s*1\.35/);
  assert.match(mon,/start:\s*'poison-sting'/);
  assert.doesNotMatch(cfg,/pokesurvivor-free/);
});
