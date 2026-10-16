/* ============ recount.js — medidor de daño ============
 * El daño se cuenta en la ruta del golpe que ya existe (combat.js), en la
 * propia instancia del movimiento: m.dealt (+ pl.dealtOther para objetos como
 * el Casco Dentado). Aquí sólo se leen esos contadores.
 *
 * Quemadura y veneno: el enemigo recuerda quién y con qué movimiento (enemy.js)
 * y en cada tick llama a dot(). Si fue un invitado, el anfitrión lo guarda y se
 * lo manda en su siguiente envío (f.dd, coop.js), que lo suma con addDot().
 *
 * En cooperativo cada uno manda su total en su estado (myState()[15] → net.dm).
 */
G.Recount = (() => {
  let me = null;            // jugador local de la run
  let pend = {};            // anfitrión: uid → { id de movimiento: daño } de quemadura/veneno
  let frozen = null;        // tabla del grupo guardada al cerrar el coop (ver freeze)

  function reset(pl) { me = pl; pend = {}; frozen = null; }

  function myTotal() {
    if (!me) return 0;
    let s = me.dealtOther || 0;
    for (const m of me.moves) s += m.dealt || 0;
    return s;
  }

  function credit(mid, d) {
    for (const m of me.moves) if (m.id === mid) { m.dealt += d; return; }
  }

  function dot(by, mid, d) {
    if (!mid || !me) return;
    if (by == null) { credit(mid, d); return; }
    const p = pend[by] || (pend[by] = {});
    p[mid] = (p[mid] || 0) + d;
  }

  function takePending(uid) {
    const p = pend[uid];
    if (!p) return null;
    delete pend[uid];
    return p;
  }

  function addDot(map) {
    if (!map || !me) return;
    for (const mid in map) credit(mid, map[mid]);
  }

  function rows() {
    if (!me) return [];
    const total = myTotal(), out = [];
    if (!total) return out;
    for (const m of me.moves) if (m.dealt > 0) out.push({ id: m.id, name: m.name, type: m.type, dealt: m.dealt, pct: m.dealt / total });
    if (me.dealtOther > 0) out.push({ id: null, name: 'Objetos', type: null, dealt: me.dealtOther, pct: me.dealtOther / total });
    return out.sort((a, b) => b.dealt - a.dealt);
  }

  function team() {
    const out = [{ uid: me && me.uid, name: G.Social.me ? G.Social.me.name : 'Tú', color: me && me.tagColor || '#fff', dealt: myTotal(), me: true }];
    for (const m of G.Coop.mates) {
      out.push({ uid: m.uid, name: m.name, color: m.color, dealt: (m.pl && m.pl.net && m.pl.net.dm) || 0, me: false });
    }
    const total = out.reduce((s, r) => s + r.dealt, 0);
    for (const r of out) r.pct = total ? r.dealt / total : 0;
    return out.sort((a, b) => b.dealt - a.dealt);
  }

  function dps(time) { return time > 0 ? myTotal() / time : 0; }

  /** Lo llama G.Coop.end(): la partida en grupo se cierra antes de llegar a la pantalla final. */
  function freeze() { if (G.Coop.active) frozen = team(); }

  function snapshot(time) {
    return { total: myTotal(), dps: dps(time), rows: rows(), team: frozen || (G.Coop.active ? team() : null) };
  }

  /** 950 · 12,3k · 1,2M (con punto en inglés). */
  function fmt(n) {
    const dec = s => G.I18n.lang === 'en' ? s : s.replace('.', ',');
    if (n < 1000) return String(Math.round(n));
    if (n < 1e6) return dec((n / 1e3).toFixed(1)) + 'k';
    return dec((n / 1e6).toFixed(1)) + 'M';
  }

  return { reset, myTotal, rows, team, dps, dot, takePending, addDot, freeze, snapshot, fmt };
})();
