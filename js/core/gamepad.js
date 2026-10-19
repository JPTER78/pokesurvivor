/* ============ gamepad.js — jugar con mando (Xbox, PlayStation, Switch...) ============
 * Gamepad API con la distribución "standard" (la de casi todos los mandos).
 * Se activa o quita en Ajustes > Controles ('gamepad'; vibración: 'padRumble').
 *
 *   En la partida:  stick izquierdo o cruceta   moverse
 *                   LB / RB (o LT / RT)         ataque anterior / siguiente
 *                   Start                       pausa
 *                   A                           saltar la animación de Arceus
 *                   stick derecho               apuntar (con "Apuntar a mano" en Accesibilidad)
 *   En menús, cartas y pausa:
 *                   stick o cruceta             mover la selección (recuadro dorado);
 *                                               en una barra (volumen), izquierda / derecha la mueven
 *                   A                           pulsar
 *                   B                           atrás / cerrar (como Esc)
 *                   Y                           cambiar las cartas (como R)
 *                   stick derecho               desplazar las listas
 *
 * Los botones se traducen a las teclas que ya entiende el juego
 * (G.Input.virtual): así no hay que tocar cada pantalla. En los menús se
 * puede pulsar todo lo que se pulsa con el ratón (lo que tiene cursor de mano).
 */
