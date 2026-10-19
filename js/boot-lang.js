/* ============ boot-lang.js — idioma de la pantalla de carga ============
 * Antes de que cargue el juego: si va en inglés, cambia los textos de "Cargando…".
 * (Fichero aparte y no dentro del HTML: la política de seguridad, CSP, no deja
 * ejecutar código escrito en la página.) */
(function () {
  var s = null; try { s = localStorage.getItem('ps.lang'); } catch (e) {}
  var n = ((navigator.languages && navigator.languages[0]) || navigator.language || 'es').toLowerCase();
  var l = s === 'es' || s === 'en' ? s : (/\/en(\/|$)/.test(location.pathname) ? 'en' : (n.indexOf('es') === 0 ? 'es' : 'en'));
  document.documentElement.lang = l;
  if (l === 'en') {
    var p = document.querySelectorAll('#boot p');
    p[0].textContent = 'A Pokémon survival game, free in your browser and on mobile.';
    p[1].textContent = 'Loading…';
  }
})();
