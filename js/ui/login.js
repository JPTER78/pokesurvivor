/* ============ login.js — inicio: entrar, crear cuenta o invitado ============ */
G.LoginUI = (() => {
  const $ = G.UI.$;
  let mode = 'login';

  function init() {
    document.querySelectorAll('#login-language [data-lang]').forEach(b => {
      b.classList.toggle('on', b.dataset.lang === G.I18n.lang);
      b.onclick = () => { if (b.dataset.lang !== G.I18n.lang) G.I18n.set(b.dataset.lang); };
    });
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
    $('btn-google').onclick = async () => {
      $('login-err').textContent = '';
      $('btn-google').disabled = true;
      const r = await G.DB.loginWithGoogle();
      $('btn-google').disabled = false;
      if (!r.ok) { $('login-err').textContent = r.error; return; }
      G.Flow.afterLogin();
    };
  }

  /** Explica dónde se guarda la partida según el modo de la base de datos. */
  function modeNote() {
    if (G.DB.mode === 'cloud') return 'Tu partida se guarda en la nube: entra desde cualquier ordenador. Como invitado no se guarda.';
    const why = G.DB.localReason === 'file'
      ? 'Abierto desde un archivo: la partida sólo se guarda en este navegador. Para guardar en la nube, juega en la versión publicada.'
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

  /** Tope de cuentas del mes alcanzado: sin "Crear cuenta" hasta el mes siguiente. */
  function applySignups(open) {
    const reg = document.querySelector('#scr-login .tab[data-tab="register"]');
    if (reg) reg.classList.toggle('hidden', !open);
    if (!open && mode === 'register') setMode('login');
    const note = $('signup-closed');
    note.classList.toggle('hidden', open);
    if (!open) note.textContent = 'Este mes se han llenado las plazas de cuentas nuevas: vuelven el 1 de ' + G.Signups.nextMonthName() +
      '. Si ya tienes cuenta, entra normal. Si no, juega como invitado.';
    $('btn-google').textContent = open ? 'Entrar con Google' : 'Entrar con Google (si ya tienes cuenta)';
  }

  function open() {
    G.UI.chrome(false);
    G.UI.show('scr-login');
    if (G.DB.mode === 'cloud' && G.Signups) G.Signups.check().then(applySignups);
    if (!G.DB.storageOk) $('login-err').textContent = 'Este navegador no deja guardar datos: juega como invitado.';
    $('btn-google').classList.toggle('hidden', G.DB.mode !== 'cloud');
    $('login-mode').textContent = modeNote();
    setTimeout(() => $('f-user').focus(), 50);
  }

  return { init, open };
})();
