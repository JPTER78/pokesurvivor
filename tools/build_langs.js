/* Diccionarios de francés, italiano, portugués y chino, uno por idioma:
 *   node tools/build_langs.js            (lo llama tools/build.js)
 *   node tools/build_langs.js --faltan   además, lista lo que falta por traducir
 *
 * Lee los js/data/lang-*.js de esos idiomas (y lang-updates.js, donde van los
 * textos nuevos en los cinco a la vez) y escribe js/lang/<idioma>.js sólo con
 * lo de ese idioma. locales.js descarga el del jugador antes que el juego.
 * El español y el inglés van dentro del juego (app.min.js), como siempre.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SOURCES = ['lang-fr.js', 'lang-it.js', 'lang-pt.js', 'lang-zh-cn.js', 'lang-zh-cn-names.js',
                 'lang-zh-hant.js', 'lang-zh-hant-names.js', 'lang-updates.js'].map(f => 'js/data/' + f);
const LANGS = ['fr', 'it', 'pt-BR', 'zh-Hans', 'zh-Hant'];

/** Ejecuta archivos con un G.I18n.add que sólo apunta: → [[dict, idioma, contexto], ...] */
function capture(files, defLang = 'en') {
  const out = [];
  const sb = { G: { I18n: { add: (d, l = defLang, c = '') => out.push([d, l, c]) } }, console };
  sb.window = sb;
  vm.createContext(sb);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  return out;
}

function build() {
  const all = capture(SOURCES, '?');
  const bad = all.filter(([, l]) => !LANGS.includes(l));
  if (bad.length) throw new Error('build_langs: diccionario sin idioma válido (' + bad.map(b => b[1]).join(', ') + ')');
  fs.mkdirSync(path.join(ROOT, 'js', 'lang'), { recursive: true });
  const sizes = [];
  for (const lang of LANGS) {
    // Lo de cada idioma, juntando lo que no tiene contexto en un solo diccionario (lo último manda).
    const plain = {}, ctx = {};
    for (const [d, l, c] of all) {
      if (l !== lang) continue;
      if (c) Object.assign(ctx[c] = ctx[c] || {}, d); else Object.assign(plain, d);
    }
    const items = [[plain, lang, '']].concat(Object.entries(ctx).map(([c, d]) => [d, lang, c]));
    const js = '/* GENERADO por tools/build_langs.js desde js/data/lang-*.js: no editar a mano. */\n'
      + '(window.PS_LANG_Q = window.PS_LANG_Q || []).push(' + items.map(i => JSON.stringify(i)).join(',\n') + ');\n';
    fs.writeFileSync(path.join(ROOT, 'js', 'lang', lang + '.js'), js);
    sizes.push(`${lang} ${(js.length / 1024).toFixed(0)} KB`);
  }
  return sizes;
}

/** Textos con traducción inglesa (lang-en.js y los de los datos del juego) que faltan en cada idioma. */
function missing() {
  const en = {};
  const files = ['js/data/lang-en.js', 'js/core/settings.js', 'js/data/pokedex.js', 'js/data/sprites-meta.js', 'js/data/moves.js', 'js/data/types.js', 'js/data/items.js',
                 'js/data/achievements.js', 'js/world/tiles.js', 'js/data/funding.js'];
  // Los datos del juego necesitan G de verdad (util.js): el mismo entorno que tools/export_data.js.
  const noop = () => {}, fakeCtx = new Proxy({}, { get: () => noop });
  const sb = {
    G: {}, console, location: { pathname: '/', protocol: 'file:' }, navigator: { language: 'es', languages: ['es'] },
    localStorage: { getItem: () => 'es', setItem: noop },
    document: { documentElement: {}, createElement: () => ({ getContext: () => fakeCtx, width: 0, height: 0 }), addEventListener: noop, querySelector: () => null, body: {} },
    addEventListener: noop, matchMedia: () => ({ matches: false }), CanvasRenderingContext2D: function () {}, Image: function () {}, performance: { now: () => 0 },
    setTimeout: noop, setInterval: noop, requestAnimationFrame: noop
  };
  sb.window = sb;
  vm.createContext(sb);
  const load = f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  for (const f of ['js/core/locales.js', 'js/core/util.js', 'js/core/i18n.js']) load(f);
  const add = sb.G.I18n.add;
  sb.G.I18n.add = (d, l = 'en', c = '') => { if (l === 'en' && !c) Object.assign(en, d); add(d, l, c); };
  for (const f of files) { try { load(f); } catch (e) { console.warn('aviso', f, e.message); } }
  const all = capture(SOURCES, '?');
  const res = {};
  for (const lang of LANGS) {
    const have = new Set();
    for (const [d, l, c] of all) if (l === lang && !c) for (const k of Object.keys(d)) have.add(k.replace(/\{name\}/g, '{x}'));
    res[lang] = Object.keys(en).filter(k => en[k] && en[k] !== k && !have.has(k.replace(/\{name\}/g, '{x}')));
  }
  return { en, res };
}

module.exports = { build, missing, capture, LANGS, SOURCES };

if (require.main === module) {
  console.log('ok: diccionarios ' + build().join(' · '));
  if (process.argv.includes('--faltan')) {
    const { res } = missing();
    for (const [l, ks] of Object.entries(res)) {
      console.log(`\n== ${l}: faltan ${ks.length}`);
      if (process.argv.includes('--todo')) ks.forEach(k => console.log('  ' + JSON.stringify(k)));
    }
  }
}
