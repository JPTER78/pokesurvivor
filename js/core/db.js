/* ============ db.js — base de datos: Firebase (nube) o local ============
 * TODO el acceso a datos persistentes pasa por aquí. El resto del juego sólo
 * usa G.DB.*.
 *
 * Dos modos (se decide en ready()):
 *
 *   NUBE  (Firebase Authentication + Cloud Firestore)
 *     Si hay configuración en js/core/firebase-config.js y el juego se abre
 *     desde una web (http/https, también localhost). La partida se guarda en
 *     saves/{uid} y se puede seguir en cualquier ordenador.
 *       - Usuario + contraseña: Firebase pide un email, así que el nombre se
 *         convierte en uno interno (nunca se le envía nada).
 *       - Cuenta de Google.
 *     Además se guarda una copia local para poder jugar sin conexión; al
 *     sincronizar se FUSIONA (ver merge): las colecciones se unen y nunca se
 *     pierde un Pokémon ni un shiny.
 *
 *   LOCAL (localStorage)
 *     Si no hay configuración o se abre con doble clic (file://). Igual que
 *     antes: cuentas y partidas sólo en este navegador.
 *       ps.accounts      { clave: { name, salt, hash, created } }
 *       ps.save.<clave>  partida de esa cuenta
 *       ps.session       última cuenta con sesión iniciada
 *
 * El modo invitado juega con una partida en memoria que no se guarda.
 */
