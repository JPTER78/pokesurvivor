// Run with node tools/test_i18n.js. No browser or dependencies required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');

function boot({ saved = null, nav = 'en', pathname = '/', search = '', blocked = false } = {}) {
  let reloads = 0, replaced = null;
  const storage = new Map(saved ? [['ps.lang', saved]] : []);
  class Canvas {
    fillText(text) { return text; }
    strokeText(text) { return text; }
    measureText(text) { return { text, width: text.length }; }
  }
  const context = {
    G: {}, URL, URLSearchParams,
    navigator: { language: nav, languages: [nav] },
    location: { pathname, search, href: 'http://localhost:8000' + pathname + search,
      reload: () => reloads++, replace: url => { replaced = url; } },
    localStorage: {
      getItem(key) { if (blocked) throw Error('blocked'); return storage.get(key) || null; },
      setItem(key, value) { if (blocked) throw Error('blocked'); storage.set(key, value); }
    },
    document: { documentElement: {} },
    CanvasRenderingContext2D: Canvas,
    confirm: text => text, alert: text => text
  };
  context.window = context;
  vm.createContext(context);
  const load = file => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  load('js/core/i18n.js');
  const dictionaries = {};
  const add = context.G.I18n.add;
  context.G.I18n.add = (dict, locale = 'en') => { dictionaries[locale] = dict; add(dict, locale); };
  load('js/data/lang-en.js');
  load('js/data/lang-zh-TW.js');
  return { ...context, dictionaries, canvas: new Canvas(), storage,
    navigation: () => ({ reloads, replaced }) };
}

for (const [options, expected] of [
  [{ nav: 'zh-TW' }, 'zh-TW'], [{ nav: 'zh-Hant' }, 'zh-TW'], [{ nav: 'zh-CN' }, 'zh-TW'],
  [{ nav: 'es-MX' }, 'es'], [{ nav: 'ja' }, 'en'],
  [{ nav: 'zh-TW', saved: 'en' }, 'en'], [{ nav: 'en', saved: 'zh-TW' }, 'zh-TW'],
  [{ nav: 'zh-TW', pathname: '/en/' }, 'en'],
  [{ saved: 'es', search: '?lang=zh-TW' }, 'zh-TW'],
  [{ saved: 'invalid', nav: 'zh-TW', search: '?lang=invalid' }, 'zh-TW'],
  [{ nav: 'zh-TW', blocked: true }, 'zh-TW']
]) {
  const app = boot(options);
  assert.equal(app.G.I18n.lang, expected);
  assert.equal(app.document.documentElement.lang, expected);
  // The early loading screen must select the same locale as the runtime.
  const html = fs.readFileSync(path.join(ROOT, 'dev.html'), 'utf8');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m => m[1].includes("localStorage.getItem('ps.lang')"))[1];
  app.document.querySelectorAll = () => [{}, {}];
  vm.runInNewContext(inline, app);
  assert.equal(app.document.documentElement.lang, expected);
}

const zh = boot({ nav: 'zh-TW' });
for (const key of Object.keys(zh.dictionaries.en)) {
  assert.ok(Object.hasOwn(zh.dictionaries['zh-TW'], key), 'Missing translation: ' + key);
}
const translated = zh.G.T('Jugar como invitado');
assert.match(translated, /[\u3400-\u9fff]/u);
assert.equal(zh.G.T('Unknown text 123'), 'Unknown text 123');
assert.equal(zh.G.T('Pikachu'), '皮卡丘');
assert.equal(zh.G.I18n.f('Pregunta {x} de {x}', 2, 8).includes('{x}'), false);
assert.ok(zh.G.I18n.f('Pregunta {x} de {x}', 2, 8).includes('2'));
assert.ok(zh.G.I18n.f('Pregunta {x} de {x}', 2, 8).includes('8'));
assert.equal(zh.canvas.fillText('Jugar como invitado'), translated);
assert.equal(zh.canvas.strokeText('Jugar como invitado'), translated);
assert.equal(zh.canvas.measureText('Jugar como invitado').text, translated);
assert.equal(zh.confirm('Jugar como invitado'), translated);
assert.equal(zh.alert('Jugar como invitado'), translated);
zh.G.I18n.add({ 'Jugar como invitado': 'WRONG LANGUAGE' });
assert.equal(zh.G.T('Jugar como invitado'), translated);
zh.G.I18n.set('invalid');
assert.equal(zh.navigation().reloads, 0);
zh.G.I18n.set('en');
assert.equal(zh.storage.get('ps.lang'), 'en');
assert.equal(zh.navigation().reloads, 1);
const query = boot({ search: '?dev&lang=zh-TW#menu' });
query.G.I18n.set('es');
assert.equal(new URL(query.navigation().replaced).searchParams.get('lang'), 'es');
assert.ok(new URL(query.navigation().replaced).searchParams.has('dev'));
const en = boot({ saved: 'en' });
assert.equal(en.G.T('Jugar como invitado'), 'Play as guest');
assert.equal(en.G.I18n.f('Pregunta {x} de {x}', 2, 8), 'Question 2 of 8');
assert.equal(boot({ saved: 'es' }).G.T('Jugar como invitado'), 'Jugar como invitado');
for (const [key, value] of Object.entries(zh.dictionaries['zh-TW'])) {
  assert.equal((value.match(/\{x\}/g) || []).length, (key.match(/\{x\}/g) || []).length,
    'Placeholder mismatch: ' + key);
}
console.log('Locale selection, boot consistency, dictionary isolation, placeholders, canvas, dialogs and switching passed.');
console.log('Traditional Chinese entries:', Object.keys(zh.dictionaries['zh-TW']).length);
