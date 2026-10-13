/* ============ hold.js — pausa del equipo (cartas, vínculos y objetos) ============
 *
 * Lógica pura, sin pantallas ni red (se prueba con tools/tests).
 *
 * En grupo, el ANFITRIÓN lleva una sola lista de "quién está eligiendo algo":
 *   lvl  la carta de la subida de nivel (barrera numerada con `seq`)
 *   own  un menú propio: qué objeto te quedas o qué movimientos fusionas
 * Mientras haya alguien en cualquiera de las dos, la partida está parada para
 * todos. Antes eran dos mecanismos sueltos (waiting/holds) que tocaban el
 * mismo estado y se pisaban (12-10-2026): al llegar las cartas con un objeto
 * a medio elegir, el menú desaparecía y la pausa se quedaba puesta para siempre.
 *
 * Por la red viaja como `w: [seq, máscara de cartas, máscara de menús]`, con un
 * bit por jugador según su orden en `members` (igual en todos los ordenadores).
 *
 * Y cada ordenador decide su estado con state(): una sola función con
 * prioridad fija, en vez de asignaciones repartidas por game.js.
 */
G.Hold = (() => {
  /** Anfitrión: quién está eligiendo. */
  function team() {
    const lvl = new Set(), own = new Set();
    let seq = 0;
    return {
      get seq() { return seq; },
      /** Abre la barrera de cartas para `uids`. Devuelve su número. */
      startLevel(uids) { seq++; lvl.clear(); for (const u of uids) lvl.add(u); return seq; },
      /** `u` ha elegido carta (de la barrera `s`; sin número = la de ahora). ¿Ha cambiado algo? */
      picked(u, s) { if (s != null && s !== seq) return false; return lvl.delete(u); },
      /** `u` abre (on) o cierra su menú propio. ¿Ha cambiado algo? */
      own(u, on) { const had = own.has(u); if (on) own.add(u); else own.delete(u); return had !== !!on; },
      /** `u` se ha ido: deja de contar. ¿Ha cambiado algo? */
      drop(u) { const a = lvl.delete(u), b = own.delete(u); return a || b; },
      get leveling() { return lvl.size > 0; },
      get busy() { return lvl.size > 0 || own.size > 0; },
      waiting() { return [...lvl]; },
      choosing() { return [...own]; },
      /** Todos los que tienen algo pendiente, sin repetir. */
      everyone() { return [...new Set([...lvl, ...own])]; },
      /** Para la trama: null si no hay pausa (así no cuesta nada mientras se juega). */
      pack(order) { return lvl.size || own.size ? [seq, mask(lvl, order), mask(own, order)] : null; }
    };
  }

  function mask(set, order) {
    let m = 0;
    order.forEach((u, i) => { if (set.has(u)) m |= 1 << i; });
    return m;
  }

  /** Los uids de una máscara. */
  function unmask(m, order) { return order.filter((u, i) => m & (1 << i)); }

  /**
   * Estado del bucle. Prioridad: fin de partida > cartas de nivel (eligiendo o
   * esperando a los demás) > tu menú (objeto / vínculo) > esperando a otros
   * (o al anfitrión, que no está) > pausa de solitario > jugando.
   * @param s  { over, cards, menu, team, away, paused }
   */
  function state(s) {
    if (s.over) return 'over';
    if (s.cards) return 'levelup';
    if (s.menu) return 'choice';
    if (s.team || s.away) return 'held';
    if (s.paused) return 'paused';
    return 'playing';
  }

  return { team, unmask, state };
})();
