/* ============ locales.js — idioma del jugador (antes que nada) ============
 * Lo usan la pantalla de carga (boot.js) y el juego (i18n.js). No guarda nada del jugador.
 * Idioma: el elegido en Ajustes; si no, /en/ en la dirección o el del navegador.
 *
 * Francés, italiano, portugués y chino: aquí mismo se pide su diccionario,
 * js/lang/<idioma>.js (lo genera tools/build.js), antes que el juego, para que
 * cada jugador descargue sólo el suyo. Si no llega, el juego sale en inglés.
 * La huella ?v= de este script (la pone build.js) va también al diccionario.
 */
window.PS_LOCALES = (() => {
  const choices = [
    ['es', 'Español', 'es-ES'], ['en', 'English', 'en-GB'],
    ['fr', 'Français', 'fr-FR'], ['it', 'Italiano', 'it-IT'],
    ['pt-BR', 'Português (Brasil)', 'pt-BR'],
    ['zh-Hans', '简体中文', 'zh-CN'], ['zh-Hant', '繁體中文', 'zh-TW'],
    ['vi', 'Tiếng Việt', 'vi-VN']
  ];
  function normalize(value) {
    const s = String(value || '').toLowerCase().replace(/_/g, '-');
    if (/^zh(?:-|$)/.test(s)) {
      if (s.includes('-hans')) return 'zh-Hans';
      if (s.includes('-hant') || /^zh-(tw|hk|mo)(-|$)/.test(s)) return 'zh-Hant';
      return 'zh-Hans';
    }
    if (/^pt(?:-|$)/.test(s)) return 'pt-BR';
    return choices.find(([id]) => s === id || s.startsWith(id + '-'))?.[0] || null;
  }
  let saved;
  try { saved = localStorage.getItem('ps.lang'); } catch (e) { /* storage can be blocked */ }
  const lang = normalize(saved) || (/\/en(\/|$)/.test(location.pathname) ? 'en' : null)
    || normalize((navigator.languages && navigator.languages[0]) || navigator.language || 'es') || 'en';
  document.documentElement.lang = lang;
  if (lang !== 'es' && lang !== 'en') {
    const me = document.currentScript, v = me && /[?&]v=([\w-]+)/.exec(me.src);
    // Mientras se lee la página: se ejecuta antes que los scripts del juego (defer).
    document.write(`<script src="js/lang/${lang}.js${v ? '?v=' + v[1] : ''}"><\/script>`);
  }
  return { choices, normalize, lang, locale: choices.find(([id]) => id === lang)[2] };
})();
