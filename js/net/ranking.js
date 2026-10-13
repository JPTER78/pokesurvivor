/* ============ ranking.js — clasificación de tiempo aguantado ============
 * Firestore (pensado para gastar lo mínimo del plan gratuito):
 *
 *   lbs/{tabla}        RESUMEN: el top 50 de la tabla en UN documento
 *                      { top: { id: { t, uids, names, dex, shiny, lv, kills } }, me, ev }
 *                      Ver una pestaña del ranking = 1 lectura (antes ~52).
 *   lb/{tabla}/e/{id}  la marca de cada jugador o equipo (la que sirve para
 *                      calcular tu puesto si no estás en el top 50)
 *
 *   tabla = modo + periodo:
 *     s_d20261008   solitario, hoy            g_...   en grupo
 *     s_w2026-41    semana ISO                s_m202610  mes
 *     s_all2        histórico   (la tabla anual se quitó el 2026-10-10)
 *     s_all2_p25    histórico sólo con Pikachu (el filtro por Pokémon sólo
 *                   existe en el histórico: así cada partida escribe la mitad)
 *                   (all2 desde la Sentencia de Arceus: con el final en el
 *                    minuto 30, el histórico empezó de cero; las tablas viejas
 *                    s_all y s_all_pN se quedan en el servidor sin usarse)
 *   id = tu uid (solitario) o los uid del equipo ordenados y unidos con "_".
 *
 * Ahorros:
 *   - Lo leído se guarda 30 min en el navegador (cambiar de pestaña y volver: 0).
 *   - Tus mejores marcas se recuerdan en el navegador: al acabar una partida
 *     no hay que leer nada para saber si has mejorado, y sólo se escribe
 *     donde mejoras.
 *   - El resumen sólo se toca si tu marca entra en el top 50.
 *   - En diario, semanal y mensual sólo se guardan las marcas del top 50: si
 *     no entras no se escribe nada y tu puesto sale como "fuera del top 50".
 *     Tu puesto exacto, aunque estés el 3.000, sólo en el histórico. Con mucha
 *     gente jugando, ahorra unas 6 de cada 10 escrituras del ranking.
 *
 * Los periodos se cuentan en hora de España (Europe/Madrid).
 */
