const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const files = ['js/core/i18n.js', 'js/data/lang-en.js', 'js/data/lang-zh-Hant.js', 'js/data/pokemon-zh-Hant.js'];
function boot(saved = null, pathname = '/', blockedStorage = false) {
  const calls = [], writes = [];
  function Context() {}
  for (const method of ['fillText', 'strokeText', 'measureText']) {
    Context.prototype[method] = function (text, ...args) { calls.push([method, text, ...args]); return text.length; };
  }
  const sandbox = {
    G: {}, document: { documentElement: {} }, navigator: { language: 'en-US' },
    location: { pathname, reload() { calls.push(['reload']); } },
    localStorage: {
      getItem() { if (blockedStorage) throw Error('blocked'); return saved; },
      setItem(...args) { if (blockedStorage) throw Error('blocked'); writes.push(args); }
    },
    window: { confirm: text => { calls.push(['confirm', text]); return true; }, alert: text => calls.push(['alert', text]) },
    CanvasRenderingContext2D: Context
  };
  vm.createContext(sandbox);
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  return { ...sandbox, calls, writes };
}
const zh = boot();
assert.equal(zh.G.I18n.lang, 'zh-Hant');
assert.equal(zh.document.documentElement.lang, 'zh-Hant');
assert.equal(zh.G.I18n.locale, 'zh-TW');
for (const [src, expected] of [
  ['Jugar', '開始遊戲'], ['MEJORAS', '強化'], ['  Volver  ', '  返回  '],
  ['Pregunta 2 de 8', '第 2 題，共 8 題'],
  ['¡Has conseguido a Bulbasaur shiny!', '獲得了閃光 妙蛙種子！'],
  ['¡Un Gholdengo shiny anda cerca!', '附近有閃光 賽富豪！'],
  ['¡Poder Furia! daño ×2 durante 10 s', '狂怒之力！傷害 ×2，持續 10 秒'],
  ['Los 151 Pokémon de la generación 1. ¡Los legendarios esperan!', '共 151 隻第 1 世代寶可夢，傳說寶可夢等著你！'],
  ['Vida', '體力'], ['Gacha', '扭蛋'], ['Vínculo', '羈絆'],
  ['La Sentencia de Arceus', '阿爾宙斯的審判'],
  ['Actualización obligatoria: tu partida se guarda y el juego se recarga en 10 s…', '必要更新：本局進度將儲存，遊戲將於 10 秒後重新載入…'],
  ['Derrota a 20 Pokémon de tipo Agua', '擊敗 20 隻 水系寶可夢'],
  ['Aguanta 5 minutos con un Pokémon de tipo Fuego', '生存 5 分鐘，使用 火系寶可夢']
]) assert.equal(zh.G.T(src), expected, src);
assert.equal(zh.G.I18n.f('Pregunta {x} de {x}', 3, 8), '第 3 題，共 8 題');
const ctx = new zh.CanvasRenderingContext2D();
ctx.fillText('¡Has conseguido a Pikachu shiny!', 10, 20);
ctx.strokeText('Pausa', 3, 4);
assert.equal(ctx.measureText('Pausa'), '暫停'.length);
assert.deepEqual(zh.calls.slice(0, 3), [
  ['fillText', '獲得了閃光 皮卡丘！', 10, 20], ['strokeText', '暫停', 3, 4], ['measureText', '暫停']
]);
assert.equal(zh.window.confirm('Volver'), true);
assert.deepEqual(zh.calls.at(-1), ['confirm', '返回']);
zh.G.I18n.set('invalid');
assert.equal(zh.writes.length, 0);
zh.G.I18n.set('en');
assert.deepEqual(zh.writes, [['ps.lang', 'en']]);
assert.deepEqual(zh.calls.at(-1), ['reload']);
const en = boot('en');
assert.equal(en.G.T('Jugar'), 'Play');
assert.equal(en.G.T('¡Has conseguido a Pikachu shiny!'), 'You got a shiny Pikachu!');
assert.equal(en.G.T('Bulbasaur'), 'Bulbasaur');
assert.equal(boot('es').G.T('Jugar'), 'Jugar');
assert.equal(boot(null, '/en/').G.I18n.lang, 'en');
assert.equal(boot(null, '/en').G.I18n.lang, 'en');
assert.equal(boot('zh-Hant', '/en/').G.I18n.lang, 'zh-Hant');
assert.equal(boot('obsolete').G.I18n.lang, 'zh-Hant');
assert.equal(boot(null, '/', true).G.T('Jugar'), '開始遊戲');
const dicts = [];
for (const file of files.slice(1)) vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), { G: { I18n: { add: (dict, language = 'en') => dicts.push({ dict, language }) } } });
const [english, chinese, names] = dicts.map(d => d.dict);
for (const [key, value] of Object.entries(chinese)) {
  assert.equal((key.match(/\{x\}/g) || []).length, (value.match(/\{x\}/g) || []).length, key);
  if (!key.includes('{x}')) assert.equal(zh.G.T(key), value, key);
}
for (const key of Object.keys(english)) assert.ok(chinese[key], `Missing translation: ${key}`);
const dex = { G: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/data/pokedex.js'), 'utf8'), dex);
assert.equal(dex.G.DEX.length, 966);
for (const mon of dex.G.DEX) {
  assert.ok(names[mon.name], `Missing Pokémon: ${mon.name}`);
  assert.equal(zh.G.T(mon.name), names[mon.name]);
}
console.log(`PASS: ${Object.keys(english).length} base keys, ${Object.keys(chinese).length} Chinese keys, ${dex.G.DEX.length} Pokémon; locales, placeholders, canvas, dialogs and persistence.`);
