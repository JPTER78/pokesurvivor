/* ============ ranking.js — clasificación de tiempo aguantado ============
 * Firestore (pensado para gastar lo mínimo del plan gratuito):
 *
 *   lbs/{tabla}        RESUMEN: el top 50 de la tabla en UN documento
 *                      { top: { id: { t, uids, names, dex, shiny, lv, kills } }, me, ev }
 *                      Ver una pestaña del ranking = 1 lectura (antes ~52).
 *   lb/{tabla}/e/{id}  la marca de cada jugador o equipo (la que validan las
 *                      reglas contra trampas y la que sirve para calcular tu
 *                      puesto si no estás en el top 50)
 *
 *   tabla = modo + periodo:
 *     s_d20261008   solitario, hoy            g_...   en grupo
 *     s_w2026-41    semana ISO                s_m202610  mes
 *     s_y2026       año                       s_all      histórico
 *     s_all_p25     histórico sólo con Pikachu (el filtro por Pokémon sólo
 *                   existe en el histórico: así cada partida escribe la mitad)
 *   id = tu uid (solitario) o los uid del equipo ordenados y unidos con "_".
 *
 * Ahorros:
 *   - Lo leído se guarda 10 min en el navegador (cambiar de pestaña y volver: 0).
 *   - Tus mejores marcas se recuerdan en el navegador: al acabar una partida
 *     no hay que leer nada para saber si has mejorado, y sólo se escribe
 *     donde mejoras.
 *   - El resumen sólo se toca si tu marca entra en el top 50.
 *
 * Los periodos se cuentan en hora de España (Europe/Madrid).
 */
