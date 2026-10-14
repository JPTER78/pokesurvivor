// ==UserScript==
// @name         PokéSurvivor — Exportar mi partida (copia local)
// @namespace    pokesurvivor-tiliko
// @version      0.1.0
// @description  Descarga tu propio guardado como JSON; sin enviar datos a servidores.
// @match        https://pokesurvivor.com/*
// @match        https://www.pokesurvivor.com/*
// @match        https://jpter78.github.io/pokesurvivor/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
  'use strict';
  const ok = location.protocol === 'https:' && (
    location.hostname === 'pokesurvivor.com' ||
    location.hostname === 'www.pokesurvivor.com' ||
    (location.hostname === 'jpter78.github.io' && location.pathname.startsWith('/pokesurvivor'))
  );
  if (!ok) { alert('Abre primero el PokéSurvivor ORIGINAL (pokesurvivor.com).'); return; }
  if (document.getElementById('ps-tiliko-export-panel')) return;
  // Lectura LOCAL exclusivamente. Sin solicitudes de red ni credenciales.
  function parseKey(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
  }
  function valid(s) {
    return s && typeof s === 'object' && !Array.isArray(s) &&
      Number.isInteger(s.v) && s.v > 0 && s.v <= 3 &&
      s.owned && typeof s.owned === 'object' && !Array.isArray(s.owned) &&
      Number.isFinite(s.coins) && s.coins >= 0 &&
      s.pupg && typeof s.pupg === 'object' && !Array.isArray(s.pupg);
  }
  function currentKeys() {
    const keys = [];
    try {
      if (window.firebase && typeof window.firebase.auth === 'function') {
        const user = window.firebase.auth().currentUser;
        if (user && user.uid) keys.push('ps.cloud.' + user.uid);
      }
    } catch (_) { /* Firebase quizá todavía esté cargando. */ }
    const session = parseKey('ps.session');
    if (typeof session === 'string' && /^[a-z0-9_ñáéíóú-]{3,32}$/i.test(session)) keys.push('ps.save.' + session);
    // Copias anteriores sin sesión actual: el usuario elige.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (/^ps\.cloud\.[\w-]+$/.test(key) || /^ps\.save\.[\wñáéíóú-]+$/i.test(key))) keys.push(key);
    }
    return [...new Set(keys)].filter(k => valid(parseKey(k)));
  }
  const panel = document.createElement('div');
  panel.id = 'ps-tiliko-export-panel';
  panel.style.cssText = 'position:fixed;z-index:2147483647;right:12px;bottom:12px;max-width:min(360px,calc(100vw - 24px));padding:12px;background:#101a33;color:#fff;border:2px solid #ffc94d;border-radius:12px;font:15px/1.4 system-ui,sans-serif;box-shadow:0 6px 32px #0009;';
  const title = document.createElement('strong'); title.textContent = 'Copia de tu partida de PokéSurvivor';
  const info = document.createElement('p');
  info.style.cssText = 'font-size:13px;margin:8px 0;';
  info.textContent = 'Descarga solo tu partida desde este navegador. No modifica el juego ni sube información a internet.';
  const select = document.createElement('select');
  select.style.cssText = 'width:100%;min-height:38px;margin:4px 0 10px;padding:6px;background:#fff;color:#111;';
  const status = document.createElement('p');
  status.style.cssText = 'margin:8px 0 0;font-size:12px;white-space:normal;';
  const btn = document.createElement('button'); btn.textContent = 'Descargar respaldo JSON';
  btn.style.cssText = 'min-height:44px;min-width:100%;font-weight:700;border:0;border-radius:6px;background:#ffc94d;color:#101a33;';
  const close = document.createElement('button');
  close.textContent = '×'; close.setAttribute('aria-label', 'Cerrar exportador');
  close.style.cssText = 'position:absolute;top:0;right:4px;background:none;color:#fff;border:0;font:26px system-ui;';
  close.onclick = () => panel.remove();
  const keys = currentKeys();
  if (!keys.length) {
    status.textContent = 'No se encontró una partida válida. Inicia sesión en el juego original en ESTE navegador, espera a que cargue y vuelve a usar el exportador.';
    btn.disabled = true; btn.style.opacity = '0.5';
  } else {
    keys.forEach((key, i) => {
      const s = parseKey(key);
      const opt = document.createElement('option'); opt.value = key;
      const count = Object.keys(s.owned || {}).length;
      opt.textContent = (i + 1) + '. ' + String(s.name || 'Entrenador').slice(0, 25) + ' · ' + count + ' Pokémon · ' + s.coins + ' monedas';
      select.appendChild(opt);
    });
    status.textContent = keys.length > 1 ? 'Hay varias copias en este navegador. Elige la cuenta correcta antes de descargar.' : 'Se encontró una partida; revisa el nombre antes de descargar.';
  }
  btn.onclick = () => {
    try {
      const s = parseKey(select.value);
      if (!valid(s)) throw new Error('La copia elegida ya no está disponible.');
      // No incluye tokens Firebase, contraseñas ni claves de localStorage.
      const payload = { format: 'pokesurvivor-save-transfer-v1', exportedAt: new Date().toISOString(), sourceSite: location.hostname, save: s };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'pokesurvivor-respaldo-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = 'Respaldo solicitado. Búscalo en Descargas y guárdalo en privado: contiene tus Pokémon y progreso.';
    } catch (e) { status.textContent = 'No se pudo exportar: ' + e.message; }
  };
  panel.append(close, title, info, select, btn, status);
  document.body.appendChild(panel);
})();
