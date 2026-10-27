/* ============ login.js — inicio: entrar, crear cuenta o invitado ============ */
G.LoginUI = (() => {
  const $ = G.UI.$;
  let mode = 'login';

  function init() {
    document.querySelectorAll('#scr-login .tab').forEach(t => {
      t.onclick = () => setMode(t.dataset.tab);
    });
    $('login-form').onsubmit = async e => {
      e.preventDefault();
      $('login-err').textContent = '';
      $('btn-auth').disabled = true;
      const fn = mode === 'login' ? G.DB.login : G.DB.register;
      const r = await fn($('f-user').value, $('f-pass').value);
      $('btn-auth').disabled = false;
      if (!r.ok) { $('login-err').textContent = r.error; return; }
      $('f-pass').value = '';
      G.Flow.afterLogin();
    };
    $('btn-guest').onclick = () => { G.DB.playAsGuest(); G.Flow.afterLogin(); };
    $('f-forgot').onclick = e => {
      e.preventDefault();
      $('login-err').textContent = '';
      $('forgot-note').classList.toggle('hidden');
    };
    // Vincular Gmail para poder recuperar la cuenta (ver offerRecovery).
    $('rec-link').onclick = async () => {
      $('rec-err').textContent = '';
      $('rec-link').disabled = true;
      const r = await G.DB.linkGoogle();
      $('rec-link').disabled = false;
      if (!r.ok) { $('rec-err').textContent = r.error; return; }
      $('scr-recover').classList.add('hidden');
      G.UI.toast('¡Gmail vinculado! Si olvidas la contraseña, entra con Google.', 4500);
    };
    $('rec-later').onclick = () => $('scr-recover').classList.add('hidden');
    $('rec-never').onclick = () => {
      try { localStorage.setItem('ps.recover.no.' + G.DB.fb.uid, '1'); } catch (e) { /* nada */ }
      $('scr-recover').classList.add('hidden');
    };
    $('btn-google').onclick = async () => {
      $('login-err').textContent = '';
      $('btn-google').disabled = true;
      const r = await G.DB.loginWithGoogle();
      $('btn-google').disabled = false;
      if (!r.ok) { $('login-err').textContent = r.error; return; }
      G.Flow.afterLogin();
    };
  }

  /**
   * Al entrar (o recién creada la cuenta) con nombre y contraseña, si aún no
   * hay Gmail vinculado: "¿te da miedo perder tu cuenta?". Una vez por sesión,
   * hasta que lo vincule o diga que no le vuelvan a preguntar.
   */
  let offered = false;
  function offerRecovery() {
    if (offered || G.DB.mode !== 'cloud' || !G.DB.fb || !G.DB.nameAccount || G.DB.hasGoogle) return;
    try { if (localStorage.getItem('ps.recover.no.' + G.DB.fb.uid)) return; } catch (e) { /* nada */ }
    offered = true;
    $('rec-err').textContent = '';
    $('scr-recover').classList.remove('hidden');
  }

  /*
   * Avisos de una actualización: cada uno sale una vez por navegador, la
   * primera vez que se entra al menú después de subirla; si hay varios,
   * uno tras otro. Para uno nuevo, se añade aquí con su propia clave.
   */
  const cloud = () => G.DB.mode === 'cloud' && !G.DB.guest;
  const NOTES = [
    { key: 'ps.savenote.1', when: cloud,              // botón Guardar (18-10-2026)
      title: ['Importante: guarda tu partida', 'Important: save your game'],
      body: ['<p>Debido a problemas con el guardado, a partir de ahora la partida se guarda en la nube automáticamente <b>cada 10 minutos</b>.</p>' +
             '<p>Hemos incorporado un botón <b class="gold">Guardar</b> arriba a la derecha. Úsalo antes de cerrar el juego o de cambiar de aparato: <b>es muy importante para no perder tu partida</b>.</p>',
             '<p>Because of problems with saving, from now on your game is saved to the cloud automatically <b>every 10 minutes</b>.</p>' +
             '<p>We have added a <b class="gold">Save</b> button at the top right. Use it before closing the game or switching devices: <b>it is very important so you don’t lose your progress</b>.</p>'] },
    { key: 'ps.ranknote.1', when: () => cloud() && ((G.DB.save.stats || {}).runs || 0) > 0,   // rankings desde cero (18-10-2026)
      title: ['Los rankings se han reiniciado', 'The leaderboards have been reset'],
      body: ['<p>Hemos ajustado la <b>Sentencia de Arceus</b>: huir corriendo con toda la velocidad subida y el veneno ya no sirven para aguantar para siempre.</p>' +
             '<p>Para que todos compitáis en igualdad, <b>todos los rankings empiezan de cero</b> (hoy, semana, mes, año e histórico). ¡A por el primer puesto!</p>',
             '<p>We have adjusted the <b>Judgment of Arceus</b>: running away with maxed-out speed and poison no longer let you last forever.</p>' +
             '<p>So everyone competes on equal terms, <b>all leaderboards start from scratch</b> (daily, weekly, monthly, yearly and all-time). Go for first place!</p>'] }
  ];
  /** → true si se ha enseñado alguno. */
  function updateNotices() {
    const queue = NOTES.filter(n => { try { return n.when() && !localStorage.getItem(n.key); } catch (e) { return false; } });
    if (!queue.length) return false;
    const en = G.I18n.lang === 'en' ? 1 : 0;
    const next = () => {
      const n = queue.shift();
      if (!n) { $('scr-savenote').classList.add('hidden'); return; }
      try { localStorage.setItem(n.key, '1'); } catch (e) { /* nada */ }
      $('savenote-title').textContent = n.title[en];
      // Otros idiomas: el aviso entero va traducido en su diccionario (por trozos sale raro); si falta, en inglés.
      const other = G.I18n.lang !== 'es' && !en, body = $('savenote-body');
      if (other) body.setAttribute('translate', 'no');
      body.innerHTML = !other ? n.body[en] : G.I18n.has(n.body[0]) ? G.T(n.body[0]) : n.body[1];
      $('savenote-ok').textContent = en ? 'Got it' : 'Entendido';
    };
    $('savenote-ok').onclick = next;
    next();
    $('scr-savenote').classList.remove('hidden');
    return true;
  }

  /** Explica dónde se guarda la partida según el modo de la base de datos. */
  function modeNote() {
    if (G.DB.mode === 'cloud') return 'Tu partida se guarda en la nube: entra desde cualquier ordenador. Como invitado no se guarda.';
    const why = G.DB.localReason === 'file'
      ? 'Abierto desde un archivo: la partida sólo se guarda en este navegador. Para guardar en la nube, juega en la versión publicada.'
      : G.DB.localReason === 'host'
        ? 'Esta no es la web oficial: la partida sólo se guarda en este navegador. El juego oficial y gratis está en pokesurvivor.com.'
      : G.DB.localReason === 'dev'
        ? 'Versión de pruebas: la partida sólo se guarda en este navegador. El juego de verdad está en pokesurvivor.com.'
      : G.DB.localReason === 'config'
        ? 'Nube sin configurar: la partida sólo se guarda en este navegador.'
        : 'No se pudo conectar con la nube: la partida sólo se guarda en este navegador.';
    return why;
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll('#scr-login .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === m));
    $('btn-auth').textContent = m === 'login' ? 'Entrar' : 'Crear cuenta';
    $('f-pass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
    $('login-err').textContent = '';
  }

  function open() {
    G.UI.chrome(false);
    G.UI.show('scr-login');
    if (!G.DB.storageOk) $('login-err').textContent = 'Este navegador no deja guardar datos: juega como invitado.';
    $('btn-google').classList.toggle('hidden', G.DB.mode !== 'cloud');
    $('login-mode').textContent = modeNote();
    setTimeout(() => $('f-user').focus(), 50);
  }

  return { init, open, offerRecovery, updateNotices };
})();
