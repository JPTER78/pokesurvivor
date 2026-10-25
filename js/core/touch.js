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
 *
 * Con las cartas de nivel, de objeto o de vínculo abiertas (el juego espera a
 * que elijas) el joystick también se coge, tocando fuera del recuadro: al
 * cerrarse ya te mueves, como quien deja pulsada la tecla o el stick del mando.
 *
 * Apuntar a mano (Ajustes > Accesibilidad, 25-10-2026): un segundo joystick.
 * El dedo en la mitad izquierda mueve y el de la derecha apunta (con el
 * joystick fijo, cualquier sitio lejos de él); al soltarlo, apunta solo.
 */
G.Touch = (() => {
  let cv = null, stick = null, aimStick = null;
  // Estados de la partida en los que se coge el joystick (ver arriba).
  const RUN = new Set(['playing', 'levelup', 'choice', 'held']);
  const aimOn = () => !!G.Settings.get('aimManual');
  let active = G.Settings.touch;      // ¿se está usando táctil?
  let buttons = [];

  const R = () => 56 * (G.Settings.get('stick') || 1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** Dónde ha colocado el jugador una cosa ('bar', 'pause', 'stick'): [x, y] en 0..1, o null. */
  function spot(k) { const p = G.Settings.get('pad'); return p && Array.isArray(p[k]) ? p[k] : null; }
  const STICK_DEF = [0.14, 0.72];
  const fixed = () => G.Settings.get('stickMode') === 'fixed';
  /** Centro del joystick fijo, en px de pantalla. */
  function stickBase(w = cv.clientWidth, h = cv.clientHeight) {
    const p = spot('stick') || STICK_DEF, r = R();
    return { x: clamp(p[0] * w, r + 4, w - r - 4), y: clamp(p[1] * h, r + 4, h - r - 4) };
  }

  function init(canvas) {
    cv = canvas;
    if (active) document.body.classList.add('touch');
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    // Cartas abiertas: un toque fuera del recuadro (o, con el joystick fijo, en él
    // pero no en una carta ni en un botón) coge el joystick.
    document.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || e.target === cv || !G.Game || !RUN.has(G.Game.state) || G.Game.state === 'playing') return;
      const t = e.target;
      if (!t || !t.closest || !t.closest('#scr-levelup, #scr-bond, #scr-item')) return;
      if (t.closest('.card, button, a, input, select, textarea, label')) return;
      if (!fixed() && t.closest('.box')) return;           // dentro: tocar y desplazar como siempre
      if (grab(e, false)) e.preventDefault();
    }, true);
    // iPhone: la pulsación larga sobre el juego abría la lupa y el menú de
    // "Copiar / Seleccionar todo". Cortar el toque aquí lo evita (los eventos
    // pointer, que son los que usa el joystick, siguen llegando).
    // Además, los botones (movimientos, pausa) se pulsan también desde aquí: en
    // iPhone (Safari y Chrome usan WebKit) a veces no llegaba el pointerdown de
    // un segundo dedo con el otro en el joystick y no se podía cambiar de movimiento.
    cv.addEventListener('touchstart', e => {
      if (e.cancelable) e.preventDefault();
      if (!active) { active = true; document.body.classList.add('touch'); }
      for (const t of e.changedTouches) { const b = hit(t.clientX, t.clientY); if (b) press(b); }
    }, { passive: false });
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

  // Un mismo toque llega por touchstart y por pointerdown: se pulsa una sola vez.
  let lastKey = '', lastAt = 0;
  function press(b) {
    const k = Math.round(b.x) + ',' + Math.round(b.y), now = performance.now();
    if (k === lastKey && now - lastAt < 350) return;
    lastKey = k; lastAt = now;
    b.fn();
  }

  function down(e) {
    const touchy = e.pointerType !== 'mouse';
    if (touchy && !active) { active = true; document.body.classList.add('touch'); }
    const b = hit(e.clientX, e.clientY);
    if (b) { e.preventDefault(); press(b); return; }
    if (!touchy || !G.Game || !RUN.has(G.Game.state)) return;
    if (grab(e, G.Game.state === 'playing')) e.preventDefault();
  }

  /** Coge el joystick de moverse (o, jugando y con Apuntar a mano, el de apuntar). → true si ha cogido alguno. */
  function grab(e, canAim) {
    const x = e.clientX, y = e.clientY, id = e.pointerId;
    canAim = canAim && aimOn();
    if (fixed()) {
      // Fijo: el de moverse sólo si el dedo cae cerca; lejos, el de apuntar.
      const b0 = stickBase();
      if (Math.hypot(x - b0.x, y - b0.y) <= R() * 2.2) {
        if (stick) return false;
        stick = { id, fixed: true, ox: b0.x, oy: b0.y, x, y };
      } else if (canAim && !aimStick) aimStick = { id, ox: x, oy: y, x, y };
      else return false;
    } else if (canAim && x > cv.clientWidth / 2) {
      if (aimStick) return false;
      aimStick = { id, ox: x, oy: y, x, y };
    } else {
      if (stick) return false;
      stick = { id, ox: x, oy: y, x, y };
    }
    try { cv.setPointerCapture(id); } catch (err) { /* nada */ }
    return true;
  }

  function move(e) {
    const s = stick && e.pointerId === stick.id ? stick : aimStick && e.pointerId === aimStick.id ? aimStick : null;
    if (!s) return;
    s.x = e.clientX; s.y = e.clientY;
    if (s.fixed) return;
    const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), r = R();
    if (d > r) { s.ox = s.x - dx / d * r; s.oy = s.y - dy / d * r; }
  }

  function up(e) {
    if (stick && e.pointerId === stick.id) stick = null;
    if (aimStick && e.pointerId === aimStick.id) aimStick = null;
  }
  function reset() { stick = null; aimStick = null; }

  /** Hacia dónde apunta el joystick de apuntar ([x, y] de largo 1), o null (apunta solo). */
  function aim() {
    if (!aimStick || !aimOn()) return null;
    const dx = aimStick.x - aimStick.ox, dy = aimStick.y - aimStick.oy, d = Math.hypot(dx, dy);
    return d < 12 ? null : [dx / d, dy / d];
  }

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
  let safe = null;
  function safeArea() {
    if (safe) return safe;
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(d);
    const cs = getComputedStyle(d);
    safe = { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0,
             bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
    d.remove();
    return safe;
  }
  addEventListener('resize', () => { safe = null; });
  addEventListener('orientationchange', () => { safe = null; });
  function resetSafe() { safe = null; }

  /** El HUD vacía y vuelve a registrar sus botones cada fotograma. */
  function clearButtons() { buttons = []; }
  function addButton(x, y, w, h, fn, pad = 6) { buttons.push({ x, y, w, h, fn, pad }); }

  /** Dibuja el joystick (coordenadas de pantalla, CSS px). */
  function draw(ctx) {
    // El fijo se ve siempre (más tenue sin tocarlo), para saber dónde está.
    const base = !stick && fixed() && active ? stickBase() : null;
    if (aimStick && aimOn()) drawStick(ctx, aimStick, R(), 1, '#ff7a5c', '#8a2a14');
    if (!stick && !base) return;
    const s = stick || { ox: base.x, oy: base.y, x: base.x, y: base.y };
    drawStick(ctx, s, R(), base ? 0.55 : 1);
  }
  /** Dibuja un joystick (también lo usa el editor de botones); k: opacidad. */
  function drawStick(ctx, stick, r, k = 1, knob = '#ffd23f', rim = '#a55f00') {
    const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy);
    const kx = stick.ox + (d > r ? dx / d * r : dx), ky = stick.oy + (d > r ? dy / d * r : dy);
    ctx.save();
    ctx.globalAlpha = 0.5 * k;
    ctx.fillStyle = 'rgba(10,20,48,.55)';
    ctx.beginPath(); ctx.arc(stick.ox, stick.oy, r, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#f4f8ff';
    ctx.stroke();
    ctx.globalAlpha = 0.85 * k;
    ctx.fillStyle = knob;
    ctx.beginPath(); ctx.arc(kx, ky, r * 0.42, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = rim; ctx.stroke();
    ctx.restore();
  }

  return { init, vector, aim, draw, drawStick, clearButtons, addButton, reset, safeArea, resetSafe, spot, stickBase, R, STICK_DEF,
           get active() { return active; }, get stick() { return stick; } };
})();
