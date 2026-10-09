/* ============ touch.js — controles táctiles ============
 * Joystick flotante: pones el dedo en cualquier sitio de la pantalla de juego
 * y ahí aparece; arrastras para moverte y al soltar desaparece. Si el dedo se
 * aleja más que el radio, la base le sigue (nunca se queda "atascado").
 *
 * Botones del HUD (iconos de ataque, pausa): el HUD los registra en cada
 * fotograma con addButton(); un toque (o un clic con el ratón) sobre uno lo
 * pulsa en vez de abrir el joystick. Varios dedos a la vez funcionan.
 */
G.Touch = (() => {
  let cv = null, stick = null;
  let active = G.Settings.touch;      // ¿se está usando táctil?
  let buttons = [];

  const R = () => 56 * (G.Settings.get('stick') || 1);

  function init(canvas) {
    cv = canvas;
    if (active) document.body.classList.add('touch');
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', e => e.preventDefault());
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

  function down(e) {
    const touchy = e.pointerType !== 'mouse';
    if (touchy && !active) { active = true; document.body.classList.add('touch'); }
    const b = hit(e.clientX, e.clientY);
    if (b) { e.preventDefault(); b.fn(); return; }
    if (!touchy || stick || !G.Game || G.Game.state !== 'playing') return;
    e.preventDefault();
    stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
  }

  function move(e) {
    if (!stick || e.pointerId !== stick.id) return;
    stick.x = e.clientX; stick.y = e.clientY;
    const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy), r = R();
    if (d > r) { stick.ox = stick.x - dx / d * r; stick.oy = stick.y - dy / d * r; }
  }

  function up(e) { if (stick && e.pointerId === stick.id) stick = null; }
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

  /** El HUD vacía y vuelve a registrar sus botones cada fotograma. */
  function clearButtons() { buttons = []; }
  function addButton(x, y, w, h, fn, pad = 6) { buttons.push({ x, y, w, h, fn, pad }); }

  /** Dibuja el joystick (coordenadas de pantalla, CSS px). */
  function draw(ctx) {
    if (!stick) return;
    const r = R();
    const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy);
    const kx = stick.ox + (d > r ? dx / d * r : dx), ky = stick.oy + (d > r ? dy / d * r : dy);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(10,20,48,.55)';
    ctx.beginPath(); ctx.arc(stick.ox, stick.oy, r, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#f4f8ff';
    ctx.stroke();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(kx, ky, r * 0.42, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#a55f00'; ctx.stroke();
    ctx.restore();
  }

  return { init, vector, draw, clearButtons, addButton, reset,
           get active() { return active; }, get stick() { return stick; } };
})();
