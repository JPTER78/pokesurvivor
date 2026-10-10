/* Exporta los datos del juego a JSON para generar las páginas web (make_seo_pages.py).
 *   node tools/export_data.js  ->  tools/cache/gamedata.json
 * Carga los mismos archivos que el juego en un contexto aislado (sin navegador). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const noop = () => {};
const fakeCtx = new Proxy({}, { get: () => noop });
const G = {};
const sandbox = {
  G, window: {}, console, Math, JSON, Date, Map, Set, Object, Array, Number, String, RegExp, Promise, Symbol, Infinity, NaN, isFinite, parseInt, parseFloat,
  location: { pathname: '/', protocol: 'file:' }, navigator: { language: 'es', languages: ['es'] }, localStorage: { getItem: () => 'es', setItem: noop },
  document: { documentElement: {}, createElement: () => ({ getContext: () => fakeCtx, width: 0, height: 0 }), addEventListener: noop, querySelector: () => null, body: {} },
  addEventListener: noop, matchMedia: () => ({ matches: false }), CanvasRenderingContext2D: function () {}, Image: function () {}, performance: { now: () => 0 },
  setTimeout: noop, setInterval: noop, requestAnimationFrame: noop
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const load = f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const EN = {};
for (const f of ['js/core/util.js', 'js/core/i18n.js']) load(f);
// Captura el diccionario inglés (clave en español).
const add = G.I18n.add;
G.I18n.add = d => { Object.assign(EN, d); add(d); };
for (const f of ['js/data/lang-en.js', 'js/core/settings.js', 'js/data/pokedex.js', 'js/data/sprites-meta.js', 'js/data/moves.js', 'js/data/types.js',
                 'js/data/items.js', 'js/data/achievements.js', 'js/world/tiles.js', 'js/data/funding.js']) {
  try { load(f); } catch (e) { console.warn('aviso', f, e.message); }
}
const moves = Object.values(G.Moves.BY_ID).map(m => {
  const inst = G.Moves.instance(m.id, m.maxLvl || 5);
  const evo = G.Moves.evoInfo(inst, {});
  return { id: m.id, name: m.name, type: m.type, kind: m.kind, desc: m.desc, maxLvl: m.maxLvl, evo: evo ? { name: evo.name, needs: evo.needName, text: evo.text } : null };
});
const out = {
  dex: G.DEX,
  legends: G.DEX.filter(p => p.leg).map(p => p.dex),
  moves,
  items: (G.Items.LIST || []).map(i => ({ id: i.id, name: i.name, desc: i.desc })),
  achievements: (G.AchDefs.LIST || []).map(a => ({ id: a.id, cat: a.cat, name: a.name, desc: a.desc, tier: a.tier, title: a.title || '', reward: a.reward || {} })),
  achCats: G.AchDefs.CATS || null,
  types: G.Types.CHART,
  typeColor: G.U.TYPE_COLOR,
  typeName: G.U.TYPE_NAME,
  typeOrder: Object.keys(G.U.TYPE_NAME),
  matrix: Object.fromEntries(Object.keys(G.U.TYPE_NAME).map(a => [a, Object.fromEntries(Object.keys(G.U.TYPE_NAME).map(d => [d, G.Types.mult(a, [d])]))])),
  arenas: Object.fromEntries(Object.entries(G.ARENA_THEMES || (G.Tiles && G.Tiles.ARENA_THEMES) || {}).map(([k, v]) => [k, v.name])),
  funding: { kofi: G.Funding.kofi, sponsors: G.Funding.sponsors, costs: G.Funding.costs },
  en: EN
};
fs.mkdirSync(path.join(__dirname, 'cache'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'cache', 'gamedata.json'), JSON.stringify(out));
console.log('ok:', out.dex.length, 'Pokémon,', out.moves.length, 'movimientos,', out.items.length, 'objetos,', out.achievements.length, 'logros,',
  Object.keys(out.arenas).length, 'arenas,', Object.keys(out.en).length, 'traducciones');
