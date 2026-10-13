/* ============ news-ui.js — "Novedades" ============
 * Botón en la barra de arriba que abre la lista de cambios del juego
 * (js/data/changelog.js). Lleva un punto mientras haya algo que no has visto.
 */
G.NewsUI = (() => {
  const $ = G.UI.$;
  const KEY = 'ps.news.seen';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const latest = () => (G.CHANGELOG[0] || {}).d || '';
  function seen() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }

  function init() {
    const b = $('btn-news');
    b.innerHTML = G.Icons.html('book', 18) + ' <span>Novedades</span><i class="dot"></i>';
    b.onclick = open;
    $('news-close').onclick = close;
    refresh();
  }
  function refresh() { $('btn-news').classList.toggle('new', seen() < latest()); }

  function fmt(d) {
    const [y, m, day] = d.split('-').map(Number);
    const loc = G.I18n.lang === 'it' ? 'it-IT' : (G.I18n.lang === 'en' ? 'en-GB' : 'es-ES');
    return new Date(y, m - 1, day).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function open() {
    const lang = G.I18n ? G.I18n.lang : 'es';
    const langIdx = lang === 'it' ? 2 : (lang === 'en' ? 1 : 0);
    // Cada texto ya va en su idioma: translate="no" para que no lo toque i18n.
    const PARTS = [['new', ['Nuevo', 'New', 'Novità']], ['chg', ['Cambios', 'Changes', 'Modifiche']], ['fix', ['Arreglos', 'Fixes', 'Correzioni']]];
    const pick = arr => (arr && (arr[langIdx] || arr[1] || arr[0])) || '';
    $('news-body').innerHTML = G.CHANGELOG.map(v =>
      `<div class="news-day" translate="no"><h3>${esc(pick(v.title))}<small>${fmt(v.d)}</small></h3>` +
      PARTS.filter(([k]) => v[k] && v[k].length).map(([k, lbl]) =>
        `<div class="news-part"><span class="news-tag ${k}">${lbl[langIdx] || lbl[1] || lbl[0]}</span><ul>${v[k].map(t => `<li>${esc(pick(t))}</li>`).join('')}</ul></div>`).join('') +
      '</div>').join('');
    $('news-body').scrollTop = 0;
    $('scr-news').classList.remove('hidden');
    try { localStorage.setItem(KEY, latest()); } catch (e) { /* nada */ }
    refresh();
  }
  function close() { $('scr-news').classList.add('hidden'); }

  return { init, open, close };
})();
