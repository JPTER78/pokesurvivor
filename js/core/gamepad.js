/* ============ gamepad.js — mando físico (consolas Android, PC) y apuntado ============
 * Dos fuentes de mando, la que tenga algo pulsado manda:
 *   - Gamepad API del navegador (mandos en PC).
 *   - La app Android (RetroidNova/consolas portátiles): sus botones nativos
 *     llegan con G.Pad.nativo({...}) desde el envoltorio (ver android/).
 *
 * En partida:  stick izq / cruceta = moverse · stick der = apuntar
 *              L / R = ataque anterior / siguiente · Start = pausa
 * En menús:    stick izq / cruceta = mover el foco · A = pulsar · B = volver
 *
 * Eso es lo de serie. Los botones se cambian en Ajustes > Controles > Mando
 * (ui/pad-ui.js): un reparto ya hecho (PRESETS) o botón a botón (ACCIONES),
 * porque cada consola pone A/B y los gatillos donde quiere. Ajustes de
 * G.Settings: padMap (el reparto), padDead (zona muerta) y padSwap (sticks
 * intercambiados). Moverse y apuntar van siempre con los sticks.
 *
 * Apuntado manual: con el stick derecho (o manteniendo el clic izquierdo del
 * ratón en PC) los ataques salen hacia donde apuntas; al soltar, vuelve el
 * apuntado automático de siempre. G.Input.axis() y player.js lo consultan.
 */
