/* ============ layout-ui.js — colocar los botones (móvil) ============
 * Ajustes > Controles > Colocar los botones: se ven los ataques (con el
 * objeto), la pausa y, si es fijo, el joystick, y se arrastran a donde se
 * quiera. Se guarda el centro de cada cosa en proporción a la pantalla
 * (G.Settings 'pad'); lo que no se mueve se queda en su sitio de siempre.
 * El HUD (hud.js) y el joystick (touch.js) leen esas posiciones.
 * La geometría se comparte con el HUD en core/control-layout.js.
 */
G.LayoutUI = (() => {
  const { S, GAP, ITEM_GAP } = G.ControlLayout, N = 4;
  const BAR_W = S + ITEM_GAP + N * S + (N - 1) * GAP;
  let el = null, pos = null, moved = null, mode = 'float';
  const cancelDrags = new Set();
  let normalized = {};
  function remember() {
    const { width: w, height: h } = G.Viewport.size;
    normalized = {};
    for (const k in pos) normalized[k] = [pos[k][0] / w, pos[k][1] / h];
  }

  /** Dónde está cada cosa ahora mismo (centro en px), con lo guardado o lo de siempre. */
  function current(k, w, h, p = G.Touch.spot(k)) {
    if (k === 'stick') { const b = G.Touch.stickBase(w, h); return [b.x, b.y]; }
    const sa = G.Touch.safeArea();
    if (k === 'bar') {
      const b = G.ControlLayout.bar(w, h, sa, p, N);
      return [b.x + b.width / 2, b.y + b.height / 2];
    }
    const b = G.ControlLayout.pause(w, h, sa, p);
    return [b.x + b.width / 2, b.y + b.height / 2];
  }

  /** Lo mismo que hace el HUD para que no se salga de la pantalla. */
  function fit(k, x, y, w, h) {
    const sa = G.Touch.safeArea(), p = [x / w, y / h];
    if (k !== 'stick') {
      const b = k === 'bar' ? G.ControlLayout.bar(w, h, sa, p, N) : G.ControlLayout.pause(w, h, sa, p);
      return [b.x + b.width / 2, b.y + b.height / 2];
    }
    const r = G.Touch.R();
    const b = G.ControlLayout.stick(w, h, sa, p, r);
    return [b.x, b.y];
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
          <button class="chip" data-m="float">Flotante</button><button class="chip" data-m="fixed">Fijo</button>
        </div>
        <small class="lay-help">Flotante: aparece donde pones el dedo. Fijo: siempre en el mismo sitio.</small>
        <div class="row wrap lay-btns">
          <button class="btn small ghost" id="lay-cancel">Cancelar</button>
          <button class="btn small" id="lay-reset">Restablecer</button>
          <button class="btn small gold" id="lay-save">Guardar</button>
        </div>
      </div>`;
    document.getElementById('app').appendChild(el);
    el.querySelectorAll('.lay-thing').forEach(drag);
    el.querySelectorAll('#lay-mode .chip').forEach(b => { b.onclick = () => { mode = b.dataset.m; paint(); }; });
    el.querySelector('#lay-cancel').onclick = close;
    el.querySelector('#lay-reset').onclick = () => {
      moved = {}; mode = 'float';
      const { width: w, height: h } = G.Viewport.size;
      pos = { bar: current('bar', w, h, null), pause: current('pause', w, h, null),
              stick: [G.Touch.STICK_DEF[0] * w, G.Touch.STICK_DEF[1] * h] };
      for (const k in pos) pos[k] = fit(k, pos[k][0], pos[k][1], w, h);
      remember();
      paint();
    };
    el.querySelector('#lay-save').onclick = save;
    G.Viewport.on(({ width: w, height: h }) => {
      if (!isOpen()) return;
      cancelDrags.forEach(fn => fn());
      // Preserve unsaved edits through orientation/viewport changes.
      for (const k in pos) {
        const p = normalized[k];
        pos[k] = fit(k, p[0] * w, p[1] * h, w, h);
      }
      paint();
    });
  }

  function drag(node) {
    const k = node.dataset.k;
    let off = null, id = null;
    node.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (off) return;
      const p = G.Viewport.toLocal(e, el);
      if (!p) return;
      id = e.pointerId;
      off = [p.x - pos[k][0], p.y - pos[k][1]];
      node.classList.add('held');
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    });
    node.addEventListener('pointermove', e => {
      if (!off || e.pointerId !== id) return;
      const p = G.Viewport.toLocal(e, el), { width: w, height: h } = G.Viewport.size;
      if (!p) return;
      pos[k] = fit(k, p.x - off[0], p.y - off[1], w, h);
      normalized[k] = [pos[k][0] / w, pos[k][1] / h];
      moved[k] = true;
      paint();
    });
    const cancel = () => {
      const oldId = id;
      off = null; id = null; node.classList.remove('held');
      try { if (oldId !== null && node.hasPointerCapture(oldId)) node.releasePointerCapture(oldId); } catch (err) { /* nada */ }
    };
    cancelDrags.add(cancel);
    const up = e => { if (e.pointerId === id) cancel(); };
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    node.addEventListener('lostpointercapture', up);
  }

  function load() {
    const { width: w, height: h } = G.Viewport.size;
    pos = {}; moved = {};
    for (const k of ['bar', 'pause', 'stick']) {
      const c = current(k, w, h);
      pos[k] = fit(k, c[0], c[1], w, h);
      moved[k] = !!G.Touch.spot(k);
    }
    remember();
  }

  function paint() {
    const { width: w, height: h } = G.Viewport.size;
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
    el.querySelector('.lay-turn').classList.toggle('hidden', w >= h);
  }

  function save() {
    const { width: w, height: h } = G.Viewport.size, pad = {};
    for (const k in pos) if (moved[k]) pad[k] = [+(pos[k][0] / w).toFixed(4), +(pos[k][1] / h).toFixed(4)];
    G.Settings.set('pad', Object.keys(pad).length ? pad : null);
    G.Settings.set('stickMode', mode);
    G.UI.toast('Botones colocados');
    close();
  }

  function open() {
    if (!el) build();
    mode = G.Settings.get('stickMode') === 'fixed' ? 'fixed' : 'float';
    load();
    el.classList.remove('hidden');
    paint();
  }
  function close() { cancelDrags.forEach(fn => fn()); if (el) el.classList.add('hidden'); }
  const isOpen = () => !!el && !el.classList.contains('hidden');

  return { open, close, get isOpen() { return isOpen(); } };
})();
