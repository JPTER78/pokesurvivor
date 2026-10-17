/* ============ input.js — teclado, ratón y mando (el táctil está en touch.js) ============
 * Mando: Gamepad API con la distribución "standard" (la de Xbox / PlayStation
 * en Chrome, Firefox y Safari). Se lee una vez por fotograma con poll(); qué
 * hace cada botón (en partida y en los menús) está en js/ui/padnav.js.
 */
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

  // ---------------- mando ----------------
  // Botones (distribución standard): 0 A · 1 B · 2 X · 3 Y · 4 LB · 5 RB · 6 LT · 7 RT
  // · 8 Select/Back · 9 Start · 12-15 cruceta (arriba, abajo, izquierda, derecha).
  const DEAD = 0.22;            // zona muerta del stick: los mandos gastados derivan solos
  let padNow = [], padPrev = [], stick = [0, 0], pads = 0;

  addEventListener('gamepadconnected', e => {
    if (G.UI && G.UI.toast) G.UI.toast(G.T('Mando conectado') + (e.gamepad.mapping === 'standard' ? '' : ' ' + G.T('(botones sin reconocer)')));
  });

  function poll() {
    padPrev = padNow; padNow = []; pads = 0;
    let sx = 0, sy = 0;
    let list = [];
    try { list = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { list = []; }
    for (const p of list) {
      if (!p || !p.connected) continue;
      pads++;
      p.buttons.forEach((b, i) => { if (b.pressed || b.value > 0.5) padNow[i] = true; });
      // Varios mandos a la vez: manda el stick que más se mueve.
      const x = p.axes[0] || 0, y = p.axes[1] || 0;
      if (x * x + y * y > sx * sx + sy * sy) { sx = x; sy = y; }
    }
    // Zona muerta radial y reescalada: fuera de ella, de 0 a 1 sin saltos.
    const m = Math.hypot(sx, sy);
    if (m < DEAD) stick = [0, 0];
    else { const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m; stick = [sx * k, sy * k]; }
  }
  const padHeld = i => !!padNow[i];

  return {
    /** Vector de movimiento del jugador (joystick táctil, stick del mando o teclado/cruceta). */
    axis() {
      const t = G.Touch && G.Touch.vector();
      if (t && (t[0] || t[1])) return t;
      // Analógico: el stick a medias anda más despacio.
      if (stick[0] || stick[1]) return stick;
      let x = 0, y = 0;
      if (MOVE_KEYS.left.some(k => down.has(k)) || padHeld(14)) x -= 1;
      if (MOVE_KEYS.right.some(k => down.has(k)) || padHeld(15)) x += 1;
      if (MOVE_KEYS.up.some(k => down.has(k)) || padHeld(12)) y -= 1;
      if (MOVE_KEYS.down.some(k => down.has(k)) || padHeld(13)) y += 1;
      return G.U.norm(x, y);
    },
    held(c) { return down.has(c); },
    /** true sólo en el frame en que se pulsó. */
    tap(c) { return pressed.has(c); },
    /** Como si se hubiera pulsado esa tecla en este frame (el mando la usa). */
    press(c) { pressed.add(c); },
    mouse() { return { x: mx, y: my, down: mdown }; },
    /** Lee los mandos: una vez por frame, antes de mirar las teclas. */
    poll,
    padHeld,
    /** true sólo en el frame en que se pulsó ese botón del mando. */
    padTap(i) { return !!padNow[i] && !padPrev[i]; },
    padStick() { return stick; },
    /** ¿Se está tocando el mando ahora mismo (algún botón o el stick)? */
    padBusy() { return padNow.some(Boolean) || !!(stick[0] || stick[1]); },
    get pads() { return pads; },
    endFrame() { pressed.clear(); }
  };
})();
