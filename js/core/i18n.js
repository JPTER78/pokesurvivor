/* ============ i18n.js — idiomas (español / inglés / chino simplificado) ============
 * El juego está escrito en español. Los demás idiomas traducen el texto
 * con su diccionario js/data/lang-*.js, sin tener que
 * tocar cada pantalla:
 *   - el DOM (menús, cartas, avisos...) con un MutationObserver,
 *   - el canvas (HUD, avisos, números) envolviendo fillText/strokeText,
 *   - confirm()/alert().
 *
 * El diccionario usa el texto español como clave. Tres niveles:
 *   1. frase exacta                    'Volver' -> 'Back'
 *   2. patrón con huecos {x}           '¡Has conseguido a {x} shiny!' -> 'You got a shiny {x}!'
 *                                      (lo que cae en el hueco también se traduce)
 *   3. trozos dentro de un texto más largo, sólo palabras enteras
 * Lo que escriben los jugadores (apodos) va marcado con translate="no".
 *
 * Idioma: el elegido en Ajustes; si no, /en/ o /zh/ en la dirección;
 * después, español si el navegador está en español e inglés en los demás casos.
 * add(dict, idioma, contexto) sólo carga el idioma activo; el contexto 'move'
 * distingue Psíquico (movimiento) de Psíquico (tipo). Los IDs no se traducen.
 * {name} conserva el apodo del jugador sin traducirlo; {x} traduce su contenido.
 */
