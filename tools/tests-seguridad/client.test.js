const fs = require('fs'), vm = require('vm'), assert = require('assert');
const root = require('path').resolve(__dirname, '../..') + '/';
const store = {};
const ctx = { console, Intl, Date, Math, JSON, Map, Set, Promise, setTimeout, clearTimeout,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; } },
  firebase: { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } }, navigator: {}, document: {}, window: {} };
ctx.globalThis = ctx; vm.createContext(ctx);
const evil = '<img src=x onerror=alert(1)>';
const load = f => vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f });
vm.runInContext('var G = {};', ctx);
load('js/core/util.js');
vm.runInContext(`G.DB = { online: true, fb: { uid: 'u', fs: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ top: { evil: { t: '${evil}', uids: '${evil}', names: [{}, '${evil.repeat(5)}', 1, 2, 3, 4, 5], dex: ['${evil}', 25], shiny: 'x', lv: '${evil}', kills: '${evil}' } } }) }) , collection: null }) }) } } };`, ctx);
load('js/net/ranking.js');
(async () => {
  const U = ctx.G.U;
  assert.strictEqual(U.int('<b>'), 0); assert.strictEqual(U.int(NaN), 0); assert.strictEqual(U.int(Infinity), 0);
  assert.strictEqual(U.int(-5), 0); assert.strictEqual(U.int(7.9), 7); assert.strictEqual(U.int(1e99, 100), 100); assert.strictEqual(U.int('12'), 12);
  assert.strictEqual(U.num(12.5), 12.5); assert.strictEqual(U.num('x'), 0); assert.strictEqual(U.num(-1), 0);
  const row = await ctx.G.Ranking.entryInfo('s_x', 'evil');
  console.log('fila saneada:', JSON.stringify(row));
  assert.strictEqual(row.lv, 0); assert.strictEqual(row.kills, 0); assert.strictEqual(row.t, 0);
  assert.ok(Array.isArray(row.uids) && row.uids.length === 0);
  assert.ok(row.names.length === 4 && row.names.every(n => typeof n === 'string' && n.length <= 16));
  assert.strictEqual(JSON.stringify(row.dex), '[0,25]');
  // perfil
  vm.runInContext('G.DB.onLeave = () => {}; G.Coop = {}; G.Net = {}; G.UI = {}; G.AchDefs = { LIST: [] };', ctx);
  load('js/net/social.js');
  const p = ctx.G.Social.cleanProfile({ name: '' + evil + '', title: 5, favs: [null, { dex: '' + evil + '', shiny: 1 }, 'x', { dex: 25 }, { dex: 1 }],
    best: { solo: '' + evil + '', group: -4, level: '1e999', bosses: 3.9, legends: {}, kills: Infinity, medals: '7' }, medals: ['a', { x: 1 }, ...Array(20).fill('m')] });
  console.log('perfil saneado:', JSON.stringify(p));
  assert.strictEqual(p.title, ''); assert.strictEqual(p.favs.length, 1); assert.strictEqual(p.favs[0].dex, 0);
  assert.strictEqual(p.best.solo, 0); assert.strictEqual(p.best.group, 0); assert.strictEqual(p.best.level, 0); assert.strictEqual(p.best.bosses, 3);
  assert.strictEqual(p.best.legends, 0); assert.strictEqual(p.best.kills, 0); assert.strictEqual(p.best.medals, 7); assert.strictEqual(p.medals.length, 8);
  assert.strictEqual(ctx.G.Social.cleanProfile(null), null); assert.strictEqual(ctx.G.Social.cleanProfile('x'), null);
  console.log('OK client.test.js: util, fila del ranking y perfil saneados');
})().catch(e => { console.error('FALLO', e); process.exit(1); });
