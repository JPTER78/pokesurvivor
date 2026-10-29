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
  let localReason = '';     // por qué no hay nube: 'file' | 'config' | 'host' | 'dev' | 'error'
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
    if (G.Dev && G.Dev.enabled) return false;
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
  function remove(k) { if (G.Dev && G.Dev.enabled) return; try { localStorage.removeItem(k); } catch (e) { /* nada */ } }

  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  /** Un entero >= 0 (lo raro, negativo o que no es un número, 0). */
  const num = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);

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
      prestige: {},          // dex -> upgrade generation / prestige level (0..5)
      pupg: {},               // dex -> { id -> nivel }: mejoras de cada Pokémon
      dfav: {},               // dex -> fecha: favorito de la colección (negativa = quitado entonces)
      pused: {},              // dex -> partidas jugadas con él (orden "más usados")
      pstart: {},             // dex -> movimiento inicial elegido (Mejoras → Movimiento inicial)
      repertoire: {},        // dex -> signed timestamp: positive on, negative off
      pstart2: {},            // dex -> segundo movimiento inicial (Mejoras → Segundo movimiento inicial)
      // Tienda Kecleon (20-10-2026, ver data/shop.js y systems/mons.js):
      bag: {},                // Mochila: id -> cuántos (mint, cap, caph); en la libreta, como las monedas
      tms: {},                // MT sin usar: movimiento -> cuántas; también en la libreta
      ptm: {},                // dex -> [movimientos aprendidos con MT] (para siempre)
      pnat: {},               // dex -> [naturaleza, fecha]: la cambiada con Menta (si no, la que le tocó)
      pabil: {},              // dex -> [0|1|2, fecha]: la habilidad cambiada con Cápsula (2 = oculta)
      // Halloween (25-10-2026, core/skins.js): los caramelos van en bag.candy.
      skins: {},              // id -> fecha: skins compradas (para siempre)
      pskin: {},              // dex -> [id, fecha]: la que lleva puesta ('' = ninguna; gana la elegida más tarde)
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
    s.coins = num(s.coins);
    s.tickets.t1 = num(s.tickets.t1);
    s.tickets.t10 = num(s.tickets.t10);
    if (isObj(s.led)) {
      for (const dev of Object.keys(s.led)) {
        const e = s.led[dev];
        if (!isObj(e)) { delete s.led[dev]; continue; }
        for (const k of Object.keys(e)) {
          if (!isCurKey(k) || !Array.isArray(e[k])) { delete e[k]; continue; }
          e[k] = [num(e[k][0]), num(e[k][1])];
        }
      }
    } else delete s.led;
    if (G.DEX_BY) for (const coll of ['owned', 'shiny', 'dfav', 'pused', 'repertoire']) {
      for (const d of Object.keys(s[coll] || {})) if (!G.DEX_BY[d]) delete s[coll][d];
    }
    for (const coll of ['dfav', 'pused', 'repertoire']) {
      if (!isObj(s[coll])) { s[coll] = {}; continue; }
      for (const d of Object.keys(s[coll])) if (!Number.isFinite(+s[coll][d])) delete s[coll][d];
    }
    for (const k of ['pstart', 'pstart2']) {
      if (!isObj(s[k])) s[k] = {};
      for (const d of Object.keys(s[k])) {
        if (typeof s[k][d] !== 'string' || (G.DEX_BY && !G.DEX_BY[d]) || (G.Moves && !G.Moves.BY_ID[s[k][d]])) delete s[k][d];
      }
    }
    // Mochila y MT: cuántas de cada cosa que exista (tope 999).
    for (const [k, ok] of [['bag', id => !G.Shop || G.Shop.ITEMS[id]], ['tms', id => !G.Moves || G.Moves.BY_ID[id]]]) {
      if (!isObj(s[k])) s[k] = {};
      for (const id of Object.keys(s[k])) {
        s[k][id] = Math.min(999, num(s[k][id]));
        if (!s[k][id] || !ok(id)) delete s[k][id];
      }
    }
    // MT aprendidas: movimientos que existen, sin repetir.
    if (!isObj(s.ptm)) s.ptm = {};
    for (const d of Object.keys(s.ptm)) {
      const l = Array.isArray(s.ptm[d]) ? s.ptm[d] : [];
      s.ptm[d] = [...new Set(l.filter(id => typeof id === 'string' && (!G.Moves || G.Moves.BY_ID[id])))];
      if (!s.ptm[d].length || (G.DEX_BY && !G.DEX_BY[d])) delete s.ptm[d];
    }
    // Naturaleza y habilidad elegidas: [valor, fecha].
    for (const [k, ok] of [['pnat', v => typeof v === 'string' && (!G.NATURE_BY || G.NATURE_BY[v])], ['pabil', v => v === 0 || v === 1 || v === 2]]) {
      if (!isObj(s[k])) s[k] = {};
      for (const d of Object.keys(s[k])) {
        const e = s[k][d];
        if (!Array.isArray(e) || !ok(e[0]) || (G.DEX_BY && !G.DEX_BY[d])) delete s[k][d];
        else s[k][d] = [e[0], num(e[1])];
      }
    }
    // Skins: las que existen; la puesta, de ese Pokémon ('' = ninguna) y con su fecha.
    if (!isObj(s.skins)) s.skins = {};
    for (const id of Object.keys(s.skins)) if ((G.Skins && !G.Skins.SKINS[id]) || !Number.isFinite(+s.skins[id])) delete s.skins[id];
    if (!isObj(s.pskin)) s.pskin = {};
    for (const d of Object.keys(s.pskin)) {
      const e = s.pskin[d], id = Array.isArray(e) ? e[0] : null;
      if (typeof id !== 'string' || (id && G.Skins && (!G.Skins.SKINS[id] || G.Skins.SKINS[id].dex !== +d))) delete s.pskin[d];
      else s.pskin[d] = [id, num(e[1])];
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
    if (!isObj(s.prestige)) s.prestige = {};
    for (const d of Object.keys(s.prestige)) {
      if ((G.DEX_BY && !G.DEX_BY[d]) || !s.owned[d]) { delete s.prestige[d]; continue; }
      s.prestige[d] = Math.min(5, num(s.prestige[d]));
      if (s.prestige[d] === 5 && !s.shiny[d]) s.shiny[d] = { at: s.created || 1, from: 'prestige' };
    }
    if (G.Upgrades) for (const d of Object.keys(s.pupg || {})) {
      const u = s.pupg[d];
      if (!u || typeof u !== 'object') { delete s.pupg[d]; continue; }
      for (const id of Object.keys(u)) {
        if (!G.Upgrades.BY[id]) delete u[id];
        else u[id] = Math.min(G.Upgrades.BY[id].max, num(u[id]));
      }
    }
  }

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
  /*
   * Desde el 20-10-2026 también la Mochila y las MT (Tienda Kecleon), con la misma
   * libreta: 'b:<objeto>' (save.bag) y 'm:<movimiento>' (save.tms). Así una Menta
   * gastada en un aparato no vuelve a aparecer al fusionar con el otro.
   */
  const isCurKey = k => !!CUR[k] || /^b:[a-z0-9]{1,12}$/.test(k) || /^m:[a-z0-9-]{1,40}$/.test(k);
  const SUB = { b: 'bag', m: 'tms' };
  function curGet(s, k) {
    if (CUR[k]) return CUR[k][0](s);
    const o = s[SUB[k[0]]];
    return o ? o[k.slice(2)] : 0;
  }
  function curSet(s, k, v) {
    if (CUR[k]) { CUR[k][1](s, v); return; }
    const o = s[SUB[k[0]]] = s[SUB[k[0]]] || {};
    if (v > 0) o[k.slice(2)] = Math.min(999, v); else delete o[k.slice(2)];
  }
  /** Todas las cosas con saldo de una partida (y de su libreta). */
  function curKeys(s, led) {
    const ks = new Set(Object.keys(CUR));
    for (const id of Object.keys(s.bag || {})) ks.add('b:' + id);
    for (const id of Object.keys(s.tms || {})) ks.add('m:' + id);
    for (const dev in led || {}) for (const k in led[dev]) if (isCurKey(k)) ks.add(k);
    return [...ks];
  }
  // Este aparato (navegador): un nombre al azar que se queda guardado.
  const DEV = (() => {
    let d = read('ps.dev');
    if (typeof d !== 'string' || !/^[a-z0-9]{6,12}$/.test(d)) { d = 'd' + Math.random().toString(36).slice(2, 10); write('ps.dev', d); }
    return d;
  })();
  const balOf = (s, led) => { const o = {}; for (const k of curKeys(s, led)) o[k] = num(curGet(s, k)); return o; };
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
      for (const k in b) base[k] = [b[k], 0];
      return { base };
    }
    const led = JSON.parse(JSON.stringify(s.led)), b = balOf(s, led);
    // Un saldo en negativo (lo mismo gastado en dos aparatos sin conexión) se ve como 0.
    for (const k in b) addTo(led, dev, k, b[k] - Math.max(0, ledSum(led, k)));
    return led;
  }
  /** Apunta en la libreta de ESTE aparato lo que ha cambiado desde la última vez. */
  function fold(s) {
    if (!s) return s;
    // Libreta en negativo (lo mismo gastado en dos aparatos): antes se veía 0,
    // pero lo ganado después se volvía a apuntar en cada guardado (y en cada
    // aparato) y los tickets crecían solos (25-10-2026). Ahora lo debido se
    // perdona una vez en led.fix: como cada apunte, al juntar se toma el mayor,
    // así que dos aparatos que ven la misma deuda no la perdonan dos veces.
    if (isObj(s.led)) for (const k of curKeys(s, s.led)) {
      const owed = -ledSum(s.led, k);
      if (owed > 0) addTo(s.led, 'fix', k, owed);
    }
    s.led = ledOf(s, DEV);
    // Y el saldo es siempre el de la libreta.
    for (const k of curKeys(s, s.led)) curSet(s, k, Math.max(0, ledSum(s.led, k)));
    return s;
  }

  /**
   * Fusiona dos versiones de la misma partida (p. ej. una jugada sin
   * conexión y la de la nube). Nunca se pierde nada conseguido:
   *   - colecciones (owned, shiny): unión
   *   - mejoras y estadísticas: el máximo de cada una
   *   - monedas, tickets, Mochila y MT: la libreta (arriba)
   *   - compañero, pity...: los de la versión más reciente
   * Es idempotente: fusionar dos veces da lo mismo.
   */
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
    r.bag = {}; r.tms = {};
    for (const k of curKeys({ bag: {}, tms: {} }, led)) curSet(r, k, Math.max(0, ledSum(led, k)));
    // MT aprendidas: nunca se olvidan (unión). Naturaleza y habilidad: la elegida más tarde.
    r.ptm = r.ptm || {};
    for (const d in older.ptm || {}) r.ptm[d] = [...new Set((r.ptm[d] || []).concat(older.ptm[d] || []))];
    for (const k of ['pnat', 'pabil', 'pskin']) {
      r[k] = r[k] || {};
      for (const d in older[k] || {}) if (!r[k][d] || (+older[k][d][1] || 0) > (+r[k][d][1] || 0)) r[k][d] = older[k][d];
    }
    for (const coll of ['owned', 'shiny']) {
      r[coll] = r[coll] || {};
      for (const k in older[coll] || {}) {
        if (!r[coll][k] || (older[coll][k].at || 0) < (r[coll][k].at || 0)) r[coll][k] = older[coll][k];
      }
    }
    for (const k in older.upgrades || {}) r.upgrades[k] = Math.max(r.upgrades[k] || 0, older.upgrades[k]);
    // Upgrades only merge within the same prestige generation. A stale device
    // must never restore the upgrades consumed by a later prestige.
    r.prestige = {}; r.pupg = {};
    const rank = (s, d) => Math.min(5, num(s.prestige && s.prestige[d]));
    for (const d of new Set([...Object.keys(a.pupg || {}), ...Object.keys(b.pupg || {}),
                              ...Object.keys(a.prestige || {}), ...Object.keys(b.prestige || {})])) {
      const level = r.prestige[d] = Math.max(rank(a, d), rank(b, d)), mine = r.pupg[d] = {};
      for (const src of [a, b]) if (rank(src, d) === level) {
        for (const k in (src.pupg || {})[d] || {}) mine[k] = Math.max(mine[k] || 0, num(src.pupg[d][k]));
      }
      if (level === 5 && !r.shiny[d]) r.shiny[d] = { at: r.created || 1, from: 'prestige' };
    }
    r.pupgDone = r.pupgDone || older.pupgDone;
    // Favoritos: gana lo último que se hizo con cada uno (poner o quitar), en
    // cualquier aparato. Partidas con cada Pokémon: el mayor de los dos.
    r.dfav = r.dfav || {};
    for (const d in older.dfav || {}) if (Math.abs(+older.dfav[d] || 0) > Math.abs(+r.dfav[d] || 0)) r.dfav[d] = older.dfav[d];
    r.pused = r.pused || {};
    for (const d in older.pused || {}) r.pused[d] = Math.max(+r.pused[d] || 0, +older.pused[d] || 0);
    r.repertoire = r.repertoire || {};
    for (const d in older.repertoire || {}) if (Math.abs(+older.repertoire[d] || 0) > Math.abs(+r.repertoire[d] || 0)) r.repertoire[d] = older.repertoire[d];
    // Movimiento inicial: el de la versión más reciente; si no lo tenía elegido, el de la otra.
    for (const k of ['pstart', 'pstart2']) {
      r[k] = r[k] || {};
      for (const d in older[k] || {}) if (!(d in r[k])) r[k][d] = older[k][d];
    }
    // Lo conseguido nunca se pierde: unión de legendarios, arenas, objetos, logros...
    for (const coll of ['legends', 'arenas', 'itemsFound', 'evoMoves', 'ach', 'skins']) {
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

  /*
   * Copia `s` sobre la partida SIN cambiar los objetos de dentro (mejoras,
   * Pokémon...): las pantallas abiertas y otros módulos guardan referencias a
   * ellos. Antes se sustituían y una compra hecha justo después de subir la
   * partida se apuntaba en la copia vieja: se cobraban las monedas y la mejora
   * se perdía.
   */
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

  let auth = null, fs = null, rtdb = null, uid = null;
  let pushT = 0, retryT = 0, pending = false, pushing = null;
  /*
   * Versión de la partida en la nube (saves/{uid}.rev, 21-10-2026). Cada subida
   * manda rev + 1 y firestore.rules sólo la deja pasar si la nube sigue en rev:
   * así un aparato con una copia vieja (la pestaña del móvil abierta desde ayer)
   * ya no pisa lo guardado en otro. Si la rechaza, se lee la nube, se junta y se
   * vuelve a subir (sólo entonces hay una lectura de más).
   */
  const K_REV = 'ps.rev.';
  let rev = 0, lastCheck = 0;
  // Lo último que se subió (o se leyó igual) desde aquí: si Guardar no cambia nada, no se escribe.
  // (Sin la hora del último cambio: cada guardado en el navegador la pone aunque no cambie nada más.)
  let sentCanon = '';
  const sameKey = s => canon(Object.assign({}, s, { updated: 0 }));
  const setRev = r => { rev = Number.isInteger(r) && r > 0 ? r : 0; write(K_REV + uid, rev); };
  /*
   * Cuándo se sube a la nube (desde el 20-10-2026; los guardados eran ~1/4 de
   * las escrituras de Firestore). SÓLO:
   *   - con el botón Guardar (lo decide el jugador: saveNow)
   *   - antes de recargar por una actualización (updater.js, G.DB.flush)
   *   - al cerrar sesión
   *   - si sales del juego con un Guardar que estaba esperando (visibilitychange)
   * Nada más: ni cada cierto tiempo, ni al entrar, ni al acabar la partida, ni
   * al cerrar la pestaña. Todo se guarda al momento en este navegador y al
   * entrar se junta con lo de la nube. Se escribe sin leer antes (rev, arriba).
   * (Antes se subía sola cada 30 min / 2 h y al cerrar la pestaña: eran
   * millones de escrituras al día.)
   */
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
  const HOSTS = ['pokesurvivor.com', 'www.pokesurvivor.com', 'jpter78.github.io', 'localhost', '127.0.0.1'];

  async function initCloud() {
    if (G.Dev && G.Dev.enabled) { localReason = 'dev'; return false; }
    const cfg = G.FIREBASE_CONFIG;
    if (!/^https?:$/.test(location.protocol)) { localReason = 'file'; return false; }
    if (cfg && !cfg.emulator && !HOSTS.includes(location.hostname)) { localReason = 'host'; return false; }
    // dev.html (el código sin encerrar: G en la consola, con todo a mano) sólo usa la
    // nube en este ordenador. En la web iba con la cuenta de quien la abriera y se
    // podía poner las monedas, tickets o Pokémon que quisiera y guardarlo (26-10-2026).
    if (!G.BUILT && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) { localReason = 'dev'; return false; }
    if (!cfg || !cfg.apiKey || !cfg.projectId) { localReason = 'config'; return false; }
    await loadScript(SDK + 'firebase-app-compat.js');
    await loadScript(SDK + 'firebase-auth-compat.js');
    await loadScript(SDK + 'firebase-firestore-compat.js');
    // Base de datos en tiempo real: las salas del cooperativo (net/social.js).
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
    // (Al salir de la pestaña no se sube nada: sólo con Guardar, ver MODO NUBE.
    // Y al volver tampoco se lee la nube desde el 20-10-2026: lo del otro aparato
    // se trae al recargar la página.)
    if (window.addEventListener) window.addEventListener('storage', fromOtherTab);
    return true;
  }

  /*
   * Otra pestaña de este navegador ha guardado su copia (25-10-2026). Las dos
   * apuntan en la misma entrada de la libreta (es el mismo aparato), y al
   * juntarlas ganaba la mayor: lo ganado o gastado en una se perdía. Ahora cada
   * pestaña junta al momento lo de la otra, y si tenía algo que la otra no,
   * vuelve a dejar la copia completa (la otra la junta y ya no cambia nada).
   */
  function fromOtherTab(e) {
    if (mode !== 'cloud' || guest || !save || !uid || e.key !== K_CLOUD + uid || !e.newValue) return;
    let other;
    try { other = migrate(JSON.parse(e.newValue)); } catch (x) { return; }
    const before = canon(save);
    applyInPlace(fold(merge(plain(fold(save)), other)));
    const now = canon(save);
    // (Más nueva que la de la otra, para que al juntarla se quede con esta.)
    if (now !== canon(other)) { save.updated = Math.max(Date.now(), (other.updated || 0) + 1); write(K_CLOUD + uid, save); }
    if (now === before) return;
    pending = true;
    setSync('pending');
    if (G.UI && G.UI.refreshCoins) G.UI.refreshCoins();
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
  // La partida en texto con las claves ordenadas (Firestore no guarda el orden): para comparar dos.
  const canon = v => JSON.stringify(v, (k, x) => (isObj(x) ? Object.keys(x).sort().reduce((o, k2) => (o[k2] = x[k2], o), {}) : x));

  /** Abre la partida de la nube de un usuario recién autenticado. */
  async function openCloud(u, opts = {}) {
    uid = u.uid; sentCanon = '';
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
    // Si esta copia tiene algo que la nube no (cuenta nueva, progreso sin subir),
    // se queda pendiente hasta que pulses Guardar (ya no se sube sola al entrar).
    // Se mira lo que hay, no la fecha (25-10-2026): si otro aparato guardó
    // después, la nube era "más nueva" y lo de aquí sin subir (tickets, Pokémon)
    // se daba por guardado; Guardar decía "Ya está todo guardado" y no lo subía.
    const same = remote && !opts.legacy && canon(save) === canon(fold(migrate(plain(remote))));
    if (!online) { pending = true; setSync('offline'); readTries = 0; readLater(); }
    else if (same) { sentCanon = sameKey(plain(save)); setSync('ok'); }
    else { pending = true; setSync('pending'); }
  }

  /*
   * Si al entrar no se pudo leer la nube (el móvil aún sin red al abrir), se
   * jugaba con la copia de este navegador, que puede ser vieja, y no se volvía
   * a mirar: faltaba lo guardado en otro aparato y se podía gastar dos veces
   * (25-10-2026). Ahora se reintenta esa lectura (la única de la sesión: las
   * fallidas no se cobran) hasta que sale, y se junta con lo de aquí.
   */
  let readT = 0, readTries = 0;
  function readLater() {
    clearTimeout(readT);
    if (readTries >= 10) return;
    readT = setTimeout(retryRead, Math.min(10 * 60e3, 10e3 * Math.pow(2, readTries++)));
  }
  async function retryRead() {
    if (mode !== 'cloud' || guest || !save || !uid) return;
    if (navigator.onLine === false) { readLater(); return; }
    const u = uid, r0 = rev;
    let snap;
    try { snap = await docRef().get(); } catch (e) { readLater(); return; }
    if (uid !== u || !save) return;
    const remote = snap.exists ? migrate(snap.data().save) : null;
    if (remote) applyInPlace(fold(merge(plain(fold(save)), plain(remote))));
    // (Si mientras tanto se subió la partida, su rev ya es la buena.)
    if (rev === r0) setRev(snap.exists ? snap.data().rev : 0);
    write(K_CLOUD + uid, save);
    if (!pushing) {
      pending = !(remote && canon(save) === canon(fold(remote)));
      if (!pending) sentCanon = sameKey(plain(save));
      setSync(pending ? 'pending' : 'ok');
    }
    if (G.UI && G.UI.refreshCoins) G.UI.refreshCoins();
  }

  /*
   * Nunca se sube dos veces en menos de MIN_GAP; mientras, todo está en el navegador.
   * MIN_GAP: 25 s (65 hasta el 25-10-2026; las reglas exigen 20: RULE_GAP). Con
   * 65, el segundo Guardar de seguida quedaba "para dentro de un rato" y, si
   * salías del juego antes, no se subía nunca: en el otro aparato faltaban los tickets.
   */
  const K_OK = 'ps.cloudok.', MIN_GAP = 25000, RULE_GAP = 21000;
  const sinceOk = () => Date.now() - (+read(K_OK + uid) || 0);

  /**
   * Sube la partida tal cual (sin leer la nube antes: lo de la nube ya se juntó al entrar).
   * Si el admin ha baneado la cuenta del ranking (ban = true en la nube, ver
   * firestore.rules), cada guardado tiene que conservarlo: sólo se escriben
   * save, updatedAt, v y rev (mergeFields) y el resto del documento (ban) se queda.
   */
  function pushNow(gap = MIN_GAP) {
    if (mode !== 'cloud' || guest || !save || !uid) return Promise.resolve();
    // Si ya hay una subida en marcha, se hace otra justo después (para lo que haya cambiado mientras).
    if (pushing) { pending = true; return pushing.then(() => (pending ? pushNow() : undefined)); }
    clearTimeout(pushT); pushT = 0; pushDue = 0;
    // Igual que lo último que se subió: la nube ya lo tiene (25-10-2026, una escritura de menos).
    if (sentCanon && sameKey(plain(fold(save))) === sentCanon) { pending = false; setSync('ok'); return Promise.resolve(); }
    if (navigator.onLine === false) {
      pending = true; setSync('offline'); scheduleRetry();
      return Promise.resolve();
    }
    if (sinceOk() < gap) {
      pending = true; setSync('pending');
      schedulePush(gap - sinceOk() + 500);
      return Promise.resolve();
    }
    pending = false;
    setSync('syncing');
    // Si la red se cae a medias, Firestore puede quedarse esperando: tope de 12 s.
    let tried = '';
    const u = uid, send = r => {
      const body = plain(fold(save));
      tried = sameKey(body);
      return Promise.race([
        docRef().set({ save: body, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), v: VERSION, rev: r },
          { mergeFields: ['save', 'updatedAt', 'v', 'rev'] }).then(() => r),
        new Promise((_, rej) => setTimeout(() => rej({ code: 'unavailable' }), 12000))
      ]);
    };
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
      clearTimeout(readT);           // (si estaba sin leer la nube: ya va a la par)
      if (uid === u) { setRev(r); sentCanon = tried; }
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
   * nada, y si se acaba de subir hace menos de 25 s (MIN_GAP) se sube en
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
    // Lo cambiado mientras subía va en la siguiente, que espera MIN_GAP.
    if (syncState === 'pending' && pushT) return { ok: true, why: 'wait', secs: Math.max(1, Math.ceil((pushDue - Date.now()) / 1000)) };
    return { ok: false, why: syncState === 'offline' ? 'offline' : 'fail' };
  }

  /*
   * Sales del juego (lo minimizas, cambias de app o de pestaña) con un Guardar
   * que estaba esperando: se sube ya, en cuanto lo dejan las reglas. Es la
   * subida que pediste, no una de más (al salir sin pulsar Guardar no se sube nada).
   */
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', () => {
    if (document.hidden && pushT && mode === 'cloud' && !guest && save) pushNow(RULE_GAP);
  });
  // Si ya había una subida programada para antes, se respeta (no se retrasa).
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
   * MODO NUBE). (Algunos lo llaman con 'run' o true, de cuando se subía antes
   * lo urgente: ya no cambia nada.)
   */
  function commit() {
    if (G.Dev && G.Dev.enabled) return false;
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
      try { await auth.signOut(); } catch (e) { /* nada */ }
    } else if (mode === 'local' && !guest) {
      commit();
      remove(K_SES);
    }
    clearTimeout(pushT); clearTimeout(retryT); clearTimeout(readT);
    sentCanon = '';
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

  function repertoireEnabled(dex) { return !(save && save.repertoire && save.repertoire[dex] < 0); }
  function setRepertoire(dex, enabled) {
    if (!owns(dex) || !upgradesOf(dex).moves) return false;
    save.repertoire = save.repertoire || {};
    const stamp = Math.max(Date.now(), Math.abs(+save.repertoire[dex] || 0) + 1);
    save.repertoire[dex] = enabled ? stamp : -stamp;
    commit();
    return true;
  }

  function prestigeOf(dex) { return Math.min(5, num(save && save.prestige && save.prestige[dex])); }
  function canPrestige(dex) {
    return owns(dex) && !!G.DEX_BY[dex] && prestigeOf(dex) < 5 && G.Upgrades.LIST.every(u => (upgradesOf(dex)[u.id] || 0) >= u.max);
  }
  function prestigePokemon(dex, expectedLevel) {
    if (!canPrestige(dex) || prestigeOf(dex) !== expectedLevel) return false;
    if (G.Game && G.Game.state !== 'ui') return false;
    save.prestige = save.prestige || {};
    save.prestige[dex] = expectedLevel + 1;
    save.pupg[dex] = {};
    if (save.prestige[dex] === 5) grantShiny(dex, 'prestige');
    commit(true);
    return true;
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
    repertoireEnabled, setRepertoire, prestigeOf, canPrestige, prestigePokemon, owns, grant, ownsShiny, grantShiny, merge, setName, upgradesOf, isFav, setFav,
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
