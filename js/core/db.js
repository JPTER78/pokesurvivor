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
  const VERSION = 3;
  const START_COINS = 500;
  const SDK = 'https://www.gstatic.com/firebasejs/13.0.0/';
  const NAME_DOMAIN = 'jugadores.pokesurvivor.net';   // sólo para el email interno

  let mode = 'local';       // 'cloud' | 'local'
  let localReason = '';     // por qué no hay nube: 'file' | 'config' | 'host' | 'error'
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
    const s = JSON.stringify(v);
    try { localStorage.setItem(k, s); return true; }
    catch (e) {
      // Navegador lleno (sobre todo por lo que guarda el ranking): se libera lo
      // prescindible y se reintenta. Antes la copia de la partida dejaba de
      // guardarse sin avisar y, al recargar, se volvía a la de la nube.
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && /^ps\.rk\.c\./.test(key)) localStorage.removeItem(key);
        }
        localStorage.setItem(k, s); return true;
      } catch (e2) { storageOk = false; return false; }
    }
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
      upgrades: {},           // (antiguo) mejoras de la cuenta; ahora van por Pokémon
      pupg: {},               // dex -> { id -> nivel }: mejoras de cada Pokémon
      dfav: {},               // dex -> fecha: favorito de la colección (negativa = quitado entonces)
      pused: {},              // dex -> partidas jugadas con él (orden "más usados")
      pstart: {},             // dex -> movimiento inicial elegido (Mejoras → Movimiento inicial)
      tickets: { t1: 0, t10: 0 },   // tickets del gacha (x1 y x10)
      pity: {},               // generación del banner -> tiradas sin ★5
      legends: {},            // dex -> fecha: legendarios vencidos en grietas
      arenas: {},             // tipo -> fecha: arenas de grieta ganadas
      itemsFound: {},         // id -> fecha: objetos equipables encontrados
      evoMoves: {},           // id -> fecha: movimientos evolucionados alguna vez
      ach: {},                // id -> fecha: logros conseguidos
      missions: {},           // misiones del día / semana (systems/progress.js)
      profile: { favs: [], title: '' },   // perfil público: 3 favoritos y título
      stats: { runs: 0, bestTime: 0, bestLevel: 0, totalKills: 0, pulls: 0, coinsEarned: 0, shinies: 0,
               bossesTotal: 0, riftWins: 0, evolutions: 0, missionsDone: 0, groupRuns: 0, bestGroupTime: 0 }
    };
  }

  /** Rellena campos que falten en partidas de versiones anteriores. */
  function migrate(s, name) {
    const base = newSave(name || s.name);
    for (const k in base) if (s[k] == null) s[k] = base[k];
    for (const k in base.stats) if (s.stats[k] == null) s.stats[k] = base.stats[k];
    // v1 -> v2: había un único banner (Kanto) con el pity como número.
    if (typeof s.pity === 'number') s.pity = { 1: s.pity };
    // v2 -> v3: las mejoras eran de la cuenta; pasan al compañero de entonces.
    if (!s.pupgDone) {
      if (s.partner && Object.values(s.upgrades || {}).some(v => v > 0)) {
        s.pupg[s.partner] = Object.assign({}, s.upgrades);
      }
      s.pupgDone = true;
    }
    s.tickets = Object.assign({ t1: 0, t10: 0 }, s.tickets);
    sanitize(s);
    s.v = VERSION;
    return s;
  }

  /**
   * Quita lo imposible de una partida editada a mano (la copia del navegador
   * se puede tocar): números negativos o raros, mejoras por encima del
   * máximo y Pokémon que no existen. Lo que sí sea posible lo frena el
   * servidor (firestore.rules, saves).
   */
  function sanitize(s) {
    const n = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
    s.coins = n(s.coins);
    s.tickets.t1 = n(s.tickets.t1);
    s.tickets.t10 = n(s.tickets.t10);
    if (isObj(s.led)) {
      for (const dev of Object.keys(s.led)) {
        const e = s.led[dev];
        if (!isObj(e)) { delete s.led[dev]; continue; }
        for (const k of Object.keys(e)) {
          if (!CUR[k] || !Array.isArray(e[k])) { delete e[k]; continue; }
          e[k] = [n(e[k][0]), n(e[k][1])];
        }
      }
    } else delete s.led;
    if (G.DEX_BY) for (const coll of ['owned', 'shiny', 'dfav', 'pused']) {
      for (const d of Object.keys(s[coll] || {})) if (!G.DEX_BY[d]) delete s[coll][d];
    }
    for (const coll of ['dfav', 'pused']) {
      if (!isObj(s[coll])) { s[coll] = {}; continue; }
      for (const d of Object.keys(s[coll])) if (!Number.isFinite(+s[coll][d])) delete s[coll][d];
    }
    if (!isObj(s.pstart)) s.pstart = {};
    for (const d of Object.keys(s.pstart)) {
      if (typeof s.pstart[d] !== 'string' || (G.DEX_BY && !G.DEX_BY[d]) || (G.Moves && !G.Moves.BY_ID[s.pstart[d]])) delete s.pstart[d];
    }
    // Atajos: 4 huecos con un movimiento que exista (o null), sin repetir.
    if (s.pbind && typeof s.pbind === 'object') {
      for (const d of Object.keys(s.pbind)) {
        const l = Array.isArray(s.pbind[d]) ? s.pbind[d].slice(0, 4) : [];
        const seen = new Set();
        s.pbind[d] = [0, 1, 2, 3].map(i => {
          const id = l[i];
          if (typeof id !== 'string' || (G.Moves && !G.Moves.BY_ID[id]) || seen.has(id)) return null;
          seen.add(id); return id;
        });
      }
    } else s.pbind = {};
    // Veto: listas de movimientos que existen, sin repetir, como mucho 3.
    if (s.pban && typeof s.pban === 'object') {
      for (const d of Object.keys(s.pban)) {
        const l = Array.isArray(s.pban[d]) ? s.pban[d] : [];
        s.pban[d] = [...new Set(l.filter(id => typeof id === 'string' && (!G.Moves || G.Moves.BY_ID[id])))].slice(0, 3);
      }
    } else s.pban = {};
    if (G.Upgrades) for (const d of Object.keys(s.pupg || {})) {
      const u = s.pupg[d];
      if (!u || typeof u !== 'object') { delete s.pupg[d]; continue; }
      for (const id of Object.keys(u)) {
        if (!G.Upgrades.BY[id]) delete u[id];
        else u[id] = Math.min(G.Upgrades.BY[id].max, n(u[id]));
      }
    }
  }

  /**
   * Fusiona dos versiones de la misma partida (p. ej. una jugada sin
   * conexión y la de la nube). Nunca se pierde nada conseguido:
   *   - colecciones (owned, shiny): unión
   *   - mejoras y estadísticas: el máximo de cada una
   *   - monedas, compañero, pity...: los de la versión más reciente
   * Es idempotente: fusionar dos veces da lo mismo.
   */
  /*
   * LIBRETA de monedas y tickets (14-10-2026). Antes las monedas y los tickets
   * eran "los de la versión más reciente": si un aparato con datos viejos (el
   * móvil con la pestaña abierta de ayer) guardaba algo, su número ganaba y se
   * perdía lo conseguido en el otro (un jugador pasó de 36 tickets a 3).
   * Ahora cada aparato apunta en save.led[aparato] lo que ha ganado y gastado
   * de cada cosa ([ganado, gastado], sólo crecen) y el saldo es la suma de
   * todos: al fusionar se toma el mayor de cada apunte y no se pierde nada.
   *   led.base: el saldo que había antes de la libreta (o al empezar).
   *   led.old:  cambios de una versión anterior del juego (pestañas sin actualizar).
   */
  const CUR = {
    c: [s => s.coins, (s, v) => { s.coins = v; }],
    t1: [s => s.tickets.t1, (s, v) => { s.tickets.t1 = v; }],
    t10: [s => s.tickets.t10, (s, v) => { s.tickets.t10 = v; }]
  };
  // Este aparato (navegador): un nombre al azar que se queda guardado.
  const DEV = (() => {
    let d = read('ps.dev');
    if (typeof d !== 'string' || !/^[a-z0-9]{6,12}$/.test(d)) { d = 'd' + Math.random().toString(36).slice(2, 10); write('ps.dev', d); }
    return d;
  })();
  const num = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
  const balOf = s => { const o = {}; for (const k in CUR) o[k] = num(CUR[k][0](s)); return o; };
  function ledSum(led, k) {
    let t = 0;
    for (const dev in led) { const e = led[dev] && led[dev][k]; if (e) t += num(e[0]) - num(e[1]); }
    return t;
  }
  function addTo(led, dev, k, d) {
    if (!d) return;
    const e = led[dev] = led[dev] || {};
    const p = e[k] = e[k] || [0, 0];
    if (d > 0) p[0] = num(p[0]) + d; else p[1] = num(p[1]) - d;
  }
  /** La libreta de una partida (sin tocarla); lo que no cuadre, a `dev`. */
  function ledOf(s, dev) {
    if (!isObj(s.led)) {
      const b = balOf(s), base = {};
      for (const k in CUR) base[k] = [b[k], 0];
      return { base };
    }
    const led = JSON.parse(JSON.stringify(s.led)), b = balOf(s);
    // Un saldo en negativo (lo mismo gastado en dos aparatos sin conexión) se ve como 0.
    for (const k in CUR) addTo(led, dev, k, b[k] - Math.max(0, ledSum(led, k)));
    return led;
  }
  /** Apunta en la libreta de ESTE aparato lo que ha cambiado desde la última vez. */
  function fold(s) {
    if (!s) return s;
    s.led = ledOf(s, DEV);
    return s;
  }

  function merge(a, b) {
    if (!a) return b;
    if (!b) return a;
    const newer = (a.updated || 0) >= (b.updated || 0) ? a : b;
    const older = newer === a ? b : a;
    const r = JSON.parse(JSON.stringify(newer));
    // Monedas y tickets: el mayor de cada apunte de cada aparato, y el saldo es la suma.
    const la = ledOf(a, 'old'), lb = ledOf(b, 'old'), led = {};
    for (const src of [la, lb]) for (const dev in src) for (const k in src[dev]) {
      const p = ((led[dev] = led[dev] || {})[k] = led[dev][k] || [0, 0]), q = src[dev][k];
      p[0] = Math.max(p[0], num(q[0])); p[1] = Math.max(p[1], num(q[1]));
    }
    r.led = led;
    r.tickets = r.tickets || { t1: 0, t10: 0 };
    for (const k in CUR) CUR[k][1](r, Math.max(0, ledSum(led, k)));
    for (const coll of ['owned', 'shiny']) {
      r[coll] = r[coll] || {};
      for (const k in older[coll] || {}) {
        if (!r[coll][k] || (older[coll][k].at || 0) < (r[coll][k].at || 0)) r[coll][k] = older[coll][k];
      }
    }
    for (const k in older.upgrades || {}) r.upgrades[k] = Math.max(r.upgrades[k] || 0, older.upgrades[k]);
    r.pupg = r.pupg || {};
    for (const d in older.pupg || {}) {
      const mine = r.pupg[d] = r.pupg[d] || {};
      for (const k in older.pupg[d]) mine[k] = Math.max(mine[k] || 0, older.pupg[d][k]);
    }
    r.pupgDone = r.pupgDone || older.pupgDone;
    // Favoritos: gana lo último que se hizo con cada uno (poner o quitar), en
    // cualquier aparato. Partidas con cada Pokémon: el mayor de los dos.
    r.dfav = r.dfav || {};
    for (const d in older.dfav || {}) if (Math.abs(+older.dfav[d] || 0) > Math.abs(+r.dfav[d] || 0)) r.dfav[d] = older.dfav[d];
    r.pused = r.pused || {};
    for (const d in older.pused || {}) r.pused[d] = Math.max(+r.pused[d] || 0, +older.pused[d] || 0);
    // Movimiento inicial: el de la versión más reciente; si no lo tenía elegido, el de la otra.
    r.pstart = r.pstart || {};
    for (const d in older.pstart || {}) if (!(d in r.pstart)) r.pstart[d] = older.pstart[d];
    // Lo conseguido nunca se pierde: unión de legendarios, arenas, objetos, logros...
    for (const coll of ['legends', 'arenas', 'itemsFound', 'evoMoves', 'ach']) {
      r[coll] = r[coll] || {};
      for (const k in older[coll] || {}) if (!r[coll][k]) r[coll][k] = older[coll][k];
    }
    // Misiones del mismo día/semana: el mayor progreso y lo ya recogido.
    const mo = older.missions || {}, mr = r.missions = r.missions || {};
    for (const [per, list] of [['day', 'daily'], ['week', 'weekly']]) {
      if (mr[per] !== mo[per] || !mr[list] || !mo[list]) continue;
      mr[list].forEach((m, i) => {
        const o = mo[list][i];
        if (!o || o.id !== m.id) return;
        m.prog = Math.max(m.prog || 0, o.prog || 0);
        m.claimed = m.claimed || o.claimed;
        m.told = m.told || o.told;
      });
    }
    for (const k in older.stats || {}) r.stats[k] = Math.max(r.stats[k] || 0, older.stats[k] || 0);
    if (r.starter == null) r.starter = older.starter;
    if (r.personality == null) r.personality = older.personality;
    if (r.partner == null || !r.owned[r.partner]) { r.partner = older.partner; r.partnerShiny = older.partnerShiny; }
    r.created = Math.min(a.created || Date.now(), b.created || Date.now());
    r.updated = Math.max(a.updated || 0, b.updated || 0);
    return r;
  }

  /** Sustituye el contenido de `save` sin cambiar el objeto (otros módulos lo tienen). */
  // Copia `s` sobre la partida SIN cambiar los objetos de dentro (mejoras,
  // Pokémon...): las pantallas abiertas guardan referencias a ellos. Antes se
  // sustituían y una compra hecha justo después de subir la partida se
  // apuntaba en la copia vieja: se cobraban las monedas y la mejora se perdía.
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function assignDeep(dst, src) {
    for (const k of Object.keys(dst)) if (!(k in src)) delete dst[k];
    for (const k in src) {
      if (isObj(src[k]) && isObj(dst[k])) assignDeep(dst[k], src[k]);
      else dst[k] = src[k];
    }
  }
  function applyInPlace(s) { assignDeep(save, s); }

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
    save = fold(loadLocal(k, name));
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

  let auth = null, fs = null, rtdb = null, uid = null, unlisten = null;
  let pushT = 0, retryT = 0, pending = false, pushing = null, lastPush = 0;
  /*
   * Versión de la partida en la nube (saves/{uid}.rev, 21-10-2026). Cada subida
   * manda rev + 1 y firestore.rules sólo la deja pasar si la nube sigue en rev:
   * así un aparato con una copia vieja (la pestaña del móvil abierta desde ayer)
   * ya no pisa lo guardado en otro. Si la rechaza, se lee la nube, se junta y se
   * vuelve a subir (sólo entonces hay una lectura de más).
   */
  const K_REV = 'ps.rev.';
  let rev = 0, lastCheck = 0;
  const setRev = r => { rev = Number.isInteger(r) && r > 0 ? r : 0; write(K_REV + uid, rev); };
  // Como mucho una subida cada 30 min (con miles de jugadores, cada 5 min
  // eran decenas de miles de escrituras por hora); lo que cuesta algo
  // (gacha, mejoras), a los 30 s. La copia local se guarda siempre al momento (y se fusiona con la
  // nube al volver a entrar), y al ocultar o cerrar la pestaña se sube lo pendiente.
  // Tras tiradas y compras se sube a los 3 min (era 30 s: quien hacía muchas tiradas
  // guardaba 2 veces por minuto y eran millones de escrituras al día). Lo hecho sigue
  // en la copia del navegador al momento, y se sube al salir de la pestaña.
  // Desde el 13-10-2026, lo normal cada 2 h (era 30 min: 216.000 jugadores al día
  // guardaban unas 12 millones de veces); al cerrar la pestaña, siempre; al
  // cambiar de pestaña, si hace más de 30 min.
  // Lo que vale algo (tiradas, compras, Pokémon nuevos, shinies, premios,
  // récords que entran en un top) se sube enseguida, y al acabar cada partida
  // como mucho cada 30 min:
  // con 2 h, quien abría el juego en otro aparato (o en el navegador de otra
  // app) veía la copia vieja de la nube y creía que lo había perdido.
  // Desde el 18-10-2026, lo urgente como mucho cada 30 min (era 15 s, y con el
  // mínimo de 65 s entre subidas quien hacía tiradas o mejoras guardaba casi
  // cada minuto). Al cerrar la pestaña se intenta subir lo pendiente, y para
  // no depender de eso está el botón Guardar de la barra de arriba (saveNow).
  // Desde el 20-10-2026 (los guardados eran ~1/4 de las escrituras de Firestore),
  // a la nube SÓLO se sube:
  //   - con el botón Guardar (lo decide el jugador)
  //   - antes de recargar por una actualización (updater.js, G.DB.flush)
  //   - al cerrar sesión
  // Nada más: ni solo cada cierto tiempo, ni al entrar, ni al cerrar la pestaña.
  // Todo se guarda al momento en este navegador igualmente, y al entrar se junta
  // con lo de la nube. Y se escribe sin leer antes (era una transacción: 1
  // lectura + 1 escritura); si juegas en dos aparatos a la vez, gana el último
  // que guarda.
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

  /*
   * La nube (Firebase) sólo desde la web oficial: el
   * código está en GitHub, y una copia publicada en otra web sin cambiar
   * firebase-config.js guardaría sus cuentas y partidas en NUESTRO proyecto
   * (y lo pagaríamos nosotros). Ahí el juego va en modo local. Lo que lo
   * cierra de verdad es la clave de la API restringida a estos dominios en
   * Google Cloud; esto frena las copias que ni lo miran (14-10-2026).
   */
  const HOSTS = ['pokesurvivor.com', 'www.pokesurvivor.com', 'jpter78.github.io', 'localhost', '127.0.0.1','joseph-ctrl-alt.github.io'];

  async function initCloud() {
    const cfg = G.FIREBASE_CONFIG;
    if (!/^https?:$/.test(location.protocol)) { localReason = 'file'; return false; }
    if (cfg && !cfg.emulator && !HOSTS.includes(location.hostname)) { localReason = 'host'; return false; }
    if (!cfg || !cfg.apiKey || !cfg.projectId) { localReason = 'config'; return false; }
    await loadScript(SDK + 'firebase-app-compat.js');
    await loadScript(SDK + 'firebase-auth-compat.js');
    await loadScript(SDK + 'firebase-firestore-compat.js');
    // Base de datos en tiempo real: amigos en línea, invitaciones y salas.
    if (cfg.databaseURL) await loadScript(SDK + 'firebase-database-compat.js');
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    fs = firebase.firestore();
    // Algunas redes y antivirus cortan las actualizaciones en directo (amigos,
    // invitaciones): Firebase prueba otra forma de recibirlas si hace falta.
    try { fs.settings({ experimentalAutoDetectLongPolling: true }); } catch (e) { /* ya estaba */ }
    rtdb = cfg.databaseURL ? firebase.database() : null;
    // Sólo para pruebas: { ..., emulator: true } usa el emulador local de Firebase.
    if (cfg.emulator) {
      auth.useEmulator('http://127.0.0.1:9099');
      fs.useEmulator('127.0.0.1', 8080);
      if (rtdb) rtdb.useEmulator('127.0.0.1', 9000);
    }
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    auth.languageCode = 'es';
    // (Al salir de la pestaña ya no se sube nada: sólo con Guardar, ver MODO NUBE.
    // Y al volver tampoco se lee la nube desde el 20-10-2026: lo del otro aparato
    // se trae al recargar la página; pullSoon queda sin usar.)
    return true;
  }

  /*
   * Al volver al juego tras más de 30 min fuera (el móvil con la pestaña
   * abierta de ayer), se baja la partida de la nube y se junta con la de aquí
   * (1 lectura): así se ve lo conseguido en el otro aparato. En plena partida
   * se espera a volver al menú.
   */
  const PULL_GAP = 30 * 60 * 1000;
  let lastPull = 0, pullT = 0;
  function pullSoon() {
    clearTimeout(pullT);
    if (mode !== 'cloud' || guest || !save || !uid || Date.now() - lastPull < PULL_GAP) return;
    if (pushing || (G.Game && G.Game.state && G.Game.state !== 'ui')) { pullT = setTimeout(pullSoon, 20000); return; }
    lastPull = Date.now();
    const u = uid;
    docRef().get().then(snap => {
      if (!snap.exists || !save || uid !== u) return;
      applyInPlace(merge(plain(fold(save)), migrate(snap.data().save)));
      setRev(snap.data().rev);
      write(K_CLOUD + uid, save);
      if (G.UI && G.UI.refreshCoins) G.UI.refreshCoins();
    }).catch(e => console.warn('[DB] no se pudo bajar la partida:', e.code || e.message));
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
      setRev(snap.exists ? snap.data().rev : 0);
    } catch (e) {
      if (!cached) throw e;                // sin conexión y sin copia: no hay nada que abrir
      online = false;
      setRev(+read(K_REV + uid) || 0);     // la de la última vez que se leyó o subió
    }
    let s = merge(cached && fold(migrate(cached)), remote && migrate(remote));
    if (!s) s = newSave(opts.name || displayNameOf(u));
    if (opts.legacy) {
      s = merge(s, opts.legacy.save);
      write(K_MIGRATED + opts.legacy.key, uid);
    }
    save = fold(migrate(s, s.name));
    key = uid; user = save.name; guest = false;
    write(K_CLOUD + uid, save);
    lastPull = Date.now();
    // Si esta copia tiene algo que la nube no (cuenta nueva, progreso sin subir),
    // se queda pendiente hasta que pulses Guardar (ya no se sube sola al entrar).
    const same = remote && !opts.legacy && (!cached || (cached.updated || 0) <= (remote.updated || 0));
    lastPush = Date.now();
    if (!online) { pending = true; setSync('offline'); }
    else if (same) setSync('ok');
    else { pending = true; setSync('pending'); }
  }

  /*
   * Ya no se escucha el documento en vivo (cada cambio costaba una lectura).
   * Si juegas en dos ordenadores, las partidas se fusionan al entrar y en
   * cada subida (transacción con merge()).
   */
  function stopListening() { if (unlisten) { unlisten(); unlisten = null; } }

  /*
   * Si el admin ha baneado la cuenta del ranking (ban = true en la nube, ver
   * firestore.rules), cada guardado tiene que conservarlo: sólo se escriben
   * save, updatedAt y v (mergeFields) y el resto del documento (ban) se queda.
   * Nunca se sube dos veces en menos de 65 s; mientras, todo está en el navegador.
   */
  const K_OK = 'ps.cloudok.', MIN_GAP = 65000;
  const sinceOk = () => Date.now() - (+read(K_OK + uid) || 0);

  /** Sube la partida tal cual (sin leer la nube antes: lo de la nube ya se juntó al entrar). */
  function pushNow() {
    if (mode !== 'cloud' || guest || !save || !uid) return Promise.resolve();
    // Si ya hay una subida en marcha, se hace otra justo después (para lo que haya cambiado mientras).
    if (pushing) { pending = true; return pushing.then(() => (pending ? pushNow() : undefined)); }
    clearTimeout(pushT); pushT = 0; pushDue = 0;
    if (navigator.onLine === false) {
      pending = true; setSync('offline'); scheduleRetry();
      return Promise.resolve();
    }
    if (sinceOk() < MIN_GAP) {
      pending = true; setSync('pending');
      schedulePush(MIN_GAP - sinceOk() + 500);
      return Promise.resolve();
    }
    pending = false;
    lastPush = Date.now();
    setSync('syncing');
    // Si la red se cae a medias, Firestore puede quedarse esperando: tope de 12 s.
    const u = uid, send = r => Promise.race([
      docRef().set({ save: plain(fold(save)), updatedAt: firebase.firestore.FieldValue.serverTimestamp(), v: VERSION, rev: r },
        { mergeFields: ['save', 'updatedAt', 'v', 'rev'] }).then(() => r),
      new Promise((_, rej) => setTimeout(() => rej({ code: 'unavailable' }), 12000))
    ]);
    pushing = send(rev + 1).catch(async e => {
      // Rechazada: si es porque otro aparato subió antes (rev distinto), se junta
      // con lo suyo y se sube otra vez. Como mucho una lectura cada 5 min.
      if (e.code !== 'permission-denied' || Date.now() - lastCheck < 5 * 60e3) throw e;
      lastCheck = Date.now();
      const snap = await docRef().get();
      if (!snap.exists || uid !== u || !save || (+snap.data().rev || 0) === rev) throw e;
      applyInPlace(merge(plain(fold(save)), migrate(snap.data().save)));
      setRev(snap.data().rev);
      write(K_CLOUD + uid, save);
      if (G.UI && G.UI.refreshCoins) G.UI.refreshCoins();
      return send(rev + 1);
    }).then(r => {
      fails = 0;
      if (uid === u) setRev(r);
      write(K_OK + uid, Date.now());
      // (Lo cambiado mientras se subía queda pendiente para el próximo Guardar.)
      setSync(pending ? 'pending' : 'ok');
      if (G.UI && G.UI.refreshCoins) G.UI.refreshCoins();
    }).catch(e => {
      console.warn('[DB] no se pudo sincronizar:', e.code || e.message);
      pending = true;
      setSync(navigator.onLine === false || e.code === 'unavailable' ? 'offline' : 'pending');
      // Lo pediste tú (Guardar o una actualización): se reintenta solo, con espera creciente.
      scheduleRetry();
    }).finally(() => { pushing = null; });
    return pushing;
  }

  /**
   * Botón Guardar: sube ya lo pendiente. Si no hay nada pendiente no gasta
   * nada, y si se acaba de subir hace menos de 65 s (MIN_GAP) se sube en
   * cuanto se pueda. → { ok, why?: 'local'|'guest'|'done'|'wait'|'offline'|'fail', secs? }
   */
  async function saveNow() {
    if (guest || !save) return { ok: false, why: 'guest' };
    if (mode !== 'cloud') return { ok: true, why: 'local' };
    if (!pending && !pushing && syncState === 'ok') return { ok: true, why: 'done' };
    if (navigator.onLine === false) { pushNow(); return { ok: false, why: 'offline' }; }
    const wait = MIN_GAP - sinceOk();
    if (!pushing && wait > 0) { pending = true; setSync('pending'); schedulePush(wait + 500); return { ok: true, why: 'wait', secs: Math.ceil(wait / 1000) + 1 }; }
    await pushNow();
    if (pushing) await pushing;          // (si había otra subida en marcha, también la que va detrás)
    if (syncState === 'ok') return { ok: true };
    // Lo cambiado mientras subía va en la siguiente, que espera los 65 s.
    if (syncState === 'pending' && pushT) return { ok: true, why: 'wait', secs: Math.max(1, Math.ceil((pushDue - Date.now()) / 1000)) };
    return { ok: false, why: syncState === 'offline' ? 'offline' : 'fail' };
  }

  // Si ya había una subida programada antes, se respeta (una compra no espera a la siguiente partida).
  let pushDue = 0;
  function schedulePush(ms) {
    const due = Date.now() + ms;
    if (pushT && pushDue && pushDue <= due) return;
    clearTimeout(pushT); pushDue = due;
    pushT = setTimeout(() => { pushT = 0; pushDue = 0; pushNow(); }, ms);
  }
  /**
   * Reintento con espera creciente: 15 s, 30 s, 1 min, 2 min... hasta 10 min.
   * Con muchos jugadores, reintentar siempre a los 15 s cuando Firebase falla
   * (cupo agotado, caída) multiplicaba las lecturas (pasó el 10-10-2026).
   */
  let fails = 0;
  function scheduleRetry() {
    const ms = Math.min(10 * 60e3, 15e3 * Math.pow(2, fails)) * (0.8 + Math.random() * 0.4);
    fails = Math.min(fails + 1, 8);
    clearTimeout(retryT);
    retryT = setTimeout(() => { if (pending) pushNow(); }, ms);
  }

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
      // Registro de cuentas nuevas desactivado en Firebase (Authentication > Configuración).
      'auth/admin-restricted-operation': 'Ahora mismo no se pueden crear cuentas nuevas. Si ya tienes cuenta, entra normal; si no, puedes jugar como invitado.',
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
    // Tope de cuentas del mes (Firebase cobra a partir de 50.000 al mes).
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

  /** Cambia el nombre que se ve en la partida (al elegir apodo). */
  function setName(n) {
    if (!save || guest) return;
    save.name = n; user = n;
    commit();
  }

  function playAsGuest() {
    user = 'Invitado'; key = null; guest = true; uid = null;
    save = newSave('Invitado');
    if (mode === 'local') remove(K_SES);
    return { ok: true, isNew: true };
  }

  /**
   * Guarda la partida actual (no hace nada en modo invitado). En el navegador,
   * al momento; en la nube, cuando pulses Guardar (queda pendiente: ver arriba,
   * MODO NUBE). urgent ya no cambia nada (se queda por si vuelve a hacer falta).
   */
  function commit(urgent = false) {
    if (guest || !key || !save) return false;
    save.updated = Date.now();
    fold(save);
    if (mode === 'local') return write(K_SAVE + key, save);
    write(K_CLOUD + uid, save);
    pending = true;
    setSync('pending');                // se sube al pulsar Guardar
    return true;
  }

  /** Funciones que se ejecutan al cerrar sesión o borrar la cuenta (amigos, salas...). */
  const leaveHooks = [];

  async function logout() {
    for (const fn of leaveHooks) { try { await fn('logout'); } catch (e) { /* nada */ } }
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

  function nameAccount() { return !!(auth && auth.currentUser && (auth.currentUser.email || '').endsWith('@' + NAME_DOMAIN)); }

  /*
   * Recuperar la cuenta: las de nombre y contraseña no tienen correo de verdad
   * (no se les puede mandar un enlace), así que se les ofrece VINCULAR su Gmail:
   * si un día olvidan la contraseña, entran con Google y es la misma cuenta.
   * Lo hace el sistema de cuentas de Firebase (gratis): ni una lectura ni una
   * escritura de la base de datos.
   */
  function hasGoogle() {
    const u = auth && auth.currentUser;
    return !!(u && u.providerData.some(p => p.providerId === 'google.com'));
  }
  async function linkGoogle() {
    if (!auth || !auth.currentUser) return { ok: false, error: 'Inicia sesión primero.' };
    try {
      await auth.currentUser.linkWithPopup(new firebase.auth.GoogleAuthProvider());
      return { ok: true };
    } catch (e) {
      const c = (e && e.code) || '';
      if (c === 'auth/provider-already-linked') return { ok: true };
      if (c === 'auth/credential-already-in-use' || c === 'auth/email-already-in-use')
        return { ok: false, error: 'Ese Gmail ya tiene su propia cuenta del juego. Usa otro Gmail.' };
      return { ok: false, error: authError(e) };
    }
  }

  /**
   * Borra la cuenta y la partida (en la nube o en este navegador).
   * @param pass  contraseña (cuentas de nombre y contraseña)
   */
  async function deleteAccount(pass) {
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
      // Primero se confirma quién eres: Firebase sólo deja borrar la cuenta si
      // se ha entrado hace poco. Antes se borraban los datos y luego fallaba
      // ese último paso: la cuenta quedaba vacía pero existía y su nombre no
      // se podía volver a usar.
      const cu = auth.currentUser;
      if (nameAccount()) {
        if (!pass) return { ok: false, error: 'Escribe tu contraseña.' };
        await cu.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(cu.email, pass));
      } else {
        await cu.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
      }
      clearTimeout(pushT); clearTimeout(retryT); pending = false;
      stopListening();
      for (const fn of leaveHooks) await fn('delete');
      // (Una cuenta baneada no puede borrar su guardado, ver firestore.rules: se queda.)
      await docRef().delete().catch(() => {});
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

  /** Favoritos de la colección. */
  function isFav(dex) { return !!(save && save.dfav && +save.dfav[dex] > 0); }
  function setFav(dex, on) {
    if (!save) return;
    save.dfav = save.dfav || {};
    save.dfav[dex] = on ? Date.now() : -Date.now();
    commit();
  }

  /** Mejoras compradas para un Pokémon: { id -> nivel }. */
  function upgradesOf(dex) {
    if (!save) return {};
    save.pupg = save.pupg || {};
    return save.pupg[dex] || (save.pupg[dex] = {});
  }

  /** Da la versión shiny (y la normal, si no la tenía). Devuelve true si es nueva. */
  function grantShiny(dex, from) {
    grant(dex, from);
    if (save.shiny[dex]) return false;
    save.shiny[dex] = { at: Date.now(), from };
    return true;
  }

  return {
    ready, register, login, loginWithGoogle, playAsGuest, logout, commit, deleteAccount, flush: pushNow, saveNow,
    owns, grant, ownsShiny, grantShiny, merge, setName, upgradesOf, isFav, setFav,
    onSync(fn) { listeners.add(fn); },
    onLeave(fn) { leaveHooks.push(fn); },
    /** Acceso de bajo nivel para los módulos de red (sólo en modo nube). */
    get fb() { return mode === 'cloud' ? { auth, fs, rtdb, uid, emulator: !!(G.FIREBASE_CONFIG || {}).emulator } : null; },
    /** ¿Está disponible lo online (amigos, ranking, multijugador)? */
    get online() { return mode === 'cloud' && !guest && !!uid && !!save; },
    /** ¿La cuenta es de usuario y contraseña (no de Google)? */
    get nameAccount() { return nameAccount(); },
    get hasGoogle() { return hasGoogle(); }, linkGoogle,
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
