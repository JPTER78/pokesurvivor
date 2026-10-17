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
  load('js/core/util.js');
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
assert.equal(zh.G.T(zh.G.U.TYPE_NAME.psychic), '超能力');
assert.equal(zh.G.T('Psíquico'), '精神強念');

// Check every game species and move against the committed, source-backed audit.
const audit = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/zh-TW-names.json'), 'utf8'));
const gameData = { G: {} };
for (const file of ['js/data/pokedex.js', 'js/data/moves.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), gameData, { filename: file });
}
assert.match(audit.source.commit, /^[0-9a-f]{40}$/);
assert.equal(audit.species.length, gameData.G.DEX.length);
assert.equal(new Set(audit.species.map(p => p.dex)).size, gameData.G.DEX.length);
for (const pokemon of gameData.G.DEX) {
  const record = audit.species.find(p => p.dex === pokemon.dex);
  assert.equal(record.source_species_id, pokemon.dex);
  assert.equal(record.game_name, pokemon.name);
  assert.equal(zh.G.T(pokemon.name), record.zh_hant_name);
}
const moves = Object.values(gameData.G.Moves.BY_ID).map(m => ({ id: m.id, name: m.name, role: 'base' }));
for (const [id, [name]] of Object.entries(gameData.G.Moves.EVO)) moves.push({ id: id + '#evolution', name, role: 'evolution' });
assert.equal(audit.moves.length, moves.length);
assert.equal(new Set(audit.moves.map(m => m.game_id)).size, moves.length);
for (const move of moves) {
  const record = audit.moves.find(m => m.game_id === move.id);
  assert.equal(record.role, move.role);
  assert.equal(record.game_name, move.name);
  assert.equal(zh.G.T(move.name), record.zh_hant_name);
  if (record.status === 'canonical_match') {
    assert.ok(Number.isInteger(record.source_move_id) && record.source_move_id > 0);
    assert.ok(record.source_identifier);
  } else {
    assert.equal(record.status, 'custom_or_unmatched');
    assert.equal(record.source_move_id, null);
    assert.ok(record.note);
    if (record.source_ability_id) {
      assert.equal(record.zh_hant_name, record.source_ability_zh_hant_name);
      assert.ok(record.source_ability_identifier);
    }
  }
}
assert.equal(audit.moves.find(m => m.game_id === 'leaf-storm').source_identifier, 'petal-blizzard');
assert.equal(audit.moves.find(m => m.game_id === 'giga-drain').source_identifier, 'grass-knot');
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
assert.equal(en.G.T(en.G.U.TYPE_NAME.psychic), 'Psychic');
assert.equal(en.G.T('Jugar como invitado'), 'Play as guest');
assert.equal(en.G.I18n.f('Pregunta {x} de {x}', 2, 8), 'Question 2 of 8');
assert.equal(boot({ saved: 'es' }).G.T('Jugar como invitado'), 'Jugar como invitado');
for (const [key, value] of Object.entries(zh.dictionaries['zh-TW'])) {
  assert.equal((value.match(/\{x\}/g) || []).length, (key.match(/\{x\}/g) || []).length,
    'Placeholder mismatch: ' + key);
}
console.log('Locale selection, boot consistency, dictionary isolation, placeholders, canvas, dialogs and switching passed.');
console.log('Traditional Chinese entries:', Object.keys(zh.dictionaries['zh-TW']).length);
