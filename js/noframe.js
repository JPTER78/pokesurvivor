/* ============ noframe.js — el juego sólo se juega en su web ============
 * Hay webs que meten pokesurvivor.com dentro de un marco (iframe) y ponen sus
 * anuncios alrededor (pokesurvival.com, 19-10-2026). Si esta página está dentro
 * de un marco de otra web, no arranca el juego (main.js mira PS_FRAMED) y
 * sale un aviso con un botón a la web oficial. Un marco de la misma web sí vale.
 * Va en un archivo aparte (y no dentro del HTML) por la CSP; lo usan el juego
 * (dev.html, index.html, en/) y las páginas de la guía (make_seo_pages.py).
 * Si algún día el juego se publica en un portal que lo mete en un marco
 * (itch.io, CrazyGames...), su dominio va en ALLOW.
 */
(function () {
  var ALLOW = [];
  if (window.top === window.self) return;
  var parent = '';
  try { parent = window.top.location.hostname; } catch (e) { /* de otra web: no se puede leer */ }
  if (parent === location.hostname) return;
  var anc = location.ancestorOrigins && location.ancestorOrigins[0];
  if (!parent && anc) { try { parent = new URL(anc).hostname; } catch (e) { /* sin origen */ } }
  if (parent && ALLOW.indexOf(parent) >= 0) return;
  window.PS_FRAMED = true;

  var lang = (window.PS_LOCALES && window.PS_LOCALES.lang) || document.documentElement.lang || 'en';
  var texts = {
    es: ['Esta no es la web oficial', 'PokéSurvivor sólo se juega en su web oficial, gratis y sin anuncios.', 'Jugar en pokesurvivor.com'],
    en: ['This is not the official website', 'PokéSurvivor can only be played on its official website, free and without ads.', 'Play on pokesurvivor.com'],
    fr: ['Ce n’est pas le site officiel', 'PokéSurvivor se joue uniquement sur son site officiel, gratuitement et sans publicité.', 'Jouer sur pokesurvivor.com'],
    it: ['Questo non è il sito ufficiale', 'PokéSurvivor si gioca solo sul suo sito ufficiale, gratis e senza pubblicità.', 'Gioca su pokesurvivor.com'],
    'pt-BR': ['Este não é o site oficial', 'PokéSurvivor só pode ser jogado no site oficial, de graça e sem anúncios.', 'Jogar em pokesurvivor.com'],
    vi: ['Đây không phải trang web chính thức', 'PokéSurvivor chỉ có thể chơi trên trang web chính thức, miễn phí và không quảng cáo.', 'Chơi tại pokesurvivor.com'],
    'zh-Hans': ['这不是官方网站', 'PokéSurvivor 只能在官方网站免费游玩，没有广告。', '前往 pokesurvivor.com 游玩'],
    'zh-Hant': ['這不是官方網站', 'PokéSurvivor 只能在官方網站免費遊玩，沒有廣告。', '前往 pokesurvivor.com 遊玩']
  };
  var copy = texts[lang] || texts.en;

  function show() {
    var url = 'https://pokesurvivor.com' + location.pathname + location.search;
    var box = document.createElement('div');
    box.setAttribute('translate', 'no');
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
      'padding:16px;background:#0a1430;color:#fff;font:16px/1.5 system-ui,sans-serif;text-align:center';
    var inner = document.createElement('div');
    inner.style.cssText = 'max-width:440px';
    var h = document.createElement('h1');
    h.style.cssText = 'margin:0 0 12px;font-size:24px;color:#ffd84a';
    h.textContent = copy[0];
    var p = document.createElement('p');
    p.style.cssText = 'margin:0 0 20px';
    p.textContent = copy[1];
    // _top saca al jugador del marco; si la web lo impide, se abre aparte.
    var a = document.createElement('a');
    a.href = url; a.target = '_top'; a.rel = 'noopener';
    a.style.cssText = 'display:inline-block;padding:12px 20px;border-radius:10px;background:#ffd84a;color:#0a1430;' +
      'font-weight:700;text-decoration:none';
    a.textContent = copy[2];
    a.addEventListener('click', function (e) {
      try { window.top.location.href = url; e.preventDefault(); } catch (err) { a.target = '_blank'; }
    });
    inner.appendChild(h); inner.appendChild(p); inner.appendChild(a);
    box.appendChild(inner);
    document.body.appendChild(box);
  }
  if (document.body) show();
  else document.addEventListener('DOMContentLoaded', show);
})();
