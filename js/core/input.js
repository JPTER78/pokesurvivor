/* ============ input.js — teclado, ratón y mando/gamepad (PS4, PS5, Xbox, etc.) ============ */
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
    if (document.body) document.body.classList.remove('gamepad-active');
    // Evita que el navegador haga scroll con flechas/espacio durante el juego.
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space', 'tab'].includes(c)) e.preventDefault();
  });
  addEventListener('keyup', e => down.delete(code(e)));
  addEventListener('blur', () => { down.clear(); });
  addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  addEventListener('mousedown', () => mdown = true);
  addEventListener('mouseup', () => mdown = false);

  // ---------------- Mando / Gamepad (PS4, PS5, Xbox, Switch Pro, Genérico) ----------------
  let activeGamepadIndex = null;
  let gamepadType = 'generic'; // 'playstation' | 'xbox' | 'nintendo' | 'generic'
  let gamepadName = 'Mando';
  const prevButtons = new Array(18).fill(false);

  function detectType(id) {
    const s = (id || '').toLowerCase();
    if (s.includes('054c') || s.includes('dualshock') || s.includes('dualsense') || s.includes('playstation') || s.includes('sony')) {
      return 'playstation';
    }
    if (s.includes('xbox') || s.includes('xinput') || s.includes('045e') || s.includes('microsoft')) {
      return 'xbox';
    }
    if (s.includes('nintendo') || s.includes('switch') || s.includes('pro controller') || s.includes('057e')) {
      return 'nintendo';
    }
    return 'generic';
  }

  function getFriendlyName(type, rawId) {
    if (type === 'playstation') {
      if ((rawId || '').toLowerCase().includes('dualsense') || (rawId || '').toLowerCase().includes('0ce6')) {
        return 'PlayStation DualSense (PS5)';
      }
      return 'PlayStation DualShock 4 (PS4)';
    }
    if (type === 'xbox') {
      return (typeof window !== 'undefined' && window.G && G.I18n && G.I18n.lang === 'en') ? 'Xbox Controller' : 'Mando de Xbox';
    }
    if (type === 'nintendo') {
      return (typeof window !== 'undefined' && window.G && G.I18n && G.I18n.lang === 'en') ? 'Nintendo Switch Controller' : 'Mando Nintendo Switch';
    }
    return (typeof window !== 'undefined' && window.G && G.I18n && G.I18n.lang === 'en') ? 'USB / Bluetooth Controller' : 'Mando USB / Bluetooth';
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('gamepadconnected', e => {
      activeGamepadIndex = e.gamepad.index;
      gamepadType = detectType(e.gamepad.id);
      gamepadName = getFriendlyName(gamepadType, e.gamepad.id);
      if (document.body) document.body.classList.add('gamepad-active');
      if (window.G && G.UI && G.UI.toast) {
        const en = G.I18n && G.I18n.lang === 'en';
        G.UI.toast(en ? `🎮 ${gamepadName} connected` : `🎮 ${gamepadName} conectado`, 3500);
      }
      console.log(`[Input] Gamepad conectado [${e.gamepad.index}]: ${e.gamepad.id} (${gamepadType})`);
    });

    window.addEventListener('gamepaddisconnected', e => {
      if (activeGamepadIndex === e.gamepad.index) {
        activeGamepadIndex = null;
        if (document.body) document.body.classList.remove('gamepad-active');
        if (window.G && G.UI && G.UI.toast) {
          const en = G.I18n && G.I18n.lang === 'en';
          G.UI.toast(en ? '🎮 Controller disconnected' : '🎮 Mando desconectado', 2500);
        }
        console.log('[Input] Gamepad desconectado');
      }
    });
  }

  // ---------------- Mando / Gamepad: Definiciones y Controles del Juego ----------------
  const CONTROLLER_BUTTONS = [
    { index: 0, labelPS: '✕ (Cruz)', labelXbox: 'A', name: '✕ / A', short: '✕ / A' },
    { index: 1, labelPS: '◯ (Círculo)', labelXbox: 'B', name: '◯ / B', short: '◯ / B' },
    { index: 2, labelPS: '▢ (Cuadrado)', labelXbox: 'X', name: '▢ / X', short: '▢ / X' },
    { index: 3, labelPS: '△ (Triángulo)', labelXbox: 'Y', name: '△ / Y', short: '△ / Y' },
    { index: 4, labelPS: 'L1', labelXbox: 'LB', name: 'L1 / LB', short: 'L1 / LB' },
    { index: 5, labelPS: 'R1', labelXbox: 'RB', name: 'R1 / RB', short: 'R1 / RB' },
    { index: 6, labelPS: 'L2 (Gatillo)', labelXbox: 'LT (Gatillo)', name: 'L2 / LT', short: 'L2 / LT' },
    { index: 7, labelPS: 'R2 (Gatillo)', labelXbox: 'RT (Gatillo)', name: 'R2 / RT', short: 'R2 / RT' },
    { index: 8, labelPS: 'Share / Create', labelXbox: 'View / Back', name: 'Share / Back', short: 'Share' },
    { index: 9, labelPS: 'Options', labelXbox: 'Menu / Start', name: 'Options / Start', short: 'Options' },
    { index: 10, labelPS: 'L3 (Stick Izq.)', labelXbox: 'LS (Stick Izq.)', name: 'L3 (Stick)', short: 'L3' },
    { index: 11, labelPS: 'R3 (Stick Der.)', labelXbox: 'RS (Stick Der)', name: 'R3 (Stick)', short: 'R3' }
  ];

  const GAME_ACTIONS = [
    {
      id: 'atk1',
      name: 'Ataque 1 / Carta 1 / Confirmar',
      desc: 'Lanza el 1er ataque, elige la carta 1 al subir de nivel y confirma en menús.',
      defaultButton: 0,
      keys: ['space', 'enter', 'digit1', 'numpad1']
    },
    {
      id: 'atk2',
      name: 'Ataque 2 / Carta 2 / Cancelar',
      desc: 'Lanza el 2º ataque, elige la carta 2 y cancela o vuelve atrás en menús.',
      defaultButton: 1,
      keys: ['escape', 'digit2', 'numpad2']
    },
    {
      id: 'atk3',
      name: 'Ataque 3 / Carta 3',
      desc: 'Lanza el 3er ataque y elige la carta 3 al subir de nivel.',
      defaultButton: 2,
      keys: ['digit3', 'numpad3']
    },
    {
      id: 'atk4',
      name: 'Ataque 4 / Carta 4',
      desc: 'Lanza el 4º ataque y elige la carta 4 si hay vínculo.',
      defaultButton: 3,
      keys: ['digit4', 'numpad4']
    },
    {
      id: 'reroll',
      name: 'Reroll (Cambiar cartas)',
      desc: 'Vuelve a tirar las opciones de cartas al subir de nivel (Tecla R).',
      defaultButton: 2,
      keys: ['keyr']
    },
    {
      id: 'prev_partner',
      name: 'Compañero anterior (Equipo)',
      desc: 'Cambia al Pokémon compañero anterior en tu equipo activo (Tecla Q).',
      defaultButton: 4,
      keys: ['keyq']
    },
    {
      id: 'next_partner',
      name: 'Compañero siguiente (Equipo)',
      desc: 'Cambia al Pokémon compañero siguiente en tu equipo activo (Tecla E).',
      defaultButton: 5,
      keys: ['keye', 'tab']
    },
    {
      id: 'pause',
      name: 'Pausa / Reanudar',
      desc: 'Abre la pausa durante la partida o reanuda el juego (Tecla Esc / P).',
      defaultButton: 9,
      keys: ['escape', 'keyp']
    },
    {
      id: 'skip',
      name: 'Saltar diálogo y cinemáticas',
      desc: 'Avanza rápidamente conversaciones y cinemáticas (Espacio / Intro / Esc).',
      defaultButton: 0,
      keys: ['space', 'enter']
    }
  ];

  const DEFAULT_ACTION_MAP = {
    atk1: 0,
    atk2: 1,
    atk3: 2,
    atk4: 3,
    reroll: 2,
    prev_partner: 4,
    next_partner: 5,
    pause: 9,
    skip: 0
  };

  function getActionMap() {
    if (typeof window !== 'undefined' && window.G && G.Settings) {
      const custom = G.Settings.get('gamepadActions');
      if (custom && typeof custom === 'object') {
        return Object.assign({}, DEFAULT_ACTION_MAP, custom);
      }
    }
    return Object.assign({}, DEFAULT_ACTION_MAP);
  }

  function setActionMap(actionId, buttonIndex) {
    if (typeof window === 'undefined' || !window.G || !G.Settings) return;
    const cur = getActionMap();
    cur[actionId] = +buttonIndex;
    G.Settings.set('gamepadActions', cur);
  }

  function resetActionMap() {
    if (typeof window === 'undefined' || !window.G || !G.Settings) return;
    G.Settings.set('gamepadActions', null);
  }

  // ---------------- Sensibilidad del Puntero Virtual ----------------
  function getCursorSensitivity() {
    if (typeof window !== 'undefined' && window.G && G.Settings) {
      const v = G.Settings.get('cursorSensitivity');
      if (typeof v === 'number' && !isNaN(v) && v > 0) return v;
    }
    return 0.4;
  }

  function setCursorSensitivity(val) {
    let num = parseFloat(val);
    if (isNaN(num)) num = 0.4;
    num = Math.max(0.2, Math.min(2.5, Math.round(num * 10) / 10));
    if (typeof window !== 'undefined' && window.G && G.Settings) {
      G.Settings.set('cursorSensitivity', num);
    }
    return num;
  }

  function getButtonName(buttonIndex) {
    const en = typeof window !== 'undefined' && window.G && G.I18n && G.I18n.lang === 'en';
    const btn = CONTROLLER_BUTTONS[buttonIndex];
    if (!btn) return en ? `Button ${buttonIndex}` : `Botón ${buttonIndex}`;
    if (gamepadType === 'playstation') {
      if (en) {
        if (buttonIndex === 0) return '✕ (Cross)';
        if (buttonIndex === 1) return '◯ (Circle)';
        if (buttonIndex === 2) return '▢ (Square)';
        if (buttonIndex === 3) return '△ (Triangle)';
        if (buttonIndex === 6) return 'L2 (Trigger)';
        if (buttonIndex === 7) return 'R2 (Trigger)';
        if (buttonIndex === 10) return 'L3 (Left Stick)';
        if (buttonIndex === 11) return 'R3 (Right Stick)';
      }
      return btn.labelPS;
    }
    if (gamepadType === 'xbox') {
      if (en) {
        if (buttonIndex === 6) return 'LT (Trigger)';
        if (buttonIndex === 7) return 'RT (Trigger)';
        if (buttonIndex === 10) return 'LS (Left Stick)';
        if (buttonIndex === 11) return 'RS (Right Stick)';
      }
      return btn.labelXbox;
    }
    if (en) {
      if (buttonIndex === 0) return '✕ / A';
      if (buttonIndex === 1) return '◯ / B';
      if (buttonIndex === 2) return '▢ / X';
      if (buttonIndex === 3) return '△ / Y';
      if (buttonIndex === 6) return 'L2 / LT (Trigger)';
      if (buttonIndex === 7) return 'R2 / RT (Trigger)';
      if (buttonIndex === 10) return 'L3 / LS (Left Stick)';
      if (buttonIndex === 11) return 'R3 / RS (Right Stick)';
    }
    return btn.name;
  }

  function getButtonKeys(i) {
    const actMap = getActionMap();
    const keys = new Set();
    for (const act of GAME_ACTIONS) {
      if (actMap[act.id] === i) {
        for (const k of act.keys) keys.add(k);
      }
    }
    // Asignaciones por defecto auxiliares para gatillos no explícitamente remapeados
    if (i === 6 && !Object.values(actMap).includes(6)) keys.add('keyq');
    if (i === 7 && !Object.values(actMap).includes(7)) { keys.add('keye'); keys.add('tab'); }
    if (i === 8 && !Object.values(actMap).includes(8)) keys.add('escape');
    if (i === 10 && !Object.values(actMap).includes(10)) keys.add('keyq');
    if (i === 11 && !Object.values(actMap).includes(11)) keys.add('keye');
    return Array.from(keys);
  }

  // ---------------- Captura interactiva de botones ----------------
  let nextButtonListener = null;

  function listenNextButton(fn) {
    nextButtonListener = fn;
  }

  function cancelListenNextButton() {
    nextButtonListener = null;
  }

  // ---------------- Estado de Menú / UI ----------------
  function isUIActive() {
    if (typeof document === 'undefined') return false;
    if (typeof window !== 'undefined' && window.G) {
      if (G.SettingsUI && G.SettingsUI.isOpen) return true;
      if (G.Game && G.Game.state !== 'playing') return true;
    }
    const scr = document.querySelector(
      '#scr-legal:not(.hidden), #scr-support:not(.hidden), #scr-news:not(.hidden), ' +
      '#scr-settings:not(.hidden), #scr-upgrades:not(.hidden), #scr-dex:not(.hidden), ' +
      '#scr-gacha:not(.hidden), #scr-goals:not(.hidden), #scr-friends:not(.hidden), ' +
      '#scr-rank:not(.hidden), #scr-nick:not(.hidden), #scr-recover:not(.hidden), ' +
      '#scr-starters:not(.hidden), #scr-result:not(.hidden), #scr-test:not(.hidden), ' +
      '#scr-pause:not(.hidden), #scr-levelup:not(.hidden), #scr-gameover:not(.hidden), ' +
      '#scr-menu:not(.hidden), #scr-login:not(.hidden), #pokemon-modal:not(.hidden), .modal:not(.hidden)'
    );
    return !!scr;
  }

  // ---------------- Puntero Virtual de Mando (Stick Analógico Izquierdo) ----------------
  let cursorEl = null;
  let cursorX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
  let cursorY = typeof window !== 'undefined' ? window.innerHeight / 2 : 300;
  let cursorVisible = false;
  let cursorHoverTarget = null;
  let cursorLastMove = 0;

  function ensureCursor() {
    if (typeof document === 'undefined') return;
    if (!cursorEl) {
      cursorEl = document.getElementById('gp-cursor');
      if (!cursorEl) {
        cursorEl = document.createElement('div');
        cursorEl.id = 'gp-cursor';
        cursorEl.className = 'gp-cursor hidden';
        cursorEl.innerHTML = '<div class="gp-cursor-ball"></div><div class="gp-cursor-dot"></div>';
        document.body.appendChild(cursorEl);
      }
    }
  }

  function showCursor() {
    ensureCursor();
    if (cursorEl && !cursorVisible) {
      cursorVisible = true;
      cursorEl.classList.remove('hidden');
    }
  }

  function hideCursor() {
    if (cursorEl && cursorVisible) {
      cursorVisible = false;
      cursorEl.classList.add('hidden');
      if (cursorHoverTarget) {
        cursorHoverTarget.classList.remove('gp-hover');
        cursorHoverTarget = null;
      }
    }
  }

  function updateCursorDOM() {
    if (!cursorEl || !cursorVisible) return;
    cursorEl.style.transform = `translate3d(${Math.round(cursorX)}px, ${Math.round(cursorY)}px, 0)`;
  }

  function checkCursorHover() {
    if (typeof document === 'undefined' || !cursorVisible) return;
    const el = document.elementFromPoint(cursorX, cursorY);
    const target = el ? el.closest('button:not(:disabled), a[href], select:not(:disabled), input:not(:disabled), .card, .chip, .menu-item, .gen-tab, .btn, [data-go], [data-tab]') : null;

    if (target !== cursorHoverTarget) {
      if (cursorHoverTarget) cursorHoverTarget.classList.remove('gp-hover');
      cursorHoverTarget = target;
      if (cursorHoverTarget) cursorHoverTarget.classList.add('gp-hover');
    }

    if (cursorEl) {
      cursorEl.classList.toggle('hovering', !!cursorHoverTarget);
    }
  }

  function clickCursorTarget() {
    if (cursorVisible && cursorHoverTarget) {
      if (cursorEl) {
        cursorEl.classList.add('clicking');
        setTimeout(() => { if (cursorEl) cursorEl.classList.remove('clicking'); }, 120);
      }
      cursorHoverTarget.click();
      if (cursorHoverTarget.tagName === 'INPUT' || cursorHoverTarget.tagName === 'SELECT') {
        cursorHoverTarget.focus();
      }
    }
  }

  // ---------------- Navegación por Menús con Crucetas (D-pad) ----------------
  let lastDpadTime = 0;
  let focusedEl = null;
  let lastActiveModal = null;

  function clearDpadFocus() {
    if (focusedEl) {
      focusedEl.classList.remove('gp-focused');
      focusedEl = null;
    }
  }

  function getActiveModalContainer() {
    if (typeof document === 'undefined') return null;

    // Prioridad: ventanas y modales superiores primero
    const modalSelectors = [
      '#scr-legal:not(.hidden)',
      '#scr-support:not(.hidden)',
      '#scr-news:not(.hidden)',
      '#scr-recover:not(.hidden)',
      '#scr-settings:not(.hidden)',
      '#scr-upgrades:not(.hidden)',
      '#scr-dex:not(.hidden)',
      '#scr-gacha:not(.hidden)',
      '#scr-goals:not(.hidden)',
      '#scr-friends:not(.hidden)',
      '#scr-rank:not(.hidden)',
      '#scr-nick:not(.hidden)',
      '#scr-starters:not(.hidden)',
      '#scr-result:not(.hidden)',
      '#scr-test:not(.hidden)',
      '#scr-pause:not(.hidden)',
      '#scr-levelup:not(.hidden)',
      '#scr-gameover:not(.hidden)',
      '#pokemon-modal:not(.hidden)',
      '.modal:not(.hidden)'
    ];

    for (const sel of modalSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null && !el.classList.contains('hidden')) {
        const box = el.querySelector('.box, .modal-content, .settings, .test-box, .result, .partner-card') || el;
        return box;
      }
    }

    // Si no hay modal superpuesto activo, buscar menú o login
    const baseSelectors = ['#scr-menu:not(.hidden)', '#scr-login:not(.hidden) .box'];
    for (const sel of baseSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null && !el.classList.contains('hidden')) {
        return el;
      }
    }

    return document.body;
  }

  function checkModalChange() {
    const currentModal = getActiveModalContainer();
    if (currentModal !== lastActiveModal) {
      lastActiveModal = currentModal;
      clearDpadFocus();
      if (currentModal && currentModal !== document.body) {
        focusFirstInContainer(currentModal);
      }
    }
  }

  function focusFirstInContainer(container) {
    if (!container) return;
    const candidates = getFocusCandidates(container);
    if (candidates.length > 0) {
      const preferred = candidates.find(el => el.classList.contains('on') || el.classList.contains('gold') || el.dataset.t || el.dataset.go) || candidates[0];
      if (focusedEl) focusedEl.classList.remove('gp-focused');
      focusedEl = preferred;
      focusedEl.classList.add('gp-focused');
      focusedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function getFocusCandidates(specificContainer) {
    if (typeof document === 'undefined') return [];
    const container = specificContainer || getActiveModalContainer() || document.body;

    const all = container.querySelectorAll(
      'button:not(:disabled):not(.hidden), ' +
      'a[href]:not(.hidden), ' +
      'select:not(:disabled):not(.hidden), ' +
      'input:not(:disabled):not(.hidden), ' +
      '.card:not(.hidden), ' +
      '.chip:not(.hidden), ' +
      '.menu-item:not(.hidden), ' +
      '.gen-tab:not(.hidden), ' +
      '.btn:not(.hidden), ' +
      '[tabindex="0"]:not(.hidden)'
    );

    return Array.from(all).filter(el => {
      if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    });
  }

  function handleDpad(up, down, left, right) {
    const now = performance.now();
    if (now - lastDpadTime < 160) return;

    checkModalChange();

    const candidates = getFocusCandidates();
    if (!candidates.length) return;

    hideCursor();

    if (!focusedEl || !focusedEl.isConnected || !candidates.includes(focusedEl)) {
      focusFirstInContainer(getActiveModalContainer());
      lastDpadTime = now;
      if (window.G && G.Audio && G.Audio.sfx) G.Audio.sfx('click');
      return;
    }

    const curRect = focusedEl.getBoundingClientRect();
    const curCx = curRect.left + curRect.width / 2;
    const curCy = curRect.top + curRect.height / 2;

    let best = null;
    let bestDist = Infinity;

    for (const el of candidates) {
      if (el === focusedEl) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      let valid = false;
      let dist = Infinity;

      if (down && cy > curCy + 4) {
        valid = true;
        dist = Math.hypot((cx - curCx) * 1.4, cy - curCy);
      } else if (up && cy < curCy - 4) {
        valid = true;
        dist = Math.hypot((cx - curCx) * 1.4, curCy - cy);
      } else if (right && cx > curCx + 4) {
        valid = true;
        dist = Math.hypot(cx - curCx, (cy - curCy) * 1.4);
      } else if (left && cx < curCx - 4) {
        valid = true;
        dist = Math.hypot(curCx - cx, (cy - curCy) * 1.4);
      }

      if (valid && dist < bestDist) {
        bestDist = dist;
        best = el;
      }
    }

    if (!best) {
      const idx = candidates.indexOf(focusedEl);
      if (down || right) best = candidates[(idx + 1) % candidates.length];
      else if (up || left) best = candidates[(idx - 1 + candidates.length) % candidates.length];
    }

    if (best && best !== focusedEl) {
      focusedEl.classList.remove('gp-focused');
      focusedEl = best;
      focusedEl.classList.add('gp-focused');
      focusedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      lastDpadTime = now;
      if (window.G && G.Audio && G.Audio.sfx) G.Audio.sfx('click');
    }
  }

  function clickFocused() {
    if (focusedEl && focusedEl.isConnected) {
      focusedEl.click();
      if (window.G && G.Audio && G.Audio.sfx) G.Audio.sfx('confirm');
    }
  }

  function closeCurrentModal() {
    const closeBtn = document.querySelector(
      '#legal-close:not(.hidden), #sup-close:not(.hidden), #news-close:not(.hidden), ' +
      '#set-close:not(.hidden), #dex-close:not(.hidden), #starter-back:not(.hidden), ' +
      '#res-other:not(.hidden), #fr-room:not(.hidden), [data-back]:not(.hidden), .modal-close:not(.hidden)'
    );
    if (closeBtn) closeBtn.click();
    else if (window.G && G.SettingsUI && G.SettingsUI.isOpen) G.SettingsUI.close();
  }

  function getActiveGamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    let gps = null;
    try { gps = navigator.getGamepads(); } catch (err) { return null; }
    if (!gps) return null;

    if (activeGamepadIndex !== null && gps[activeGamepadIndex] && gps[activeGamepadIndex].connected) {
      return gps[activeGamepadIndex];
    }

    for (let i = 0; i < gps.length; i++) {
      if (gps[i] && gps[i].connected) {
        if (activeGamepadIndex !== i) {
          activeGamepadIndex = i;
          gamepadType = detectType(gps[i].id);
          gamepadName = getFriendlyName(gamepadType, gps[i].id);
        }
        return gps[i];
      }
    }
    return null;
  }

  // ---------------- Desplazamiento y Páginas con Stick Derecho ----------------
  let lastRightStickFlick = 0;

  function findScrollContainer() {
    if (typeof document === 'undefined') return null;

    // 1. Elemento bajo el puntero virtual si está visible
    if (cursorVisible) {
      let el = document.elementFromPoint(cursorX, cursorY);
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const oy = style.overflowY;
        const ox = style.overflowX;
        const canY = (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight;
        const canX = (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth;
        if (canY || canX) return el;
        el = el.parentElement;
      }
    }

    // 2. Contenedor activo de pantallas conocidas
    const active = document.querySelector(
      '#scr-settings:not(.hidden) .set-body, ' +
      '#scr-dex:not(.hidden) .dex-grid, #scr-dex:not(.hidden) .grid, #scr-dex:not(.hidden) #dex-detail, ' +
      '#scr-upgrades:not(.hidden) .upg-body, ' +
      '#scr-goals:not(.hidden) .goals-body, ' +
      '#scr-rank:not(.hidden) .rk-list, ' +
      '#scr-friends:not(.hidden) .fr-list, ' +
      '#scr-news:not(.hidden) .news-body, ' +
      '#scr-support:not(.hidden) .box.support, ' +
      '.comparison-table-wrapper, .catalog-grid'
    );
    if (active) return active;

    return document.scrollingElement || document.documentElement || document.body;
  }

  function handleHorizontalPageSwitch(dir) {
    if (typeof document === 'undefined') return;
    const now = performance.now();
    if (now - lastRightStickFlick < 320) return;

    // A. Pestañas de Ajustes: Sonido · Gráficos · Controles · Cuenta · Acerca de
    const settingsEl = document.querySelector('#scr-settings:not(.hidden)');
    if (settingsEl) {
      const tabs = Array.from(settingsEl.querySelectorAll('#set-tabs .gen-tab'));
      if (tabs.length > 1) {
        const curIdx = tabs.findIndex(t => t.classList.contains('on'));
        if (curIdx !== -1) {
          const nextIdx = (curIdx + dir + tabs.length) % tabs.length;
          tabs[nextIdx].click();
          lastRightStickFlick = now;
          if (window.G && G.Audio && G.Audio.sfx) G.Audio.sfx('click');
          return;
        }
      }
    }

    // B. Pestañas de Pokédex por Región / Generación
    const dexEl = document.querySelector('#scr-dex:not(.hidden)');
    if (dexEl) {
      const tabs = Array.from(dexEl.querySelectorAll('.gen-tabs .gen-tab'));
      if (tabs.length > 1) {
        const curIdx = tabs.findIndex(t => t.classList.contains('on'));
        if (curIdx !== -1) {
          const nextIdx = (curIdx + dir + tabs.length) % tabs.length;
          tabs[nextIdx].click();
          tabs[nextIdx].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
          lastRightStickFlick = now;
          if (window.G && G.Audio && G.Audio.sfx) G.Audio.sfx('click');
          return;
        }
      }
    }

    // C. Paginación en Character Analyzer si está presente
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    if (dir < 0 && prevBtn && !prevBtn.disabled) {
      prevBtn.click();
      lastRightStickFlick = now;
      return;
    } else if (dir > 0 && nextBtn && !nextBtn.disabled) {
      nextBtn.click();
      lastRightStickFlick = now;
      return;
    }
  }

  function handleRightStick(rx, ry) {
    const rmag = Math.hypot(rx, ry);
    if (rmag < 0.18) return;

    const normMag = (rmag - 0.18) / (1 - 0.18);
    const sens = getCursorSensitivity();
    const speed = 20 * (normMag * normMag * 1.5 + 0.6) * sens;
    const dx = (rx / rmag) * speed;
    const dy = (ry / rmag) * speed;

    // Desplazamiento continuo de contenedores (vertical y horizontal)
    const container = findScrollContainer();
    if (container) {
      if (container === document.body || container === document.documentElement || container === document.scrollingElement) {
        window.scrollBy({ left: dx, top: dy, behavior: 'instant' });
      } else {
        container.scrollTop += dy;
        container.scrollLeft += dx;
      }
    }

    // Cambio de página / pestaña al empujar el stick derecho fuertemente en horizontal
    if (Math.abs(rx) > 0.72 && Math.abs(ry) < 0.45) {
      handleHorizontalPageSwitch(rx > 0 ? 1 : -1);
    }
  }

  function pollGamepad() {
    const gp = getActiveGamepad();
    if (!gp || !gp.buttons) return null;

    if (document.body && !document.body.classList.contains('gamepad-active')) {
      document.body.classList.add('gamepad-active');
    }

    const btns = gp.buttons;
    const len = Math.min(btns.length, 18);

    // 1. Comprobar si hay un oyente de captura interactiva (para reasignar botón)
    if (nextButtonListener) {
      for (let i = 0; i < len; i++) {
        const isDown = !!btns[i] && (btns[i].pressed || btns[i].value > 0.5);
        if (isDown && !prevButtons[i]) {
          const fn = nextButtonListener;
          nextButtonListener = null;
          fn(i);
          break;
        }
      }
    }

    const inUI = isUIActive();
    const actMap = getActionMap();
    const confirmBtnIdx = actMap.atk1 != null ? actMap.atk1 : 0;
    const cancelBtnIdx = actMap.atk2 != null ? actMap.atk2 : 1;

    // 2. Si estamos en interfaz/menús: Stick como puntero virtual y Crucetas para navegar
    if (inUI) {
      checkModalChange();
      // Stick izquierdo -> Mover puntero virtual en pantalla
      let gx = gp.axes && gp.axes[0] != null ? gp.axes[0] : 0;
      let gy = gp.axes && gp.axes[1] != null ? gp.axes[1] : 0;
      const mag = Math.hypot(gx, gy);

      if (mag > 0.18) {
        clearDpadFocus();
        showCursor();
        cursorLastMove = performance.now();
        const normMag = (mag - 0.18) / (1 - 0.18);
        const sens = getCursorSensitivity();
        const speed = 14 * Math.min(2.5, normMag * normMag * 2.2 + 0.8) * sens;

        cursorX += (gx / mag) * speed;
        cursorY += (gy / mag) * speed;
        if (typeof window !== 'undefined') {
          cursorX = Math.max(8, Math.min(window.innerWidth - 8, cursorX));
          cursorY = Math.max(8, Math.min(window.innerHeight - 8, cursorY));
        }
        updateCursorDOM();
        checkCursorHover();
      } else if (cursorVisible && performance.now() - cursorLastMove > 5000) {
        hideCursor();
      }

      // Stick derecho -> Desplazamiento horizontal y vertical de contenedores / páginas
      let rx = gp.axes && gp.axes[2] != null ? gp.axes[2] : 0;
      let ry = gp.axes && gp.axes[3] != null ? gp.axes[3] : 0;
      handleRightStick(rx, ry);

      // Crucetas (D-pad) -> Navegación espacial por botones
      const dUp = btns[12] && (btns[12].pressed || btns[12].value > 0.5);
      const dDown = btns[13] && (btns[13].pressed || btns[13].value > 0.5);
      const dLeft = btns[14] && (btns[14].pressed || btns[14].value > 0.5);
      const dRight = btns[15] && (btns[15].pressed || btns[15].value > 0.5);

      if (dUp || dDown || leftDpadPressed(dLeft) || dRight) {
        handleDpad(dUp, dDown, dLeft, dRight);
      }
    } else {
      hideCursor();
      clearDpadFocus();
    }

    function leftDpadPressed(val) { return !!val; }

    // 3. Procesar pulsaciones de botones
    for (let i = 0; i < len; i++) {
      const isDown = !!btns[i] && (btns[i].pressed || btns[i].value > 0.5);
      const wasDown = prevButtons[i];

      // Acciones de UI para Confirmar y Cancelar
      if (inUI) {
        if (i === confirmBtnIdx && isDown && !wasDown) {
          if (cursorVisible && cursorHoverTarget) {
            clickCursorTarget();
          } else if (focusedEl) {
            clickFocused();
          }
        } else if (i === cancelBtnIdx && isDown && !wasDown) {
          closeCurrentModal();
        }
      }

      const keys = getButtonKeys(i);
      if (keys) {
        if (isDown && !wasDown) {
          for (const k of keys) {
            pressed.add(k);
            down.add(k);
          }
        } else if (!isDown && wasDown) {
          for (const k of keys) {
            down.delete(k);
          }
        }
      }

      prevButtons[i] = isDown;
    }

    return gp;
  }

  return {
    /** Vector de movimiento del jugador (stick analógico, cruceta, teclado o joystick táctil). */
    axis() {
      // En menús/interfaz, el stick mueve el puntero virtual, no al personaje
      if (isUIActive()) {
        pollGamepad();
        return [0, 0];
      }

      // 1. Mando / Gamepad analógico o digital durante partida activa
      const gp = pollGamepad();
      if (gp) {
        let gx = gp.axes && gp.axes[0] != null ? gp.axes[0] : 0;
        let gy = gp.axes && gp.axes[1] != null ? gp.axes[1] : 0;

        // Zona muerta analógica para evitar drifting (0.18)
        const mag = Math.hypot(gx, gy);
        if (mag < 0.18) {
          gx = 0;
          gy = 0;
        } else {
          const normMag = Math.min(1, (mag - 0.18) / (1 - 0.18));
          gx = (gx / mag) * normMag;
          gy = (gy / mag) * normMag;
        }

        // Cruceta (D-pad) como entrada direccional
        const btns = gp.buttons || [];
        if (btns[14] && (btns[14].pressed || btns[14].value > 0.5)) gx -= 1; // Left
        if (btns[15] && (btns[15].pressed || btns[15].value > 0.5)) gx += 1; // Right
        if (btns[12] && (btns[12].pressed || btns[12].value > 0.5)) gy -= 1; // Up
        if (btns[13] && (btns[13].pressed || btns[13].value > 0.5)) gy += 1; // Down

        if (gx !== 0 || gy !== 0) {
          return G.U.norm(gx, gy);
        }
      }

      // 2. Joystick táctil en pantalla móvil
      const t = G.Touch && G.Touch.vector();
      if (t && (t[0] || t[1])) return t;

      // 3. Teclado (WASD / Flechas)
      let x = 0, y = 0;
      if (MOVE_KEYS.left.some(k => down.has(k))) x -= 1;
      if (MOVE_KEYS.right.some(k => down.has(k))) x += 1;
      if (MOVE_KEYS.up.some(k => down.has(k))) y -= 1;
      if (MOVE_KEYS.down.some(k => down.has(k))) y += 1;
      return G.U.norm(x, y);
    },

    held(c) {
      pollGamepad();
      return down.has(c);
    },

    /** true sólo en el frame en que se pulsó. */
    tap(c) {
      pollGamepad();
      return pressed.has(c);
    },

    mouse() { return { x: mx, y: my, down: mdown }; },

    /** Vibración / Háptica para mandos compatibles (DualSense, DualShock 4, Xbox). */
    rumble(duration = 150, weak = 0.5, strong = 0.5) {
      const gp = getActiveGamepad();
      if (!gp) return;
      if (gp.vibrationActuator && typeof gp.vibrationActuator.playEffect === 'function') {
        try {
          gp.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: Math.max(40, Math.min(1000, duration)),
            weakMagnitude: Math.max(0, Math.min(1, weak)),
            strongMagnitude: Math.max(0, Math.min(1, strong))
          }).catch(() => {});
        } catch (e) {}
      } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(duration); } catch (e) {}
      }
    },

    /** Información del mando activo */
    gamepadInfo() {
      const gp = getActiveGamepad();
      return {
        connected: !!gp,
        type: gamepadType,
        name: gamepadName,
        id: gp ? gp.id : null
      };
    },

    /** Mapeo de controles del juego a botones del mando */
    CONTROLLER_BUTTONS,
    GAME_ACTIONS,
    DEFAULT_ACTION_MAP,
    getActionMap,
    setActionMap,
    resetActionMap,
    getButtonName,
    listenNextButton,
    cancelListenNextButton,
    getCursorSensitivity,
    setCursorSensitivity,
    handleRightStick,
    showCursor,
    hideCursor,
    isUIActive,
    clearDpadFocus,

    endFrame() {
      pressed.clear();
    }
  };
})();
