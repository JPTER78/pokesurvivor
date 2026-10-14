/* ============ touch.js — controles táctiles ============
 * Joystick flotante: pones el dedo en cualquier sitio de la pantalla de juego
 * y ahí aparece; arrastras para moverte y al soltar desaparece. Si el dedo se
 * aleja más que el radio, la base le sigue (nunca se queda "atascado").
 *
 * Botones del HUD (iconos de ataque, pausa): el HUD los registra en cada
 * fotograma con addButton(); un toque (o un clic con el ratón) sobre uno lo
 * pulsa en vez de abrir el joystick. Varios dedos a la vez funcionan.
 *
 * Joystick fijo (Ajustes > Controles > Colocar los botones): siempre en el
 * mismo sitio; sólo se coge tocando cerca de él.
 */
G.Touch = (() => {
  let cv = null, stick = null;
  let active = G.Settings.touch;      // ¿se está usando táctil?
  let buttons = [];

  const R = () => 56 * (G.Settings.get('stick') || 1);

  /** Dónde ha colocado el jugador una cosa ('bar', 'pause', 'stick'): [x, y] en 0..1, o null. */
  function spot(k) { const p = G.Settings.get('pad'); return p && Array.isArray(p[k]) ? p[k] : null; }
  const STICK_DEF = [0.14, 0.72];
  const fixed = () => G.Settings.get('stickMode') === 'fixed';
  /** Centro del joystick fijo, en px de pantalla. */
  function stickBase(w = G.Viewport.size.width, h = G.Viewport.size.height) {
    return G.ControlLayout.stick(w, h, safeArea(), spot('stick') || STICK_DEF, R());
  }

  function init(canvas) {
    cv = canvas;
    if (active) document.body.classList.add('touch');
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('lostpointercapture', up);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    // iPhone: la pulsación larga sobre el juego abría la lupa y el menú de
    // "Copiar / Seleccionar todo". Cortar el toque aquí lo evita.
    // Touch owns the whole finger lifecycle. Ignore its companion pointer
    // events, so a second finger works in WebKit without duplicate actions.
    cv.addEventListener('touchstart', e => {
      if (e.cancelable) e.preventDefault();
      activate();
      for (const t of e.changedTouches) begin('t' + t.identifier, G.Viewport.toLocal(t), true);
    }, { passive: false });
    cv.addEventListener('touchmove', e => {
      if (e.cancelable) e.preventDefault();
      for (const t of e.changedTouches) moveStick('t' + t.identifier, G.Viewport.toLocal(t));
    }, { passive: false });
    for (const ev of ['touchend', 'touchcancel']) cv.addEventListener(ev, e => {
      for (const t of e.changedTouches) end('t' + t.identifier);
    });
    document.addEventListener('selectstart', e => {
      if (!e.target.closest || !e.target.closest('input, textarea, [contenteditable]')) e.preventDefault();
    });
    addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
  }

  function hit(x, y) {
    for (let i = buttons.length - 1; i >= 0; i--) {
      const b = buttons[i];
      if (x >= b.x - b.pad && x <= b.x + b.w + b.pad && y >= b.y - b.pad && y <= b.y + b.h + b.pad) return b;
    }
    return null;
  }

  function activate() {
    if (!active) {
      active = true; document.body.classList.add('touch');
      if (G.Game) G.Game.checkOrientation();
      G.Viewport.refresh();
    }
  }

  function down(e) {
    if (e.pointerType === 'touch') return;
    const touchy = e.pointerType !== 'mouse';
    if (touchy) activate();
    if (!begin('p' + e.pointerId, G.Viewport.toLocal(e), touchy)) return;
    e.preventDefault();
    if (stick && stick.id === 'p' + e.pointerId) {
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    }
  }

  function begin(id, p, touchy) {
    if (!p) return false;
    const b = hit(p.x, p.y);
    if (b) { b.fn(); return true; }
    if (!touchy || stick || !G.Game || G.Game.state !== 'playing') return false;
    if (fixed()) {
      // Fijo: sólo si el dedo cae cerca del joystick (si no, no hace nada).
      const b0 = stickBase();
      if (Math.hypot(p.x - b0.x, p.y - b0.y) > R() * 2.2) return false;
      stick = { id, fixed: true, ox: b0.x, oy: b0.y, x: p.x, y: p.y };
    } else {
      stick = { id, ox: p.x, oy: p.y, x: p.x, y: p.y };
    }
    return true;
  }

  function move(e) {
    if (e.pointerType !== 'touch') moveStick('p' + e.pointerId, G.Viewport.toLocal(e));
  }

  function moveStick(id, p) {
    if (!stick || id !== stick.id || !p) return;
    stick.x = p.x; stick.y = p.y;
    if (stick.fixed) return;
    const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy), r = R();
    if (d > r) { stick.ox = stick.x - dx / d * r; stick.oy = stick.y - dy / d * r; }
  }

  function end(id) { if (stick && id === stick.id) stick = null; }
  function up(e) { end('p' + e.pointerId); }
  function reset() { stick = null; }

  /** Dirección del joystick (con fuerza 0..1), o null si no se usa. */
  function vector() {
    if (!stick) return null;
    const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy);
    if (d < 7) return [0, 0];
    // A partir de medio radio ya va a toda velocidad.
    const k = Math.min(1, (d - 7) / (R() * 0.5 - 7));
    return [dx / d * k, dy / d * k];
  }

  /** Márgenes del iPhone (barra de inicio abajo, muesca a los lados), en px. */
  function safeArea() { return G.Viewport.safeArea(); }

  /** El HUD vacía y vuelve a registrar sus botones cada fotograma. */
  function clearButtons() { buttons = []; }
  function addButton(x, y, w, h, fn, pad = 6) { buttons.push({ x, y, w, h, fn, pad }); }

  /** Dibuja el joystick (coordenadas de pantalla, CSS px). */
  function draw(ctx) {
    // El fijo se ve siempre (más tenue sin tocarlo), para saber dónde está.
    const base = !stick && fixed() && active ? stickBase() : null;
    if (!stick && !base) return;
    const s = stick || { ox: base.x, oy: base.y, x: base.x, y: base.y };
    drawStick(ctx, s, R(), base ? 0.55 : 1);
  }
  /** Dibuja un joystick (también lo usa el editor de botones); k: opacidad. */
  function drawStick(ctx, stick, r, k = 1) {
    const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy);
    const kx = stick.ox + (d > r ? dx / d * r : dx), ky = stick.oy + (d > r ? dy / d * r : dy);
    ctx.save();
    ctx.globalAlpha = 0.5 * k;
    ctx.fillStyle = 'rgba(10,20,48,.55)';
    ctx.beginPath(); ctx.arc(stick.ox, stick.oy, r, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#f4f8ff';
    ctx.stroke();
    ctx.globalAlpha = 0.85 * k;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(kx, ky, r * 0.42, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#a55f00'; ctx.stroke();
    ctx.restore();
  }

  return { init, vector, draw, drawStick, clearButtons, addButton, reset, safeArea, spot, stickBase, R, STICK_DEF,
           get active() { return active; }, get stick() { return stick; } };
})();