G.Pad = (() => {
  // Zona muerta de los sticks (Ajustes); para apuntar, un poco más.
  const dead = () => G.U.clamp(+G.Settings.get('padDead') || 0.25, 0.05, 0.6);
  const aimDead = () => dead() + 0.1;
  // Estado lógico: botones por nombre y ejes [-1..1].
  const nat = { btn: {}, lx: 0, ly: 0, rx: 0, ry: 0 };
  let prev = {};
  let foco = null;
  let repetirT = 0, dirPrev = null;
  let ratonApunta = false;
  let usado = false;

  /** La app Android manda aquí el estado completo de su mando en cada cambio. */
  function nativo(e) {
    nat.btn = e.btn || {};
    nat.lx = +e.lx || 0; nat.ly = +e.ly || 0;
    nat.rx = +e.rx || 0; nat.ry = +e.ry || 0;
  }

  // Gamepad API estándar (mapping "standard").
  const STD = ['a', 'b', 'x', 'y', 'l1', 'r1', 'l2', 'r2', 'select', 'start', 'l3', 'r3', 'up', 'down', 'left', 'right'];
  function leerNavegador() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const btn = {};
      STD.forEach((n, i) => { if (p.buttons[i] && p.buttons[i].pressed) btn[n] = true; });
      const ax = p.axes || [];
      return { btn, lx: ax[0] || 0, ly: ax[1] || 0, rx: ax[2] || 0, ry: ax[3] || 0 };
    }
    return null;
  }

  function estado() {
    const web = leerNavegador();
    if (!web) return nat;
    const algoNat = Object.keys(nat.btn).length || Math.hypot(nat.lx, nat.ly) > dead() || Math.hypot(nat.rx, nat.ry) > dead();
    return algoNat ? nat : web;
  }

  // ---------------- botones configurables ----------------

  /**
   * Lo que se puede asignar a un botón. ctx: 'juego' (en partida) o 'menu'.
   * fijo: no puede quedarse sin botón (sin él no se podría usar el mando).
   */
  const ACCIONES = [
    { id: 'prev',  ctx: 'juego', nombre: 'Ataque anterior',  def: ['l1', 'l2'], tecla: 'KeyQ' },
    { id: 'next',  ctx: 'juego', nombre: 'Ataque siguiente', def: ['r1', 'r2'], tecla: 'KeyE' },
    { id: 'm1',    ctx: 'juego', nombre: 'Ataque 1',         def: [],           tecla: 'Digit1' },
    { id: 'm2',    ctx: 'juego', nombre: 'Ataque 2',         def: [],           tecla: 'Digit2' },
    { id: 'm3',    ctx: 'juego', nombre: 'Ataque 3',         def: [],           tecla: 'Digit3' },
    { id: 'm4',    ctx: 'juego', nombre: 'Ataque 4',         def: [],           tecla: 'Digit4' },
    { id: 'pause', ctx: 'juego', nombre: 'Pausa',            def: ['start'],    tecla: 'Escape', fijo: true },
    { id: 'ok',    ctx: 'menu',  nombre: 'Aceptar',          def: ['a'],        fijo: true },
    { id: 'back',  ctx: 'menu',  nombre: 'Volver',           def: ['b', 'start'], fijo: true }
  ];
  const ACC = Object.fromEntries(ACCIONES.map(a => [a.id, a]));
  // Botones asignables (la cruceta no: mueve al Pokémon y el foco).
  const BOTONES = { a: 'A', b: 'B', x: 'X', y: 'Y', l1: 'L1', r1: 'R1', l2: 'L2', r2: 'R2', select: 'Select', start: 'Start', l3: 'L3', r3: 'R3' };
  const esBoton = n => Object.prototype.hasOwnProperty.call(BOTONES, n);

  /**
   * Repartos ya hechos (Ajustes > Mando). Cada uno dice sólo lo que cambia
   * respecto al de serie; lo que no nombra se queda como viene en ACCIONES.
   */
  const PRESETS = [
    { id: 'serie',    nombre: 'De serie',           desc: 'L y R cambian de ataque. A acepta y B vuelve.', map: {} },
    { id: 'nintendo', nombre: 'A y B al revés',     desc: 'Para consolas con los botones al estilo Nintendo: B acepta y A vuelve.',
      map: { ok: ['b'], back: ['a', 'start'] } },
    { id: 'caras',    nombre: 'Un botón por ataque', desc: 'X, Y, B y A eligen el ataque 1, 2, 3 y 4. L y R siguen cambiando.',
      map: { m1: ['x'], m2: ['y'], m3: ['b'], m4: ['a'] } },
    { id: 'gatillos', nombre: 'Ataques en los gatillos', desc: 'L1, R1, L2 y R2 eligen el ataque 1, 2, 3 y 4.',
      map: { prev: [], next: [], m1: ['l1'], m2: ['r1'], m3: ['l2'], m4: ['r2'] } }
  ];

  let captura = null;        // esperando un botón: { id, sobre, t, cb }
  let ultimo = null;         // último botón pulsado (para la prueba de Ajustes > Mando)

  /**
   * Reparto completo a partir de uno guardado o de un preset: sólo botones que
   * existen, ninguno en dos acciones del mismo contexto y las acciones fijas
   * nunca sin botón. (Lo guardado puede venir de otra versión o estar tocado a mano.)
   */
  function resolver(m) {
    const out = {}, usados = { juego: new Set(), menu: new Set() };
    const vale = (a, lista) => [...new Set(lista)].filter(n => esBoton(n) && !usados[a.ctx].has(n));
    const poner = (a, bs) => { out[a.id] = bs; bs.forEach(n => usados[a.ctx].add(n)); };
    // Primero lo elegido; después lo de serie con los botones que queden libres.
    for (const a of ACCIONES) {
      const v = m && typeof m === 'object' ? m[a.id] : null;
      if (!Array.isArray(v)) continue;
      const bs = vale(a, v);
      if (bs.length || !a.fijo) poner(a, bs);
    }
    for (const a of ACCIONES) if (!out[a.id]) poner(a, vale(a, a.def));
    return out;
  }

  let limpio = null;
  G.Settings.on(k => { if (k === 'padMap') limpio = null; });
  const mapa = () => limpio || (limpio = resolver(G.Settings.get('padMap')));
  /** Botones que tiene ahora una acción. */
  function botonesDe(id) { return mapa()[id] || []; }

  const igual = (x, y) => ACCIONES.every(a => x[a.id].join() === y[a.id].join());
  /** El preset que coincide con lo que hay ahora, o null si el jugador lo ha tocado. */
  function presetActual() {
    const p = PRESETS.find(q => igual(resolver(q.map), mapa()));
    return p ? p.id : null;
  }
  function preset(id) {
    const p = PRESETS.find(q => q.id === id);
    if (p) G.Settings.set('padMap', resolver(p.map));
  }

  /**
   * Da un botón a una acción. `sobre`: el botón suyo al que sustituye (si no,
   * se añade a los que tenga). El botón se le quita a la acción del mismo
   * contexto que lo tuviera; si esa es fija y se queda sin ninguno, hereda el
   * sustituido (así A y B se intercambian de un paso).
   * @returns false si no se puede (una acción fija se quedaría sin botón)
   */
  function asignar(id, boton, sobre) {
    const acc = ACC[id];
    if (!acc || !esBoton(boton)) return false;
    const m = Object.assign({}, mapa());
    const mios = m[id];
    if (mios.includes(boton)) return true;                 // ya lo tiene
    const hueco = mios.includes(sobre) ? sobre : null;
    for (const o of ACCIONES) {
      if (o.id === id || o.ctx !== acc.ctx || !m[o.id].includes(boton)) continue;
      const resto = m[o.id].filter(n => n !== boton);
      if (!resto.length && o.fijo) {
        if (!hueco) return false;
        resto.push(hueco);
      }
      m[o.id] = resto;
    }
    m[id] = hueco ? mios.map(n => (n === hueco ? boton : n)) : [...mios, boton];
    G.Settings.set('padMap', m);
    return true;
  }

  /** Quita un botón de una acción. @returns false si es fija y es el último. */
  function quitar(id, boton) {
    const acc = ACC[id], bs = botonesDe(id);
    if (!acc || !bs.includes(boton) || (bs.length < 2 && acc.fijo)) return false;
    G.Settings.set('padMap', Object.assign({}, mapa(), { [id]: bs.filter(n => n !== boton) }));
    return true;
  }

  /**
   * Espera a que se pulse un botón del mando y se lo da a la acción (ver asignar).
   * cb(boton, hecho) al acabar; boton es null si pasan 5 s sin pulsar nada.
   */
  function capturar(id, sobre, cb) { captura = { id, sobre: sobre || null, t: 5, cb }; }
  function cancelar() { captura = null; }

  /** Todo lo del mando como viene: botones, zona muerta y sticks. */
  function restablecer() {
    G.Settings.set('padMap', {});
    G.Settings.set('padDead', G.Settings.DEF.padDead);
    G.Settings.set('padSwap', false);
  }

  /** Pone el foco del mando en un elemento (Ajustes lo usa al repintar). */
  function enfocar(el) { if (usado && el) marcar(el); }

  let s = nat;

  function stick(x, y, zm) {
    const d = Math.hypot(x, y);
    if (d < zm) return null;
    const k = Math.min(1, (d - zm) / (1 - zm));
    return [x / d * k, y / d * k];
  }

  /** Movimiento: stick izquierdo o cruceta. Null si no se toca. */
  function vector() {
    if (!jugando()) return null;
    const v = stick(s.lx, s.ly, dead());
    if (v) return v;
    let x = 0, y = 0;
    if (s.btn.left) x -= 1;
    if (s.btn.right) x += 1;
    if (s.btn.up) y -= 1;
    if (s.btn.down) y += 1;
    return x || y ? G.U.norm(x, y) : null;
  }

  /** Ángulo de apuntado manual (stick derecho o ratón pulsado), o null. */
  function aimAngle(pl) {
    const r = stick(s.rx, s.ry, aimDead());
    if (r) return Math.atan2(r[1], r[0]);
    if (ratonApunta && G.Input && G.Camera && G.Camera.scale) {
      const m = G.Input.mouse();
      const wx = G.Camera.left() + m.x / G.Camera.scale, wy = G.Camera.top() + m.y / G.Camera.scale;
      return Math.atan2(wy - (pl.y - (G.LIFT || 0)), wx - pl.x);
    }
    return null;
  }

  /** Blanco en la dirección apuntada (cono de ±35°): el más cercano a tiro. */
  function targetInCone(list, pl, ang, maxDist = 520) {
    let best = null, bd = Infinity;
    for (const e of list) {
      if (e.dead) continue;
      const dx = e.x - pl.x, dy = e.y - pl.y, d = Math.hypot(dx, dy);
      if (d > maxDist) continue;
      const da = Math.abs(((Math.atan2(dy, dx) - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da <= 0.61 && d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function jugando() {
    // En grupo la pausa no para el juego ('playing' con la pausa abierta): el mando va al menú.
    const pausa = document.getElementById('scr-pause');
    return G.Game && G.Game.state === 'playing' && !(G.SettingsUI && G.SettingsUI.isOpen)
      && !(pausa && !pausa.classList.contains('hidden'));
  }

  // Teclas sintéticas: así el juego las trata igual que el teclado.
  function tecla(code) {
    dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
    dispatchEvent(new KeyboardEvent('keyup', { code, key: code }));
  }

  const pulsado = n => s.btn[n] && !prev[n];
  /** ¿Se acaba de pulsar algún botón de esta acción? */
  const accion = id => botonesDe(id).some(pulsado);

  // ---------------- navegación de menús ----------------

  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || +cs.opacity === 0) return false;
    // Fuera de la pantalla pero mostrado: parte de una lista con scroll
    // (Pokédex, colección...). Se puede elegir y scrollIntoView lo trae.
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return alcanzable(el);
    // Tapado por otra capa (p.ej. el menú debajo de un diálogo): el punto
    // central tiene que caer en el propio elemento.
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!t && (t === el || el.contains(t) || t.contains(el));
  }

  // Pantallas que se abren ENCIMA de una partida. Mientras dura la partida el
  // mando solo navega dentro de la que esté abierta: si no, en grupo (cuando
  // otro elige carta o fusión el estado no es 'playing') A y la cruceta
  // acababan en los botones del HUD o en «Salir de la partida» de la pausa,
  // y el jugador se salía del cooperativo sin querer.
  const EN_PARTIDA = ['playing', 'paused', 'levelup', 'held', 'choice'];
  const ENCIMA = ['scr-settings', 'scr-levelup', 'scr-item', 'scr-bond', 'scr-pause'];

  /** Dónde se puede navegar ahora: el documento, la pantalla abierta sobre la partida, o nada. */
  function ambito() {
    if (!G.Game || !EN_PARTIDA.includes(G.Game.state)) return document;
    for (const id of ENCIMA) {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) return el;
    }
    return null;
  }

  /**
   * ¿Se puede traer a la vista con scroll? Sólo si la lista que lo contiene
   * está delante: con un diálogo encima, mover el foco ahí haría scroll en la
   * pantalla de debajo.
   */
  function alcanzable(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (!/auto|scroll/.test(cs.overflowY + cs.overflowX)) continue;
      if (p.scrollHeight <= p.clientHeight && p.scrollWidth <= p.clientWidth) continue;
      const r = p.getBoundingClientRect();
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!t && (t === p || p.contains(t));
    }
    return true;
  }

  function pulsables() {
    const raiz = ambito();
    if (!raiz) return [];
    const todos = [...raiz.querySelectorAll('button, a[href], input, select, textarea, [onclick], [role="button"], .card, [tabindex]')];
    // Además, todo lo que el CSS marca como clicable (cursor: pointer).
    for (const el of raiz.querySelectorAll(raiz === document ? 'body *' : '*')) {
      if (todos.includes(el)) continue;
      if (getComputedStyle(el).cursor === 'pointer' && (!el.parentElement || getComputedStyle(el.parentElement).cursor !== 'pointer')) todos.push(el);
    }
    return todos.filter(el => !el.disabled && el.tagName !== 'CANVAS' && visible(el));
  }

  function centro(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function marcar(el) {
    if (foco) foco.classList.remove('gp-foco');
    foco = el;
    if (!el) return;
    el.classList.add('gp-foco');
    traer(el);
  }

  /** Lo trae a la vista; si aun así queda tapado (p.ej. bajo la barra de arriba), al centro. */
  function traer(el) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (!visible(el)) el.scrollIntoView({ block: 'center', inline: 'nearest' });
  }

  function mover(dx, dy) {
    const lista = pulsables();
    if (!lista.length) { marcar(null); return; }
    // Al entrar en una pantalla, el foco empieza en lo principal (Continuar, la
    // primera carta...), nunca en lo primero que aparezca (p. ej. «Salir»).
    if (!foco || !lista.includes(foco)) { marcar(lista.find(el => el.matches('.btn.gold, .card')) || lista[0]); return; }
    const o = centro(foco), a = foco.getBoundingClientRect();
    const SOLAPE = 4;                             // px que pueden pisarse dos vecinos
    let mejor = null, md = Infinity;              // por bordes
    let otro = null, od = Infinity;               // por centros, si lo anterior no encuentra nada
    for (const el of lista) {
      if (el === foco) continue;
      const c = centro(el), vx = c.x - o.x, vy = c.y - o.y;
      const along = vx * dx + vy * dy;           // avance en la dirección pedida
      if (along <= 2) continue;
      const lado = Math.abs(vx * dy - vy * dx);  // desvío lateral entre centros
      if (along + lado * 2.5 < od) { od = along + lado * 2.5; otro = el; }
      // Hueco y desvío lateral entre los bordes, no entre los centros: un botón
      // ancho (Jugar ocupa dos columnas) cuenta aunque su centro quede lejos.
      // Sólo los que empiezan donde acaba el foco: los de al lado no valen.
      const b = el.getBoundingClientRect();
      const hueco = dx > 0 ? b.left - a.right : dx < 0 ? a.left - b.right : dy > 0 ? b.top - a.bottom : a.top - b.bottom;
      if (hueco < -SOLAPE) continue;
      const cross = dx ? Math.max(0, b.top - a.bottom, a.top - b.bottom) : Math.max(0, b.left - a.right, a.left - b.right);
      // A igualdad, el más alineado por el centro.
      const d = Math.max(0, hueco) + cross * 2.5 + lado * 0.05;
      if (d < md) { md = d; mejor = el; }
    }
    if (mejor || otro) marcar(mejor || otro);
  }

  function menus(dt) {
    let dir = null;
    const v = stick(s.lx, s.ly, 0.5);
    if (s.btn.up || (v && v[1] < -0.7)) dir = [0, -1];
    else if (s.btn.down || (v && v[1] > 0.7)) dir = [0, 1];
    else if (s.btn.left || (v && v[0] < -0.7)) dir = [-1, 0];
    else if (s.btn.right || (v && v[0] > 0.7)) dir = [1, 0];

    const clave = dir && dir.join();
    if (clave && clave !== dirPrev) { mover(dir[0], dir[1]); repetirT = 0.38; }
    else if (clave) { repetirT -= dt; if (repetirT <= 0) { mover(dir[0], dir[1]); repetirT = 0.11; } }
    dirPrev = clave;

    if (foco && !document.contains(foco)) foco = null;
    if (foco) {                                      // pantalla cerrada o fuera del ámbito
      const raiz = ambito();
      if (!raiz || !raiz.contains(foco) || !visible(foco)) marcar(null);
    }
    if (accion('ok')) {
      if (!foco || !visible(foco)) mover(0, 1);
      else if (/^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName)) foco.focus();
      else foco.click();
    }
    if (accion('back')) tecla('Escape');
  }

  // ---------------- bucle ----------------

  function poll(dt) {
    s = estado();
    if (G.Settings.get('padSwap') === true) s = { btn: s.btn, lx: s.rx, ly: s.ry, rx: s.lx, ry: s.ly };
    const hay = Object.keys(s.btn).length || stick(s.lx, s.ly, dead()) || stick(s.rx, s.ry, dead());
    if (hay && !usado) { usado = true; document.body.classList.add('gamepad'); }

    const nuevo = Object.keys(s.btn).find(pulsado);
    if (nuevo) ultimo = nuevo;

    // Sólo se espera un botón con la pantalla del mando a la vista.
    if (captura && !(G.PadUI && G.PadUI.isOpen)) captura = null;
    if (captura) {
      // Ajustes > Mando: el primer botón que se pulse es el elegido.
      const c = captura, b = Object.keys(BOTONES).find(pulsado);
      c.t -= dt || 0.016;
      if (b || c.t <= 0) {
        captura = null;
        const hecho = b ? asignar(c.id, b, c.sobre) : false;
        if (c.cb) c.cb(b || null, hecho);
      }
    } else if (jugando()) {
      if (foco) marcar(null);
      for (const a of ACCIONES) if (a.ctx === 'juego' && accion(a.id)) tecla(a.tecla);
    } else if (usado) {
      menus(dt || 0.016);
    }
    prev = { ...s.btn };
  }

  // Ratón en PC: mantener el clic izquierdo sobre el juego apunta al cursor.
  addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0 && e.target.tagName === 'CANVAS') ratonApunta = true; });
  addEventListener('pointerup', e => { if (e.pointerType === 'mouse') ratonApunta = false; });
  addEventListener('blur', () => { ratonApunta = false; });

  // Anillo de foco para la navegación con mando.
  const css = document.createElement('style');
  css.textContent = '.gp-foco{outline:3px solid #ffd84a!important;outline-offset:2px;box-shadow:0 0 0 6px rgba(255,216,74,.25)!important;border-radius:6px}';
  document.head.appendChild(css);

  return { nativo, poll, vector, aimAngle, targetInCone,
           ACCIONES, BOTONES, PRESETS, botonesDe, preset, presetActual, capturar, cancelar, quitar, restablecer, enfocar,
           /** Qué se está esperando asignar: { id, sobre } o null. */
           get capturando() { return captura ? { id: captura.id, sobre: captura.sobre } : null; },
           /** Último botón pulsado (nombre lógico: 'a', 'l1', 'up'...), o null. */
           get ultimo() { return ultimo; },
           /** ¿Se ha usado el mando en esta sesión? */
           get usado() { return usado; } };
})();