G.Pad = (() => {
  const DEAD = 0.25;
  const BT = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  // [data-pad]: se puede pulsar aunque no tenga cursor de mano (los Pokémon que aún no tienes).
  const NATIVE = 'button, a[href], input, select, textarea, label[for], [data-pad]';
  let prev = [], vec = [0, 0], aimVec = [0, 0], aimAt = 0, name = '';
  let focus = null, focusScope = null, showing = false;
  let navDir = null, navT = 0;

  const enabled = () => G.Settings.get('gamepad') !== false;
  function pad() {
    if (!navigator.getGamepads) return null;
    for (const p of navigator.getGamepads()) if (p && p.connected) return p;
    return null;
  }

  addEventListener('gamepadconnected', e => {
    name = e.gamepad.id || '';
    if (enabled() && G.UI && G.UI.toast) G.UI.toast('Mando conectado', 2200);
  });
  addEventListener('gamepaddisconnected', () => { if (!pad()) { name = ''; hideFocus(); } });
  // Si vuelves al ratón o a la pantalla táctil, se quita el recuadro.
  for (const ev of ['mousemove', 'pointerdown']) addEventListener(ev, e => { if (e.isTrusted && (e.movementX || e.movementY || ev === 'pointerdown')) hideFocus(); });

  // ---------------- qué pantalla manda ----------------

  /** La pantalla que se ve por encima: la de mayor z-index (Ajustes va por delante de la pausa) y, si empatan, la última. */
  function topScreen() {
    let top = null, tz = -Infinity;
    for (const s of document.querySelectorAll('.scr:not(.hidden)')) {
      const z = parseInt(getComputedStyle(s).zIndex, 10) || 0;
      if (z >= tz) { tz = z; top = s; }
    }
    return top;
  }
  /** En un menú, cartas, pausa o ventana: el mando mueve la selección en vez de al Pokémon. */
  function uiMode() {
    return G.Game.state !== 'playing' || !!topScreen();
  }

  // ---------------- selección en los menús ----------------

  function scopes() {
    const top = topScreen(), out = [];
    const tap = document.getElementById('tap-start');
    if (tap && !tap.classList.contains('hidden')) return [tap];
    if (top) out.push(top);
    // La barra de arriba (Guardar, Ajustes...) cuenta si no hay una ventana encima.
    const bar = document.getElementById('topbar');
    if (bar && !bar.classList.contains('hidden') && (!top || !top.classList.contains('dim'))) out.push(bar);
    return out;
  }

  /** Lo que se puede pulsar ahora: botones, enlaces y lo que tiene cursor de mano. */
  function candidates() {
    const out = [];
    const W = innerWidth, H = innerHeight;
    for (const sc of scopes()) {
      if (sc.id === 'tap-start') { out.push(sc); continue; }
      for (const el of sc.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
        if (el.disabled) continue;
        let ok = el.matches(NATIVE);
        if (!ok) {
          // El cursor se hereda: sólo cuenta el de más arriba con mano.
          const cs = getComputedStyle(el);
          ok = cs.cursor === 'pointer' && (!el.parentElement || getComputedStyle(el.parentElement).cursor !== 'pointer');
        }
        if (!ok || out.some(o => o.contains(el))) continue;
        // Que se vea de verdad (no tapado por otra cosa).
        const cx = Math.min(W - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(H - 1, Math.max(0, r.top + r.height / 2));
        const hit = document.elementFromPoint(cx, cy);
        if (hit && !el.contains(hit) && !hit.contains(el)) continue;
        out.push(el);
      }
    }
    return out;
  }

  const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  function setFocus(el) {
    if (focus) focus.classList.remove('pad-focus');
    focus = el;
    focusScope = topScreen();
    if (!el) return;
    el.classList.add('pad-focus');
    showing = true;
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* nada */ }
  }
  function hideFocus() {
    if (focus) focus.classList.remove('pad-focus');
    focus = null; showing = false;
  }

  /** La primera selección de una pantalla: el botón principal, si lo hay (nunca "Volver" o "Cerrar" si hay otra cosa). */
  const isBack = el => /(-close|-back)$/.test(el.id) || el.hasAttribute('data-back') || /^(Cerrar|Volver|Close|Back)$/i.test(el.textContent.trim());
  function firstOf(list) {
    const rest = list.filter(el => !isBack(el));
    const pool = rest.length ? rest : list;
    const main = pool.find(el => el.matches('.play, .btn.gold, .card'));
    if (main) return main;
    return pool.slice().sort((a, b) => { const [ax, ay] = center(a), [bx, by] = center(b); return (ay - by) || (ax - bx); })[0] || null;
  }

  function valid() {
    return focus && focus.isConnected && focusScope === topScreen() && candidates().includes(focus);
  }

  function move(dx, dy) {
    const list = candidates();
    if (!list.length) { hideFocus(); return; }
    if (!valid()) { setFocus(firstOf(list)); return; }
    const [fx, fy] = center(focus);
    let best = null, bs = Infinity;
    for (const el of list) {
      if (el === focus) continue;
      const [x, y] = center(el);
      const ax = x - fx, ay = y - fy;
      const main = ax * dx + ay * dy;              // avance en la dirección pedida
      if (main <= 4) continue;
      const side = Math.abs(ax * dy - ay * dx);    // desvío hacia los lados
      const s = main + side * 2.5;
      if (s < bs) { bs = s; best = el; }
    }
    if (best) setFocus(best);
  }

  function press() {
    if (!valid()) { const list = candidates(); setFocus(firstOf(list)); return; }
    const el = focus;
    if (el.matches('input[type=range]')) return;          // se mueve con izquierda / derecha
    if (el.matches('select')) {                           // un desplegable no se abre: pasa a la siguiente opción
      el.selectedIndex = (el.selectedIndex + 1) % Math.max(1, el.options.length);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (el.matches('input, select, textarea')) { el.focus(); return; }
    const scr = topScreen(), [ox, oy] = center(el);
    el.click();
    // Si al pulsar se redibuja la misma pantalla (un Sí/No de Ajustes), sigue en
    // lo que haya en el mismo sitio; si cambia de pantalla, empieza en la nueva.
    setTimeout(() => {
      if (!showing || valid()) return;
      const list = candidates();
      if (!list.length) { hideFocus(); return; }
      if (topScreen() !== scr) { setFocus(firstOf(list)); return; }
      let best = null, bd = Infinity;
      for (const c of list) { const [x, y] = center(c); const d = (x - ox) ** 2 + (y - oy) ** 2; if (d < bd) { bd = d; best = c; } }
      setFocus(best);
    }, 120);
  }

  /** Barras (volumen): izquierda / derecha cambian el valor. → true si lo ha hecho. */
  function slide(dir) {
    if (!valid() || !focus.matches('input[type=range]') || (dir !== 'l' && dir !== 'r')) return false;
    const r = focus, min = +r.min || 0, max = r.max === '' ? 100 : +r.max;
    const st = (+r.step || 1) * Math.max(1, Math.round((max - min) / 20 / (+r.step || 1)));
    const v = Math.max(min, Math.min(max, +r.value + (dir === 'r' ? st : -st)));
    if (v === +r.value) return true;
    r.value = v;
    r.dispatchEvent(new Event('input', { bubbles: true }));
    r.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  /** B: el botón de cerrar o volver de la ventana, si lo tiene; si no, Esc. */
  function back() {
    const top = topScreen();
    if (top) {
      const btns = [...top.querySelectorAll('button, a')].filter(b => b.getBoundingClientRect().width > 0);
      const close = btns.find(isBack);
      if (close) { close.click(); return; }
    }
    G.Input.virtual('escape');
  }

  function scrollLists(dy, dt) {
    let el = valid() ? focus : topScreen();
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) { el.scrollTop += dy * 900 * dt; return; }
      el = el.parentElement;
    }
    const top = topScreen();
    if (top) for (const s of top.querySelectorAll('*')) {
      const cs = getComputedStyle(s);
      if (/(auto|scroll)/.test(cs.overflowY) && s.scrollHeight > s.clientHeight + 2) { s.scrollTop += dy * 900 * dt; return; }
    }
  }

  // ---------------- cada fotograma ----------------

  /** Lo llama el bucle del juego antes de mirar las teclas. */
  function poll(dt) {
    const p = enabled() ? pad() : null;
    if (!p) { vec = [0, 0]; aimVec = [0, 0]; prev = []; return; }
    if (!name) name = p.id || '';
    const now = p.buttons.map(b => !!(b && (b.pressed || b.value > 0.5)));
    const was = prev;
    const hit = i => now[i] && !was[i];
    prev = now;

    let x = p.axes[0] || 0, y = p.axes[1] || 0;
    const m = Math.hypot(x, y);
    if (m < DEAD) x = y = 0;
    else { const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m; x *= k; y *= k; }
    if (now[BT.LEFT]) x = -1; else if (now[BT.RIGHT]) x = 1;
    if (now[BT.UP]) y = -1; else if (now[BT.DOWN]) y = 1;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }

    if (uiMode()) {
      vec = [0, 0];
      // Mover la selección: al empujar, y repitiendo si se mantiene.
      const dir = Math.hypot(x, y) < 0.5 ? null : Math.abs(x) > Math.abs(y) ? (x > 0 ? 'r' : 'l') : (y > 0 ? 'd' : 'u');
      if (dir !== navDir) { navDir = dir; navT = 0.38; if (dir) step(dir); }
      else if (dir && (navT -= dt) <= 0) { navT = 0.14; step(dir); }
      if (hit(BT.A)) press();
      if (hit(BT.B) || hit(BT.BACK)) back();
      if (hit(BT.START)) G.Input.virtual('escape');
      if (hit(BT.Y)) G.Input.virtual('keyr');
      const ry = p.axes[3] || 0;
      if (Math.abs(ry) > DEAD) scrollLists(ry, dt);
    } else {
      if (showing) hideFocus();
      navDir = null;
      vec = [x, y];
      const ax = p.axes[2] || 0, ay = p.axes[3] || 0;
      if (Math.hypot(ax, ay) > 0.35) { aimVec = [ax, ay]; aimAt = performance.now(); } else aimVec = [0, 0];
      if (hit(BT.LB) || hit(BT.LT)) G.Input.virtual('keyq');
      if (hit(BT.RB) || hit(BT.RT)) G.Input.virtual('keye');
      if (hit(BT.START) || hit(BT.BACK)) G.Input.virtual('escape');
      if (hit(BT.A)) G.Input.virtual('space');
    }
  }
  function step(dir) { if (!slide(dir)) move(...{ r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] }[dir]); }

  /** Vibración (0..1, en ms), si el mando y el ajuste lo permiten. */
  function rumble(k, ms = 120) {
    if (!enabled() || G.Settings.get('padRumble') === false) return;
    const p = pad();
    const a = p && p.vibrationActuator;
    if (!a || !a.playEffect) return;
    k = Math.max(0, Math.min(1, k));
    a.playEffect('dual-rumble', { duration: ms, strongMagnitude: k, weakMagnitude: Math.min(1, k * 1.3) }).catch(() => {});
  }

  return {
    poll, rumble,
    /** Vector de movimiento del stick (sólo en la partida). */
    vector() { return vec; },
    /** Stick derecho, si se está empujando: [x, y] o null; y cuándo se usó por última vez. */
    aim() { return aimVec[0] || aimVec[1] ? aimVec : null; },
    get aimAt() { return aimAt; },
    /** Nombre del mando conectado ('' si no hay). */
    get name() { return pad() ? name || 'Mando' : ''; }
  };
})();
