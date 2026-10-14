/* Importación de respaldos — SOLO para la rama de pruebas local de Tiliko.
 * Nunca escribe en Firebase ni utiliza red. No incorporar a producción hasta
 * diseñar una migración autenticada y revisada contra reglas antitrampas.
 */
G.SaveTransfer = (() => {
  'use strict';
  const FORMAT = 'pokesurvivor-save-transfer-v1';
  const MAX_BYTES = 3 * 1024 * 1024;
  const FIELDS = ['v', 'name', 'created', 'updated', 'coins', 'owned', 'shiny', 'partner',
    'partnerShiny', 'starter', 'personality', 'upgrades', 'pupg', 'pupgDone', 'tickets',
    'pity', 'legends', 'arenas', 'itemsFound', 'evoMoves', 'ach', 'missions', 'profile',
    'stats', 'pbind', 'pban'];
  const map = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const num = x => Number.isFinite(x) && x >= 0 && Number.isInteger(x);
  function localOnly() {
    if (!G.DB.save || G.DB.guest || G.DB.mode !== 'local') {
      G.UI.toast('La importación sólo funciona en una cuenta LOCAL, no en Invitado ni en Firebase.', 6000);
      return false;
    }
    if (G.Game.state !== 'ui') {
      G.UI.toast('Sal primero de la partida para importar.', 4000);
      return false;
    }
    return true;
  }
  function download(object, name) {
    const blob = new Blob([JSON.stringify(object, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function backupObject(save) {
    return { format: FORMAT, exportedAt: new Date().toISOString(), sourceSite: location.hostname,
      save: JSON.parse(JSON.stringify(save)) };
  }
  function exportCurrent() {
    if (!localOnly()) return;
    download(backupObject(G.DB.save), 'tiliko-mi-cuenta-local-' + new Date().toISOString().slice(0, 10) + '.json');
    G.UI.toast('Copia local preparada. Consérvala en privado.', 4500);
  }
  function validateEnvelope(env) {
    if (!map(env) || env.format !== FORMAT || !map(env.save)) throw Error('El archivo no tiene el formato del exportador de PokéSurvivor.');
    const raw = env.save;
    if (!Number.isInteger(raw.v) || raw.v < 1 || raw.v > 3) throw Error('Versión de partida no compatible.');
    if (!num(raw.coins) || raw.coins > 1e9) throw Error('Las monedas del archivo son inválidas.');
    if (!map(raw.owned) || !map(raw.pupg) || !map(raw.stats) || !map(raw.tickets)) throw Error('La partida está incompleta.');
    if (!num(raw.tickets.t1) || !num(raw.tickets.t10)) throw Error('Los tickets del archivo son inválidos.');
    if (Object.keys(raw.owned).length > 1100 || Object.keys(raw.shiny || {}).length > 1100) throw Error('La colección tiene un tamaño imposible.');
    if (raw.partner != null && typeof raw.partner !== 'string' && typeof raw.partner !== 'number') throw Error('Pokémon compañero inválido.');
    const s = {};
    for (const field of FIELDS) if (Object.prototype.hasOwnProperty.call(raw, field)) s[field] = raw[field];
    for (const field of ['owned', 'shiny', 'pupg', 'upgrades', 'tickets', 'pity', 'ach', 'stats']) {
      if (s[field] != null && !map(s[field])) throw Error('El campo ' + field + ' es inválido.');
    }
    s.shiny = s.shiny || {};
    s.upgrades = s.upgrades || {};
    s.ach = s.ach || {};
    s.pity = s.pity || {};
    const dex = G.DEX_BY || {};
    for (const group of ['owned', 'shiny', 'pupg']) {
      for (const key of Object.keys(s[group] || {})) if (!dex[key]) delete s[group][key];
    }
    return s;
  }
  function chooseFile() {
    if (!localOnly()) return;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        if (file.size > MAX_BYTES) throw Error('El archivo es demasiado grande (máximo 3 MB).');
        const parsed = JSON.parse(await file.text(), (k, v) => ['__proto__', 'constructor', 'prototype'].includes(k) ? undefined : v);
        const s = validateEnvelope(parsed);
        if (!localOnly()) return;
        const owned = Object.keys(s.owned).length;
        const shiny = Object.keys(s.shiny).length;
        const upgraded = Object.values(s.pupg).filter(x => map(x) && Object.values(x).some(n => n > 0)).length;
        const msg = [
          'COPIA ENCONTRADA', '', 'Origen: ' + String(parsed.sourceSite || 'sin indicar').slice(0, 80),
          'Pokémon: ' + owned, 'Shinies: ' + shiny, 'Pokémon con mejoras: ' + upgraded,
          'Monedas: ' + s.coins, 'Tickets: ' + s.tickets.t1 + ' ×1 / ' + s.tickets.t10 + ' ×10', '',
          '¿Importar SOLO a la cuenta local de esta página de pruebas?',
          'Se hará una copia de seguridad local antes de cambiar nada. NO se enviará a Firebase.'
        ].join('\n');
        if (!confirm(msg)) return;
        const target = G.DB.save;
        const original = JSON.parse(JSON.stringify(target));
        const backup = backupObject(original);
        const backupKey = 'ps.transfer.backup.' + Date.now();
        try { localStorage.setItem(backupKey, JSON.stringify(backup)); }
        catch (_) { throw Error('No hay espacio para guardar la copia de seguridad. No se importó nada.'); }
        s.updated = Math.max(Date.now(), (target.updated || 0) + 1);
        s.name = target.name;
        const merged = G.DB.merge(original, s);
        merged.name = target.name;
        try {
          for (const k of Object.keys(target)) delete target[k];
          Object.assign(target, merged);
          if (!G.DB.commit(true)) throw Error('Falló el guardado local.');
        } catch (e) {
          for (const k of Object.keys(target)) delete target[k];
          Object.assign(target, original);
          G.DB.commit(true);
          throw e;
        }
        alert('¡Importación local terminada! Tus datos anteriores siguen respaldados en este navegador. Recarga la página para ver los Pokémon y mejoras importados. No se ha enviado nada a Firebase.');
        location.reload();
      } catch (e) { alert('No se importó la partida: ' + e.message); }
    };
    input.click();
  }
  return { chooseFile, exportCurrent };
})();