G.Ranking = (() => {
  const TZ = 'Europe/Madrid';
  const PERIODS = [['d', 'Diario'], ['w', 'Semanal'], ['m', 'Mensual'], ['a', 'Histórico']];
  // Periodos en los que sólo se guarda el top 50 (ver arriba).
  // ('p' = histórico de un Pokémon: casi cada partida entraba en el de su
  //  Pokémon y escribía; ahora también sólo el top 50.)
  const TOP_ONLY = new Set(['d', 'w', 'm', 'p']);
  const TOP = 50;
  // Las runs de menos de 1 minuto no se suben (casi nunca entran en una tabla
  // y eran muchas lecturas y escrituras para nada).
  const MIN_T = 60;
  // Y las que duran más de lo posible tampoco (el servidor las rechazaría igual).
  const MAX_T = G.Integrity.MAX_T;
  const TTL = 30 * 60 * 1000;            // caché de lo leído (30 min: menos lecturas de Firestore)

  const fbx = () => G.DB.online ? G.DB.fb : null;

  // ---------------- periodos ----------------

  function madridDate(date) {
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)) p[x.type] = x.value;
    return { y: +p.year, m: +p.month, d: +p.day };
  }

  /** Semana ISO (lunes a domingo) de una fecha y-m-d. */
  function isoWeek(y, m, d) {
    const t = new Date(Date.UTC(y, m - 1, d));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / 86400000 + 1) / 7) };
  }

  const ALL = 'all2';                     // histórico (ver arriba)
  function periodIds(date = new Date()) {
    const { y, m, d } = madridDate(date);
    const w = isoWeek(y, m, d);
    const p2 = n => String(n).padStart(2, '0');
    return { d: 'd' + y + p2(m) + p2(d), w: 'w' + w.year + '-' + p2(w.week), m: 'm' + y + p2(m), y: 'y' + y, a: ALL };
  }

  /** El filtro por Pokémon sólo existe en el histórico. */
  function board(mode, period, dex) {
    return mode + '_' + periodIds()[period] + (dex && period === 'a' ? '_p' + dex : '');
  }

  const col = b => fbx().fs.collection('lb').doc(b).collection('e');
  const sumRef = b => fbx().fs.collection('lbs').doc(b);

  // ---------------- caché en el navegador ----------------

  const mem = new Map();                 // clave -> { at, v }
  function cacheGet(k) {
    let c = mem.get(k);
    if (!c) { try { c = JSON.parse(localStorage.getItem('ps.rk.c.' + k) || 'null'); } catch (e) { c = null; } if (c) mem.set(k, c); }
    return c && Date.now() - c.at < TTL ? c.v : undefined;
  }
  function cacheSet(k, v) {
    const c = { at: Date.now(), v };
    mem.set(k, c);
    try { localStorage.setItem('ps.rk.c.' + k, JSON.stringify(c)); } catch (e) { /* lleno */ }
  }
  /** Borra lo caducado (la caché del navegador no crece sin límite). */
  function cachePrune() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('ps.rk.c.')) continue;
        const c = JSON.parse(localStorage.getItem(k) || 'null');
        if (!c || Date.now() - c.at > TTL) localStorage.removeItem(k);
      }
    } catch (e) { /* nada */ }
  }
  cachePrune();

  // Tus mejores marcas por tabla (para no leer antes de escribir).
  // (best2 desde 2026-10-12: se quitaron del ranking las marcas rotas; así quien
  //  tenía una vuelve a mirar su marca real y puede volver a entrar.)
  const bestKey = () => 'ps.rk.best2.' + (fbx() ? fbx().uid : '');
  function bests() { try { return JSON.parse(localStorage.getItem(bestKey()) || '{}'); } catch (e) { return {}; } }
  function saveBests(b) {
    // Sólo se conservan las tablas de los periodos actuales y las históricas.
    const cur = Object.values(periodIds());
    for (const k of Object.keys(b)) if (!cur.some(p => k.split(':')[0].split('_')[1] === p)) delete b[k];
    try { localStorage.setItem(bestKey(), JSON.stringify(b)); } catch (e) { /* lleno */ }
  }

  // ---------------- umbral de cada tabla ----------------
  /*
   * La marca más baja del top 50 de cada tabla, cuando está llena. Sólo puede
   * subir con el tiempo, así que un valor viejo sigue sirviendo: si tu marca
   * no lo supera, seguro que no entra y no hace falta leer nada (cada resumen
   * pesa ~30 KB y al acabar una partida se miraban hasta 5; 13-10-2026).
   */
  const THR = 'ps.rk.thr';
  function thresholds() { try { return JSON.parse(localStorage.getItem(THR) || '{}'); } catch (e) { return {}; } }
  function noteTop(b, top) {
    const vals = Object.values(top || {});
    if (vals.length < TOP) return;
    const low = Math.min(...vals.map(v => v.t));
    const t = thresholds();
    if ((t[b] || 0) >= low) return;
    t[b] = low;
    // Sólo las tablas de los periodos de ahora (y las históricas).
    const cur = Object.values(periodIds());
    for (const k of Object.keys(t)) if (!cur.some(p => k.split('_')[1] === p)) delete t[k];
    try { localStorage.setItem(THR, JSON.stringify(t)); } catch (e) { /* lleno */ }
  }

  // ---------------- guardar ----------------

  const rowOf = (id, v) => ({ id, t: v.t, uids: v.uids || [], names: v.names || [], dex: v.dex || [], shiny: v.shiny || [], lv: v.lv, kills: v.kills });
  const sorted = top => Object.entries(top || {}).map(([id, v]) => rowOf(id, v)).sort((a, b) => b.t - a.t);
  const now = () => firebase.firestore.FieldValue.serverTimestamp();

  // ---------------- anti-trampas ----------------

  /**
   * Al empezar cada partida (en grupo, el anfitrión) el servidor apunta la
   * hora: ninguna marca puede durar más que el tiempo real desde entonces
   * (firestore.rules, validEntry). Antes se espera a que acabe de subirse la
   * marca de la partida anterior, para no cambiarle la hora a mitad.
   */
  let busy = Promise.resolve();
  function runStarted(mode) {
    const fb = fbx();
    if (!fb) return;
    const go = n => fb.fs.collection('runs').doc(fb.uid).set({ startedAt: now(), mode })
      .catch(e => { console.warn('[Ranking] inicio:', e.code || e.message); if (n < 2) setTimeout(() => go(n + 1), 15000); });
    busy.then(() => go(0));
  }
  /** La subida de una marca (para que la partida siguiente espere a que acabe). */
  function track(p) { busy = p.catch(() => {}); return p; }

  /**
   * Sube la grabación de la partida (replays/{uid}). Las reglas piden que la
   * marca que la cita (sm.rid) ya la tenga detrás. Si falla, la marca sube sin rid.
   */
  async function saveReplay(rep) {
    const fb = fbx();
    if (!fb || !rep) return false;
    try {
      await fb.fs.collection('replays').doc(fb.uid).set({
        rid: rep.rid, v: String(rep.hdr.v || '').slice(0, 16), t: rep.t, mode: rep.hdr.mode, h: JSON.stringify(rep.hdr),
        log: rep.log, n: rep.n, trunc: !!rep.trunc, at: now()
      });
      return true;
    } catch (e) { console.warn('[Ranking] grabación:', e.code || e.message); return false; }
  }

  /** Guarda la entrada en cada tabla donde mejore. → periodos mejorados */
  async function store(boards, id, entry, rep) {
    const fb = fbx();
    const better = [];
    const known = bests();
    // La grabación sólo se sube si alguna tabla va a escribirse (una vez por partida).
    let replayP = null;
    const withReplay = () => replayP || (replayP = saveReplay(rep));
    await Promise.all(boards.map(async ([b, period]) => {
      const key = b + ':' + id;
      try {
        const topOnly = TOP_ONLY.has(period);
        // Si no llegas a la 50.ª marca que conoce este navegador, no entras: en
        // diario, semanal, mensual y por Pokémon no hay nada que hacer (ni leer).
        const thr = thresholds()[b] || 0;
        if (topOnly && thr && entry.t <= thr) return;
        // ¿Ya tenías una marca mejor? En el histórico, si este navegador no lo
        // sabe, se mira una vez tu marca (pequeña). En las demás lo dice el
        // resumen, que se lee igualmente dentro de la transacción de abajo.
        if (known[key] === undefined && !topOnly) {
          const old = await col(b).doc(id).get();
          known[key] = old.exists ? old.data().t : 0;
        }
        if ((known[key] || 0) >= entry.t) return;
        let sm = entry.sm;
        if (sm && !(await withReplay())) { sm = Object.assign({}, sm); delete sm.rid; }
        const data = Object.assign({}, entry, { at: firebase.firestore.FieldValue.serverTimestamp() });
        if (sm) data.sm = sm; else delete data.sm;
        // Si la tabla ya está llena y no llegas al top 50, no hace falta tocar el resumen
        // (y en diario, semanal y mensual, ni siquiera se guarda la marca).
        const cached = cacheGet('s:' + b);
        if (thr && entry.t <= thr && !(cached && id in cached)) {
          if (!topOnly) await col(b).doc(id).set(data);
          else { known[key] = entry.t; return; }
        } else {
          let entered = true;
          let newTop = null;
          await fb.fs.runTransaction(async tx => {
            const s = await tx.get(sumRef(b));
            const top = Object.assign({}, s.exists ? s.data().top : {});
            // (Sin "shiny" si no hay ninguno: el resumen pesa menos.)
            const mine = { t: entry.t, uids: entry.uids, names: entry.names, dex: entry.dex, lv: entry.lv, kills: entry.kills };
            if (entry.shiny.some(Boolean)) mine.shiny = entry.shiny;
            let ev = '';
            // Ya estabas con una marca mejor (otro ordenador): nada que escribir.
            if (id in top && top[id].t >= entry.t) { entered = false; newTop = top; return; }
            if (!(id in top) && Object.keys(top).length >= TOP) {
              const low = sorted(top).pop();
              if (low.t >= entry.t) {                                // no entra en el top
                if (!topOnly) tx.set(col(b).doc(id), data);
                entered = false; newTop = top; return;
              }
              ev = low.id; delete top[ev];
            }
            tx.set(col(b).doc(id), data);
            top[id] = mine;
            tx.set(sumRef(b), { top, me: id, ev });
            newTop = top;
          });
          if (newTop) { cacheSet('s:' + b, newTop); noteTop(b, newTop); }
          if (topOnly && !entered) { known[key] = entry.t; return; }
        }
        known[key] = entry.t;
        if (b.startsWith('g_')) known[b + ':*'] = Math.max(known[b + ':*'] || 0, entry.t);
        mem.delete('r:' + b); try { localStorage.removeItem('ps.rk.c.r:' + b); } catch (e) { /* nada */ }
        if (period && period !== 'p' && !better.includes(period)) better.push(period);
      } catch (e) { console.warn('[Ranking] no se pudo guardar en', b, e.code || e.message); }
    }));
    saveBests(known);
    return better;
  }

  function announce(better) {
    if (!better.length) return;
    const names = { d: 'de hoy', w: 'de la semana', m: 'del mes', a: 'histórico' };
    const best = PERIODS.map(p => p[0]).filter(p => better.includes(p)).pop();
    G.UI.toast('¡Nueva mejor marca ' + names[best] + ' en el ranking!', 3400);
  }

  function submitSolo(r) { return track(submitSoloNow(r)); }
  async function submitSoloNow(r) {
    const fb = fbx();
    if (!fb || !G.Social.me || r.t < MIN_T || r.t > MAX_T || !G.Integrity.rankable()) return [];
    const ids = periodIds();
    const entry = { t: r.t, uids: [fb.uid], names: [G.Social.me.name], dex: [r.dex], shiny: [!!r.shiny], lv: r.lv, kills: r.kills, sm: r.sm };
    const boards = PERIODS.map(([p]) => ['s_' + ids[p], p]);
    boards.push(['s_' + ALL + '_p' + r.dex, 'p']);
    const better = await store(boards, fb.uid, entry, r.rep);
    announce(better);
    return better;
  }

  /** La sube el anfitrión, con todo el equipo. */
  function submitGroup(r) { return track(submitGroupNow(r)); }
  async function submitGroupNow(r) {
    const fb = fbx();
    if (!fb || r.t < MIN_T || r.t > MAX_T || !G.Integrity.rankable() || !r.members || r.members.length < 2) return [];
    const ms = r.members.slice().sort((a, b) => (a.uid < b.uid ? -1 : 1));
    const id = ms.map(m => m.uid).join('_');
    const entry = { t: r.t, uids: ms.map(m => m.uid), names: ms.map(m => m.name), dex: ms.map(m => m.dex),
                    shiny: ms.map(m => !!m.shiny), lv: r.lv, kills: r.kills, sm: r.sm };
    const ids = periodIds();
    const boards = PERIODS.map(([p]) => ['g_' + ids[p], p]);
    for (const d of new Set(entry.dex)) boards.push(['g_' + ALL + '_p' + d, 'p']);
    const better = await store(boards, id, entry, r.rep);
    announce(better);
    return better;
  }

  // ---------------- leer ----------------

  /** El top 50 de una tabla (1 lectura, o 0 si se leyó hace menos de 30 min). */
  const inflight = new Map();             // tabla -> lectura en curso (la lista y tu puesto la comparten)
  async function summary(b) {
    const c = cacheGet('s:' + b);
    if (c !== undefined) return c;
    if (!inflight.has(b)) {
      inflight.set(b, sumRef(b).get().then(s => {
        const top = s.exists ? (s.data().top || {}) : {};
        cacheSet('s:' + b, top);
        noteTop(b, top);
        return top;
      }).finally(() => inflight.delete(b)));
    }
    return inflight.get(b);
  }

  /**
   * Mejores marcas de una tabla.
   * @param friendsOnly  sólo tú y tus amigos
   */
  async function top(mode, period, dex, friendsOnly) {
    const fb = fbx();
    if (!fb) return [];
    const b = board(mode, period, dex);
    const rows = sorted(await summary(b));
    if (!friendsOnly) return rows.slice(0, TOP);
    const circle = [fb.uid, ...G.Social.friends.filter(f => f.status === 'ok').map(f => f.uid)].slice(0, 30);
    const inTop = rows.filter(r => r.uids.some(u => circle.includes(u)));
    // En diario, semanal, mensual y por Pokémon no hay marcas fuera del top 50.
    if (TOP_ONLY.has(period) || dex) return inTop;
    // Los amigos que no están en el top 50: se buscan aparte (y se guardan 30 min).
    const ck = 'f:' + b + ':' + circle.slice().sort().join(',');
    let extra = cacheGet(ck);
    if (extra === undefined) {
      if (mode === 's') {
        const missing = circle.filter(u => !inTop.some(r => r.id === u));
        const docs = await Promise.all(missing.map(u => col(b).doc(u).get().catch(() => null)));
        extra = docs.filter(d => d && d.exists).map(d => rowOf(d.id, d.data()));
      } else {
        const s = await col(b).where('uids', 'array-contains-any', circle).get();
        extra = s.docs.map(d => rowOf(d.id, d.data()));
      }
      cacheSet(ck, extra);
    }
    const all = new Map();
    for (const r of [...inTop, ...extra]) all.set(r.id, r);
    return [...all.values()].sort((a, c) => c.t - a.t).slice(0, TOP);
  }

  /** Tu puesto en la tabla (aunque no salgas en el top). → { pos, t, row } | null */
  async function myRank(mode, period, dex) {
    const fb = fbx();
    if (!fb) return null;
    const b = board(mode, period, dex);
    // ¿Estás en el top 50? Entonces el puesto sale del resumen, sin gastar nada.
    const rows = sorted(await summary(b));
    const i = rows.findIndex(r => r.uids.includes(fb.uid));
    if (i >= 0) return { pos: i + 1, t: rows[i].t, row: rows[i] };
    if (TOP_ONLY.has(period) || dex) return { out: true };
    const ck = 'r:' + b;
    const c = cacheGet(ck);
    if (c !== undefined) return c;
    // Si este navegador ya sabe que no tienes marca en esta tabla, no se mira.
    const kb = bests(), mk = b + ':' + (mode === 's' ? fb.uid : '*');
    if (kb[mk] === 0) { cacheSet(ck, null); return null; }
    let mine = null;
    if (mode === 's') {
      const d = await col(b).doc(fb.uid).get();
      if (d.exists) mine = rowOf(d.id, d.data());
    } else {
      const s = await col(b).where('uids', 'array-contains', fb.uid).get();
      for (const d of s.docs) { const r = rowOf(d.id, d.data()); if (!mine || r.t > mine.t) mine = r; }
    }
    kb[mk] = mine ? mine.t : 0;
    saveBests(kb);
    let res = null;
    if (mine) res = { pos: (await countAbove(b, mine.t)) + 1, t: mine.t, row: mine };
    cacheSet(ck, res);
    return res;
  }

  /**
   * Cuántas entradas tienen más tiempo. La versión "compat" del SDK no trae
   * count(), así que se usa la API REST de agregación (1 lectura por cada
   * 1.000 entradas, en vez de leerlas todas). Sólo se usa si no estás en el top 50.
   */
  async function countAbove(b, t) {
    const fb = fbx();
    const cfg = G.FIREBASE_CONFIG;
    const base = fb.emulator ? 'http://127.0.0.1:8080/v1' : 'https://firestore.googleapis.com/v1';
    const url = `${base}/projects/${cfg.projectId}/databases/(default)/documents/lb/${encodeURIComponent(b)}:runAggregationQuery`;
    const token = await fb.auth.currentUser.getIdToken();
    const body = { structuredAggregationQuery: {
      structuredQuery: { from: [{ collectionId: 'e' }],
        where: { fieldFilter: { field: { fieldPath: 't' }, op: 'GREATER_THAN', value: { integerValue: String(t) } } } },
      aggregations: [{ alias: 'n', count: {} }] } };
    try {
      const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      const n = j && j[0] && j[0].result && j[0].result.aggregateFields && j[0].result.aggregateFields.n;
      return n ? +n.integerValue : 0;
    } catch (e) {
      console.warn('[Ranking] puesto:', e.message);
      return 0;
    }
  }

  /** Al borrar la cuenta: quita tus filas de los resúmenes que conoce este navegador. */
  async function removeMine() {
    const fb = fbx();
    if (!fb) return;
    const ids = periodIds();
    const boards = new Set();
    for (const m of ['s', 'g']) for (const [p] of PERIODS) boards.add(m + '_' + ids[p]);
    for (const k of Object.keys(bests())) boards.add(k.split(':')[0]);
    await Promise.all([...boards].map(b => fb.fs.runTransaction(async tx => {
      const s = await tx.get(sumRef(b));
      if (!s.exists) return;
      const top = s.data().top || {};
      for (const [id, v] of Object.entries(top)) {
        if (!(v.uids || []).includes(fb.uid)) continue;
        // Una fila por escritura (las reglas sólo dejan quitar una cada vez).
        const next = Object.assign({}, top); delete next[id];
        tx.set(sumRef(b), { top: next, me: '', ev: id });
        return;
      }
    }).catch(() => {})));
    try { localStorage.removeItem(bestKey()); } catch (e) { /* nada */ }
  }

  // ---------------- reportes y moderación ----------------

  /** Reporta una marca sospechosa (una vez por marca y jugador). → true si se ha enviado */
  const repKey = () => 'ps.rk.rep.' + (fbx() ? fbx().uid : '');
  function reported() { try { return new Set(JSON.parse(localStorage.getItem(repKey()) || '[]')); } catch (e) { return new Set(); } }
  async function report(b, row) {
    const fb = fbx();
    if (!fb) return false;
    const key = b + '__' + row.id;
    const done = reported();
    if (!done.has(key)) {
      // (Si ya lo habías reportado desde otro ordenador, el servidor no deja repetirlo: da igual.)
      await fb.fs.collection('reports').doc(key + '__' + fb.uid)
        .set({ board: b, e: row.id, names: row.names.slice(0, 4), t: row.t | 0, by: fb.uid, at: now() }).catch(() => {});
      done.add(key);
      try { localStorage.setItem(repKey(), JSON.stringify([...done].slice(-300))); } catch (e) { /* lleno */ }
    }
    return true;
  }

  // Cuenta de moderación (firestore.rules, admin()): la pantalla oculta de js/ui/mod-ui.js.
  const ADMINS = ['rshaa5gKD3fXw6lE4PPXITbowaG2'];
  const isAdmin = () => !!fbx() && ADMINS.includes(fbx().uid);

  /** Admin: los reportes, juntos por marca (los más reportados primero). */
  async function reports() {
    const s = await fbx().fs.collection('reports').orderBy('at', 'desc').limit(400).get();
    const by = new Map();
    for (const d of s.docs) {
      const v = d.data(), k = v.board + '__' + v.e;
      if (!by.has(k)) by.set(k, { board: v.board, e: v.e, names: v.names || [], t: v.t, n: 0, ids: [], at: v.at && v.at.toMillis ? v.at.toMillis() : 0 });
      const g = by.get(k); g.n++; g.ids.push(d.id);
    }
    return [...by.values()].sort((a, b) => b.n - a.n || b.at - a.at);
  }

  /** Admin: la fila de una marca en el top 50 de su tabla (o null si ya no está). */
  async function entryInfo(b, e) {
    const top = await summary(b);
    return top[e] ? rowOf(e, top[e]) : null;
  }

  /** Admin: quita una marca de una tabla (la marca y su fila del top 50). */
  async function removeEntry(b, e) {
    const fb = fbx();
    await col(b).doc(e).delete().catch(() => {});
    await fb.fs.runTransaction(async tx => {
      const s = await tx.get(sumRef(b));
      const top = Object.assign({}, s.exists ? s.data().top : {});
      if (!(e in top)) return;
      delete top[e];
      tx.set(sumRef(b), { top, me: '', ev: e });
    }).catch(err => console.warn('[Ranking] quitar', b, err.code || err.message));
    cacheSet('s:' + b, undefined);
  }

  /** Admin: quita la marca de un jugador o equipo de todas las tablas de ahora (y de `also`). */
  async function removeEverywhere(e, mode, dexes = [], also = null) {
    const ids = periodIds();
    const boards = new Set(PERIODS.map(([p]) => mode + '_' + ids[p]));
    for (const d of dexes) boards.add(mode + '_' + ALL + '_p' + d);
    if (also) boards.add(also);
    await Promise.all([...boards].map(b => removeEntry(b, e)));
  }

  /**
   * Admin: quita de TODAS las tablas las marcas de más de `maxT` segundos (las
   * filas de cada top 50 y las marcas sueltas del histórico). Con la Sentencia
   * de Arceus nadie legal pasa de ~32 min. → { rows, boards }
   */
  async function purgeAbove(maxT, onProgress) {
    const fs = fbx().fs;
    const all = await fs.collection('lbs').get();
    let rows = 0, boards = 0, n = 0;
    for (const d of all.docs) {
      n++;
      if (onProgress && n % 50 === 0) onProgress(n, all.size);
      const top = d.data().top || {};
      const bad = Object.keys(top).filter(id => (top[id].t || 0) > maxT);
      if (!bad.length) continue;
      await fs.runTransaction(async tx => {
        const s = await tx.get(d.ref);
        const cur = Object.assign({}, (s.exists && s.data().top) || {});
        const gone = Object.keys(cur).filter(id => (cur[id].t || 0) > maxT);
        if (!gone.length) return;
        for (const id of gone) delete cur[id];
        tx.set(d.ref, { top: cur, me: '', ev: gone[0] });
      });
      await Promise.all(bad.map(id => fs.collection('lb').doc(d.id).collection('e').doc(id).delete().catch(() => {})));
      rows += bad.length; boards++;
      mem.delete('s:' + d.id); try { localStorage.removeItem('ps.rk.c.s:' + d.id); } catch (e) { /* nada */ }
    }
    // Las marcas del histórico que no están en el top 50 (sirven para el puesto exacto).
    for (const b of ['s_' + ALL, 'g_' + ALL]) {
      const q = await col(b).where('t', '>', maxT).get();
      await Promise.all(q.docs.map(e => e.ref.delete().catch(() => {})));
      rows += q.size;
    }
    return { rows, boards };
  }

  /** Admin: marca o desmarca una cuenta (marcada = no puede subir marcas). */
  function setMarked(uid, on) { return fbx().fs.collection('saves').doc(uid).update({ sus: !!on }); }
  /** Admin: borra reportes ya vistos. */
  function dismiss(ids) { return Promise.all(ids.map(id => fbx().fs.collection('reports').doc(id).delete().catch(() => {}))); }
  /** Admin: cuentas marcadas. */
  async function markedAccounts() {
    const s = await fbx().fs.collection('saves').where('sus', '==', true).limit(100).get();
    return s.docs.map(d => { const v = d.data().save || {}; return { uid: d.id, name: v.name || '?', coins: v.coins || 0,
      t1: (v.tickets || {}).t1 || 0, t10: (v.tickets || {}).t10 || 0, owned: Object.keys(v.owned || {}).length }; });
  }

  return { PERIODS, periodIds, board, runStarted, submitSolo, submitGroup, top, myRank, removeMine,
           report, reported, isAdmin, reports, entryInfo, removeEntry, purgeAbove, removeEverywhere, setMarked, dismiss, markedAccounts };
})();
