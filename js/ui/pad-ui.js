/* ============ pad-ui.js — pantalla del mando (Ajustes > Controles > Mando) ============
 * Qué botón hace cada cosa. Se abre encima de Ajustes y al cerrar vuelve ahí.
 *   - Repartos ya hechos (G.Pad.PRESETS): un toque y listo.
 *   - Botón a botón: cada acción enseña sus botones; se toca uno para
 *     cambiarlo, «+» para añadir otro y «×» para quitarlo.
 *   - Sticks: zona muerta e intercambiarlos.
 *   - Restablecer: todo como venía.
 * La lógica (qué se puede asignar y a qué) está en core/gamepad.js.
 */
G.PadUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FLECHA = { up: '↑', down: '↓', left: '←', right: '→' };
  let listo = false, reloj = null, probado = null;

  function open() {
    if (!listo) { listo = true; $('pad-close').onclick = close; }
    $('scr-pad').classList.remove('hidden');
    probado = G.Pad.ultimo;
    render();
    // La prueba («has pulsado…») se mira unas cuantas veces por segundo.
    reloj = setInterval(prueba, 120);
  }

  function close() {
    $('scr-pad').classList.add('hidden');
    G.Pad.cancelar();
    clearInterval(reloj);
    G.SettingsUI.refresh();   // la línea «Ahora: …» de Ajustes
  }
  const isOpen = () => !$('scr-pad').classList.contains('hidden');

  // ---------------- piezas ----------------

  const h = (t, sub) => `<h3 class="set-h">${esc(t)}</h3>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}`;

  function presets() {
    const P = G.Pad, cur = P.presetActual();
    return `<div class="pad-presets">${P.PRESETS.map(p =>
        `<button class="pad-preset ${p.id === cur ? 'on' : ''}" data-preset="${p.id}"><b>${esc(p.nombre)}</b><small>${esc(p.desc)}</small></button>`).join('')}</div>`
      + (cur ? '' : `<p class="sub pad-nota">Ahora: Personalizado (lo has cambiado botón a botón).</p>`);
  }

  function fila(a) {
    const P = G.Pad, esp = P.capturando, bs = P.botonesDe(a.id);
    const aqui = !!esp && esp.id === a.id;
    const chips = bs.map(n => {
      const wait = aqui && esp.sobre === n;
      // Se puede quitar si le queda otro, o si la acción puede estar sin botón.
      const sobra = bs.length > 1 || !a.fijo;
      return `<span class="pad-g"><button class="pad-b ${wait ? 'wait' : ''}" data-id="${a.id}" data-b="${n}" title="Cambiar este botón"${wait ? '' : ' translate="no"'}>${
          wait ? 'Pulsa…' : esc(P.BOTONES[n])}</button>${
          sobra ? `<button class="pad-b pad-x" data-id="${a.id}" data-del="${n}" title="Quitar este botón" translate="no">×</button>` : ''}</span>`;
    }).join('');
    const mas = aqui && !esp.sobre;
    return `<div class="set-row pad-row"><div class="grow"><b>${esc(a.nombre)}</b></div>
      <div class="pad-bs">${chips}<button class="pad-b add ${mas ? 'wait' : ''}" data-id="${a.id}" data-add="1" title="Añadir un botón">${
          mas ? 'Pulsa…' : bs.length ? '+' : 'Sin botón  +'}</button></div></div>`;
  }

  function render(keep) {
    const P = G.Pad, box = $('pad-body');
    const top = keep === true ? box.scrollTop : 0;
    const foco = keep === true ? selector(box.querySelector('.gp-foco')) : null;
    const de = ctx => P.ACCIONES.filter(a => a.ctx === ctx).map(fila).join('');
    const dead = G.Settings.get('padDead'), swap = !!G.Settings.get('padSwap');
    box.innerHTML = h('Repartos ya hechos', 'Elige el que más se parezca a tu consola. Después puedes retocarlo abajo.')
      + presets()
      + h('Botón a botón', 'Toca un botón para cambiarlo y pulsa en el mando el que quieras. «+» añade otro y «×» lo quita.')
      + `<div class="pad-test">¿No sabes cuál es cuál? Pulsa un botón del mando: <b id="pad-test">—</b></div>`
      + `<h4 class="pad-h">En partida</h4>` + de('juego')
      + `<h4 class="pad-h">En los menús</h4>` + de('menu')
      + h('Sticks', 'Moverse y apuntar van siempre con los sticks (o la cruceta).')
      + `<div class="set-row"><div class="grow"><b>Zona muerta</b><small>Súbela si el Pokémon se mueve solo.</small></div></div>`
      + `<div class="chips set-chips">${[[0.15, 'Baja'], [0.25, 'Media'], [0.4, 'Alta']].map(([v, l]) =>
           `<button class="chip ${v === dead ? 'on' : ''}" data-dead="${v}">${l}</button>`).join('')}</div>`
      + `<div class="set-row"><div class="grow"><b>Intercambiar los sticks</b><small>Moverse con el derecho y apuntar con el izquierdo.</small></div>
           <button class="btn small switch ${swap ? 'gold' : ''}" id="pad-swap">${swap ? 'Sí' : 'No'}</button></div>`
      + h('Empezar de cero')
      + `<div class="set-row"><div class="grow"><b>Restablecer</b><small>Botones, zona muerta y sticks como venían.</small></div>
           <button class="btn small danger" id="pad-reset">Restablecer</button></div>`;
    wire(box);
    box.scrollTop = top;
    probado = null;
    prueba();
    if (foco) G.Pad.enfocar(box.querySelector(foco));
  }

  /** Selector que encuentra el mismo control después de repintar. */
  function selector(el) {
    if (!el) return null;
    if (el.id) return '#' + el.id;
    const d = el.dataset;
    if (d.preset) return `[data-preset="${d.preset}"]`;
    if (d.dead) return `[data-dead="${d.dead}"]`;
    // Un botón cambiado ya no está: el foco se queda en el «+» de su acción.
    if (d.id) return d.del ? `[data-id="${d.id}"][data-add]` : d.b ? `[data-id="${d.id}"][data-b="${d.b}"], [data-id="${d.id}"][data-add]` : `[data-id="${d.id}"][data-add]`;
    return null;
  }

  function wire(box) {
    const P = G.Pad;
    box.querySelectorAll('[data-preset]').forEach(b => { b.onclick = () => { P.cancelar(); P.preset(b.dataset.preset); render(true); }; });
    box.querySelectorAll('.pad-b[data-b], .pad-b[data-add]').forEach(b => {
      b.onclick = () => {
        const id = b.dataset.id, sobre = b.dataset.b || null, esp = P.capturando;
        // Otra vez el mismo: se cancela.
        if (esp && esp.id === id && esp.sobre === sobre) P.cancelar();
        else P.capturar(id, sobre, (boton, hecho) => {
          if (boton && !hecho) G.UI.toast('Ese botón no se puede mover: otra acción se quedaría sin ninguno');
          if (isOpen()) render(true);
        });
        render(true);
      };
    });
    box.querySelectorAll('[data-del]').forEach(b => { b.onclick = () => { P.cancelar(); P.quitar(b.dataset.id, b.dataset.del); render(true); }; });
    box.querySelectorAll('[data-dead]').forEach(b => { b.onclick = () => { G.Settings.set('padDead', +b.dataset.dead); render(true); }; });
    $('pad-swap').onclick = () => { G.Settings.set('padSwap', !G.Settings.get('padSwap')); render(true); };
    $('pad-reset').onclick = () => { P.cancelar(); P.restablecer(); G.UI.toast('Mando restablecido'); render(true); };
  }

  /** «Has pulsado L1 → Ataque anterior»: para saber qué botón es cuál en esta consola. */
  function prueba() {
    const P = G.Pad, n = P.ultimo, el = $('pad-test');
    if (!el || n === probado) return;
    probado = n;
    if (!n) { el.textContent = '—'; return; }
    const hace = P.ACCIONES.filter(a => P.botonesDe(a.id).includes(n)).map(a => a.nombre);
    el.innerHTML = `<span class="pad-b" translate="no">${esc(P.BOTONES[n] || FLECHA[n] || n)}</span>`
      + (FLECHA[n] ? '' : `<span class="pad-hace">${hace.length ? hace.map(esc).join(' · ') : 'Sin usar'}</span>`);
  }

  return { open, close, get isOpen() { return isOpen(); } };
})();
