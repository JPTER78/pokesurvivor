/* ============ boot.js — lo primero que corre (antes estaba dentro del HTML) ============
 * Fuera del HTML para que la política de seguridad (CSP, en dev.html) pueda
 * prohibir todo el código metido en la página: así, aunque algún día se
 * colara texto con código en algo que se pinta, el navegador no lo ejecuta.
 *   - PS_PAGES: hay guía y Pokédex (no con --sin-seo, ver tools/build.js).
 *   - El idioma de la pantalla de carga, antes de que cargue el juego.
 */
window.PS_PAGES = !!document.querySelector('meta[name="ps-pages"]');
(function () {
  var s = null; try { s = localStorage.getItem('ps.lang'); } catch (e) {}
  var l = s === 'es' || s === 'en' || s === 'zh-Hant' ? s : (/\/en(\/|$)/.test(location.pathname) ? 'en' : 'zh-Hant');
  document.documentElement.lang = l;
  if (l === 'zh-Hant') {
    var p = document.querySelectorAll('#boot p');
    p[0].textContent = '免費寶可夢生存遊戲，支援瀏覽器與手機。';
    p[1].textContent = '載入中…';
  } else if (l === 'en') {
    var p = document.querySelectorAll('#boot p');
    p[0].textContent = 'A Pokémon survival game, free in your browser and on mobile.';
    p[1].textContent = 'Loading…';
  }
})();
