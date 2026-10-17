/* ============ evo.js — evolucionar en la run ============
 * Las formas canónicas las trae js/data/evolutions.js (G.EVO, generado).
 * Aquí están las reglas del juego: a qué nivel de la RUN toca evolucionar, si
 * la forma siguiente está desbloqueada y qué se le enseña al jugador.
 *
 * Decisiones del dueño (16-10-2026):
 *   - Solo cadenas lineales: si la especie ramifica (Eevee y cia.), no se
 *     evoluciona nunca.
 *   - Hace falta tener DESBLOQUEADA la forma siguiente. Si no, te quedas como
 *     estabas (pero te avisamos de por qué).
 *   - El nivel es el canónico de los juegos, tal cual: Charmander evoluciona al
 *     16 y su siguiente al 36, como en los juegos.
 *   - No desbloquea nada en la colección: solo vale para esta partida.
 */
G.Evo = (() => {

  // Las evoluciones que no son por nivel (piedras, amistad, intercambio...) no
  // traen número: se les pone una reserva, para que también se puedan hacer.
  const RESERVA = 20;

  /** Nivel de la run al que toca evolucionar (el canónico, o la reserva). */
  function levelFor(e) {
    if (e.how === 'level' && e.lvl) return e.lvl;
    return RESERVA;
  }

  /**
   * La forma siguiente canónica, o null si no hay nada que hacer:
   * no evoluciona, ramifica, o la forma no está en el juego (sin sprite).
   * @return { to, lvl, how }  lvl es el nivel de la run
   */
  function next(dex) {
    const list = (G.EVO && G.EVO[dex]) || null;
    if (!list || list.length !== 1) return null;      // ramificada: no se toca
    const e = list[0];
    return G.DEX_BY[e.to] ? { to: e.to, lvl: levelFor(e), how: e.how } : null;
  }

  /**
   * Qué le pasa a este jugador con la evolución.
   * @param pl    jugador en curso
   * @param owns  (dex) => ¿desbloqueado? Por defecto G.DB.owns (se inyecta en
   *              las pruebas para poder jugar con datos falsos)
   * @return null si no hay evolución, o:
   *   { to, from, lvl, name, fromName, levelDone, ready, locked }
   *   ready    hay nivel y está desbloqueada → sale la carta dorada
   *   locked   hay nivel pero NO está desbloqueada → solo el aviso
   */
  function info(pl, owns) {
    if (!pl) return null;
    const n = next(pl.dex);
    if (!n) return null;
    const has = owns || (d => G.DB.owns(d));
    const levelDone = pl.level >= n.lvl;
    const unlocked = has(n.to);
    const mine = G.DEX_BY[pl.dex], theirs = G.DEX_BY[n.to];
    return {
      to: n.to, from: pl.dex, lvl: n.lvl, how: n.how,
      name: (theirs && theirs.name) || '',
      fromName: (mine && mine.name) || '',
      levelDone,
      ready: levelDone && unlocked,
      locked: levelDone && !unlocked
    };
  }

  return { next, levelFor, info, RESERVA };
})();
