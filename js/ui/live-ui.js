/* ============ live-ui.js — botón de YouTube ============
 * Botón en la barra de arriba que lleva al canal. Si el canal está en
 * directo, se pone rojo con «EN DIRECTO» y lleva al directo.
 *
 * Saber si hay directo no cuesta nada: .github/workflows/live.yml mira el
 * canal cada 5 min y deja live.json en la rama «live» del repositorio
 * ({ live, id, at }); aquí se lee de GitHub, sin Firebase. Si el aviso es
 * de hace más de 90 min (la comprobación se ha parado), no se hace caso.
 */
G.LiveUI = (() => {
  const $ = G.UI.$;
  const CHANNEL = 'https://www.youtube.com/@jpter78';
  const SRC = 'https://raw.githubusercontent.com/JPTER78/pokesurvivor/live/live.json';
  const EVERY = 5 * 60 * 1000, STALE = 90 * 60 * 1000;
  let live = null, lastT = 0;

  function init() {
    const b = $('btn-yt');
    b.onclick = () => window.open(live ? 'https://www.youtube.com/watch?v=' + live : CHANNEL, '_blank', 'noopener');
    draw();
    check();
    setInterval(check, EVERY);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }

  function draw() {
    const b = $('btn-yt');
    b.classList.toggle('live', !!live);
    b.title = live ? '¡Estoy en directo! Pulsa para verlo' : 'Mi canal de YouTube';
    b.innerHTML = live ? '<i class="rec"></i><span>EN DIRECTO</span>' : G.Icons.html('yt', 18) + ' <span>YouTube</span>';
  }

  async function check() {
    // Sólo con la pestaña a la vista y como mucho una vez cada 5 min.
    if (document.hidden || Date.now() - lastT < EVERY - 5000) return;
    lastT = Date.now();
    try {
      const r = await fetch(SRC, { cache: 'no-cache' });
      if (!r.ok) return;
      const d = await r.json();
      const id = d.live && /^[\w-]{11}$/.test(d.id || '') && Date.now() - Date.parse(d.at) < STALE ? d.id : null;
      if (id !== live) { live = id; draw(); }
    } catch (e) { /* sin red o sin archivo: se queda como estaba */ }
  }

  return { init };
})();