G.Ranking = (() => {
  const TZ = 'Europe/Madrid';
  const PERIODS = [['d', 'Diario'], ['w', 'Semanal'], ['m', 'Mensual'], ['y', 'Anual'], ['a', 'Histórico']];
  const TOP = 50;
  const TTL = 10 * 60 * 1000;            // caché de lo leído

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

  function periodIds(date = new Date()) {
    const { y, m, d } = madridDate(date);
    const w = isoWeek(y, m, d);
    const p2 = n => String(n).padStart(2, '0');
    return { d: 'd' + y + p2(m) + p2(d), w: 'w' + w.year + '-' + p2(w.week), m: 'm' + y + p2(m), y: 'y' + y, a: 'all' };
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
  const bestKey = () => 'ps.rk.best.' + (fbx() ? fbx().uid : '');
  function bests() { try { return JSON.parse(localStorage.getItem(bestKey()) || '{}'); } catch (e) { return {}; } }
  function saveBests(b) {
    // Sólo se conservan las tablas de los periodos actuales y las históricas.
    const cur = Object.values(periodIds());
    for (const k of Object.keys(b)) if (!cur.some(p => k.split(':')[0].split('_')[1] === p)) delete b[k];
    try { localStorage.setItem(bestKey(), JSON.stringify(b)); } catch (e) { /* lleno */ }
  }

  // ---------------- guardar ----------------

  /** Al empezar una partida: el servidor apunta la hora (anti-trampas). */
  function runStarted(mode) {
    const fb = fbx();
    if (!fb) return;
    fb.fs.collection('runs').doc(fb.uid).set({ startedAt: firebase.firestore.FieldValue.serverTimestamp(), mode })
      .catch(e => console.warn('[Ranking] inicio:', e.code || e.message));
  }

  const rowOf = (id, v) => ({ id, t: v.t, uids: v.uids || [], names: v.names || [], dex: v.dex || [], shiny: v.shiny || [], lv: v.lv, kills: v.kills });
  const sorted = top => Object.entries(top || {}).map(([id, v]) => rowOf(id, v)).sort((a, b) => b.t - a.t);

  /** Guarda la entrada en cada tabla donde mejore. → periodos mejorados */
  async function store(boards, id, entry) {
    const fb = fbx();
    const better = [];
    const known = bests();
    await Promise.all(boards.map(async ([b, period]) => {
      const key = b + ':' + id;
      try {
        // ¿Ya tenías una marca mejor? Si este navegador no lo sabe, se mira una vez.
        if (known[key] === undefined) {
          const old = await col(b).doc(id).get();
          known[key] = old.exists ? old.data().t : 0;
        }
        if (known[key] >= entry.t) return;
        const data = Object.assign({}, entry, { at: firebase.firestore.FieldValue.serverTimestamp() });
        // Si la tabla ya está llena y no llegas al top 50, no hace falta tocar el resumen.
        const cached = cacheGet('s:' + b);
        const full = cached && Object.keys(cached).length >= TOP;
        const minT = full ? Math.min(...Object.values(cached).map(v => v.t)) : 0;
        if (full && entry.t <= minT && !(id in cached)) {
          await col(b).doc(id).set(data);
        } else {
          let newTop = null;
          await fb.fs.runTransaction(async tx => {
            const s = await tx.get(sumRef(b));
            const top = Object.assign({}, s.exists ? s.data().top : {});
            tx.set(col(b).doc(id), data);
            const mine = { t: entry.t, uids: entry.uids, names: entry.names, dex: entry.dex, shiny: entry.shiny, lv: entry.lv, kills: entry.kills };
            let ev = '';
            if (!(id in top) && Object.keys(top).length >= TOP) {
              const low = sorted(top).pop();
              if (low.t >= entry.t) { newTop = top; return; }      // no entra en el top
              ev = low.id; delete top[ev];
            }
            top[id] = mine;
            tx.set(sumRef(b), { top, me: id, ev });
            newTop = top;
          });
          if (newTop) cacheSet('s:' + b, newTop);
        }
        known[key] = entry.t;
        if (b.startsWith('g_')) known[b + ':*'] = Math.max(known[b + ':*'] || 0, entry.t);
        mem.delete('r:' + b); try { localStorage.removeItem('ps.rk.c.r:' + b); } catch (e) { /* nada */ }
        if (period && !better.includes(period)) better.push(period);
      } catch (e) { console.warn('[Ranking] no se pudo guardar en', b, e.code || e.message); }
    }));
    saveBests(known);
    return better;
  }

  function announce(better) {
    if (!better.length) return;
    const names = { d: 'de hoy', w: 'de la semana', m: 'del mes', y: 'del año', a: 'histórico' };
    const best = PERIODS.map(p => p[0]).filter(p => better.includes(p)).pop();
    G.UI.toast('¡Nueva mejor marca ' + names[best] + ' en el ranking!', 3400);
  }

  async function submitSolo(r) {
    const fb = fbx();
    if (!fb || !G.Social.me || r.t < 5) return [];
    const ids = periodIds();
    const entry = { t: r.t, uids: [fb.uid], names: [G.Social.me.name], dex: [r.dex], shiny: [!!r.shiny], lv: r.lv, kills: r.kills };
    const boards = PERIODS.map(([p]) => ['s_' + ids[p], p]);
    boards.push(['s_all_p' + r.dex, null]);
    const better = await store(boards, fb.uid, entry);
    announce(better);
    return better;
  }

  /** La sube el anfitrión, con todo el equipo. */
  async function submitGroup(r) {
    const fb = fbx();
    if (!fb || r.t < 5 || !r.members || r.members.length < 2) return [];
    const ms = r.members.slice().sort((a, b) => (a.uid < b.uid ? -1 : 1));
    const id = ms.map(m => m.uid).join('_');
    const entry = { t: r.t, uids: ms.map(m => m.uid), names: ms.map(m => m.name), dex: ms.map(m => m.dex),
                    shiny: ms.map(m => !!m.shiny), lv: r.lv, kills: r.kills };
    const ids = periodIds();
    const boards = PERIODS.map(([p]) => ['g_' + ids[p], p]);
    for (const d of new Set(entry.dex)) boards.push(['g_all_p' + d, null]);
    const better = await store(boards, id, entry);
    announce(better);
    return better;
  }

  // ---------------- leer ----------------

  /** El top 50 de una tabla (1 lectura, o 0 si se leyó hace menos de 10 min). */
  const inflight = new Map();             // tabla -> lectura en curso (la lista y tu puesto la comparten)
  async function summary(b) {
    const c = cacheGet('s:' + b);
    if (c !== undefined) return c;
    if (!inflight.has(b)) {
      inflight.set(b, sumRef(b).get().then(s => {
        const top = s.exists ? (s.data().top || {}) : {};
        cacheSet('s:' + b, top);
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
    // Los amigos que no están en el top 50: se buscan aparte (y se guardan 10 min).
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

  return { PERIODS, periodIds, board, runStarted, submitSolo, submitGroup, top, myRank, removeMine };
})();
