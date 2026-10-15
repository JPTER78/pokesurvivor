/* ============ settings-ui.js — pantalla de Ajustes (PC y móvil) ============
 * Se abre por encima de lo que haya (menú o pausa) y al cerrar vuelve ahí.
 * Pestañas: Sonido · Gráficos · Controles · Cuenta · Acerca de.
 * Los ajustes son de este dispositivo (G.Settings / G.Audio en el navegador).
 */
G.SettingsUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const VERSION = '1.2 · 2026-10-09';
  const REPO = 'https://github.com/JPTER78/pokesurvivor';
  let tab = 'sound';
  let activeKeyCaptureBtn = null;
  let keyCaptureCleanup = null;

  function stopKeyCapture() {
    if (keyCaptureCleanup) {
      keyCaptureCleanup();
      keyCaptureCleanup = null;
    }
    if (activeKeyCaptureBtn) {
      const en = window.G && G.I18n && G.I18n.lang === 'en';
      activeKeyCaptureBtn.classList.remove('listening');
      activeKeyCaptureBtn.textContent = en ? '🎮 Assign button' : '🎮 Asignar botón';
      activeKeyCaptureBtn = null;
    }
  }

  function init() {
    document.querySelectorAll('#set-tabs .gen-tab').forEach(b => {
      b.onclick = () => { stopKeyCapture(); tab = b.dataset.t; render(); };
    });
    $('set-close').onclick = close;
    $('btn-settings').innerHTML = G.Icons.html('gear', 20);
    $('btn-settings').onclick = () => open();
    $('btn-pause-settings').onclick = () => open('sound');
    // Pantalla completa (si el navegador la permite; en iPhone, cómo conseguirla).
    if (canFull() || iosTip()) {
      $('btn-full').classList.remove('hidden');
      $('btn-full').innerHTML = G.Icons.html('full', 20);
      $('btn-full').onclick = toggleFull;
    }
  }

  function open(t) {
    stopKeyCapture();
    if (t) tab = t;
    $('scr-settings').classList.remove('hidden');
    render();
  }
  function close() {
    stopKeyCapture();
    $('scr-settings').classList.add('hidden');
  }
  const isOpen = () => !$('scr-settings').classList.contains('hidden');

  // ---------------- pantalla completa ----------------
  function canFull() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); }
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  // iPhone: Safari no deja poner una web a pantalla completa (por eso a veces
  // no salía la opción). Sí se puede abriéndola desde la pantalla de inicio.
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => !!navigator.standalone || (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);
  function iosTip() { return IOS && !canFull() && !standalone(); }
  const IOS_TIP = 'En iPhone, Safari no deja poner las webs a pantalla completa. Pulsa Compartir y luego "Añadir a pantalla de inicio": abriendo el juego desde ese icono se juega a pantalla completa.';
  function toggleFull() {
    if (!canFull()) { if (iosTip()) G.UI.toast(IOS_TIP, 9000); return; }
    if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const el = document.documentElement;
      const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      // En móvil, además se intenta fijar la pantalla en horizontal.
      if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* nada */ } }).catch(() => {});
    }
    setTimeout(() => { if (isOpen()) render(); }, 300);
  }

  // ---------------- piezas ----------------
  function section(title, sub) { return `<h3 class="set-h">${esc(title)}</h3>${sub ? `<p class="sub">${sub}</p>` : ''}`; }
  function toggle(key, label, desc) {
    const on = !!G.Settings.get(key);
    return `<div class="set-row"><div class="grow"><b>${esc(label)}</b><small>${esc(desc)}</small></div>
      <button class="btn small switch ${on ? 'gold' : ''}" data-k="${key}">${on ? 'Sí' : 'No'}</button></div>`;
  }
  function choice(key, opts) {
    const cur = G.Settings.get(key);
    return `<div class="chips set-chips">${opts.map(([v, l]) => `<button class="chip ${v === cur ? 'on' : ''}" data-k="${key}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
  }

  function getSensLabel(val) {
    const en = window.G && G.I18n && G.I18n.lang === 'en';
    const v = Math.round(val * 10) / 10;
    if (v <= 0.45) return `${v.toFixed(1)}× (${en ? 'Slow' : 'Lenta'})`;
    if (v < 0.95) return `${v.toFixed(1)}× (${en ? 'Moderate' : 'Moderada'})`;
    if (Math.abs(v - 1.0) < 0.05) return `1.0× (Normal)`;
    if (v <= 1.55) return `${v.toFixed(1)}× (${en ? 'Fast' : 'Rápida'})`;
    return `${v.toFixed(1)}× (${en ? 'Very fast' : 'Muy rápida'})`;
  }

  function renderGamepadControls() {
    if (!window.G || !G.Input || !G.Input.GAME_ACTIONS) return '';
    const en = window.G && G.I18n && G.I18n.lang === 'en';
    const info = G.Input.gamepadInfo ? G.Input.gamepadInfo() : { connected: false };
    const actions = G.Input.GAME_ACTIONS;
    const actMap = G.Input.getActionMap ? G.Input.getActionMap() : {};
    const defMap = G.Input.DEFAULT_ACTION_MAP || {};
    const buttons = G.Input.CONTROLLER_BUTTONS || [];
    const curSens = G.Input.getCursorSensitivity ? G.Input.getCursorSensitivity() : 0.4;

    let rowsHtml = '';
    for (const act of actions) {
      const assignedBtn = actMap[act.id] != null ? actMap[act.id] : act.defaultButton;
      const isDef = assignedBtn === defMap[act.id];
      const btnName = G.Input.getButtonName ? G.Input.getButtonName(assignedBtn) : (en ? `Button ${assignedBtn}` : `Botón ${assignedBtn}`);

      let optHtml = '';
      for (const b of buttons) {
        const isSel = b.index === assignedBtn;
        const bLabel = G.Input.getButtonName ? G.Input.getButtonName(b.index) : b.name;
        optHtml += `<option value="${b.index}" ${isSel ? 'selected' : ''}>${esc(bLabel)}</option>`;
      }

      const actName = G.I18n && G.I18n.t ? G.I18n.t(act.name) : act.name;
      const actDesc = G.I18n && G.I18n.t ? G.I18n.t(act.desc) : act.desc;
      const listenBtnTitle = en ? 'Press a button on your controller to assign it to this action' : 'Presiona un botón en tu mando para asignarlo a esta acción';
      const listenBtnText = en ? '🎮 Assign button' : '🎮 Asignar botón';

      rowsHtml += `
        <div class="gp-action-row" data-act-id="${act.id}" id="gp-act-row-${act.id}">
          <div class="gp-action-info">
            <b>${esc(actName)}</b>
            <small>${esc(actDesc)}</small>
          </div>
          <kbd class="gp-btn-badge ${isDef ? '' : 'custom'}" id="gp-badge-${act.id}">${esc(btnName)}</kbd>
          <div class="gp-action-controls">
            <select class="field small gp-button-select" data-act-id="${act.id}">
              ${optHtml}
            </select>
            <button class="btn small gp-listen-btn" data-act-id="${act.id}" title="${esc(listenBtnTitle)}">${esc(listenBtnText)}</button>
          </div>
        </div>
      `;
    }

    const sensLabel = getSensLabel(curSens);
    const sensChips = [
      [0.4, en ? '0.4× Slow' : '0.4× Lenta'],
      [0.7, en ? '0.7× Moderate' : '0.7× Moderada'],
      [1.0, '1.0× Normal'],
      [1.4, en ? '1.4× Fast' : '1.4× Rápida'],
      [1.8, en ? '1.8× Very fast' : '1.8× Muy rápida']
    ];

    const sensHtml = `
      <div class="gp-sensitivity-box">
        <div class="row between" style="align-items:center;margin-bottom:6px">
          <div>
            <b>${en ? 'Pointer Sensitivity' : 'Sensibilidad del puntero'}</b>
            <small style="display:block;color:var(--muted)">${en ? 'Adjust cursor speed with the left stick in menus and interface.' : 'Ajusta la velocidad del cursor con el stick analógico izquierdo.'}</small>
          </div>
          <span class="gp-sens-val gold" id="gp-sens-badge">${esc(sensLabel)}</span>
        </div>
        <div class="gp-slider-row">
          <span class="gp-slider-lbl">0.2×</span>
          <input type="range" class="gp-slider" id="gp-sens-slider" min="0.2" max="2.4" step="0.1" value="${curSens.toFixed(1)}">
          <span class="gp-slider-lbl">2.4×</span>
        </div>
        <div class="chips gp-sens-chips" style="margin-top:8px">
          ${sensChips.map(([v, l]) => `<button class="chip ${Math.abs(curSens - v) < 0.05 ? 'on' : ''}" data-sens="${v}">${esc(l)}</button>`).join('')}
        </div>
      </div>
    `;

    const secTitle = en ? 'Controller / Gamepad (PS4, PS5, Xbox, Switch)' : 'Mando / Control (PS4, PS5, Xbox, Switch)';
    const secSub = en ? 'Assign the controller button of your choice to each in-game action.' : 'Asigna a cada control del juego el botón de tu control que prefieras.';
    const connTitle = info.connected ? (en ? 'Controller connected: ' : 'Mando conectado: ') + esc(info.name) : (en ? 'No controller detected' : 'Ningún mando detectado');
    const connSub = info.connected ? (en ? 'Left Stick: cursor · Right Stick: scroll & switch pages · D-pad: menus' : 'Stick Izq: puntero · Stick Der: mover y cambiar páginas · Cruceta: menús') : (en ? 'Connect your controller via USB or Bluetooth and press any button to activate.' : 'Conecta tu control por cable USB o Bluetooth y pulsa un botón para activarlo.');
    const footerNote = en ? 'Left Stick: Visual pointer · Right Stick: Horizontal/vertical scroll & pages · D-pad: Menu navigation' : 'Stick Izq: Puntero visual · Stick Der: Scroll horizontal/vertical y páginas · Cruceta: Navegación de menú';
    const resetText = en ? 'Reset default controls' : 'Restablecer controles por defecto';

    return section(secTitle, secSub)
      + `<div class="gp-status-banner ${info.connected ? 'connected' : 'disconnected'}">
           <span class="gp-dot ${info.connected ? 'green' : 'gray'}"></span>
           <div class="grow">
             <b>${connTitle}</b>
             <small>${connSub}</small>
           </div>
         </div>`
      + sensHtml
      + `<div class="gp-action-list">${rowsHtml}</div>`
      + `<div class="row between" style="margin-top:12px;align-items:center;flex-wrap:wrap;gap:8px">
           <small style="color:var(--muted)">${footerNote}</small>
           <button class="btn small danger" id="gp-reset-all">${resetText}</button>
         </div>`;
  }

  function render() {
    document.querySelectorAll('#set-tabs .gen-tab').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    const box = $('set-body');
    box.scrollTop = 0;
    if (tab === 'sound') {
      box.innerHTML = section('Sonido') + '<div id="set-sound" class="sound-inline"></div>';
      G.UI.soundControls($('set-sound'));
    } else if (tab === 'gfx') {
      const auto = ['baja', 'media', 'alta'][G.Settings.autoLevel];
      box.innerHTML = section('Idioma', 'El juego se recarga al cambiarlo.')
        + `<div class="chips set-chips" translate="no">${[['es', 'Español'], ['en', 'English']].map(([v, l]) =>
             `<button class="chip ${G.I18n.lang === v ? 'on' : ''}" data-lang="${v}">${l}</button>`).join('')}</div>`
        + section('Calidad', 'Cuántos efectos y partículas se dibujan. <b>Auto</b> la baja sola si el juego va a tirones (ahora: ' + auto + ').')
        + choice('quality', [['auto', 'Auto'], ['high', 'Alta'], ['mid', 'Media'], ['low', 'Baja']])
        + section('Pantalla')
        + toggle('dmgNumbers', 'Números de daño', 'Los números que salen al golpear y al recibir daño.')
        + toggle('calm', 'Menos sacudidas y destellos', 'La cámara tiembla menos y los fogonazos son suaves.')
        + toggle('fps', 'Mostrar FPS', 'Fotogramas por segundo, en la esquina de abajo.')
        + (canFull() ? `<div class="set-row"><div class="grow"><b>Pantalla completa</b><small>Sin barras del navegador.</small></div>
             <button class="btn small" id="set-full">${isFull() ? 'Salir' : 'Activar'}</button></div>`
           : iosTip() ? `<div class="set-row"><div class="grow"><b>Pantalla completa</b><small>${esc(IOS_TIP)}</small></div></div>` : '');
    } else if (tab === 'ctl') {
      box.innerHTML = section('En móvil o tablet')
        + `<p class="sub">Pon el dedo en cualquier parte y arrastra para moverte: el joystick aparece donde tocas. Toca un ataque de abajo para cambiarlo y el botón de arriba a la derecha para pausar. Se juega en horizontal.</p>`
        + `<div class="set-row"><div class="grow"><b>Tamaño del joystick</b><small>Cuánto hay que arrastrar el dedo.</small></div></div>`
        + choice('stick', [[0.8, 'Pequeño'], [1, 'Normal'], [1.25, 'Grande']])
        + `<div class="set-row"><div class="grow"><b>Colocar los botones</b><small>Pon los ataques, la pausa y el joystick (fijo, si quieres) donde quieras de la pantalla.</small></div>
             <button class="btn small" id="set-layout">Colocar</button></div>`
        + section('En PC')
        + `<div class="keys">
             <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o flechas</div><span>moverse</span>
             <div><kbd>1</kbd>–<kbd>4</kbd> o clic en el icono</div><span>elegir ataque</span>
             <div><kbd>Q</kbd> / <kbd>E</kbd></div><span>ataque anterior / siguiente</span>
             <div><kbd>Esc</kbd> o <kbd>P</kbd></div><span>pausa</span>
             <div><kbd>1</kbd>–<kbd>3</kbd></div><span>elegir carta al subir de nivel</span>
           </div>`
        + renderGamepadControls();
    } else if (tab === 'acc') {
      renderAccount(box);
    } else {
      box.innerHTML = `<div class="about-logo">PokéSurvivor</div><p class="sub center">Versión ${esc(VERSION)}</p>`
        + `<p class="sub">Juego de fans <b>gratuito y sin ánimo de lucro</b>: sin anuncios ni compras. Pokémon y sus personajes son propiedad de Nintendo, Creatures y GAME FREAK; este proyecto no está afiliado a ellos.</p>`
        + section('Créditos')
        + `<ul class="credits">
             <li><b>Sprites:</b> PMD SpriteCollab y sus artistas (CC BY-NC 4.0).</li>
             <li><b>Datos de los Pokémon:</b> PokéAPI.</li>
             <li><b>Música y sonidos:</b> originales, generados por el propio juego.</li>
             <li><b>Fuente:</b> Pixelify Sans (OFL).</li>
           </ul>`
        + `<div class="row wrap" style="justify-content:center;gap:8px">
             ${window.PS_PAGES ? `<a class="btn small" href="${G.I18n.lang === 'en' ? 'en/guide/' : 'guia/'}" target="_blank">Guía y preguntas</a>
             <a class="btn small" href="${G.I18n.lang === 'en' ? 'en/pokedex/' : 'pokedex/'}" target="_blank">Pokédex</a>` : ''}
             <button class="btn small" data-legal>Aviso legal y privacidad</button>
             <a class="btn small" href="contacto/" target="_blank" rel="noopener">Contacto</a>
             <a class="btn small" href="${REPO}" target="_blank" rel="noopener">Código (GitHub)</a>
           </div>`;
    }
    wire(box);
  }

  function renderAccount(box) {
    const st = G.DB.guest ? 'guest' : G.DB.syncState;
    const SYNC = { ok: 'Guardado en la nube', syncing: 'Guardando…', pending: 'Pendiente de subir (se sube al salir del juego)',
                   offline: 'Sin conexión: se subirá al volver', local: 'Guardado sólo en este navegador', guest: 'Invitado: no se guarda' };
    if (G.DB.guest) {
      box.innerHTML = section('Cuenta', 'Estás jugando como <b>invitado</b>: tu progreso no se guarda al salir.')
        + `<button class="btn gold" id="set-login">Crear cuenta o entrar</button>`;
      return;
    }
    const nick = G.Social.me ? G.Social.me.name : (G.DB.user || '');
    const kind = G.DB.mode === 'local' ? 'Cuenta de este navegador' : G.DB.nameAccount ? 'Nombre y contraseña' : 'Google';
    box.innerHTML = section('Cuenta')
      + `<div class="set-row"><div class="grow"><b>Apodo</b><small>Es único y no se puede cambiar.</small></div><span class="gold" translate="no">${esc(nick)}</span></div>`
      + `<div class="set-row"><div class="grow"><b>Tipo de cuenta</b></div><span>${esc(kind)}</span></div>`
      + `<div class="set-row"><div class="grow"><b>Partida</b></div><span>${esc(SYNC[st] || st)}</span></div>`
      + `<div class="row wrap" style="gap:8px;margin-top:12px">
           <button class="btn" id="set-logout">Cerrar sesión</button>
           <button class="btn danger" id="set-delete">Borrar cuenta</button>
         </div><p class="note" id="set-msg"></p>`;
  }

  function wire(box) {
    box.querySelectorAll('.switch[data-k]').forEach(b => { b.onclick = () => { G.Settings.set(b.dataset.k, !G.Settings.get(b.dataset.k)); render(); }; });
    box.querySelectorAll('.chip[data-k]').forEach(b => {
      b.onclick = () => { const v = b.dataset.v; G.Settings.set(b.dataset.k, isNaN(+v) ? v : +v); render(); };
    });
    const full = $('set-full'); if (full) full.onclick = toggleFull;
    const lay = $('set-layout'); if (lay) lay.onclick = () => G.LayoutUI.open();
    box.querySelectorAll('[data-lang]').forEach(b => { b.onclick = () => { if (b.dataset.lang !== G.I18n.lang) G.I18n.set(b.dataset.lang); }; });
    const lo = $('set-login'); if (lo) lo.onclick = () => { close(); leave(); };
    const out = $('set-logout'); if (out) out.onclick = () => { close(); leave(); };
    const del = $('set-delete');
    if (del) del.onclick = async () => {
      const ok = await G.UI.confirmDelete();
      if (!ok) return;
      del.disabled = true;
      const r = await G.DB.deleteAccount(ok.pass);
      if (!r.ok) { $('set-msg').textContent = r.error; del.disabled = false; return; }
      close();
      G.UI.toast('Cuenta borrada');
      G.Audio.music(null);
      G.Flow.toLogin();
    };

    // ---------------- Mando / Gamepad: Asignar botón a cada acción ----------------
    box.querySelectorAll('.gp-button-select').forEach(sel => {
      sel.onchange = () => {
        stopKeyCapture();
        const en = window.G && G.I18n && G.I18n.lang === 'en';
        const actId = sel.dataset.actId;
        const btnIdx = +sel.value;
        G.Input.setActionMap(actId, btnIdx);
        const btnName = G.Input.getButtonName(btnIdx);
        G.UI.toast(en ? `🎮 Control mapped to: ${btnName}` : `🎮 Control asignado a: ${btnName}`, 2200);
        render();
      };
    });

    box.querySelectorAll('.gp-listen-btn').forEach(btn => {
      btn.onclick = () => {
        const en = window.G && G.I18n && G.I18n.lang === 'en';
        const actId = btn.dataset.actId;
        if (activeKeyCaptureBtn === btn) {
          stopKeyCapture();
          return;
        }
        stopKeyCapture();

        activeKeyCaptureBtn = btn;
        btn.classList.add('listening');
        btn.textContent = en ? '🟡 Press a button on your controller...' : '🟡 Pulsa un botón en tu mando...';

        // Escucha directa del mando (presionar cualquier botón en el control)
        G.Input.listenNextButton(btnIdx => {
          stopKeyCapture();
          G.Input.setActionMap(actId, btnIdx);
          const btnName = G.Input.getButtonName(btnIdx);
          G.UI.toast(en ? `🎮 Control mapped to: ${btnName}` : `🎮 Control asignado a: ${btnName}`, 2500);
          render();
        });

        const onKeyDown = e => {
          const code = e.code.toLowerCase();
          if (code === 'escape') {
            stopKeyCapture();
            render();
            return;
          }
          if (code === 'digit1' || code === 'numpad1') G.Input.setActionMap(actId, 0);
          else if (code === 'digit2' || code === 'numpad2') G.Input.setActionMap(actId, 1);
          else if (code === 'digit3' || code === 'numpad3') G.Input.setActionMap(actId, 2);
          else if (code === 'digit4' || code === 'numpad4') G.Input.setActionMap(actId, 3);
          stopKeyCapture();
          render();
        };

        window.addEventListener('keydown', onKeyDown, { capture: true, once: true });
        keyCaptureCleanup = () => {
          window.removeEventListener('keydown', onKeyDown, { capture: true });
          if (G.Input && G.Input.cancelListenNextButton) G.Input.cancelListenNextButton();
        };
      };
    });

    const resetAllBtn = $('gp-reset-all');
    if (resetAllBtn) {
      resetAllBtn.onclick = () => {
        const en = window.G && G.I18n && G.I18n.lang === 'en';
        stopKeyCapture();
        G.Input.resetActionMap();
        G.UI.toast(en ? '🎮 Controller controls reset to default' : '🎮 Controles del mando restablecidos por defecto', 2500);
        render();
      };
    }

    // Sensibilidad del puntero con el mando
    const sensSlider = $('gp-sens-slider');
    const sensBadge = $('gp-sens-badge');
    if (sensSlider) {
      sensSlider.oninput = () => {
        const val = parseFloat(sensSlider.value);
        if (G.Input && G.Input.setCursorSensitivity) {
          G.Input.setCursorSensitivity(val);
        }
        if (sensBadge) sensBadge.textContent = getSensLabel(val);
        box.querySelectorAll('.gp-sens-chips .chip').forEach(c => {
          c.classList.toggle('on', Math.abs(parseFloat(c.dataset.sens) - val) < 0.05);
        });
      };
    }

    box.querySelectorAll('.gp-sens-chips .chip').forEach(chip => {
      chip.onclick = () => {
        const en = window.G && G.I18n && G.I18n.lang === 'en';
        const val = parseFloat(chip.dataset.sens);
        if (G.Input && G.Input.setCursorSensitivity) {
          G.Input.setCursorSensitivity(val);
        }
        if (sensSlider) sensSlider.value = val.toFixed(1);
        if (sensBadge) sensBadge.textContent = getSensLabel(val);
        box.querySelectorAll('.gp-sens-chips .chip').forEach(c => c.classList.remove('on'));
        chip.classList.add('on');
        G.UI.toast(en ? `🎮 Cursor sensitivity: ${val.toFixed(1)}×` : `🎮 Sensibilidad del cursor: ${val.toFixed(1)}×`, 1800);
      };
    });

    // Live feedback: ilumina la fila de la acción cuando se presiona su botón en el mando
    if (tab === 'ctl' && typeof navigator !== 'undefined' && navigator.getGamepads) {
      function checkGamepadButtons() {
        if (!isOpen() || tab !== 'ctl') return;
        let gps = null;
        try { gps = navigator.getGamepads(); } catch (e) { return; }
        if (gps) {
          const gp = Array.from(gps).find(g => g && g.connected);
          if (gp && gp.buttons) {
            const actMap = G.Input.getActionMap ? G.Input.getActionMap() : {};
            const actions = G.Input.GAME_ACTIONS || [];
            for (const act of actions) {
              const row = document.getElementById(`gp-act-row-${act.id}`);
              const btnIdx = actMap[act.id] != null ? actMap[act.id] : act.defaultButton;
              if (row && gp.buttons[btnIdx]) {
                const isDown = gp.buttons[btnIdx].pressed || gp.buttons[btnIdx].value > 0.5;
                row.classList.toggle('gp-pressed', isDown);
              }
            }
          }
        }
        requestAnimationFrame(checkGamepadButtons);
      }
      requestAnimationFrame(checkGamepadButtons);
    }
  }

  /** Cerrar sesión (si estás en una partida, se abandona). */
  function leave() {
    if (G.DB.guest && !confirm('Eres invitado: se perderá todo el progreso. ¿Salir?')) return;
    if (G.Game.state !== 'ui') G.Game.quit && G.Game.quit();
    G.Audio.music(null);
    G.DB.logout().then(() => G.Flow.toLogin());
  }

  return { init, open, close, get isOpen() { return isOpen(); } };
})();
