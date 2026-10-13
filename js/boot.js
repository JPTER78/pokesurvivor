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
  var n = ((navigator.languages && navigator.languages[0]) || navigator.language || 'es').toLowerCase();
  var l = s === 'es' || s === 'en' || s === 'fr' ? s : (/\/en(\/|$)/.test(location.pathname) ? 'en' : (n.indexOf('es') === 0 ? 'es' : n.indexOf('fr') === 0 ? 'fr' : 'en'));
  document.documentElement.lang = l;
  var p = document.querySelectorAll('#boot p');
  if (l === 'en') {
    p[0].textContent = 'A Pokémon survival game, free in your browser and on mobile.';
    p[1].textContent = 'Loading…';
  } else if (l === 'fr') {
    p[0].textContent = 'Un jeu de survie Pokémon, gratuit sur navigateur et sur mobile.';
    p[1].textContent = 'Chargement…';
  }
})();
