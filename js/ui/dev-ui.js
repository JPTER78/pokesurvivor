/* ============ dev-ui.js — herramientas de desarrollo (sólo con ?dev) ============
 * Esto NO se publica: en dev.html va dentro del bloque <!-- dev:begin --> (que
 * tools/build.js quita al generar index.html) y no está en la lista de scripts
 * que se empaquetan. Sirve para probar cosas sin abrir la consola: subir de nivel
 * de clic en clic y dar o quitar Pokémon para simular que la evolución siguiente
 * está (o no) desbloqueada, y así ver la carta dorada y el aviso de bloqueo.
 *
 * Ojo: si juegas con cuenta (no invitado), el cambio se guarda y se sincroniza
 * de verdad. Úsalo con la cuenta de pruebas.
 */
G.DevUI = (() => {
  const $ = G.UI.$;
  let mirando = 0;                  // dex del Pokémon que se está mirando

  /** Sólo con ?dev en la dirección. */
  const cuadra = () => /[?&]dev\b/.test(location.search);
  const save = () => (G.DB && G.DB.save) || null;
  const owns = d => !!(save() && save().owned && save().owned[d]);

  /** Da o quita un Pokémon (cambia la partida de verdad: es una herramienta). */
  function toggle(d) {
    const s = save();
    if (!s || !G.DEX_BY[d]) return false;
    if (s.owned[d]) {
      delete s.owned[d];
      if (s.shiny) delete s.shiny[d];            // un shiny sin el normal no vale
      if (s.partner === d) s.partnerShiny = false;
    } else {
      G.DB.grant(d, 'dev');
    }
    G.DB.commit(true);                            // en invitado no hace nada
    return true;
  }

  /** ¿Hay partida en curso? (fuera de ella no se puede subir de nivel) */
  function enRun() {
    const e = G.Game && G.Game.state;
    return !!(G.Game && G.Game.player && e !== 'ui' && e !== 'over');
  }

  /**
   * Sube de nivel la partida en curso, de uno en uno como el juego (usa el
   * atajo de siempre, así que la partida queda marcada como amañada y no
   * cuenta para la clasificación).
   */
  function subir(n) {
    if (!enRun()) return false;
    const veces = (n === undefined || n < 1) ? 1 : n;
    for (let i = 0; i < veces; i++) G.Game.debugLevelUp();
    return true;
  }

  /** Busca por número o por nombre (primero los que empiezan por lo escrito). */
  function find(texto) {
    const t = (texto || '').trim().toLowerCase();
    if (!t) return 0;
    if (/^\d+$/.test(t)) return G.DEX_BY[+t] ? +t : 0;
    const hit = G.DEX.find(m => m.name.toLowerCase().startsWith(t))
             || G.DEX.find(m => m.name.toLowerCase().indexOf(t) >= 0);
    return hit ? hit.dex : 0;
  }

  /** Repinta el cacharro: el Pokémon mirado, su estado y su línea evolutiva. */
  function paint() {
    const bar = $('dev-bar');
    if (!bar || bar.classList.contains('cerrado')) return;
    const pl = G.Game && G.Game.player;
    const escrito = $('dev-q').value.trim();
    // Si escribes y no hay nada, no se toca a nadie (ni al que estás jugando).
    mirando = find(escrito) || (escrito ? 0 : (pl ? pl.dex : 0));
    const m = G.DEX_BY[mirando] || null;
    $('dev-who').textContent = m ? m.name : (escrito ? '—' : '');
    const b = $('dev-toggle');
    const tiene = !!m && owns(mirando);
    b.textContent = m ? (tiene ? 'Quitar' : 'Tener') : '—';
    b.disabled = !m;
    b.className = 'dev-btn ' + (tiene ? 'on' : 'off');
    // La línea entera (su primera forma, la de en medio y la final), a un clic.
    const lin = (m && G.Evo.line(mirando)) || (m ? [mirando] : []);
    const box = $('dev-line');
    box.innerHTML = '';
    for (const d of lin) {
      const el = document.createElement('button');
      const ya = owns(d);
      el.className = 'dev-chip ' + (ya ? 'si' : 'no');
      el.textContent = G.DEX_BY[d].name + (ya ? ' ✓' : ' ✗');
      el.title = (ya ? 'Quitar ' : 'Dar ') + G.DEX_BY[d].name;
      el.onclick = () => { toggle(d); paint(); };
      box.appendChild(el);
    }
    // Subir de nivel sólo vale en una partida (y se ve si está o no).
    const jugando = enRun();
    for (const id of ['dev-level', 'dev-level5']) $(id).disabled = !jugando;
    $('dev-level').title = jugando
      ? 'Sube un nivel (nivel ' + G.Game.player.level + ')'
      : 'Subir de nivel: sólo dentro de una partida';
  }

  function init() {
    const bar = $('dev-bar');
    if (!bar) return;
    if (!cuadra()) { bar.remove(); return; }        // sin ?dev no se enseña nada
    $('dev-q').value = '';                          // el navegador recuerda lo escrito: se empieza mirando al que juegas
    $('dev-q').oninput = paint;
    $('dev-toggle').onclick = () => { toggle(mirando); paint(); };
    $('dev-tag').onclick = () => { bar.classList.toggle('cerrado'); paint(); };
    $('dev-level').onclick = () => { subir(1); paint(); };
    $('dev-level5').onclick = () => { subir(5); paint(); };
    paint();
    setInterval(paint, 700);                        // cambia al evolucionar o al empezar una run
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init);
  else init();

  return { init, paint, toggle, subir, owns, find, enRun };
})();
