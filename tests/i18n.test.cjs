/* Run with node --test tests/i18n.test.cjs; no npm dependencies. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
function context({ saved = 'zh-CN', nav = 'en-US', pathname = '/', storageThrows = false } = {}) {
  const calls = [], dict = {}, contexts = {};
  const storage = { 'ps.lang': saved };
  class Canvas {
    constructor() { this.font = '700 16px Pixelify,sans-serif'; }
    fillText(s, ...args) { calls.push(['fillText', s, this.font, ...args]); }
    strokeText(s, ...args) { calls.push(['strokeText', s, this.font, ...args]); }
    measureText(s) { calls.push(['measureText', s, this.font]); return { width: s.length * 8 }; }
  }
  const ctx = { G: {}, Map, Set, console, navigator: { language: nav, languages: [nav] },
    localStorage: { getItem(k) { if (storageThrows) throw Error('blocked'); return storage[k]; }, setItem(k, v) { storage[k] = v; } },
    location: { pathname, reload() { calls.push(['reload']); } },
    document: { documentElement: {}, querySelectorAll: () => [] },
    CanvasRenderingContext2D: Canvas, alert: s => calls.push(['alert', s]), confirm: s => (calls.push(['confirm', s]), true) };
  ctx.window = ctx;
  vm.createContext(ctx);
  const load = file => vm.runInContext(source(file), ctx, { filename: file });
  load('js/core/i18n.js');
  const add = ctx.G.I18n.add;
  ctx.G.I18n.add = (d, lang = 'en', scope = '') => {
    if (scope) contexts[scope] = { ...contexts[scope], ...d };
    else dict[lang] = { ...dict[lang], ...d };
    add(d, lang, scope);
  };
  for (const f of ['lang-en', 'lang-zh-cn', 'lang-zh-cn-names']) load(`js/data/${f}.js`);
  return { ...ctx, ctx, calls, dict, contexts, storage, load, Canvas };
}
test('bootstrap and runtime choose the same supported language', () => {
  const cases = [
    [null, 'zh-CN', '/', 'en'], [null, 'zh-HK', '/', 'en'], [null, 'zh-MO', '/', 'en'],
    [null, 'zh-CN-TW', '/', 'en'], [null, 'zh-Hans-TW', '/', 'en'],
    [null, 'es-MX', '/', 'es'], [null, 'es-ES', '/', 'es'], [null, 'en-US', '/', 'en'],
    [null, 'ja-JP', '/', 'en'], [null, 'es-ES', '/en/index.html', 'en'],
    [null, 'en-US', '/zh/index.html', 'zh-CN'],
    ['zh-CN', 'en-US', '/en/index.html', 'zh-CN'], ['es', 'zh-CN', '/', 'es'],
    ['en', 'zh-CN', '/', 'en'], ['en', 'zh-CN', '/zh/index.html', 'en'],
    ['invalid', 'zh-CN', '/', 'en'], ['invalid', 'es-MX', '/', 'es']
  ];
  const boot = [...source('dev.html').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes("localStorage.getItem('ps.lang')"));
  const contact = [...source('contacto/index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes("localStorage.getItem('ps.lang')"));
  for (const [saved, nav, pathname, want] of cases) {
    const c = context({ saved, nav, pathname });
    assert.equal(c.G.I18n.lang, want);
    const paras = [{}, {}]; c.document.querySelectorAll = () => paras;
    vm.runInContext(boot, c.ctx);
    assert.equal(c.document.documentElement.lang, want);
    if (want === 'zh-CN') assert.equal(paras[1].textContent, '加载中…');
    let redirect = null;
    c.location.replace = url => { redirect = url; };
    vm.runInContext(contact, c.ctx);
    assert.equal(c.document.documentElement.lang, want);
    assert.equal(redirect, want === 'zh-CN' ? '../zh/contact/index.html' : null);
  }
  for (const [nav, pathname, want] of [['zh-CN', '/', 'en'], ['es-MX', '/', 'es'], ['en-US', '/zh/', 'zh-CN']]) {
    const c = context({ storageThrows: true, nav, pathname });
    c.document.querySelectorAll = () => [{}, {}];
    c.location.replace = () => {};
    assert.equal(c.G.I18n.lang, want);
    vm.runInContext(boot, c.ctx);
    assert.equal(c.document.documentElement.lang, want);
    vm.runInContext(contact, c.ctx);
    assert.equal(c.document.documentElement.lang, want);
  }
});
test('all English keys have Chinese counterparts and preserve placeholders', () => {
  const { dict } = context();
  const zh = Object.fromEntries(Object.entries(dict['zh-CN']).map(([k,v]) => [k.replaceAll('{name}', '{x}'), v.replaceAll('{name}', '{x}')]));
  for (const [key, value] of Object.entries(dict.en)) {
    assert.ok(zh[key], `Missing: ${key}`);
    assert.equal((zh[key].match(/\{x\}/g) || []).length, (key.match(/\{x\}/g) || []).length, key);
  }
});
test('all species, moves, evolutions, items and release notes are translated', () => {
  const c = context();
  c.load('js/core/util.js');
  for (const f of ['pokedex', 'moves', 'items', 'changelog']) c.load(`js/data/${f}.js`);
  const T = c.G.T, han = /\p{Script=Han}/u;
  assert.equal(c.G.DEX.length, 966);
  for (const p of c.G.DEX) assert.ok(han.test(T(p.name)), p.name);
  for (const m of Object.values(c.G.Moves.BY_ID)) {
    assert.ok(han.test(T(m.name, 'move')), m.name);
    assert.ok(han.test(T(m.desc)), m.desc);
    const evo = c.G.Moves.evoInfo(c.G.Moves.instance(m.id, m.maxLvl), {});
    if (evo) assert.ok(han.test(T(evo.name, 'move')), evo.name);
  }
  for (const i of c.G.Items.LIST) assert.ok(han.test(T(i.name)) && han.test(T(i.desc)), i.name);
  for (const n of c.G.CHANGELOG) for (const pair of [n.title, ...(n.new || []), ...(n.chg || []), ...(n.fix || [])]) assert.ok(han.test(T(pair[0])), pair[0]);
  assert.equal(c.G.DEX_BY[25].name, 'Pikachu'); // translation never mutates the model
  assert.equal(T(c.G.DEX_BY[983].name), '仆刀将军');
});
test('type and move homonyms use separate translations', () => {
  const { G } = context();
  assert.equal(G.T('Psíquico'), '超能力');
  assert.equal(G.T('Psíquico', 'move'), '精神强念');
  assert.equal(G.I18n.term('type', 'Normal'), '一般');
  assert.equal(G.I18n.term('form', 'Normal'), '普通');
  assert.equal(G.I18n.term('pokemon', 233), '多边兽2型');
  assert.equal(G.I18n.term('pokemon', 312), '负电拍拍');
  assert.equal(G.T('Mejora'), '强化');
  assert.equal(G.T('Diario'), '每日');
  assert.equal(G.T('Niebla'), '迷雾');
  assert.equal(G.T('Tormenta Floral', 'move'), '落英缤纷');
  assert.equal(G.T('Hierba Lazo', 'move'), '打草结');
});
test('exact, uppercase, whitespace, dynamic and fragment translations', () => {
  const { G } = context();
  assert.equal(G.T('  Volver  '), '  返回  ');
  assert.equal(G.T('VOLVER'), '返回');
  assert.equal(G.T('¡Nivel 12!'), '升到 12 级！');
  assert.equal(G.T('¡Has conseguido a Pikachu shiny!'), '获得异色 皮卡丘！');
  assert.equal(G.T('Derrota a 25 Pokémon de tipo Fuego'), '击败 25 只火属性宝可梦');
  assert.equal(G.T('Pikachu + Bulbasaur'), '皮卡丘 + 妙蛙种子');
  assert.equal(G.T('2026'), '2026');
  assert.equal(G.T('¡Pikachu necesita ayuda! · 8 m'), 'Pikachu 需要救援！· 8 米');
  assert.equal(G.T('Tu apodo es Pikachu'), '你的昵称是 Pikachu');
  assert.equal(G.T('¿Reportar la marca de Pikachu, Agua como trampa?'), '要举报 Pikachu, Agua 的成绩涉嫌作弊吗？');
  assert.equal(G.T('Unknown untranslated text'), 'Unknown untranslated text');
});
test('Spanish and English behavior is preserved and dictionaries cannot cross-contaminate', () => {
  const es = context({ saved: 'es' }).G, en = context({ saved: 'en' }).G;
  assert.equal(es.T('Volver'), 'Volver');
  assert.equal(es.T('Psíquico', 'move'), 'Psíquico');
  assert.equal(en.T('Volver'), 'Back');
  assert.equal(en.T('¡Nivel 12!'), 'Level 12!');
  assert.equal(en.T('Pikachu'), 'Pikachu');
  assert.equal(en.T('Psíquico', 'move'), 'Psychic');
});
test('Canvas uses matching measurement, CJK fonts, and preserves player names', () => {
  const c = context(), ctx = new c.Canvas(), font = ctx.font;
  ctx.fillText('Pikachu', 1, 2); ctx.measureText('Pikachu');
  assert.equal(c.calls[0][1], '皮卡丘'); assert.equal(c.calls[1][1], '皮卡丘');
  assert.match(c.calls[0][2], /PSChinese/); assert.equal(ctx.font, font);
  c.G.I18n.rawCanvas(ctx, 'fillText', 'Pikachu', 1, 2);
  assert.equal(c.calls[2][1], 'Pikachu');
  assert.equal(c.G.I18n.f('Esperando a {x}…', 'Pikachu'), '等待 Pikachu…');
});
test('language changes only update the preference and reject unsupported locales', () => {
  const c = context(); c.storage['ps.save.test'] = 'unchanged';
  c.G.I18n.set('unsupported'); assert.equal(c.calls.length, 0);
  c.G.I18n.set('en'); assert.equal(c.storage['ps.lang'], 'en');
  assert.equal(c.storage['ps.save.test'], 'unchanged'); assert.equal(c.calls.at(-1)[0], 'reload');
});

test('every displayed species matches the frozen official audit and dictionaries have no duplicate keys', () => {
  const c = context(); c.load('js/data/pokedex.js');
  const audit = JSON.parse(source('tools/localization/zh-cn-terms.json'));
  for (const [dex,row] of Object.entries(audit.species)) {
    assert.equal(c.G.I18n.term('pokemon', dex), row.zh, dex);
    assert.equal(c.G.DEX_BY[dex].name, row.source, dex);
  }
  for (const file of ['js/data/lang-zh-cn.js','js/data/lang-zh-cn-names.js']) {
    for (const call of source(file).matchAll(/G\.I18n\.add\((\{[\s\S]*?\}), 'zh-CN'(?:, '[^']+')?\);/g)) {
      const keys = [...call[1].matchAll(/^\s{2}("(?:\\.|[^"\\])*")\s*:/gm)].map(m=>JSON.parse(m[1]));
      assert.equal(new Set(keys).size, keys.length, file);
    }
  }
});

