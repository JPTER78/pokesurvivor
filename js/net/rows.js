/* ============ rows.js — enemigos del cooperativo, en compacto ============
 * Lo que más pesa de lo que manda el anfitrión (y de lo que pasa por el TURN
 * cuando una pareja no conecta directa) es la lista de enemigos: ~17 bytes por
 * enemigo, 15 veces por segundo y por invitado. A los invitados que lo
 * entienden (cv >= 2, ver coop.js) se les manda así (f.e2 en vez de f.e):
 *
 *   - Una sola lista plana de números (sin una lista dentro por enemigo).
 *   - Animación, dirección y estados en un solo número: a + 7·dir + 56·estados
 *     (casi siempre cabe en 1 byte; eran 3).
 *   - Fila corta si la vida y ese número no han cambiado desde la última fila
 *     que se le mandó a ese invitado: sólo el id y cuánto se ha movido desde
 *     entonces (casi siempre menos de 96: 1 byte por eje; la posición entera
 *     son 3). El canal es fiable y en orden, así que el invitado siempre tiene
 *     la anterior; y un enemigo que falta en un envío (se ha alejado, la
 *     grieta lo ha guardado...) se olvida y vuelve con una fila completa.
 *        completa  id+1,    x,  y, vida, aDirEst
 *        corta     -(id+1), dx, dy
 *   - Los enemigos lejos de lo que ve el invitado (fuera de cualquier pantalla,
 *     FAR) van uno de cada FAR_EVERY envíos: entre medias el invitado ya los
 *     mueve solo con su velocidad (enemy.netUpdate).
 *   - Cada KEY envíos, todas las filas completas y todos los enemigos.
 *
 * Sólo cambia cómo viaja: el invitado acaba con los mismos datos que antes.
 */
G.NetRows = (() => {
  const FAR = 640;            // la pantalla más ancha ve ~520 desde el centro
  const FAR_EVERY = 3;        // lejos: 5 veces por segundo en vez de 15
  const KEY = 15;             // todo completo una vez por segundo

  const packAd = (a, dir, st) => a + 7 * dir + 56 * st;

  /** Memoria del anfitrión para un invitado (lo último que se le mandó de cada enemigo). */
  function memo() { return { n: 0, last: new Map() }; }

  /**
   * Anfitrión: las filas de enemyList() ([id, x, y, vida, anim, dir, estados])
   * en compacto para un invitado que mira a `view`.
   */
  function encode(rows, view, m) {
    const key = m.n % KEY === 0, out = [], next = new Map(), far2 = FAR * FAR;
    for (const r of rows) {
      const id = r[0], ad = packAd(r[4], r[5], r[6]), was = m.last.get(id);
      const dx = r[1] - view.x, dy = r[2] - view.y;
      if (!key && was && dx * dx + dy * dy > far2 && (m.n + id) % FAR_EVERY !== 0) {
        next.set(id, was);                   // esta vez no va: el invitado lo mueve solo
        continue;
      }
      if (!key && was && was.hp === r[3] && was.ad === ad) out.push(-(id + 1), r[1] - was.x, r[2] - was.y);
      else out.push(id + 1, r[1], r[2], r[3], ad);
      next.set(id, { x: r[1], y: r[2], hp: r[3], ad });
    }
    m.last = next;
    m.n++;
    return out;
  }

  /**
   * Invitado: recorre la lista y llama a fn(id, x, y, vida, anim, dir, estados)
   * por enemigo. En las filas cortas llegan fn(id, dx, dy): lo que se ha movido
   * desde la última posición recibida, y vida y lo demás no han cambiado.
   * Lo que no tenga sentido se deja de leer.
   */
  function decode(flat, fn) {
    if (!Array.isArray(flat)) return;
    for (let i = 0; i < flat.length;) {
      const k = flat[i];
      if (typeof k !== 'number' || !Number.isInteger(k) || k === 0) return;
      if (k < 0) {
        if (i + 3 > flat.length) return;
        fn(-k - 1, flat[i + 1], flat[i + 2]);
        i += 3;
      } else {
        if (i + 5 > flat.length) return;
        const ad = flat[i + 4] | 0;
        fn(k - 1, flat[i + 1], flat[i + 2], flat[i + 3], ad % 7, Math.floor(ad / 7) % 8, Math.floor(ad / 56));
        i += 5;
      }
    }
  }

  return { memo, encode, decode, FAR, FAR_EVERY, KEY };
})();
