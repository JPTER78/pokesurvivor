/* ============ ranking.js — tiempo aguantado y daño a Arceus ============
 * Firestore (pensado para gastar lo mínimo del plan gratuito):
 *
 *   lbs/{tabla}        RESUMEN: los dos top 50 de la tabla en UN documento
 *                      { top:  { id: { t, uids, names, dex, shiny, lv, kills } },   tiempo
 *                        dtop: { id: { d, uids, names, dex, shiny } },               daño a Arceus
 *                        me, ev, dev }
 *                      Ver una pestaña del ranking (las dos mitades) = 1 lectura.
 *   lb/{tabla}/e/{id}  la marca de cada jugador o equipo: su mejor tiempo y su
 *                      mejor daño a Arceus (dmg), cada uno de su partida (sirve
 *                      para calcular tu puesto de tiempo si no estás en el top 50)
 *
 *   Daño a Arceus (23-10-2026): sólo el top 50 de cada tabla, y no en las de
 *   cada Pokémon. Va en el mismo resumen y en la misma marca que el tiempo: si
 *   mejoras las dos cosas en una partida, se escribe lo mismo que antes.
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
 *                   (all3 y todas las demás con una "r" desde el 18-10-2026:
 *                    se acabó huir de Arceus corriendo y con veneno, y TODAS
 *                    las tablas empezaron de cero)
 *                   (all4 y las demás con una "a" desde el 23-10-2026: sin el
 *                    tope de 45 min, con el daño a Arceus y los objetos rotos
 *                    en el minuto 35, otra vez TODAS desde cero)
 *   id = tu uid (solitario) o los uid del equipo ordenados y unidos con "_".
 *
 * Ahorros:
 *   - Lo leído se guarda 2 h en el navegador (cambiar de pestaña y volver: 0).
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
  // Las runs de menos de 2 minutos no se suben (nunca entran en un top que
  // importe y eran muchas lecturas y escrituras para nada: los que empiezan
  // mueren a menudo en el primer minuto; era 1 min hasta el 14-10-2026).
  const MIN_T = 120;
  // En el histórico de cada Pokémon, 10 min (5 hasta el 25-10-2026): con más de mil
  // tablas, casi ninguna llega a 50 marcas y aceptaban cualquier partida (2
  // escrituras cada vez; eran ~1/10 de todas las escrituras de Firestore).
  const MIN_T_MON = 600;
  // Caché de lo leído: 2 h (era 30 min hasta el 20-10-2026). Tu marca nueva se
  // ve al momento igual (al subirla se guarda en la caché lo que se escribió).
  const TTL = 2 * 3600 * 1000;

  const fbx = () => G.DB.online ? G.DB.fb : null;

  // ---------------- sello ----------------
  /*
   * Al empezar cada partida se pide un sello a ice.pokesurvivor.com (el servidor
   * del cooperativo): tu cuenta y la hora, firmadas. Va con la marca y sin él no
   * entra en el ranking. En grupo cada uno pide el suyo y el invitado se lo
   * manda al anfitrión (coop.js), que es quien sube la marca.
   */
  const SEAL_API = 'https://ice.pokesurvivor.com/v1/seal';
  /*
   * Las reglas aceptan un sello de hasta 90 s después de empezar (rt <= desde el
   * sello + 90 s). Antes se probaba 3 veces con 6 s de espera (unos 25 s): con el
   * servidor lento (27-10-2026: tardaba 7-8 s y fallaba a menudo) casi ninguna
   * partida conseguía sello y no entraba en ningún ranking. Ahora se insiste
   * mientras quepa en esos 90 s (SEAL_LAST: el último intento acaba antes).
   */
  const SEAL_TRIES = 8, SEAL_WAIT = 15000, SEAL_GAP = 3000, SEAL_LAST = 80000;
  let seal = null, sealRun = 0;
  function newSeal() {
    seal = null;
    const run = ++sealRun, fb = fbx(), user = fb && fb.auth.currentUser;
    if (!user || fb.emulator) return;
    const t0 = Date.now();
    (async () => {
      for (let i = 0; i < SEAL_TRIES && run === sealRun; i++) {
        if (i) await new Promise(r => setTimeout(r, SEAL_GAP));
        const left = SEAL_LAST - (Date.now() - t0);
        if (left < 2000) return;
        const ctl = new AbortController(), stop = setTimeout(() => ctl.abort(), Math.min(SEAL_WAIT, left));
        try {
          const token = await user.getIdToken();
          const r = await fetch(SEAL_API, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, signal: ctl.signal });
          if (r.status === 401 || r.status === 403) return;
          const j = r.ok ? await r.json() : null;
          if (j && Number.isSafeInteger(j.s) && /^[0-9a-f]{64}$/.test(j.g)) {
            if (run === sealRun) seal = { uid: user.uid, s: j.s, g: j.g };
            return;
          }
        } catch (e) { /* sin red: otra vez */ } finally { clearTimeout(stop); }
      }
    })();
  }
  /** El sello de esta partida, { s, g }, o null si no hay. */
  function mySeal() {
    const fb = fbx();
    return seal && fb && seal.uid === fb.uid ? { s: seal.s, g: seal.g } : null;
  }
  const okSeal = x => !!x && Number.isSafeInteger(x.s) && typeof x.g === 'string' && /^[0-9a-f]{64}$/.test(x.g);

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

  const ALL = 'all4';                     // histórico (ver arriba)
  function periodIds(date = new Date()) {
    const { y, m, d } = madridDate(date);
    const w = isoWeek(y, m, d);
    const p2 = n => String(n).padStart(2, '0');
    return { d: 'd' + y + p2(m) + p2(d), w: 'w' + w.year + '-' + p2(w.week), m: 'm' + y + p2(m), y: 'y' + y, a: ALL };
  }

  /*
   * Nombres de las tablas: los de periodIds() con una "a" detrás (23-10-2026:
   * todas desde cero con el daño a Arceus; del 18-10 era una "r" y antes una
   * "j", del 14-10). periodIds() se queda igual porque también lo usan las
   * misiones (progress.js). El histórico ya cambia de nombre (ALL).
   */
  const GEN = 'a';
  function boardIds(date) {
    const p = periodIds(date);
    return Object.assign({}, p, { d: p.d + GEN, w: p.w + GEN, m: p.m + GEN, y: p.y + GEN });
  }

  /** El filtro por Pokémon sólo existe en el histórico. */
  function board(mode, period, dex) {
    return mode + '_' + boardIds()[period] + (dex && period === 'a' ? '_p' + dex : '');
  }

  const col = b => fbx().fs.collection('lb').doc(b).collection('e');
  const sumRef = b => fbx().fs.collection('lbs').doc(b);

  // ---------------- caché en el navegador ----------------

  const mem = new Map();                 // clave -> { at, v }
  // Tu puesto exacto (fuera del top 50) cuesta 1 lectura por cada 1.000 marcas
  // que tienes por delante: se guarda 6 h, y se vuelve a mirar antes si mejoras.
  const RANK_TTL = 6 * 3600 * 1000;
  const ttlOf = k => (k.startsWith('r:') ? RANK_TTL : TTL);
  function cacheGet(k) {
    let c = mem.get(k);
    if (!c) { try { c = JSON.parse(localStorage.getItem('ps.rk.c.' + k) || 'null'); } catch (e) { c = null; } if (c) mem.set(k, c); }
    return c && Date.now() - c.at < ttlOf(k) ? c.v : undefined;
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
        if (!c || Date.now() - c.at > ttlOf(k.slice(8))) localStorage.removeItem(k);
      }
    } catch (e) { /* nada */ }
  }
  cachePrune();

  // Tus mejores marcas por tabla (para no leer antes de escribir): "tabla:id"
  // el tiempo y "tabla:id#d" el daño a Arceus.
  // (best2 desde 2026-10-12: se quitaron del ranking las marcas rotas; así quien
  //  tenía una vuelve a mirar su marca real y puede volver a entrar.)
  const bestKey = () => 'ps.rk.best2.' + (fbx() ? fbx().uid : '');
  function bests() { try { return JSON.parse(localStorage.getItem(bestKey()) || '{}'); } catch (e) { return {}; } }
  function saveBests(b) {
    // Sólo se conservan las tablas de los periodos actuales y las históricas.
    const cur = Object.values(boardIds());
    for (const k of Object.keys(b)) if (!cur.some(p => k.split(':')[0].split('_')[1] === p)) delete b[k];
    try { localStorage.setItem(bestKey(), JSON.stringify(b)); } catch (e) { /* lleno */ }
  }

  // ---------------- umbral de cada tabla ----------------
  /*
   * La marca más baja del top 50 de cada tabla, cuando está llena. Sólo puede
   * subir con el tiempo, así que un valor viejo sigue sirviendo: si tu marca
   * no lo supera, seguro que no entra y no hace falta leer nada (cada resumen
   * pesa ~30 KB y al acabar una partida se miraban hasta 5; 13-10-2026).
   * "tabla" la del tiempo y "tabla#d" la del daño a Arceus.
   */
  const THR = 'ps.rk.thr';
  function thresholds() { try { return JSON.parse(localStorage.getItem(THR) || '{}'); } catch (e) { return {}; } }
  function noteTop(b, sum) {
    const t = thresholds();
    let changed = false;
    for (const [k, rows, f] of [[b, sum.top, v => v.t], [b + '#d', sum.dtop, v => v.d]]) {
      const vals = Object.values(rows || {});
      if (vals.length < TOP) continue;
      const low = Math.min(...vals.map(f));
      if ((t[k] || 0) < low) { t[k] = low; changed = true; }
    }
    if (!changed) return;
    // Sólo las tablas de los periodos de ahora (y las históricas).
    const cur = Object.values(boardIds());
    for (const k of Object.keys(t)) if (!cur.some(p => k.split('#')[0].split('_')[1] === p)) delete t[k];
    try { localStorage.setItem(THR, JSON.stringify(t)); } catch (e) { /* lleno */ }
  }

  // ---------------- guardar ----------------

  // Fila de otro jugador: todo limpio (ver G.U.int / str), sea lo que sea que haya en la base de datos.
  const rowOf = (id, v) => {
    const U = G.U; v = v || {};
    return { id: U.str(String(id), 200), t: U.int(v.t, 86400), d: U.int(v.d != null ? v.d : v.dmg, 1e15), uids: U.list(v.uids, 4).map(x => U.str(x, 128)),
             names: U.list(v.names, 4).map(x => U.str(x, 24)), dex: U.list(v.dex, 4).map(x => U.int(x, 2000)),
             shiny: U.list(v.shiny, 4).map(x => x === true), lv: U.int(v.lv, 999) || 1, kills: U.int(v.kills, 1e9) };
  };
  const sorted = top => Object.entries(top || {}).map(([id, v]) => rowOf(id, v)).sort((a, b) => b.t - a.t);
  const sortedD = dtop => Object.entries(dtop || {}).map(([id, v]) => rowOf(id, v)).sort((a, b) => b.d - a.d);
  // Filas del resumen: copia exacta de la marca (lo comprueba firestore.rules).
  // (Sin "shiny" si no hay ninguno: el resumen pesa menos.)
  const shinyOf = (e, row) => { if (e.shiny.some(Boolean)) row.shiny = e.shiny; return row; };
  const rowT = e => shinyOf(e, { t: e.t, uids: e.uids, names: e.names, dex: e.dex, lv: e.lv, kills: e.kills });
  const rowD = e => shinyOf(e, { d: e.dmg, uids: e.uids, names: e.names, dex: e.dex });
  /** El resumen tal cual se vuelve a escribir (sin perder la otra mitad). */
  const sumOut = (top, dtop, me, ev, dev) => (dtop && Object.keys(dtop).length ? { top, dtop, me, ev, dev: dev || '' } : { top, me, ev });
  const now = () => firebase.firestore.FieldValue.serverTimestamp();

  // ---------------- anti-trampas ----------------

  /*
   * Hasta el 20-10-2026, al empezar a jugar se apuntaba la hora en runs/{uid}
   * y ninguna marca podía durar más que el tiempo real desde entonces. Era lo
   * que más escribía en Firestore (1/3) y la regla lo leía en cada marca, para
   * una protección que se esquivaba esperando una vez: se quitó. Quedan nivel
   * y derrotados con sentido y el baneo (firestore.rules; el tope de 45 min se
   * quitó el 23-10-2026: en el minuto 35 Arceus rompe los objetos).
   */
  /** Al empezar a jugar: sube las marcas del histórico que esperaban (ver DEFER). */
  function runStarted() { flushDeferred(); }

  /*
   * Tu marca del histórico FUERA del top 50 (20-10-2026): nadie la ve, sólo
   * sirve para tu puesto exacto, que ya se mira cada 6 h (RANK_TTL). Así que se
   * sube como mucho cada DEFER; mientras, la mejor espera en el navegador y
   * sale al acabar o empezar otra partida pasado ese tiempo. Si entras en el
   * top 50 se sube al momento, como siempre.
   */
  const DEFER = 6 * 3600 * 1000, DEF = 'ps.rk.def';
  const defKey = () => DEF + '.' + (fbx() ? fbx().uid : '');
  function deferred() { try { return JSON.parse(localStorage.getItem(defKey()) || '{}'); } catch (e) { return {}; } }
  function saveDeferred(d) { try { localStorage.setItem(defKey(), JSON.stringify(d)); } catch (e) { /* lleno */ } }
  /** ¿Toca subirla ya (hace DEFER que no) o se deja esperando? → true si hay que subirla. */
  function dueOrDefer(b, id, entry) {
    const d = deferred(), k = b + ':' + id, up = (d[k] && d[k].up) || 0;
    if (Date.now() - up >= DEFER) { d[k] = { up: Date.now() }; saveDeferred(d); return true; }
    // (Si ya esperaba una mejor, se queda esa: 25-10-2026, una partida peor la sustituía.)
    d[k] = { up, e: d[k] && d[k].e && d[k].e.t >= entry.t ? d[k].e : entry }; saveDeferred(d);
    return false;
  }
  function flushDeferred() {
    const fb = fbx();
    if (!fb) return;
    const d = deferred();
    let changed = false;
    for (const [k, v] of Object.entries(d)) {
      if (!v || !v.e) { if (v && Date.now() - (v.up || 0) > DEFER) { delete d[k]; changed = true; } continue; }
      if (Date.now() - (v.up || 0) < DEFER) continue;
      const i = k.indexOf(':'), b = k.slice(0, i), id = k.slice(i + 1);
      d[k] = { up: Date.now() }; changed = true;
      // (Si ya hay una mejor en la nube, las reglas la rechazan: no pasa nada.)
      col(b).doc(id).set(Object.assign({}, v.e, { at: now() })).catch(() => {});
      mem.delete('r:' + b); try { localStorage.removeItem('ps.rk.c.r:' + b); } catch (e) { /* nada */ }
    }
    if (changed) saveDeferred(d);
  }
  /** Ya se ha subido por otro camino (entró en el top): nada que esperar. */
  function clearDeferred(b, id) {
    const d = deferred(), k = b + ':' + id;
    if (d[k] && d[k].e) { d[k] = { up: Date.now() }; saveDeferred(d); }
  }

  /** Guarda la entrada en cada tabla donde mejore (tiempo o daño). → periodos mejorados */
  async function store(boards, id, entry) {
    const fb = fbx();
    const better = [];
    const known = bests();
    const thr = thresholds();
    await Promise.all(boards.map(async ([b, period]) => {
      const key = b + ':' + id, dkey = key + '#d';
      try {
        const topOnly = TOP_ONLY.has(period);
        // Daño a Arceus: sólo en las tablas de periodo (no en las de cada Pokémon).
        const dmg = period === 'p' ? 0 : entry.dmg || 0;
        // Si no llegas a la 50.ª marca que conoce este navegador, no entras en
        // ese top 50 (en diario, semanal, mensual y por Pokémon, ni se lee nada).
        const thrT = thr[b] || 0, thrD = thr[b + '#d'] || 0;
        const cached = cacheGet('S:' + b);
        const canT = !thrT || entry.t > thrT || !!(cached && cached.top && id in cached.top);
        const canD = dmg > 0 && (!thrD || dmg > thrD || !!(cached && cached.dtop && id in cached.dtop));
        if (topOnly && !canT && !canD) return;
        // ¿Ya tenías una marca mejor? En el histórico, si este navegador no lo
        // sabe, se mira una vez tu marca (pequeña). En las demás lo dice la
        // marca, que se lee dentro de la transacción de abajo.
        if (known[key] === undefined && !topOnly) {
          const old = await col(b).doc(id).get();
          known[key] = old.exists ? old.data().t : 0;
          known[dkey] = old.exists ? old.data().dmg || 0 : 0;
        }
        const upT = entry.t > (known[key] || 0), upD = dmg > (known[dkey] || 0);
        if (!upT && !upD) return;
        const stamp = e => Object.assign({}, e, { at: firebase.firestore.FieldValue.serverTimestamp() });
        let waiting = false, wrote = false;
        if (!canT && !canD && !upT) {
          // Histórico fuera de los dos top 50 y sólo mejora el daño (#356: se perdía
          // si no mejorabas también el tiempo): se guarda ya, con el tiempo, nivel y
          // derrotados de la marca que tenías (así lo piden las reglas).
          const old = await col(b).doc(id).get(), o = old.exists ? old.data() : null;
          if (o && (o.dmg || 0) >= dmg) { known[dkey] = o.dmg; return; }
          await col(b).doc(id).set(stamp(Object.assign({}, entry, o && o.t > entry.t ? { t: o.t, lv: o.lv, kills: o.kills } : {})));
          wrote = true;
          // La marca de tiempo que espera para subir (DEFER) lleva ya este daño: si no, las reglas la rechazarían.
          const dd = deferred(), dk = b + ':' + id;
          if (dd[dk] && dd[dk].e) { dd[dk].e.dmg = Math.max(dd[dk].e.dmg || 0, dmg); saveDeferred(dd); }
        } else if (!canT && !canD) {
          // Histórico fuera de los dos top 50: tu puesto exacto por tiempo, como
          // mucho cada DEFER (ver arriba).
          const e = Object.assign({}, entry, { dmg: Math.max(dmg, known[dkey] || 0) });
          if (dueOrDefer(b, id, e)) { await col(b).doc(id).set(stamp(e)); wrote = true; } else waiting = true;
        } else {
          let newSum = null;
          await fb.fs.runTransaction(async tx => {
            const s = await tx.get(sumRef(b));
            const old = await tx.get(col(b).doc(id));
            const sd = s.exists ? s.data() : {};
            const top = Object.assign({}, sd.top || {}), dtop = Object.assign({}, sd.dtop || {});
            newSum = { top: sd.top || {}, dtop: sd.dtop || {} };
            const o = old.exists ? old.data() : null, ot = o ? o.t || 0 : 0, od = o ? o.dmg || 0 : 0;
            const bt = entry.t > ot, bd = dmg > od;
            // Ya tenías algo mejor (otro ordenador): nada que escribir.
            if (!bt && !bd) return;
            // La marca: lo mejor de cada cosa (nivel y derrotados, los del mejor tiempo).
            const e = Object.assign({}, entry, { dmg: Math.max(dmg, od) }, bt ? {} : { t: ot, lv: o.lv, kills: o.kills });
            let ev = '', dev = '', inT = false, inD = false;
            if (bt) {
              if (id in top || Object.keys(top).length < TOP) inT = true;
              else { const low = sorted(top).pop(); if (low.t < e.t) { ev = low.id; delete top[ev]; inT = true; } }
              if (inT) top[id] = rowT(e);
            }
            if (bd) {
              if (id in dtop || Object.keys(dtop).length < TOP) inD = true;
              else { const low = sortedD(dtop).pop(); if (low.d < e.dmg) { dev = low.id; delete dtop[dev]; inD = true; } }
              if (inD) dtop[id] = rowD(e);
            }
            // No entra en ningún top: en el histórico se guarda la marca (tu puesto); en los demás, nada.
            if (!inT && !inD) { if (!topOnly && bt) { tx.set(col(b).doc(id), stamp(e)); wrote = true; } return; }
            tx.set(col(b).doc(id), stamp(e));
            tx.set(sumRef(b), sumOut(top, dtop, id, ev, dev));
            newSum = { top, dtop };
            wrote = true;
          });
          if (newSum) { cacheSet('S:' + b, newSum); noteTop(b, newSum); }
          if (!topOnly && wrote) clearDeferred(b, id);
        }
        known[key] = Math.max(known[key] || 0, entry.t);
        known[dkey] = Math.max(known[dkey] || 0, dmg);
        if (!wrote && !waiting) return;
        if (b.startsWith('g_')) known[b + ':*'] = Math.max(known[b + ':*'] || 0, entry.t);
        // (Si la marca espera para subir, tu puesto en la nube aún no ha cambiado:
        // myRank enseña la que espera sin volver a leer nada.)
        if (!waiting) { mem.delete('r:' + b); try { localStorage.removeItem('ps.rk.c.r:' + b); } catch (e) { /* nada */ } }
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

  /*
   * Nivel, derrotados y daño a Arceus dentro de lo que aceptan las reglas (firestore.rules,
   * validEntry). Si se pasaban, el servidor rechazaba la marca ENTERA sin avisar
   * (25-10-2026: los mejores pasaban de 12 derrotados por segundo y su marca no
   * subía nunca). Así entra siempre; como mucho, con algún derrotado de menos.
   */
  function fit(r) {
    const t = Math.min(86400, Math.max(1, r.t | 0));
    // Daño a Arceus: sólo desde el minuto 30, hasta 50.000 por segundo de Sentencia.
    const dmg = t < 1800 ? 0 : Math.max(0, Math.min(Math.floor(r.dmg || 0), (t - 1799) * 50000));
    // rt: el tiempo de esta partida (t puede quedarse en el de una marca anterior mejor).
    return { t, rt: t, lv: Math.max(1, Math.min(r.lv | 0, 10 + Math.floor(t / 4))), kills: Math.max(0, Math.min(r.kills | 0, 100 + t * 12)), dmg };
  }

  /** Sin sello (#356): la partida no entra, y ahora se dice (antes, sin avisar). */
  function noSeal() { G.UI.toast('Esta partida no ha podido entrar en el ranking: no se pudo conectar con el servidor.', 4200); }

  function submitSolo(r) { return submitSoloNow(r); }
  async function submitSoloNow(r) {
    const fb = fbx();
    const sl = mySeal();
    if (!fb || !G.Social.me || r.t < MIN_T) return [];
    if (!sl) { noSeal(); return []; }
    flushDeferred();
    const ids = boardIds();
    const entry = Object.assign({ uids: [fb.uid], names: [G.Social.me.name], dex: [r.dex], shiny: [!!r.shiny], seal: [sl] }, fit(r));
    const boards = PERIODS.map(([p]) => ['s_' + ids[p], p]);
    if (r.t >= MIN_T_MON) boards.push(['s_' + ALL + '_p' + r.dex, 'p']);
    const better = await store(boards, fb.uid, entry);
    announce(better);
    return better;
  }

  /** La sube el anfitrión, con todo el equipo. */
  function submitGroup(r) { return submitGroupNow(r); }
  async function submitGroupNow(r) {
    const fb = fbx();
    if (!fb || r.t < MIN_T || !r.members || r.members.length < 2) return [];
    const ms = r.members.slice().sort((a, b) => (a.uid < b.uid ? -1 : 1));
    const id = ms.map(m => m.uid).join('_');
    // El sello de cada uno (el mío, de aquí; el de los demás, el que mandaron).
    const seals = ms.map(m => (m.uid === fb.uid ? mySeal() : okSeal(m.seal) ? { s: m.seal.s, g: m.seal.g } : null));
    if (seals.some(x => !x)) { noSeal(); return []; }
    const entry = Object.assign({ uids: ms.map(m => m.uid), names: ms.map(m => m.name), dex: ms.map(m => m.dex),
                    shiny: ms.map(m => !!m.shiny), seal: seals }, fit(r));
    const ids = boardIds();
    const boards = PERIODS.map(([p]) => ['g_' + ids[p], p]);
    if (r.t >= MIN_T_MON) for (const d of new Set(entry.dex)) boards.push(['g_' + ALL + '_p' + d, 'p']);
    const better = await store(boards, id, entry);
    announce(better);
    return better;
  }

  // ---------------- leer ----------------

  /** Los dos top 50 de una tabla, { top, dtop } (1 lectura, o 0 si se leyó hace menos de 2 h). */
  const inflight = new Map();             // tabla -> lectura en curso (las listas y tu puesto la comparten)
  async function sumOf(b) {
    const c = cacheGet('S:' + b);
    if (c !== undefined) return c;
    if (!inflight.has(b)) {
      inflight.set(b, sumRef(b).get().then(s => {
        const d = s.exists ? s.data() : {};
        const sum = { top: d.top || {}, dtop: d.dtop || {} };
        cacheSet('S:' + b, sum);
        noteTop(b, sum);
        return sum;
      }).finally(() => inflight.delete(b)));
    }
    return inflight.get(b);
  }

  /*
   * Lo que se enseña de una tabla: su resumen y, encima, lo que este navegador
   * ya tiene leído de las más cortas (sin leer nada más). Cada tabla se guarda
   * 2 h por su cuenta y el semanal podía enseñar marcas que el histórico (leído
   * antes) aún no tenía: no cuadraban (25-10-2026). Toda marca de hoy es también
   * de esta semana, de este mes y del histórico.
   */
  const WITHIN = { a: ['m', 'w', 'd'], m: ['d'], w: ['d'], d: [] };
  async function view(mode, period, dex) {
    const sum = await sumOf(board(mode, period, dex));
    if (dex) return sum;
    const top = Object.assign({}, sum.top), dtop = Object.assign({}, sum.dtop);
    for (const p of WITHIN[period] || []) {
      const c = cacheGet('S:' + board(mode, p));
      if (!c) continue;
      for (const [id, v] of Object.entries(c.top || {})) if (!top[id] || v.t > top[id].t) top[id] = v;
      for (const [id, v] of Object.entries(c.dtop || {})) if (!dtop[id] || v.d > dtop[id].d) dtop[id] = v;
    }
    return { top, dtop };
  }

  /** Tú y tus amigos con marca (como mucho 30). */
  async function circleOf(fb) {
    await G.Social.ensureFriends();          // (la lista de amigos ya no se carga al entrar)
    return [fb.uid, ...G.Social.friends.filter(f => f.status === 'ok').map(f => f.uid)].slice(0, 30);
  }

  /**
   * Daño a Arceus: el top 50 de una tabla (de la misma lectura que el de
   * tiempo) y tu puesto en él. No hay por Pokémon. → { rows, me: { pos, d } | { out } | null }
   */
  async function topDmg(mode, period, friendsOnly) {
    const fb = fbx();
    if (!fb) return { rows: [], me: null };
    let rows = sortedD((await view(mode, period)).dtop);
    const i = rows.findIndex(r => r.uids.includes(fb.uid));
    const me = !G.Social.me ? null : i >= 0 ? { pos: i + 1, d: rows[i].d } : { out: true };
    if (friendsOnly) {
      const circle = await circleOf(fb);
      rows = rows.filter(r => r.uids.some(u => circle.includes(u)));
      // Los amigos que no están en el top 50 de daño (#356: sólo salían los de ese
      // top). Sólo en el histórico, el único que guarda las demás marcas; son las
      // mismas que lee top() y se comparten (no se lee nada más).
      if (!TOP_ONLY.has(period)) {
        const extra = (await friendMarks(fb, mode, board(mode, period), circle)).filter(r => r.d > 0 && !rows.some(x => x.id === r.id));
        rows = rows.concat(extra).sort((a, c) => c.d - a.d);
      }
    }
    return { rows: rows.slice(0, TOP), me };
  }

  /** Las marcas de tus amigos (y la tuya) en una tabla del histórico. Se guardan 2 h. */
  async function friendMarks(fb, mode, b, circle) {
    const ck = 'f:' + b + ':' + circle.slice().sort().join(',');
    let extra = cacheGet(ck);
    if (extra === undefined) {
      if (mode === 's') {
        const docs = await Promise.all(circle.map(u => col(b).doc(u).get().catch(() => null)));
        extra = docs.filter(d => d && d.exists).map(d => rowOf(d.id, d.data()));
      } else {
        const s = await col(b).where('uids', 'array-contains-any', circle).get();
        extra = s.docs.map(d => rowOf(d.id, d.data()));
      }
      cacheSet(ck, extra);
    }
    return extra;
  }

  /**
   * Mejores marcas de una tabla.
   * @param friendsOnly  sólo tú y tus amigos
   */
  async function top(mode, period, dex, friendsOnly) {
    const fb = fbx();
    if (!fb) return [];
    const b = board(mode, period, dex);
    const rows = sorted((await view(mode, period, dex)).top);
    if (!friendsOnly) return rows.slice(0, TOP);
    const circle = await circleOf(fb);
    const inTop = rows.filter(r => r.uids.some(u => circle.includes(u)));
    // En diario, semanal, mensual y por Pokémon no hay marcas fuera del top 50.
    if (TOP_ONLY.has(period) || dex) return inTop;
    // Los amigos que no están en el top 50: se buscan aparte (y se guardan 2 h).
    const extra = await friendMarks(fb, mode, b, circle);
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
    const rows = sorted((await view(mode, period, dex)).top).slice(0, TOP);
    const i = rows.findIndex(r => r.uids.includes(fb.uid));
    if (i >= 0) return { pos: i + 1, t: rows[i].t, row: rows[i] };
    if (TOP_ONLY.has(period) || dex) return { out: true };
    const ck = 'r:' + b;
    // Tu marca que espera para subir (DEFER) es la buena: se enseña ya esa, sin
    // leer nada (el puesto, el de la última vez que se miró).
    const w = mode === 's' ? (deferred()[b + ':' + fb.uid] || {}).e : null;
    const c = cacheGet(ck);
    if (c !== undefined) return c && w && w.t > c.t ? Object.assign({}, c, { t: w.t, row: rowOf(fb.uid, w) }) : c;
    // Si este navegador ya sabe que no tienes marca en esta tabla, no se mira.
    const kb = bests(), mk = b + ':' + (mode === 's' ? fb.uid : '*');
    if (kb[mk] === 0) { cacheSet(ck, null); return null; }
    let mine = null;
    if (mode === 's') {
      const d = await col(b).doc(fb.uid).get();
      if (d.exists) mine = rowOf(d.id, d.data());
      if (w && (!mine || w.t > mine.t)) mine = rowOf(fb.uid, w);
    } else {
      const s = await col(b).where('uids', 'array-contains', fb.uid).get();
      for (const d of s.docs) { const r = rowOf(d.id, d.data()); if (!mine || r.t > mine.t) mine = r; }
    }
    // (Sin bajar lo que ya sabía este navegador: con la marca de la nube, más
    // vieja, la siguiente partida aunque fuera peor sustituía a la que esperaba.)
    kb[mk] = Math.max(kb[mk] || 0, mine ? mine.t : 0);
    saveBests(kb);
    let res = null;
    if (mine) { const above = await countAbove(b, mine.t); res = { pos: above + 1, capped: above >= RANK_CAP, t: mine.t, row: mine }; }
    cacheSet(ck, res);
    return res;
  }

  // Tope del recuento: un count() cobra 1 lectura por cada 1.000 marcas que cuenta
  // (en el histórico eran ~40 por consulta). Pasado el tope se enseña "#1000+".
  const RANK_CAP = 1000;
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
      aggregations: [{ alias: 'n', count: { upTo: String(RANK_CAP) } }] } };
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
    const ids = boardIds();
    const boards = new Set();
    for (const m of ['s', 'g']) for (const [p] of PERIODS) boards.add(m + '_' + ids[p]);
    for (const k of Object.keys(bests())) boards.add(k.split(':')[0]);
    // Una fila por escritura (las reglas sólo dejan quitar una cada vez): se
    // repite mientras quede alguna tuya (de tiempo o de daño).
    const once = b => fb.fs.runTransaction(async tx => {
      const s = await tx.get(sumRef(b));
      if (!s.exists) return false;
      const top = s.data().top || {}, dtop = s.data().dtop || {};
      for (const [id, v] of Object.entries(top)) {
        if (!(v.uids || []).includes(fb.uid)) continue;
        const next = Object.assign({}, top); delete next[id];
        tx.set(sumRef(b), sumOut(next, dtop, '', id, ''));
        return true;
      }
      for (const [id, v] of Object.entries(dtop)) {
        if (!(v.uids || []).includes(fb.uid)) continue;
        const next = Object.assign({}, dtop); delete next[id];
        tx.set(sumRef(b), Object.assign(sumOut(top, next, '', '', id), { dtop: next, dev: id }));
        return true;
      }
      return false;
    }).catch(() => false);
    await Promise.all([...boards].map(async b => { for (let i = 0; i < 8 && await once(b); i++) { /* otra */ } }));
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
      if (!by.has(k)) by.set(k, { board: G.U.str(v.board, 40), e: G.U.str(v.e, 160), names: G.U.list(v.names, 4).map(x => G.U.str(x, 24)),
                                  t: G.U.int(v.t, 86400), n: 0, ids: [], at: v.at && v.at.toMillis ? v.at.toMillis() : 0 });
      const g = by.get(k); g.n++; g.ids.push(d.id);
    }
    return [...by.values()].sort((a, b) => b.n - a.n || b.at - a.at);
  }

  /** Admin: la fila de una marca en un top 50 de su tabla (o null si ya no está). */
  async function entryInfo(b, e) {
    const sum = await sumOf(b);
    return sum.top[e] ? rowOf(e, sum.top[e]) : sum.dtop[e] ? rowOf(e, sum.dtop[e]) : null;
  }

  /** Admin: quita una marca de una tabla (la marca y sus filas de los dos top 50). */
  async function removeEntry(b, e) {
    const fb = fbx();
    await col(b).doc(e).delete().catch(() => {});
    await fb.fs.runTransaction(async tx => {
      const s = await tx.get(sumRef(b));
      const d = s.exists ? s.data() : {};
      const top = Object.assign({}, d.top || {}), dtop = Object.assign({}, d.dtop || {});
      if (!(e in top) && !(e in dtop)) return;
      delete top[e]; delete dtop[e];
      tx.set(sumRef(b), Object.assign(sumOut(top, dtop, '', e, e), d.dtop ? { dtop } : {}));
    }).catch(err => console.warn('[Ranking] quitar', b, err.code || err.message));
    mem.delete('S:' + b); try { localStorage.removeItem('ps.rk.c.S:' + b); } catch (err) { /* nada */ }
  }

  /** Admin: quita la marca de un jugador o equipo de todas las tablas de ahora (y de `also`). */
  async function removeEverywhere(e, mode, dexes = [], also = null) {
    const ids = boardIds();
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
        tx.set(d.ref, sumOut(cur, s.data().dtop, '', gone[0], ''));
      });
      await Promise.all(bad.map(id => fs.collection('lb').doc(d.id).collection('e').doc(id).delete().catch(() => {})));
      rows += bad.length; boards++;
      mem.delete('S:' + d.id); try { localStorage.removeItem('ps.rk.c.S:' + d.id); } catch (e) { /* nada */ }
    }
    // Las marcas del histórico que no están en el top 50 (sirven para el puesto exacto).
    for (const b of ['s_' + ALL, 'g_' + ALL]) {
      const q = await col(b).where('t', '>', maxT).get();
      await Promise.all(q.docs.map(e => e.ref.delete().catch(() => {})));
      rows += q.size;
    }
    return { rows, boards };
  }

  /** Admin: banea o desbanea una cuenta del ranking (baneada = no puede subir marcas). */
  function setMarked(uid, on) { return fbx().fs.collection('saves').doc(uid).update({ ban: !!on }); }
  /** Admin: borra reportes ya vistos. */
  function dismiss(ids) { return Promise.all(ids.map(id => fbx().fs.collection('reports').doc(id).delete().catch(() => {}))); }
  /** Admin: cuentas baneadas del ranking. */
  async function markedAccounts() {
    const s = await fbx().fs.collection('saves').where('ban', '==', true).limit(100).get();
    return s.docs.map(d => { const v = d.data().save || {}; return { uid: d.id, name: v.name || '?', coins: v.coins || 0,
      t1: (v.tickets || {}).t1 || 0, t10: (v.tickets || {}).t10 || 0, owned: Object.keys(v.owned || {}).length }; });
  }

  return { PERIODS, periodIds, board, runStarted, newSeal, mySeal, submitSolo, submitGroup, top, topDmg, myRank, removeMine,
           report, reported, isAdmin, reports, entryInfo, removeEntry, purgeAbove, removeEverywhere, setMarked, dismiss, markedAccounts };
})();
