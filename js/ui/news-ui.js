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
    return new Date(y, m - 1, day).toLocaleDateString(G.I18n.locale, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function open() {
    const en = G.I18n.lang === 'en' ? 1 : 0;
    const text = pair => G.I18n.lang === 'zh-CN' ? G.T(pair[0]) : pair[en];
    // Cada texto ya va en su idioma: translate="no" para que no lo toque i18n.
    const PARTS = [['new', ['Nuevo', 'New']], ['chg', ['Cambios', 'Changes']], ['fix', ['Arreglos', 'Fixes']]];
    $('news-body').innerHTML = G.CHANGELOG.map(v =>
      `<div class="news-day" translate="no"><h3>${esc(v.title ? text(v.title) : '')}<small>${fmt(v.d)}</small></h3>` +
      PARTS.filter(([k]) => v[k] && v[k].length).map(([k, lbl]) =>
        `<div class="news-part"><span class="news-tag ${k}">${text(lbl)}</span><ul>${v[k].map(t => `<li>${esc(text(t))}</li>`).join('')}</ul></div>`).join('') +
      '</div>').join('');
    $('news-body').scrollTop = 0;
    $('scr-news').classList.remove('hidden');
    try { localStorage.setItem(KEY, latest()); } catch (e) { /* nada */ }
    refresh();
  }
  function close() { $('scr-news').classList.add('hidden'); }

  return { init, open, close };
})();
