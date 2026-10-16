/* ============ gamepad.js — mando (Xbox, PlayStation, Switch Pro…) ============
 * Se lee en cada fotograma (G.Input.endFrame llama a poll()).
 *
 * - En partida: el stick izquierdo y la cruceta mueven (G.Input.axis) y los
 *   botones se convierten en las teclas de siempre (1–4, Q, E, Esc, R): el
 *   resto del juego no sabe si se juega con teclado o con mando.
 * - En los menús: cruceta o stick para ir de botón en botón, el botón de abajo
 *   (A / ✕) para pulsar y el de la derecha (B / ○) para volver (Esc).
 * - Los botones de partida se cambian en Ajustes > Controles y se guardan en
 *   este navegador.
 *
 *   G.Gamepad.vector()  ·  G.Gamepad.rebind('pause')  ·  G.Gamepad.on(fn)
 */
G.Gamepad = (() => {
  const KEY = 'ps.pad';
  // Botón de cada acción (índices del "standard mapping" de los navegadores).
  const DEF = { slot1: 0, slot2: 1, slot3: 2, slot4: 3, prev: 4, next: 5, pause: 9, reroll: 8 };
  const ACTIONS = [
    ['slot1', 'Ataque / carta 1'], ['slot2', 'Ataque / carta 2'], ['slot3', 'Ataque / carta 3'], ['slot4', 'Ataque 4'],
    ['prev', 'Ataque anterior'], ['next', 'Ataque siguiente'], ['pause', 'Pausa'], ['reroll', 'Cambiar cartas']
  ];
  // La tecla que "pulsa" cada acción: [code, key], como un KeyboardEvent de verdad.
  const KEYS = {
    slot1: ['Digit1', '1'], slot2: ['Digit2', '2'], slot3: ['Digit3', '3'], slot4: ['Digit4', '4'],
    prev: ['KeyQ', 'q'], next: ['KeyE', 'e'], pause: ['Escape', 'Escape'], reroll: ['KeyR', 'r']
  };
  const OK = 0, BACK = 1, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15, HOME = 16;
  const DEAD = 0.25;
  const NAMES = {
    xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', '↑', '↓', '←', '→', 'Home'],
    ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', '↑', '↓', '←', '→', 'PS'],
    nin: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L3', 'R3', '↑', '↓', '←', '→', 'Home']
  };
  // Estados del juego en los que los botones son de partida (y no de menú).
  const PLAY = ['playing', 'held', 'levelup', 'choice'];

  let map = Object.assign({}, DEF);
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const k in DEF) if (Number.isInteger(s[k])) map[k] = s[k];
  } catch (e) { /* nada */ }

  let last = [], vec = null, mode = null, capture = null;
  let navKey = null, navT = 0, focusEl = null, focusSig = '';
  const sent = new Set();     // acciones con la tecla "pulsada"
  const fns = new Set();

  function save() { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) { /* nada */ } }
  function changed() { fns.forEach(fn => { try { fn(); } catch (e) { /* nada */ } }); }

  function pad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    let any = null;
    for (const p of list) {
      if (!p || !p.connected) continue;
      if (p.mapping === 'standard') return p;
      any = any || p;
    }
    return any;
  }
  function family(p) {
    const id = (p && p.id) || '';
    if (/xbox|045e|xinput/i.test(id)) return 'xbox';
    if (/054c|sony|playstation|dualsense|dualshock|wireless controller/i.test(id)) return 'ps';
    if (/057e|nintendo|pro controller|joy-con/i.test(id)) return 'nin';
    return 'xbox';
  }

  function send(type, act) {
    const [code, key] = KEYS[act];
    dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true }));
  }
  function tapKey(act) { send('keydown', act); send('keyup', act); }
  function releaseAll() { sent.forEach(a => send('keyup', a)); sent.clear(); }

  function playing() {
    if (G.SettingsUI && G.SettingsUI.isOpen) return false;
    return !!G.Game && PLAY.includes(G.Game.state);
  }

  // ---------------- navegar por los menús ----------------
  const SEL = 'button, a[href], input, select, textarea, .card, .chip, .menu-item, [tabindex]';
  const center = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const sig = el => el.id || (Object.keys(el.dataset).length ? JSON.stringify(el.dataset) : el.textContent.trim().slice(0, 40));

  function scroller(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    }
    return null;
  }
  /** ¿Se ve (no está tapado por otra pantalla)? Si está fuera de su lista con scroll, cuenta la lista. */
  function onTop(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const { x, y } = center(el);
    const sc = scroller(el);
    if (sc) {
      const s = sc.getBoundingClientRect();
      if (y < s.top || y > s.bottom || x < s.left || x > s.right) return onTop(sc);
    }
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
    const hit = document.elementFromPoint(x, y);
    return !!hit && el.contains(hit);
  }
  function candidates() {
    return [...document.querySelectorAll(SEL)].filter(el => !el.disabled && onTop(el));
  }
  function setFocus(el) {
    if (focusEl) focusEl.classList.remove('pad-focus');
    focusEl = el; focusSig = el ? sig(el) : '';
    if (el) { el.classList.add('pad-focus'); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
  /** El botón marcado, si sigue a la vista (tras redibujar una pantalla se busca su gemelo). */
  function current(list) {
    if (focusEl && !focusEl.isConnected) focusEl = list.find(el => sig(el) === focusSig) || null;
    if (focusEl && list.includes(focusEl)) { focusEl.classList.add('pad-focus'); return focusEl; }
    setFocus(null);     // su pantalla ya no está: que no se quede marcado para cuando vuelva
    return null;
  }
  function move(dx, dy) {
    const list = candidates();
    const cur = current(list);
    if (!cur) { setFocus(list[0] || null); return; }
    // Hacia esa dirección (en un cono, si hay algo en él): la fila (o columna)
    // más cercana y, dentro de ella, el más alineado.
    const a = center(cur);
    let opts = [];
    for (const el of list) {
      if (el === cur || el.contains(cur) || cur.contains(el)) continue;
      const c = center(el), vx = c.x - a.x, vy = c.y - a.y;
      const along = vx * dx + vy * dy;
      if (along > 2) opts.push({ el, along, side: Math.abs(vx * dy - vy * dx) });
    }
    const cone = opts.filter(o => o.side <= o.along * 2);
    if (cone.length) opts = cone;
    if (!opts.length) return;
    const near = Math.min(...opts.map(o => o.along)) + 24;
    const best = opts.filter(o => o.along <= near).sort((u, v) => u.side - v.side)[0];
    setFocus(best.el);
  }
  function activate() {
    const list = candidates();
    const cur = current(list);
    if (!cur) { setFocus(list[0] || null); return; }
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(cur.tagName)) cur.focus();
    else cur.click();
  }

  // ---------------- cada fotograma ----------------

  function poll() {
    const p = pad();
    if (!p) { vec = null; last = []; if (sent.size) releaseAll(); return; }
    const now = p.buttons.map(b => b.pressed || b.value > 0.5);
    const hit = i => now[i] && !last[i];

    // Ajustes: esperando el botón nuevo de una acción.
    if (capture) {
      if (!(G.SettingsUI && G.SettingsUI.isOpen)) capture = null;
      else {
        const i = now.findIndex((on, j) => on && !last[j] && (j < UP || j > HOME));
        if (i >= 0) { assign(capture, i); capture = null; changed(); }
        last = now; vec = null;
        return;
      }
    }

    let x = p.axes[0] || 0, y = p.axes[1] || 0;
    const m = Math.hypot(x, y);
    if (m < DEAD) x = y = 0;
    else { const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m; x *= k; y *= k; }
    const dx = (now[RIGHT] ? 1 : 0) - (now[LEFT] ? 1 : 0), dy = (now[DOWN] ? 1 : 0) - (now[UP] ? 1 : 0);
    if (dx || dy) [x, y] = G.U.norm(dx, dy);

    const md = playing() ? 'play' : 'menu';
    if (md !== mode) { releaseAll(); mode = md; navKey = null; }

    if (md === 'play') {
      vec = x || y ? [x, y] : null;
      if (focusEl) setFocus(null);
      // Sólo al apretar: un botón que venía pulsado del menú no dispara nada.
      for (const act in map) {
        const b = map[act];
        if (hit(b) && !sent.has(act)) { sent.add(act); send('keydown', act); }
        else if (!now[b] && sent.has(act)) { sent.delete(act); send('keyup', act); }
      }
    } else {
      vec = null;
      // La pantalla se ha redibujado (p. ej. Ajustes): se marca enseguida el gemelo.
      if (focusEl && !focusEl.isConnected) {
        const twin = [...document.querySelectorAll(SEL)].find(el => sig(el) === focusSig);
        if (twin) setFocus(twin);
      }
      if (hit(map.pause) || (hit(BACK) && map.pause !== BACK)) tapKey('pause');
      if (hit(OK)) activate();
      const ax = Math.abs(x), ay = Math.abs(y);
      const dir = ax > 0.5 || ay > 0.5 ? (ax > ay ? [Math.sign(x), 0] : [0, Math.sign(y)]) : null;
      if (!dir) navKey = null;
      else {
        const t = performance.now(), k = dir.join();
        if (k !== navKey) { navKey = k; navT = t + 380; move(dir[0], dir[1]); }
        else if (t >= navT) { navT = t + 140; move(dir[0], dir[1]); }
      }
    }
    last = now;
  }

  // ---------------- cambiar botones ----------------
  /** Pone el botón i a la acción; si otra lo tenía, se quedan intercambiados. */
  function assign(act, i) {
    const other = Object.keys(map).find(k => map[k] === i);
    if (other && other !== act) map[other] = map[act];
    map[act] = i;
    save();
  }

  addEventListener('gamepadconnected', () => { G.UI && G.UI.toast('Mando conectado'); changed(); });
  addEventListener('gamepaddisconnected', () => { releaseAll(); vec = null; G.UI && G.UI.toast('Mando desconectado'); changed(); });

  return {
    poll, ACTIONS,
    vector() { return vec; },
    get map() { return Object.assign({}, map); },
    get name() { const p = pad(); return p ? p.id.replace(/\s*\(.*\)\s*$/, '') || 'Mando' : ''; },
    get capturing() { return capture; },
    label(i) { return NAMES[family(pad())][i] || 'Botón ' + i; },
    /** Espera el siguiente botón del mando para esa acción (otra vez: cancela). */
    rebind(act) { capture = capture === act ? null : act; changed(); },
    reset() { map = Object.assign({}, DEF); capture = null; save(); changed(); },
    on(fn) { fns.add(fn); }
  };
})();
