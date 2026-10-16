/* Run with node --test tests/i18n.test.cjs; no npm dependencies. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
function context({ saved = 'zh-Hant', nav = 'en-US', pathname = '/', storageThrows = false } = {}) {
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
  for (const f of ['lang-en', 'lang-zh-hant', 'lang-zh-hant-names']) load(`js/data/${f}.js`);
  return { ...ctx, ctx, calls, dict, contexts, storage, load, Canvas };
}
test('bootstrap and runtime choose the same supported language', () => {
  const cases = [
    [null, 'zh-TW', '/', 'zh-Hant'], [null, 'zh-HK', '/', 'zh-Hant'], [null, 'zh-MO', '/', 'zh-Hant'],
    [null, 'zh-Hant', '/', 'zh-Hant'], [null, 'zh-Hant-TW', '/', 'zh-Hant'],
    [null, 'zh-Hans-TW', '/', 'en'], [null, 'zh-CN', '/', 'en'], [null, 'es-MX', '/', 'es'],
    [null, 'ja-JP', '/', 'en'], [null, 'zh-TW', '/en/index.html', 'en'],
    ['zh-Hant', 'en-US', '/en/index.html', 'zh-Hant'], ['es', 'zh-TW', '/', 'es'],
    ['en', 'zh-TW', '/', 'en'], ['invalid', 'zh-TW', '/', 'zh-Hant']
  ];
  const boot = [...source('dev.html').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes("localStorage.getItem('ps.lang')"));
  for (const [saved, nav, pathname, want] of cases) {
    const c = context({ saved, nav, pathname });
    assert.equal(c.G.I18n.lang, want);
    const paras = [{}, {}]; c.document.querySelectorAll = () => paras;
    vm.runInContext(boot, c.ctx);
    assert.equal(c.document.documentElement.lang, want);
    if (want === 'zh-Hant') assert.equal(paras[1].textContent, '載入中…');
  }
  assert.equal(context({ storageThrows: true, nav: 'zh-TW' }).G.I18n.lang, 'zh-Hant');
});
test('all English keys have Chinese counterparts and preserve placeholders', () => {
  const { dict } = context();
  const zh = Object.fromEntries(Object.entries(dict['zh-Hant']).map(([k,v]) => [k.replaceAll('{name}', '{x}'), v.replaceAll('{name}', '{x}')]));
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
  assert.equal(T(c.G.DEX_BY[983].name), '仆斬將軍');
});
test('type and move homonyms use separate translations', () => {
  const { G } = context();
  assert.equal(G.T('Psíquico'), '超能力');
  assert.equal(G.T('Psíquico', 'move'), '精神強念');
  assert.equal(G.T('Mejora'), '強化');
  assert.equal(G.T('Diario'), '每日');
  assert.equal(G.T('Niebla'), '迷霧');
  assert.equal(G.T('Tormenta Floral', 'move'), '落英繽紛');
  assert.equal(G.T('Hierba Lazo', 'move'), '打草結');
});
test('exact, uppercase, whitespace, dynamic and fragment translations', () => {
  const { G } = context();
  assert.equal(G.T('  Volver  '), '  返回  ');
  assert.equal(G.T('VOLVER'), '返回');
  assert.equal(G.T('¡Nivel 12!'), '升到 12 級！');
  assert.equal(G.T('¡Has conseguido a Pikachu shiny!'), '獲得異色 皮卡丘！');
  assert.equal(G.T('Derrota a 25 Pokémon de tipo Fuego'), '擊敗 25 隻火屬性寶可夢');
  assert.equal(G.T('Pikachu + Bulbasaur'), '皮卡丘 + 妙蛙種子');
  assert.equal(G.T('2026'), '2026');
  assert.equal(G.T('¡Pikachu necesita ayuda! · 8 m'), 'Pikachu 需要救援！· 8 公尺');
  assert.equal(G.T('Tu apodo es Pikachu'), '你的暱稱是 Pikachu');
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
  assert.match(c.calls[0][2], /PingFang TC/); assert.equal(ctx.font, font);
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
test('new recovery, moderation and Judgment strings preserve opaque player text', () => {
  const { G } = context();
  assert.equal(G.T('¿Reportar la marca de Pikachu como trampa?'), '要檢舉 Pikachu 的紀錄涉嫌作弊嗎？');
  assert.equal(G.T('¿Banear a Pikachu? No podrán volver a salir en el ranking y se borra su marca.'), '要禁止 Pikachu 上榜嗎？其紀錄將被刪除，之後也無法再登上排行榜。');
  assert.equal(G.T('SENTENCIA · 00:12 · JEFES 3'), '審判 · 00:12 · 首領 3');
  assert.equal(G.T('ARCEUS · 25 m'), '阿爾宙斯 · 25 公尺');
  assert.equal(G.T('No se pudo cargar (permission-denied).'), '無法載入（permission-denied）。');
  assert.equal(G.I18n.f('{x} monedas · {x} tickets · {x} ×10 · {x} Pokémon', '12,345', 2, 3, 4), '12,345 金幣 · 2 張普通券 · 3 張十連券 · 4 隻寶可夢');
});
test('startup error and maintenance translations work with a private G', () => {
  for (const maintenance of [false, true]) {
    let translated = false;
    const el = { innerHTML: '', setAttribute() {} };
    const ctx = { G: { I18n: { lang: 'zh-Hant', walk() { translated = true; } } }, window: {},
      document: { readyState: 'complete', getElementById() { return el; } },
      navigator: { language: 'zh-TW' }, location: { search: '' }, console: { warn() {} } };
    const script = source('js/main.js').replace('const MAINTENANCE = false;', `const MAINTENANCE = ${maintenance};`);
    vm.runInNewContext(script, ctx);
    assert.equal(ctx.window.G, undefined);
    if (maintenance) assert.match(el.innerHTML, /目前維護中/);
    else assert.ok(translated);
  }
});
