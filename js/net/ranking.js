/* ============ ranking.js — clasificación de tiempo aguantado ============
 * Firestore:  lb/{tabla}/e/{id}
 *   tabla = modo + periodo (+ Pokémon):
 *     s_d20261008      solitario, hoy           g_...  en grupo
 *     s_w2026-41       semana ISO               s_m202610   mes
 *     s_y2026          año                      s_all       histórico
 *     s_w2026-41_p25   la misma, sólo con Pikachu
 *   id = tu uid (solitario) o los uid del equipo ordenados y unidos con "_".
 *   { t (segundos), uids, names, dex, shiny, lv, kills, at }
 *
 * Una entrada por jugador (o equipo) y tabla: sólo se guarda si mejora la
 * marca. Las reglas comprueban que el tiempo no supere el tiempo real desde
 * que empezaste la partida (runs/{uid}).
 *
 * Los periodos se cuentan en hora de España (Europe/Madrid).
 */
G.Ranking = (() => {
  const TZ = 'Europe/Madrid';
  const PERIODS = [['d', 'Diario'], ['w', 'Semanal'], ['m', 'Mensual'], ['y', 'Anual'], ['a', 'Histórico']];
  const TOP = 50;

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

  function board(mode, period, dex) {
    return mode + '_' + periodIds()[period] + (dex ? '_p' + dex : '');
  }

  const col = b => fbx().fs.collection('lb').doc(b).collection('e');

  // ---------------- guardar ----------------

  /** Al empezar una partida: el servidor apunta la hora (anti-trampas). */
  function runStarted(mode) {
    const fb = fbx();
    if (!fb) return;
    fb.fs.collection('runs').doc(fb.uid).set({ startedAt: firebase.firestore.FieldValue.serverTimestamp(), mode })
      .catch(e => console.warn('[Ranking] inicio:', e.code || e.message));
  }

  /** Guarda la entrada en cada tabla donde mejore. → periodos mejorados */
  async function store(boards, id, entry) {
    const better = [];
    await Promise.all(boards.map(async ([b, period]) => {
      try {
        const ref = col(b).doc(id);
        const old = await ref.get();
        if (old.exists && old.data().t >= entry.t) return;
        await ref.set(Object.assign({}, entry, { at: firebase.firestore.FieldValue.serverTimestamp() }));
        if (period && !better.includes(period)) better.push(period);
      } catch (e) { console.warn('[Ranking] no se pudo guardar en', b, e.code || e.message); }
    }));
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
    const boards = [];
    for (const [p] of PERIODS) boards.push(['s_' + ids[p], p], ['s_' + ids[p] + '_p' + r.dex, null]);
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
    const boards = [];
    for (const [p] of PERIODS) {
      boards.push(['g_' + ids[p], p]);
      for (const d of new Set(entry.dex)) boards.push(['g_' + ids[p] + '_p' + d, null]);
    }
    const better = await store(boards, id, entry);
    announce(better);
    return better;
  }

  // ---------------- leer ----------------

  function row(d) {
    const v = d.data();
    return { id: d.id, t: v.t, uids: v.uids || [], names: v.names || [], dex: v.dex || [], shiny: v.shiny || [], lv: v.lv, kills: v.kills };
  }

  /**
   * Mejores marcas de una tabla.
   * @param friendsOnly  sólo tú y tus amigos
   */
  async function top(mode, period, dex, friendsOnly) {
    const fb = fbx();
    if (!fb) return [];
    const b = board(mode, period, dex);
    if (!friendsOnly) {
      const s = await col(b).orderBy('t', 'desc').limit(TOP).get();
      return s.docs.map(row);
    }
    const circle = [fb.uid, ...G.Social.friends.filter(f => f.status === 'ok').map(f => f.uid)].slice(0, 30);
    let rows;
    if (mode === 's') {
      const docs = await Promise.all(circle.map(u => col(b).doc(u).get().catch(() => null)));
      rows = docs.filter(d => d && d.exists).map(row);
    } else {
      const s = await col(b).where('uids', 'array-contains-any', circle).get();
      rows = s.docs.map(row);
    }
    return rows.sort((a, c) => c.t - a.t).slice(0, TOP);
  }

  /** Tu puesto en la tabla (aunque no salgas en el top). → { pos, t, row } | null */
  async function myRank(mode, period, dex) {
    const fb = fbx();
    if (!fb) return null;
    const b = board(mode, period, dex);
    let mine = null;
    if (mode === 's') {
      const d = await col(b).doc(fb.uid).get();
      if (d.exists) mine = row(d);
    } else {
      const s = await col(b).where('uids', 'array-contains', fb.uid).get();
      for (const d of s.docs) { const r = row(d); if (!mine || r.t > mine.t) mine = r; }
    }
    if (!mine) return null;
    const ahead = await countAbove(b, mine.t);
    return { pos: ahead + 1, t: mine.t, row: mine };
  }

  /**
   * Cuántas entradas tienen más tiempo. La versión "compat" del SDK no trae
   * count(), así que se usa la API REST de agregación (1 lectura por cada
   * 1.000 entradas, en vez de leerlas todas).
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

  return { PERIODS, periodIds, board, runStarted, submitSolo, submitGroup, top, myRank };
})();
