/* ============ padnav.js — qué hace el mando ============
 * En partida: el stick o la cruceta mueven (eso lo lee G.Input.axis), y los
 * botones se traducen a las teclas de siempre (G.Input.press), así el juego
 * no distingue teclado de mando:
 *   A/B/X/Y = ataque 1-4 · LB/LT y RB/RT = anterior / siguiente · Start o Select = pausa.
 * En los menús (y cartas, pausa, ajustes...): la cruceta o el stick mueven un
 * recuadro dorado entre los botones que se ven, A pulsa, B vuelve, Start = Esc,
 * Y = cambiar las cartas. En un deslizador (volumen), izquierda/derecha lo mueven.
 * Si se mueve el ratón o se toca la pantalla, el recuadro desaparece.
 */
G.PadNav = (() => {
  const A = 0, B = 1, X = 2, Y = 3, LB = 4, RB = 5, LT = 6, RT = 7, BACK = 8, START = 9;
  const UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;
  // Lo mismo que suena al pasar el ratón (ver CLICKABLE en ui.js), más los controles de formulario.
  const SEL = '.btn, .menu-item, .tab, .chip, .card, .cell:not(.locked), .answer, .gen-tab, button, a[href], input[type=range], input[type=checkbox], select';

  let cur = null, dirKey = null, repT = 0, navWas = false, graceT = 0;

  // ---------------- qué se puede elegir ----------------

  function shown(el) {
    if (el.disabled || el.closest('.hidden')) return false;
    if (el.checkVisibility ? !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : !el.getClientRects().length) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }
  function scroller(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    }
    return null;
  }
  /** ¿Está encima (no tapado por otra ventana)? En una lista con scroll se mira la lista. */
  function onTop(el, memo) {
    const sc = scroller(el), t = sc || el;
    if (memo.has(t)) return memo.get(t);
    const r = t.getBoundingClientRect();
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + Math.min(r.width / 2, 20)));
    const y = Math.min(innerHeight - 1, Math.max(0, r.top + Math.min(r.height / 2, 20)));
    const hit = document.elementFromPoint(x, y);
    const ok = !!hit && (t.contains(hit) || hit.contains(t));
    memo.set(t, ok);
    return ok;
  }
  function candidates() {
    const all = [...document.querySelectorAll(SEL)].filter(shown);
    const set = new Set(all), memo = new Map();
    // Sin repetir: un botón dentro de una carta cuenta como la carta.
    return all.filter(el => {
      const up = el.parentElement && el.parentElement.closest(SEL);
      return !(up && set.has(up)) && onTop(el, memo);
    });
  }
  /** Dónde empieza el recuadro: lo principal de la pantalla (cartas, botón dorado...). */
  function first(list) {
    return list.find(el => el.matches('.card')) || list.find(el => el.matches('.menu-item'))
      || list.find(el => el.matches('.btn.gold')) || list.find(el => !el.closest('#topbar')) || list[0] || null;
  }
  const center = r => [r.left + r.width / 2, r.top + r.height / 2];

  function setCur(el, sound = true) {
    if (cur === el) return;
    if (cur) cur.classList.remove('pad-focus');
    cur = el;
    if (!el) return;
    el.classList.add('pad-focus');
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (sound) G.Audio.sfx('hover');
  }
  function valid(el) { return !!el && el.isConnected && shown(el); }

  // ---------------- moverse ----------------

  function step(dx, dy) {
    // Deslizador: izquierda/derecha cambian el valor en vez de salir de él.
    if (valid(cur) && dx && cur.matches('input[type=range]')) {
      const s = parseFloat(cur.step) || (parseFloat(cur.max || 100) - parseFloat(cur.min || 0)) / 20;
      cur.value = parseFloat(cur.value) + dx * s;
      cur.dispatchEvent(new Event('input', { bubbles: true }));
      cur.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const list = candidates();
    if (!cur || !list.includes(cur)) { setCur(first(list)); return; }
    const [ax, ay] = center(cur.getBoundingClientRect());
    let best = null, bs = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const [x, y] = center(el.getBoundingClientRect());
      const along = (x - ax) * dx + (y - ay) * dy;
      if (along <= 4) continue;
      // Lo más cerca en esa dirección, castigando lo que queda muy de lado.
      const s = along + Math.abs((x - ax) * dy - (y - ay) * dx) * 2.5;
      if (s < bs) { bs = s; best = el; }
    }
    if (best) setCur(best);
  }

  function press(el) {
    if (el.matches('select')) {
      el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.matches('input[type=range]')) {
      // Nada: se mueve con izquierda/derecha.
    } else el.click();
  }

  function back() {
    const list = candidates();
    const b = list.find(el => el.matches('[data-back], #set-close'));
    if (b) b.click(); else G.Input.press('escape');
  }

  // ---------------- cada fotograma ----------------

  /** @param nav  true en menús, cartas, pausa...; false jugando. */
  function update(dt, nav) {
    const I = G.Input;
    if (!I.pads) { if (cur) setCur(null); navWas = false; return; }

    if (!nav) {
      navWas = false;
      if (cur) setCur(null);
      if (I.padTap(START) || I.padTap(BACK)) I.press('escape');
      if (I.padTap(LB) || I.padTap(LT)) I.press('keyq');
      if (I.padTap(RB) || I.padTap(RT)) I.press('keye');
      [A, B, X, Y].forEach((b, i) => { if (I.padTap(b)) I.press('digit' + (i + 1)); });
      if (I.padTap(A)) I.press('space');          // saltar la animación de la Sentencia
      return;
    }

    // Al abrirse una pantalla con el mando en la mano, el recuadro ya está puesto;
    // un ratito sin aceptar A, para no elegir carta sin querer al ir pulsando.
    if (!navWas) { navWas = true; graceT = 0.3; if (I.padBusy() || cur) setCur(first(candidates()), false); }
    if (graceT > 0) graceT -= dt;
    if (cur && !valid(cur)) setCur(first(candidates()), false);

    let d = I.padHeld(UP) ? [0, -1] : I.padHeld(DOWN) ? [0, 1] : I.padHeld(LEFT) ? [-1, 0] : I.padHeld(RIGHT) ? [1, 0] : null;
    const [sx, sy] = I.padStick();
    if (!d && Math.hypot(sx, sy) > 0.5) d = Math.abs(sx) > Math.abs(sy) ? [Math.sign(sx), 0] : [0, Math.sign(sy)];
    const key = d ? d.join() : null;
    if (!key) dirKey = null;
    else if (key !== dirKey) { dirKey = key; repT = 0.38; step(d[0], d[1]); }
    else if ((repT -= dt) <= 0) { repT = 0.11; step(d[0], d[1]); }

    if (I.padTap(A) && graceT <= 0) {
      if (valid(cur)) press(cur); else setCur(first(candidates()));
    }
    if (I.padTap(B)) back();
    if (I.padTap(START)) I.press('escape');
    if (I.padTap(Y)) I.press('keyr');
  }

  // El ratón o el dedo mandan: fuera el recuadro.
  let lastMx = -1, lastMy = -1;
  addEventListener('mousemove', e => {
    if (Math.abs(e.clientX - lastMx) + Math.abs(e.clientY - lastMy) > 3 && cur) setCur(null);
    lastMx = e.clientX; lastMy = e.clientY;
  });
  addEventListener('pointerdown', () => { if (cur) setCur(null); });

  return { update };
})();
