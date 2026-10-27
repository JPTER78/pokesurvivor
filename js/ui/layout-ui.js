/* ============ layout-ui.js — colocar los botones (móvil) ============
 * Ajustes > Controles > Colocar los botones: se ven los ataques (con el
 * objeto), la pausa y, si es fijo, el joystick, y se arrastran a donde se
 * quiera. Se guarda el centro de cada cosa en proporción a la pantalla
 * (G.Settings 'pad'); lo que no se mueve se queda en su sitio de siempre.
 * El HUD (hud.js) y el joystick (touch.js) leen esas posiciones.
 * Las medidas copian las del HUD: si cambian allí, cambiarlas aquí.
 */
G.LayoutUI = (() => {
  const S = 54, GAP = 9, ITEM_GAP = 18, N = 4;          // como en hud.js
  const BAR_W = S + ITEM_GAP + N * S + (N - 1) * GAP;
  let el = null, pos = null, moved = null, mode = 'float';

  /** Dónde está cada cosa ahora mismo (centro en px), con lo guardado o lo de siempre. */
  function current(k, w, h) {
    const p = G.Touch.spot(k);
    if (k === 'stick') { const b = G.Touch.stickBase(w, h); return [b.x, b.y]; }
    const sa = G.Touch.safeArea();
    if (k === 'bar') {
      if (p) return [p[0] * w, p[1] * h];
      const totalW = N * S + (N - 1) * GAP;
      const left = (w - totalW) / 2 - S - ITEM_GAP;
      return [left + BAR_W / 2, h - S - 18 - Math.min(28, sa.bottom) + S / 2];
    }
    if (p) return [p[0] * w, p[1] * h];
    return [w - 52 - Math.min(44, sa.right) + 20, 12 + Math.min(20, sa.top) + 20];
  }

  /** Lo mismo que hace el HUD para que no se salga de la pantalla. */
  function fit(k, x, y, w, h) {
    if (k === 'bar') return [G.U.clamp(x, 6 + BAR_W / 2, Math.max(6 + BAR_W / 2, w - BAR_W / 2 - 6)), G.U.clamp(y, 24 + S / 2, h - S / 2 - 6)];
    if (k === 'pause') return [G.U.clamp(x, 24, w - 24), G.U.clamp(y, 30, h - 24)];
    const r = G.Touch.R();
    return [G.U.clamp(x, r + 4, w - r - 4), G.U.clamp(y, r + 4, h - r - 4)];
  }

  function build() {
    el = document.createElement('section');
    el.id = 'scr-layout';
    el.className = 'scr hidden';
    const slots = Array.from({ length: N }, (_, i) => `<div class="lay-slot${i === 0 ? ' on' : ''}"><i>${i + 1}</i></div>`).join('');
    el.innerHTML = `
      <div class="lay-thing lay-bar" data-k="bar"><div class="lay-slot item"></div>${slots}<span class="lay-tag">Ataques</span></div>
      <div class="lay-thing lay-pause" data-k="pause"><b></b><b></b></div>
      <div class="lay-thing lay-stick" data-k="stick"><div class="knob"></div><span class="lay-tag">Joystick</span></div>
      <div class="box lay-panel">
        <h3>Arrastra los botones a donde quieras</h3>
        <p class="lay-turn">Gira el móvil: se juega en horizontal.</p>
        <div class="chips set-chips" id="lay-mode"><b>Joystick</b>
          <button class="chip" data-m="float">Flotante</button><button class="chip" data-m="anchor">Anclado</button><button class="chip" data-m="fixed">Fijo</button>
        </div>
        <small class="lay-help">Flotante: aparece donde pones el dedo. Fijo: siempre en el mismo sitio.</small>
        <small class="lay-help">Anclado: aparece donde pones el dedo y se queda ahí hasta que lo levantas.</small>
        <div class="row wrap lay-btns">
          <button class="btn small ghost" id="lay-cancel">Cancelar</button>
          <button class="btn small" id="lay-reset">Restablecer</button>
          <button class="btn small gold" id="lay-save">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.querySelectorAll('.lay-thing').forEach(drag);
    el.querySelectorAll('#lay-mode .chip').forEach(b => { b.onclick = () => { mode = b.dataset.m; paint(); }; });
    el.querySelector('#lay-cancel').onclick = close;
    el.querySelector('#lay-reset').onclick = () => {
      moved = {}; mode = 'float';
      const w = innerWidth, h = innerHeight, sa = G.Touch.safeArea();
      const totalW = N * S + (N - 1) * GAP;
      pos = { bar: [(w - totalW) / 2 - S - ITEM_GAP + BAR_W / 2, h - S - 18 - Math.min(28, sa.bottom) + S / 2],
              pause: [w - 52 - Math.min(44, sa.right) + 20, 12 + Math.min(20, sa.top) + 20],
              stick: [G.Touch.STICK_DEF[0] * w, G.Touch.STICK_DEF[1] * h] };
      for (const k in pos) pos[k] = fit(k, pos[k][0], pos[k][1], w, h);
      paint();
    };
    el.querySelector('#lay-save').onclick = save;
    addEventListener('resize', () => { if (isOpen()) { load(); paint(); } });
  }

  function drag(node) {
    const k = node.dataset.k;
    let off = null;
    node.addEventListener('pointerdown', e => {
      e.preventDefault();
      off = [e.clientX - pos[k][0], e.clientY - pos[k][1]];
      node.classList.add('held');
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    });
    node.addEventListener('pointermove', e => {
      if (!off) return;
      pos[k] = fit(k, e.clientX - off[0], e.clientY - off[1], innerWidth, innerHeight);
      moved[k] = true;
      paint();
    });
    const up = () => { off = null; node.classList.remove('held'); };
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
  }

  function load() {
    const w = innerWidth, h = innerHeight;
    pos = {}; moved = {};
    for (const k of ['bar', 'pause', 'stick']) {
      const c = current(k, w, h);
      pos[k] = fit(k, c[0], c[1], w, h);
      moved[k] = !!G.Touch.spot(k);
    }
  }

  function paint() {
    const r = G.Touch.R();
    const place = (k, ww, hh) => {
      const n = el.querySelector(`[data-k="${k}"]`);
      n.style.left = (pos[k][0] - ww / 2) + 'px'; n.style.top = (pos[k][1] - hh / 2) + 'px';
      n.style.width = ww + 'px'; n.style.height = hh + 'px';
      return n;
    };
    place('bar', BAR_W, S);
    place('pause', 40, 40);
    place('stick', r * 2, r * 2).classList.toggle('hidden', mode !== 'fixed');
    el.querySelectorAll('#lay-mode .chip').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
    el.querySelector('.lay-turn').classList.toggle('hidden', innerWidth >= innerHeight);
  }

  function save() {
    const w = innerWidth, h = innerHeight, pad = {};
    for (const k in pos) if (moved[k]) pad[k] = [+(pos[k][0] / w).toFixed(4), +(pos[k][1] / h).toFixed(4)];
    G.Settings.set('pad', Object.keys(pad).length ? pad : null);
    G.Settings.set('stickMode', mode);
    G.UI.toast('Botones colocados');
    close();
  }

  function open() {
    if (!el) build();
    mode = ['fixed', 'anchor'].includes(G.Settings.get('stickMode')) ? G.Settings.get('stickMode') : 'float';
    load();
    el.classList.remove('hidden');
    paint();
  }
  function close() { if (el) el.classList.add('hidden'); }
  const isOpen = () => !!el && !el.classList.contains('hidden');

  return { open, close, get isOpen() { return isOpen(); } };
})();
