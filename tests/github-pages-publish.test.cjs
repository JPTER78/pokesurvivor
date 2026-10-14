'use strict';
// Regresión de publicación GitHub Pages: el usuario juega en el SUBDIRECTORIO
// /pokesurvivor/, no en el dominio original ni en Pages de Cloudflare.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html');
const dev=read('dev.html');
const config=read('js/core/firebase-config.js');
const scripts=h=>[...h.matchAll(/<script defer src="(js\/[^"]+\.js)"\s*><\/script>/g)].map(m=>m[1]);

test('GitHub Pages carga las 74 versiones ACTUALES del juego, no el app.min antiguo',()=>{
 const src=scripts(dev),prod=scripts(html);
 assert.equal(prod.length,74);
 assert.deepEqual(prod,src);
 assert.ok(prod.includes('js/data/maomao-preview.js'));
 assert.ok(prod.includes('js/data/maomao-animation.js'));
 assert.ok(prod.includes('js/data/gift-codes.js'));
 assert.ok(prod.includes('js/ui/gifts-ui.js'));
 assert.equal(prod.at(-1),'js/main.js');
 for(const p of prod)assert.ok(fs.existsSync(path.join(root,p)),'Falta '+p);
 assert.doesNotMatch(html,/<script[^>]+src="js\/app\.min\.js/);
});

test('GitHub Pages utiliza la raíz /pokesurvivor/ sin reclamar dominio ajeno',()=>{
 assert.equal(fs.existsSync(path.join(root,'CNAME')),false);
 assert.match(html,/https:\/\/tiliko2803\.github\.io\/pokesurvivor\//);
 assert.doesNotMatch(html,/https:\/\/pokesurvivor\.com\//);
 assert.match(html,/name="ps-version"/);
 assert.match(html,/href="css\/style\.css\?v=tiliko-gh05"/);
});

test('Nube sólo en GitHub Pages de Tiliko, Cloudflare Tiliko y HTTPS',()=>{
 function conf(host,pathname,protocol='https:'){
  const ctx={G:{},location:{hostname:host,pathname,protocol}};
  vm.runInNewContext(config,ctx);
  return ctx.G.FIREBASE_CONFIG;
 }
 assert.equal(conf('tiliko2803.github.io','/pokesurvivor/').projectId,'pokesurvivor-tiliko');
 assert.equal(conf('tiliko2803.github.io','/pokesurvivor/index.html').projectId,'pokesurvivor-tiliko');
 assert.equal(conf('tiliko2803.github.io','/otro/'),null);
 assert.equal(conf('tiliko2803.github.io','/'),null);
 assert.equal(conf('tiliko2803.github.io','/pokesurvivor/','http:'),null);
 assert.equal(conf('jpter78.github.io','/pokesurvivor/'),null);
 assert.equal(conf('pokesurvivor.com','/'),null);
 assert.equal(conf('pokesurvivor-tiliko.pages.dev','/').projectId,'pokesurvivor-tiliko');
});

test('La versión publicada, la caché y el control de actualizaciones coinciden',()=>{
 const v=JSON.parse(read('version.json')).v;
 assert.equal(html.match(/name="ps-version" content="([^"]+)"/)[1],v);
 assert.match(read('sw.js'),/ps-code-v2-ghmaomao/);
 assert.match(read('js/core/updater.js'),/meta\[name="ps-version"\]/);
});

test('Mao Mao conserva poder Kyogre, regalo MAO25 y Picotazo Veneno',()=>{
 const mon=read('js/data/maomao-preview.js');
 assert.match(mon,/hp:\s*110,\s*spd:\s*112,\s*atk:\s*1\.52/);
 assert.match(mon,/start:\s*'poison-sting'/);
 assert.match(read('js/data/gift-codes.js'),/MAO25/);
 const tabs=read('js/ui/menu.js');
 assert.match(tabs,/Especial/);
});
