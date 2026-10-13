/* ============ input.js — teclado y ratón (el táctil está en touch.js) ============ */
G.Input = (() => {
  const down = new Set();
  const pressed = new Set();   // se limpia cada frame
  let mx = 0, my = 0, mdown = false;

  const MOVE_KEYS = {
    up: ['keyw', 'arrowup'], down: ['keys', 'arrowdown'],
    left: ['keya', 'arrowleft'], right: ['keyd', 'arrowright']
  };

  function code(e) { return (e.code || e.key).toLowerCase(); }

  addEventListener('keydown', e => {
    const c = code(e);
    if (!down.has(c)) pressed.add(c);
    down.add(c);
    // Evita que el navegador haga scroll con flechas/espacio durante el juego.
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space', 'tab'].includes(c)) e.preventDefault();
  });
  addEventListener('keyup', e => down.delete(code(e)));
  addEventListener('blur', () => { down.clear(); });
  addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  addEventListener('mousedown', () => mdown = true);
  addEventListener('mouseup', () => mdown = false);

  return {
    /** Vector de movimiento del jugador (teclado o joystick táctil). */
    axis() {
      const t = G.Touch && G.Touch.vector();
      if (t && (t[0] || t[1])) return t;
      let x = 0, y = 0;
      if (MOVE_KEYS.left.some(k => down.has(k))) x -= 1;
      if (MOVE_KEYS.right.some(k => down.has(k))) x += 1;
      if (MOVE_KEYS.up.some(k => down.has(k))) y -= 1;
      if (MOVE_KEYS.down.some(k => down.has(k))) y += 1;
      return G.U.norm(x, y);
    },
    held(c) { return down.has(c); },
    /** true sólo en el frame en que se pulsó. */
    tap(c) { return pressed.has(c); },
    mouse() { return { x: mx, y: my, down: mdown }; },
    /**
     * Posición del cursor en coordenadas de mundo (para "Apuntado: hacia el
     * cursor"). Se convierte el píxel CSS sobre el canvas con la escala y el
     * origen de G.Camera. Sin cámara lista, devuelve null.
     */
    worldMouse() {
      if (!G.Camera || !G.Camera.scale) return null;
      const cv = document.getElementById('game');
      const r = cv ? cv.getBoundingClientRect() : null;
      const dx = r ? mx - r.left : mx, dy = r ? my - r.top : my;
      const s = G.Camera.scale;
      return { x: G.Camera.left() + dx / s, y: G.Camera.top() + dy / s };
    },
    /**
     * Ángulo desde (x, y) hacia donde apunta el cursor, o null si no hay
     * cursor utilizable (p. ej. en táctil).
     */
    cursorAim(x, y) {
      if (G.Touch && G.Touch.active) return null;
      const w = this.worldMouse();
      if (!w) return null;
      if (Math.hypot(w.x - x, w.y - y) < 2) return null;
      return Math.atan2(w.y - y, w.x - x);
    },
    endFrame() { pressed.clear(); }
  };
})();