G.DB = (() => {
  const K_ACC = 'ps.accounts', K_SES = 'ps.session', K_SAVE = 'ps.save.';
  const K_CLOUD = 'ps.cloud.', K_MIGRATED = 'ps.migrated.';
  const VERSION = 2;
  const START_COINS = 500;
  const SDK = 'https://www.gstatic.com/firebasejs/13.0.0/';
  const NAME_DOMAIN = 'jugadores.pokesurvivors.net';   // sólo para el email interno

  let mode = 'local';       // 'cloud' | 'local'
  let localReason = '';     // por qué no hay nube: 'file' | 'config' | 'error'
  let user = null;          // nombre visible
  let key = null;           // clave local (minúsculas) o uid de Firebase
  let guest = false;
  let save = null;
  let storageOk = true;

  // ---------------- almacenamiento local seguro ----------------

  function read(k) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }
    catch (e) { storageOk = false; return null; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { storageOk = false; return false; }
  }
  function remove(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }

  // ---------------- partida ----------------

  function newSave(name) {
    return {
      v: VERSION,
      name,
      created: Date.now(),
      updated: Date.now(),    // última modificación (para fusionar)
      coins: START_COINS,
      owned: {},              // dex -> { at, from: 'starter'|'gacha'|'wild' }
      shiny: {},              // dex -> { at, from } — variantes shiny conseguidas
      partner: null,          // dex del Pokémon con el que juegas
      partnerShiny: false,    // jugar con su versión shiny (si la tienes)
      starter: null,          // dex que te tocó en el test
      personality: null,      // { trait, scores }
      upgrades: {},           // id -> nivel
      pity: {},               // generación del banner -> tiradas sin ★5
      stats: { runs: 0, bestTime: 0, bestLevel: 0, totalKills: 0, pulls: 0, coinsEarned: 0, shinies: 0 }
    };
  }

  /** Rellena campos que falten en partidas de versiones anteriores. */
  function migrate(s, name) {
    const base = newSave(name || s.name);
    for (const k in base) if (s[k] == null) s[k] = base[k];
    for (const k in base.stats) if (s.stats[k] == null) s.stats[k] = base.stats[k];
    // v1 -> v2: había un único banner (Kanto) con el pity como número.
    if (typeof s.pity === 'number') s.pity = { 1: s.pity };
    s.v = VERSION;
    return s;
  }

  /**
   * Fusiona dos versiones de la misma partida (p. ej. una jugada sin
   * conexión y la de la nube). Nunca se pierde nada conseguido:
   *   - colecciones (owned, shiny): unión
   *   - mejoras y estadísticas: el máximo de cada una
   *   - monedas, compañero, pity...: los de la versión más reciente
   * Es idempotente: fusionar dos veces da lo mismo.
   */
  function merge(a, b) {
    if (!a) return b;
    if (!b) return a;
    const newer = (a.updated || 0) >= (b.updated || 0) ? a : b;
    const older = newer === a ? b : a;
    const r = JSON.parse(JSON.stringify(newer));
    for (const coll of ['owned', 'shiny']) {
      r[coll] = r[coll] || {};
      for (const k in older[coll] || {}) {
        if (!r[coll][k] || (older[coll][k].at || 0) < (r[coll][k].at || 0)) r[coll][k] = older[coll][k];
      }
    }
    for (const k in older.upgrades || {}) r.upgrades[k] = Math.max(r.upgrades[k] || 0, older.upgrades[k]);
    for (const k in older.stats || {}) r.stats[k] = Math.max(r.stats[k] || 0, older.stats[k] || 0);
    if (r.starter == null) r.starter = older.starter;
    if (r.personality == null) r.personality = older.personality;
    if (r.partner == null || !r.owned[r.partner]) { r.partner = older.partner; r.partnerShiny = older.partnerShiny; }
    r.created = Math.min(a.created || Date.now(), b.created || Date.now());
    r.updated = Math.max(a.updated || 0, b.updated || 0);
    return r;
  }

  /** Sustituye el contenido de `save` sin cambiar el objeto (otros módulos lo tienen). */
  function applyInPlace(s) {
    for (const k of Object.keys(save)) if (!(k in s)) delete save[k];
    Object.assign(save, s);
  }

  const VALID = /^[A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]{3,16}$/;

  // =====================================================================
  //                               MODO LOCAL
  // =====================================================================

  async function hash(pass, salt) {
    const text = salt + ':' + pass;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
    }
    return 'f' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }

  function randomSalt() {
    const a = new Uint8Array(12);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < a.length; i++) a[i] = Math.random() * 256;
    return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function loadLocal(k, name) {
    const s = read(K_SAVE + k);
    return s ? migrate(s, name) : newSave(name);
  }

  function beginLocal(k, name) {
    key = k; user = name; guest = false;
    save = loadLocal(k, name);
    write(K_SES, k);
  }

  async function registerLocal(name, pass) {
    const accs = read(K_ACC) || {};
    const k = name.toLowerCase();
    if (accs[k]) return { ok: false, error: 'Ese nombre ya existe.' };
    const salt = randomSalt();
    accs[k] = { name, salt, hash: await hash(pass, salt), created: Date.now() };
    if (!write(K_ACC, accs)) return { ok: false, error: 'El navegador no deja guardar datos (¿modo incógnito?).' };
    beginLocal(k, name);
    write(K_SAVE + k, save);
    return { ok: true, isNew: true };
  }

  async function loginLocal(name, pass) {
    const accs = read(K_ACC) || {};
    const acc = accs[name.toLowerCase()];
    if (!acc || acc.hash !== await hash(pass || '', acc.salt)) {
      return { ok: false, error: 'Usuario o contraseña incorrectos.' };
    }
    beginLocal(name.toLowerCase(), acc.name);
    return { ok: true, isNew: !save.partner };
  }

  function restoreLocal() {
    const k = read(K_SES);
    if (!k) return false;
    const accs = read(K_ACC) || {};
    if (!accs[k]) { remove(K_SES); return false; }
    beginLocal(k, accs[k].name);
    return true;
  }

  /** Partida de una cuenta local antigua, si el nombre y la contraseña coinciden. */
  async function legacySave(name, pass) {
    const k = (name || '').toLowerCase();
    const acc = (read(K_ACC) || {})[k];
    if (!acc || read(K_MIGRATED + k)) return null;
    if (acc.hash !== await hash(pass || '', acc.salt)) return null;
    const s = read(K_SAVE + k);
    return s ? { key: k, save: migrate(s, acc.name) } : null;
  }

  // =====================================================================
  //                               MODO NUBE
  // =====================================================================

  let auth = null, fs = null, uid = null, unlisten = null;
  let pushT = 0, retryT = 0, pending = false, pushing = null;
  let syncState = 'local';           // 'ok' | 'syncing' | 'pending' | 'offline' | 'local'
  const listeners = new Set();

  function setSync(s) { syncState = s; listeners.forEach(fn => { try { fn(s); } catch (e) { /* nada */ } }); }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const el = document.createElement('script');
      el.src = src; el.async = true;
      el.onload = res; el.onerror = () => rej(new Error('No se pudo cargar ' + src));
      document.head.appendChild(el);
    });
  }

  async function initCloud() {
    const cfg = G.FIREBASE_CONFIG;
    if (!/^https?:$/.test(location.protocol)) { localReason = 'file'; return false; }
    if (!cfg || !cfg.apiKey || !cfg.projectId) { localReason = 'config'; return false; }
    await loadScript(SDK + 'firebase-app-compat.js');
    await loadScript(SDK + 'firebase-auth-compat.js');
    await loadScript(SDK + 'firebase-firestore-compat.js');
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    fs = firebase.firestore();
    // Sólo para pruebas: { ..., emulator: true } usa el emulador local de Firebase.
    if (cfg.emulator) {
      auth.useEmulator('http://127.0.0.1:9099');
      fs.useEmulator('127.0.0.1', 8080);
    }
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    auth.languageCode = 'es';
    addEventListener('online', () => { if (pending) pushNow(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pending) pushNow(); });
    return true;
  }

  /** Firebase pide email: el nombre se codifica en uno interno, único y válido. */
  function nameToEmail(name) {
    const hex = [...new TextEncoder().encode(name.trim().toLowerCase())].map(b => b.toString(16).padStart(2, '0')).join('');
    return hex + '@' + NAME_DOMAIN;
  }

  function displayNameOf(u) {
    const n = ((u && u.displayName) || 'Entrenador').trim().split(/\s+/)[0].replace(/[^A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]/g, '');
    return (n || 'Entrenador').slice(0, 16);
  }

  const docRef = () => fs.collection('saves').doc(uid);
  const plain = s => JSON.parse(JSON.stringify(s));      // Firestore no admite undefined

  /** Abre la partida de la nube de un usuario recién autenticado. */
  async function openCloud(u, opts = {}) {
    uid = u.uid;
    const cached = read(K_CLOUD + uid);
    let remote = null, online = true;
    try {
      const snap = await docRef().get();
      remote = snap.exists ? snap.data().save : null;
    } catch (e) {
      if (!cached) throw e;                // sin conexión y sin copia: no hay nada que abrir
      online = false;
    }
    let s = merge(cached && migrate(cached), remote && migrate(remote));
    if (!s) s = newSave(opts.name || displayNameOf(u));
    if (opts.legacy) {
      s = merge(s, opts.legacy.save);
      write(K_MIGRATED + opts.legacy.key, uid);
    }
    save = migrate(s, s.name);
    key = uid; user = save.name; guest = false;
    write(K_CLOUD + uid, save);
    listen();
    if (online) await pushNow(); else { pending = true; setSync('offline'); scheduleRetry(); }
  }

  /**
   * Cambios que llegan de otro ordenador mientras juegas: se fusionan al
   * momento. Sin esto, este ordenador seguía con su copia vieja y, al guardar,
   * podía devolver las monedas o el compañero a un estado anterior.
   */
  function listen() {
    if (unlisten) unlisten();
    unlisten = docRef().onSnapshot(snap => {
      if (!snap.exists || snap.metadata.hasPendingWrites || !save) return;
      const remote = migrate(snap.data().save);
      if ((remote.updated || 0) <= (save.updated || 0)) return;
      applyInPlace(merge(plain(save), remote));
      write(K_CLOUD + uid, save);
      if (!pending) setSync('ok');
      if (G.UI && G.UI.refreshCoins) G.UI.refreshCoins();
    }, e => console.warn('[DB] escucha:', e.code || e.message));
  }

  function stopListening() { if (unlisten) { unlisten(); unlisten = null; } }

  /** Sube la partida fusionándola con lo que haya en la nube (transacción). */
  function pushNow() {
    if (mode !== 'cloud' || guest || !save || !uid) return Promise.resolve();
    if (pushing) { pending = true; return pushing; }
    clearTimeout(pushT);
    if (navigator.onLine === false) {
      pending = true; setSync('offline'); scheduleRetry();
      return Promise.resolve();
    }
    pending = false;
    setSync('syncing');
    let merged = null;
    const tr = fs.runTransaction(async tx => {
      const ref = docRef();
      const snap = await tx.get(ref);
      const remote = snap.exists ? migrate(snap.data().save) : null;
      merged = remote ? merge(plain(save), remote) : plain(save);
      tx.set(ref, { save: merged, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), v: VERSION });
    });
    // Si la red se cae a medias, Firestore puede quedarse esperando: tope de 12 s.
    const timeout = new Promise((_, rej) => setTimeout(() => rej({ code: 'unavailable' }), 12000));
    pushing = Promise.race([tr, timeout]).then(() => {
      if (merged && save) { applyInPlace(merged); write(K_CLOUD + uid, save); }
      setSync(pending ? 'pending' : 'ok');
      if (G.UI && G.UI.refreshCoins) G.UI.refreshCoins();
    }).catch(e => {
      console.warn('[DB] no se pudo sincronizar:', e.code || e.message);
      pending = true;
      setSync(navigator.onLine === false || e.code === 'unavailable' ? 'offline' : 'pending');
      scheduleRetry();
    }).finally(() => {
      pushing = null;
      if (pending && syncState === 'pending') schedulePush(1500);
    });
    return pushing;
  }

  function schedulePush(ms) { clearTimeout(pushT); pushT = setTimeout(pushNow, ms); }
  function scheduleRetry() { clearTimeout(retryT); retryT = setTimeout(() => { if (pending) pushNow(); }, 15000); }

  function authError(e) {
    const c = (e && e.code) || '';
    const M = {
      'auth/email-already-in-use': 'Ese nombre ya existe.',
      'auth/invalid-credential': 'Usuario o contraseña incorrectos.',
      'auth/invalid-login-credentials': 'Usuario o contraseña incorrectos.',
      'auth/wrong-password': 'Usuario o contraseña incorrectos.',
      'auth/user-not-found': 'Usuario o contraseña incorrectos.',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
      'auth/too-many-requests': 'Demasiados intentos seguidos. Espera un poco.',
      'auth/network-request-failed': 'Sin conexión a internet.',
      'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes.',
      'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication > Configuración > Dominios autorizados).',
      'auth/operation-not-allowed': 'Ese método de inicio de sesión no está activado en Firebase.',
      'auth/requires-recent-login': 'Por seguridad, vuelve a iniciar sesión y repite la operación.',
      'permission-denied': 'La base de datos rechazó el acceso (revisa las reglas de Firestore).',
      'unavailable': 'Sin conexión con la base de datos.'
    };
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
    return M[c] || ('Error: ' + (c || (e && e.message) || 'desconocido'));
  }

  // =====================================================================
  //                           API PÚBLICA
  // =====================================================================

  let readyP = null;

  /** Arranca la base de datos y recupera la sesión anterior. → true si hay sesión. */
  function ready() {
    if (readyP) return readyP;
    readyP = (async () => {
      try { if (await initCloud()) mode = 'cloud'; }
      catch (e) { console.warn('[DB] sin nube:', e.message); localReason = 'error'; mode = 'local'; }
      if (mode === 'local') { setSync('local'); return restoreLocal(); }
      const u = await new Promise(res => { const off = auth.onAuthStateChanged(x => { off(); res(x); }); });
      if (!u) return false;
      try { await openCloud(u); return true; }
      catch (e) { console.warn('[DB] no se pudo abrir la partida:', e.code || e.message); return false; }
    })();
    return readyP;
  }

  async function register(name, pass) {
    name = (name || '').trim();
    if (!VALID.test(name)) return { ok: false, error: 'El nombre debe tener 3-16 letras, números o _.' };
    const min = mode === 'cloud' ? 6 : 4;
    if ((pass || '').length < min) return { ok: false, error: `La contraseña debe tener al menos ${min} caracteres.` };
    if (mode === 'local') return registerLocal(name, pass);
    try {
      const legacy = await legacySave(name, pass);
      const cred = await auth.createUserWithEmailAndPassword(nameToEmail(name), pass);
      await openCloud(cred.user, { name, legacy });
      return { ok: true, isNew: !save.partner, imported: !!legacy };
    } catch (e) { return { ok: false, error: authError(e) }; }
  }

  async function login(name, pass) {
    name = (name || '').trim();
    if (mode === 'local') return loginLocal(name, pass);
    try {
      const legacy = await legacySave(name, pass);
      const cred = await auth.signInWithEmailAndPassword(nameToEmail(name), pass || '');
      await openCloud(cred.user, { name, legacy });
      return { ok: true, isNew: !save.partner, imported: !!legacy };
    } catch (e) { return { ok: false, error: authError(e) }; }
  }

  async function loginWithGoogle() {
    if (mode !== 'cloud') return { ok: false, error: 'Entrar con Google necesita la versión publicada del juego.' };
    try {
      const cred = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      await openCloud(cred.user, { name: displayNameOf(cred.user) });
      return { ok: true, isNew: !save.partner };
    } catch (e) { return { ok: false, error: authError(e) }; }
  }

  function playAsGuest() {
    user = 'Invitado'; key = null; guest = true; uid = null;
    save = newSave('Invitado');
    if (mode === 'local') remove(K_SES);
    return { ok: true, isNew: true };
  }

  /** Guarda la partida actual (no hace nada en modo invitado). */
  function commit() {
    if (guest || !key || !save) return false;
    save.updated = Date.now();
    if (mode === 'local') return write(K_SAVE + key, save);
    write(K_CLOUD + uid, save);
    pending = true;
    setSync('pending');
    schedulePush(1200);
    return true;
  }

  async function logout() {
    if (mode === 'cloud' && !guest && save) {
      if (pending) { try { await pushNow(); } catch (e) { /* queda la copia local */ } }
      stopListening();
      try { await auth.signOut(); } catch (e) { /* nada */ }
    } else if (mode === 'local' && !guest) {
      commit();
      remove(K_SES);
    }
    clearTimeout(pushT); clearTimeout(retryT);
    user = key = save = uid = null; guest = false; pending = false;
    setSync(mode === 'cloud' ? 'ok' : 'local');
  }

  /** Borra la cuenta y la partida (en la nube o en este navegador). */
  async function deleteAccount() {
    if (guest || !key) return { ok: false, error: 'No hay cuenta que borrar.' };
    if (mode === 'local') {
      const accs = read(K_ACC) || {};
      delete accs[key];
      write(K_ACC, accs);
      remove(K_SAVE + key); remove(K_SES);
      user = key = save = null;
      return { ok: true };
    }
    try {
      clearTimeout(pushT); clearTimeout(retryT); pending = false;
      stopListening();
      await docRef().delete();
      remove(K_CLOUD + uid);
      await auth.currentUser.delete();
      user = key = save = uid = null;
      return { ok: true };
    } catch (e) { return { ok: false, error: authError(e) }; }
  }

  // ---------------- helpers de partida ----------------

  function owns(dex) { return !!(save && save.owned[dex]); }

  function grant(dex, from) {
    if (!save.owned[dex]) save.owned[dex] = { at: Date.now(), from };
  }

  function ownsShiny(dex) { return !!(save && save.shiny && save.shiny[dex]); }

  /** Da la versión shiny (y la normal, si no la tenía). Devuelve true si es nueva. */
  function grantShiny(dex, from) {
    grant(dex, from);
    if (save.shiny[dex]) return false;
    save.shiny[dex] = { at: Date.now(), from };
    return true;
  }

  return {
    ready, register, login, loginWithGoogle, playAsGuest, logout, commit, deleteAccount, flush: pushNow,
    owns, grant, ownsShiny, grantShiny, merge,
    onSync(fn) { listeners.add(fn); },
    get mode() { return mode; },
    get localReason() { return localReason; },
    get syncState() { return syncState; },
    get user() { return user; },
    get guest() { return guest; },
    get save() { return save; },
    get loggedIn() { return !!save; },
    get storageOk() { return storageOk; },
    START_COINS
  };
})();