G.I18n = (() => {
  const KEY = 'ps.lang';
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* nada */ }
  const byPath = /\/en(\/|$)/.test(location.pathname) ? 'en' : /\/zh(\/|$)/.test(location.pathname) ? 'zh-CN' : null;
  const supported = ['es', 'en', 'zh-CN'];
  const nav = ((navigator.languages && navigator.languages[0]) || navigator.language || 'es').toLowerCase();
  const lang = supported.includes(saved) ? saved : byPath || (nav.startsWith('es') ? 'es' : 'en');
  const locale = { es: 'es-ES', en: 'en-GB', 'zh-CN': 'zh-CN' }[lang];
  document.documentElement.lang = lang;

  const exact = new Map(), exactLow = new Map();
  let patterns = [], frag = null, fragLow = null, fragMap = new Map();
  const cache = new Map(), contexts = new Map();
  const L = '\\p{L}\\p{N}';
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /** Añade traducciones { 'texto en español': 'English text' }. */
  function add(dict, language = 'en', context = '') {
    if (language !== lang) return;
    if (context) { contexts.set(context, { ...contexts.get(context), ...dict }); return; }
    const fr = [];
    for (const [es, en] of Object.entries(dict)) {
      if (!en || es === en) continue;
      if (/\{(?:x|name)\}/.test(es)) {
        const slots = es.match(/\{(?:x|name)\}/g);
        const parts = es.split(/\{(?:x|name)\}/).map(reEsc);
        patterns.push({ re: new RegExp('^' + parts.join('(.+?)') + '$', 'u'), reI: new RegExp('^' + parts.join('(.+?)') + '$', 'iu'), en, slots });
      } else {
        exact.set(es, en);
        exactLow.set(es.toLowerCase(), en);
        if (es.length >= 4 || /\s/.test(es)) { fr.push(es); fragMap.set(es.toLowerCase(), en); }
      }
    }
    // Una sola expresión con todos los trozos (los más largos primero), sólo palabras enteras.
    const all = [...fragMap.keys()].sort((a, b) => b.length - a.length).map(reEsc).join('|');
    frag = all ? new RegExp(`(?<![${L}])(${all})(?![${L}])`, 'giu') : null;
    cache.clear();
  }

  function keepCase(src, en) {
    if (src === src.toUpperCase() && /\p{L}/u.test(src)) return en.toUpperCase();
    return en;
  }

  /** Traduce un texto (sin espacios de los lados) al idioma actual. */
  function t(s, context) {
    const contextual = contexts.get(context);
    if (contextual && Object.prototype.hasOwnProperty.call(contextual, s)) return contextual[s];
    if (lang === 'es' || !s || typeof s !== 'string') return s;
    if (!/\p{L}/u.test(s)) return s;
    const c = cache.get(s);
    if (c !== undefined) return c;
    let r = core(s);
    if (cache.size > 4000) cache.clear();
    cache.set(s, r);
    return r;
  }

  function core(s) {
    // Respeta los espacios de alrededor (nodos de texto del DOM).
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    // Los textos del HTML pueden ocupar varias líneas: se comparan con los espacios juntos.
    const lead = m[1], tail = m[3], body = m[2].replace(/\s+/g, ' ');
    if (!body) return s;
    const upper = body === body.toUpperCase() && /\p{L}/u.test(body);
    let r = exact.get(body);
    if (r === undefined && upper) { const e = exactLow.get(body.toLowerCase()); if (e !== undefined) r = keepCase(body, e); }
    if (r === undefined) {
      for (const p of patterns) {
        const mm = (upper ? p.reI : p.re).exec(body);
        if (!mm) continue;
        let i = 1;
        r = p.en.replace(/\{(?:x|name)\}/g, () => {
          const slot = p.slots[i - 1], g = mm[i++];
          return g === undefined ? '' : slot === '{name}' ? g : core(g);
        });
        r = keepCase(body, r);
        break;
      }
    }
    if (r === undefined && frag) {
      r = body.replace(frag, w => keepCase(w, fragMap.get(w.toLowerCase()) || w));
    }
    return lead + (r === undefined ? body : r) + tail;
  }

  /** Texto con huecos para el código: T('Nivel {x}', 5). */
  function f(es, ...vals) { let i = 0; return t(es).replace(/\{(?:x|name)\}/g, () => vals[i++]); }
  function term(category, source) {
    if (category === 'pokemon' && G.DEX_BY && G.DEX_BY[source]) return t(G.DEX_BY[source].name);
    return t(String(source), category);
  }
  const PAGE_PATHS = {
    es: { guide: 'guia/', pokedex: 'pokedex/', contact: 'contacto/' },
    en: { guide: 'en/guide/', pokedex: 'en/pokedex/', contact: 'contacto/' },
    'zh-CN': { guide: 'zh/guide/', pokedex: 'zh/pokedex/', contact: 'zh/contact/' }
  };
  function pageUrl(page) { const path = PAGE_PATHS[lang][page]; return location.protocol === 'file:' ? path + 'index.html' : path; }

  // ---------------- DOM ----------------
  const ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];
  const skipEl = el => !!(el && el.closest && el.closest('[translate="no"], script, style, code'));

  function doText(n) {
    const p = n.parentElement;
    if (!p || skipEl(p)) return;
    const v = n.nodeValue;
    if (n.__tr === v) return;
    const r = t(v);
    n.__tr = r;
    if (r !== v) n.nodeValue = r;
  }
  function doEl(el) {
    if (skipEl(el)) return;
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) { const r = t(v); if (r !== v) el.setAttribute(a, r); }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || skipEl(root)) return;
    doEl(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) doText(n); else doEl(n); }
  }

  function startDom() {
    document.title = { es: 'PokéSurvivor – Juego Pokémon gratis online estilo Survivor.io', en: 'PokéSurvivor – Free online Pokémon survival game (Survivor.io style)', 'zh-CN': 'PokéSurvivor – 免费在线宝可梦生存游戏' }[lang];
    if (lang === 'es') return;
    // Los enlaces a las páginas de la web, a su versión en inglés.
    const links = { 'guia/': 'guide', 'pokedex/': 'pokedex', 'contacto/': 'contact' };
    document.querySelectorAll('a[href]').forEach(a => { const page = links[a.getAttribute('href')]; if (page) a.setAttribute('href', pageUrl(page)); });
    walk(document.body);
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doEl(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    const normal = document.querySelector('#menu-shiny [data-v="0"]');
    if (normal) normal.textContent = t('Normal', 'form');
  }

  // ---------------- canvas y ventanas del navegador ----------------
  const P = CanvasRenderingContext2D.prototype;
  const canvasText = Object.fromEntries(['fillText', 'strokeText', 'measureText'].map(k => [k, P[k]]));
  function canvasCall(ctx, method, text, args) {
    const font = ctx.font;
    if (lang === 'zh-CN' && font.includes('Pixelify')) ctx.font = font.replace('Pixelify', 'Pixelify,"PSChinese","Microsoft YaHei","PingFang SC"');
    try { return canvasText[method].call(ctx, text, ...args); }
    finally { if (ctx.font !== font) ctx.font = font; }
  }
  function rawCanvas(ctx, method, text, ...args) { return canvasCall(ctx, method, text, args); }
  if (lang !== 'es') {
    for (const k of ['fillText', 'strokeText', 'measureText']) {
      P[k] = function (s, ...a) {
        return canvasCall(this, k, typeof s === 'string' ? t(s) : s, a);
      };
    }
    const oc = window.confirm, oa = window.alert;
    window.confirm = s => oc.call(window, t(s));
    window.alert = s => oa.call(window, t(s));
  }

  function set(l) {
    if (!supported.includes(l)) return;
    try { localStorage.setItem(KEY, l); } catch (e) { /* nada */ }
    location.reload();
  }

  return { lang, locale, add, t, f, term, set, startDom, walk, rawCanvas, pageUrl };
})();
G.T = G.I18n.t;
