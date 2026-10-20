/* ============ layouts.js — cómo se genera el terreno de cada bioma ============
 *
 * Cada bioma de la run tiene su forma de terreno, no sólo sus colores
 * (inspirado en Mundo Misterioso):
 *   plains  campo abierto con charcas y rocas (lo de siempre)
 *   cave    cueva de salas rectangulares al azar (se pisan) y pasillos rectos
 *   islands islas grandes y pequeñas unidas por puentes cortos, islotes de paso o vados
 *   bog     las mismas islas, todo unido por puentes (el pantano venenoso: nada de vadear)
 *   marsh   pantano: ríos de agua que frena, más que los de lava
 *   plant   la cueva con las charcas lejos de las paredes (para la central: su líquido quema)
 *   lava    ríos de lava serpenteantes con puentes de piedra
 *
 * Cada uno se hace con su ancla { tx, ty } (make): el sitio donde empieza, que
 * es parte de sus reglas, no un hueco a la fuerza: la sala, la isla o el trozo
 * de tierra del principio están ahí, unidos a los demás como cualquier otro
 * (al empezar la run, el 0,0; al cambiar de bioma, donde está el jugador). Y un
 * claro de 9 casillas alrededor.
 * Todo es determinista (sólo depende de la casilla y la semilla), así en
 * cooperativo cada uno genera el mismo mapa. world.js decide qué generador
 * va en cada casilla (y el cambio de uno a otro con la onda del bioma).
 *
 *   terrain(tx, ty, seed)  0 suelo · 1 pared · 2 líquido
 *   edgeProp(tx, ty, seed, at?) objeto que el generador pone en esta casilla
 *                          de suelo (`at(tx, ty)` da el terreno ya calculado):
 *                          'tree' (sólido), 'grass' (no bloquea) o null
 *                          (en la cueva, los cristales del borde de las paredes)
 *   liquidHurts            su líquido hace daño (en el juego lo decide la
 *                          paleta del bioma; aquí, para las pruebas)
 *
 * Pasillos y puentes dejan al menos 4 casillas
 * libres (cabe el Pokémon más grande, 104 px) y no quedan zonas cerradas
 * (tests/worldgen.test.cjs). world.js no pone objetos sólidos al azar donde
 * no haya sitio de sobra (ver placeProps).
 */
G.Layouts = (() => {
  const FLOOR = 0, WALL = 1, LIQUID = 2;
  const H = (x, y, s) => G.U.hash(x, y, s);

  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = H(xi, yi, s), b = H(xi + 1, yi, s), c = H(xi, yi + 1, s), d = H(xi + 1, yi + 1, s);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.65 + vnoise(x * 2.13 + 17, y * 2.13 - 9, s + 1) * 0.35;

  /**
   * Lo de cada punto de la rejilla (centro, tamaño...) se calcula una vez y se
   * guarda: cada casilla mira las 9 celdas de alrededor, y un chunk son 256.
   * Una caché por semilla (hasta SEEDS a la vez), con tope (se vacía entera al llenarse).
   */
  const SEEDS = 4;
  function cellCache(make, max = 4096) {
    const bySeed = new Map();
    return (i, j, s) => {
      let map = bySeed.get(s);
      if (!map || map.size > max) {
        if (!map && bySeed.size >= SEEDS) bySeed.delete(bySeed.keys().next().value);
        map = new Map();
        bySeed.set(s, map);
      }
      const k = (i + 32768) * 65536 + (j + 32768);
      let c = map.get(k);
      if (!c) { c = make(i, j, s); map.set(k, c); }
      return c;
    };
  }

  /** Cuántas de sus 8 vecinas son pared. */
  function wallsAround(at, tx, ty) {
    let n = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      if ((a || b) && at(tx + a, ty + b) === WALL) n++;
    }
    return n;
  }

  /**
   * Adornos del borde: árbol (o cristal, o tronco seco: lo dibuja el bioma) en
   * los rincones con CORNER o más paredes alrededor, y hierba alta con
   * probabilidad `grass` en el resto del borde.
   */
  const CORNER = 5;
  function edgeProps(lay, grass) {
    return (tx, ty, seed, at = (x, y) => lay.terrain(x, y, seed)) => {
      if (at(tx, ty) !== FLOOR) return null;
      const n = wallsAround(at, tx, ty);
      if (n >= CORNER) return 'tree';
      return n > 0 && H(tx, ty, seed + 1301) < grass ? 'grass' : null;
    };
  }

  // ---------------- campo abierto (el de siempre) ----------------

  const plainsAt = A => ({
    liquidHurts: false,
    terrain(tx, ty, seed) {
      const d = Math.hypot(tx - A.tx, ty - A.ty);
      if (d < 9) return FLOOR;                          // claro inicial
      const ramp = G.U.clamp((d - 9) / 8, 0, 1);       // aparición suave
      if (fbm(tx / 13, ty / 13, seed + 101) < 0.04 + 0.23 * ramp) return LIQUID;
      if (fbm(tx / 8, ty / 8, seed + 202) > 1 - 0.27 * ramp) return WALL;
      return FLOOR;
    },
    edgeProp: () => null
  });

  // ---------------- salas y pasillos: la cueva ----------------
  /*
   * Como el plano de una mazmorra: salas rectangulares de tamaño y forma al azar
   * (de cuadradas a alargadas), repartidas sin rejilla a la vista (cada celda de
   * `cell` casillas tiene una con `keep`, en cualquier punto) y que a veces se
   * pisan, así salen espacios irregulares en L, en T, escalonados...
   * Se unen con pasillos de `w` = [mín, máx] de ancho (cada uno el suyo): recto
   * si las dos salas se miran de frente (sus lados se solapan lo bastante), en L si no.
   * Qué salas se unen: el grafo de vecindad relativa de sus centros (dos se unen
   * si no hay una tercera más cerca de las dos que ellas entre sí). Ese grafo las
   * une todas (contiene el árbol de expansión mínimo) y da callejones y cruces en
   * T; con `loop`, algunas uniones más del grafo de Gabriel cierran vueltas.
   * Lo de fuera es `outside` (la roca), y sus bordes no son rectos: con ruido, el
   * suelo se come hasta `grow` (salas) o `growH` (pasillos) casillas, a trozos.
   * Sólo crece, nunca encoge: los pasillos siguen teniendo su ancho mínimo libre
   * y nada se cierra.
   *   inside(tx, ty, r, seed, edge)  qué hay dentro de una sala (a `edge` del borde)
   *   wetHalls  las charcas de dentro tapan también los pasillos (si su líquido no quema)
   */
  const ROOM_REACH = 3, ROOM_BLOCK = 16;
  const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  /** Rectángulo de casillas (inclusivo). */
  const box = (x0, y0, x1, y1) => ({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) });

  function rooms(o) {
    const S = o.salt, A = o.anchor, ai = Math.floor(A.tx / o.cell), aj = Math.floor(A.ty / o.cell);

    /** Sala de la celda (i, j), o null. Centro y medio ancho/alto en casillas enteras. La del principio, en el ancla. */
    const room = cellCache((i, j, s) => {
      if (i === ai && j === aj) return { i, j, x: A.tx, y: A.ty, hw: 7, hh: 6, start: true, k: 1 };
      if (H(i, j, s + S + 1) > o.keep) return null;
      const r = o.size[0] + H(i, j, s + S + 2) * (o.size[1] - o.size[0]);
      const asp = Math.pow(o.aspect, H(i, j, s + S + 3) * 2 - 1);
      return { i, j, x: Math.floor((i + 0.1 + H(i, j, s + S + 4) * 0.8) * o.cell), y: Math.floor((j + 0.1 + H(i, j, s + S + 5) * 0.8) * o.cell),
               hw: Math.max(2, Math.round(r * asp)), hh: Math.max(2, Math.round(r / asp)), start: false, k: H(i, j, s + S + 6) };
    });

    function around(i, j, k, s) {
      const out = [];
      for (let b = j - k; b <= j + k; b++) for (let a = i - k; a <= i + k; a++) {
        const q = room(a, b, s);
        if (q) out.push(q);
      }
      return out;
    }

    /**
     * Pasillo de la sala a a la b: recto si se miran de frente (de centro a
     * centro, a una altura o columna al azar de la parte que comparten), en L si
     * no (por la esquina de un lado o del otro, al azar).
     */
    function corridor(a, b, k, s) {
      // Su ancho (al azar entre los de `w`); en el eje c ocupa [c-LO, c-LO+W-1].
      const W = o.w[0] + Math.floor(H(k, 11, s + S + 10) * (o.w[1] - o.w[0] + 1)), LO = Math.floor(W / 2);
      const ox0 = Math.max(a.x - a.hw, b.x - b.hw) + 1, ox1 = Math.min(a.x + a.hw, b.x + b.hw) - 1;
      const oy0 = Math.max(a.y - a.hh, b.y - b.hh) + 1, oy1 = Math.min(a.y + a.hh, b.y + b.hh) - 1;
      const pick = (lo, hi) => lo + Math.floor(H(k, 5, s + S + 7) * (hi - lo + 1));
      if (ox1 - ox0 + 1 >= W) {                                 // uno encima del otro: vertical
        const x = pick(ox0, ox1 - W + 1);
        return [box(x, a.y, x + W - 1, b.y)];
      }
      if (oy1 - oy0 + 1 >= W) {                                 // uno al lado del otro: horizontal
        const y = pick(oy0, oy1 - W + 1);
        return [box(a.x, y, b.x, y + W - 1)];
      }
      // En L: horizontal desde una y vertical hasta la otra. La esquina, una casilla
      // más por fuera: si le sale un adorno en el rincón, sigue cabiendo W.
      const [p, q] = H(k, 6, s + S + 8) < 0.5 ? [a, b] : [b, a];
      const ex = q.x > p.x ? 1 : -1, ey = q.y > p.y ? -1 : 1;  // hacia fuera de la esquina
      const h = box(p.x - LO, p.y - LO, q.x - LO + W - 1, p.y - LO + W - 1);
      const v = box(q.x - LO, p.y - LO, q.x - LO + W - 1, q.y - LO + W - 1);
      const c = box(q.x - LO, p.y - LO, q.x - LO + W - 1, p.y - LO + W - 1);
      return [h, v, box(c.x0 + Math.min(0, ex), c.y0 + Math.min(0, ey), c.x1 + Math.max(0, ex), c.y1 + Math.max(0, ey))];
    }

    /** Pasillos que salen de la sala de la celda hacia salas de celdas "mayores" (así cada uno se guarda una vez). */
    const edges = cellCache((i, j, s) => {
      const p = room(i, j, s);
      if (!p) return [];
      const near = around(i, j, ROOM_REACH + 1, s);
      const out = [];
      for (const q of near) {
        if (q.j < j || (q.j === j && q.i <= i)) continue;
        if (Math.abs(q.i - i) > ROOM_REACH || Math.abs(q.j - j) > ROOM_REACH) continue;
        const pq = d2(p, q);
        let rng = true, gabriel = true;
        for (const r of near) {
          if (r === p || r === q) continue;
          const da = d2(p, r), db = d2(q, r);
          if (da + db < pq) { gabriel = false; rng = false; break; }  // dentro del círculo de diámetro pq
          if (da < pq && db < pq) rng = false;                         // dentro de la "luna"
        }
        const k = (i * 73856093) ^ (j * 19349663) ^ (q.i * 83492791) ^ (q.j * 2971215073);
        if (rng || (gabriel && H(k, 3, s + S + 9) < o.loop)) out.push(...corridor(p, q, k, s));
      }
      return out;
    }, 2048);

    /** Lo que puede tocar un bloque de ROOM_BLOCK casillas (un chunk de world.js): sus salas y sus pasillos. */
    const block = cellCache((bi, bj, s) => {
      const B = ROOM_BLOCK, x0 = bi * B, y0 = bj * B, x1 = x0 + B - 1, y1 = y0 + B - 1;
      const reach = ROOM_REACH + 1, g = o.grow, gh = o.growH;
      const rs = [], halls = [];
      for (let j = Math.floor(y0 / o.cell) - reach; j <= Math.floor(y1 / o.cell) + reach; j++) {
        for (let i = Math.floor(x0 / o.cell) - reach; i <= Math.floor(x1 / o.cell) + reach; i++) {
          const r = room(i, j, s);
          if (r && r.x + r.hw + g >= x0 && r.x - r.hw - g <= x1 && r.y + r.hh + g >= y0 && r.y - r.hh - g <= y1) rs.push(r);
          for (const h of edges(i, j, s)) if (h.x1 + gh >= x0 && h.x0 - gh <= x1 && h.y1 + gh >= y0 && h.y0 - gh <= y1) halls.push(h);
        }
      }
      return { rooms: rs, halls };
    });

    /**
     * Una pasada final, por bloques (un chunk de world.js): las rendijas de una
     * casilla (suelo entre dos paredes, de frente) se cierran: parecen un paso y
     * no cabe nadie. Los pasillos (de 4+) no tienen ninguna casilla así: nada se
     * corta. Varias pasadas (al cerrar una rendija puede quedar otra al lado):
     * el terreno de antes, una vez por casilla con un borde de PASSES, y el
     * resultado guardado.
     */
    const SB = ROOM_BLOCK, PASSES = 3;
    function closeSlits(g, n) {
      const m = n - 2, out = new Uint8Array(m * m);
      const at = (i, j) => g[j * n + i];
      for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
        const t = at(i, j);
        const slit = t !== WALL && ((at(i - 1, j) === WALL && at(i + 1, j) === WALL) || (at(i, j - 1) === WALL && at(i, j + 1) === WALL));
        out[(j - 1) * m + i - 1] = slit ? WALL : t;
      }
      return out;
    }
    const finalBlock = cellCache((bi, bj, seed) => {
      const n = SB + 2 * PASSES, x0 = bi * SB - PASSES, y0 = bj * SB - PASSES;
      let g = new Uint8Array(n * n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) g[j * n + i] = roughTile(x0 + i, y0 + j, seed);
      for (let k = 0; k < PASSES; k++) g = closeSlits(g, n - 2 * k);
      return g;
    }, 1024);

    /** Dentro de una sala o de un pasillo, con el borde a trozos (la roca). */
    function roughTile(tx, ty, seed) {
      const blk = block(Math.floor(tx / ROOM_BLOCK), Math.floor(ty / ROOM_BLOCK), seed);
      // Cuánto de fuera se come el suelo aquí: manchas de ruido y, encima, algún mordisco suelto.
      const n = fbm(tx / 3.2, ty / 3.2, seed + S + 40) + (H(tx, ty, seed + S + 41) < 0.18 ? 0.35 : 0);
      const grow = Math.min(o.grow, Math.floor(n * (o.grow + 1)));
      const growH = Math.min(o.growH, Math.floor(n * (o.growH + 1)));
      const inRoom = r => Math.abs(tx - r.x) <= r.hw + grow && Math.abs(ty - r.y) <= r.hh + grow;
      const inner = r => o.inside(tx, ty, r, seed, Math.min(r.hw - Math.abs(tx - r.x), r.hh - Math.abs(ty - r.y)));
      // Con `wetHalls`, las charcas de las salas tapan también los pasillos que las cruzan (se vadean).
      if (o.wetHalls) for (const r of blk.rooms) if (!r.start && inRoom(r) && inner(r) === LIQUID) return LIQUID;
      // Los pasillos llegan hasta el centro de sus salas: por donde pasan, nada de lo de dentro.
      for (const h of blk.halls) {
        if (tx >= h.x0 - growH && tx <= h.x1 + growH && ty >= h.y0 - growH && ty <= h.y1 + growH) return FLOOR;
      }
      for (const r of blk.rooms) {
        if (!inRoom(r)) continue;
        return r.start ? FLOOR : inner(r);
      }
      return o.outside;
    }

    return {
      liquidHurts: false,
      terrain(tx, ty, seed) {
        const bi = Math.floor(tx / SB), bj = Math.floor(ty / SB);
        return finalBlock(bi, bj, seed)[(ty - bj * SB) * SB + (tx - bi * SB)];
      }
    };
  }

  /*
   * Cueva: salas de roca con pasillos de 4. Dentro, lejos de las paredes,
   * grupos de estalagmitas y, en tres de cada cuatro salas, una o dos charcas
   * pequeñas (los pasillos las cruzan: hacen de pasarela). Cristales en los rincones.
   *   ring  suelo libre entre las charcas y las paredes
   *   wet   las charcas tapan los pasillos (se vadean)
   *   pond  { n: cuántas por sala como mucho, r: [radio mín, máx] }
   * Con agua (se vadea), las charcas pisan los pasillos. Si el líquido quema (la
   * central eléctrica), los pasillos quedan secos: se cruza siempre en seco.
   */
  function caveOf(anchor, ring, wet, pond = { n: 2, r: [1.6, 3.6] }) {
    const lay = rooms({
      anchor, salt: 2100, cell: 18, keep: 0.72, loop: 0.3, w: [4, 6], grow: 2, growH: 1, size: [3, 6.5], aspect: 1.9, outside: WALL, wetHalls: wet,
      inside(tx, ty, r, seed, edge) {
        if (edge < Math.min(2, ring)) return FLOOR;                // anillo libre junto a las paredes
        if (r.k < 0.75 && edge >= ring) {
          const n = 1 + Math.floor(H(r.i, r.j, seed + 2135) * pond.n);
          const wob = 0.8 + 0.4 * fbm(tx / 2.5, ty / 2.5, seed + 2132);
          for (let c = 0; c < n; c++) {
            // Del tamaño que quepa en la sala (con `ring` hasta las paredes), y al menos de 1,2.
            const pr = Math.min(Math.min(r.hw, r.hh) - ring, pond.r[0] + H(r.i + c * 7, r.j, seed + 2136) * (pond.r[1] - pond.r[0]));
            if (pr < 1.2) continue;
            const rx = r.hw - ring - pr, ry = r.hh - ring - pr;     // cuánto se puede mover sin salir de su sitio
            const px = r.x + (H(r.i + c * 7, r.j, seed + 2133) - 0.5) * 2 * rx;
            const py = r.y + (H(r.i + c * 7, r.j, seed + 2134) - 0.5) * 2 * ry;
            if (Math.hypot(tx - px, ty - py) < pr * wob) return LIQUID;
          }
        }
        if (edge >= 3 && fbm(tx / 2.2, ty / 2.2, seed + 2131) > 0.8) return WALL;   // estalagmitas
        return FLOOR;
      }
    });
    lay.edgeProp = edgeProps(lay, 0.12);
    return lay;
  }
  const cave = A => caveOf(A, 2, true);
  /**
   * La misma cueva con los pasillos secos, para cuando su líquido quema (la
   * central: descarga). Charcas grandes y hasta tres por sala, hasta casi la
   * pared: a veces hay que rodearlas, pero los pasillos las cruzan en seco.
   */
  const plant = A => caveOf(A, 1, false, { n: 3, r: [2.2, 4.2] });

  // ---------------- islas ----------------
  /*
   * Islas grandes y pequeñas (elipses de tamaño, forma y giro al azar, que a veces
   * se pisan) en el agua, con la orilla suave. Cada celda de `cell` casillas tiene
   * una (con `keep`), en cualquier punto de ella; una de cada tantas (`big`),
   * grande (y alguna, enorme: más que la celda; se pisa con las vecinas).
   * Qué islas se unen: el grafo de vecindad relativa de sus centros (dos se unen
   * si no hay una tercera más cerca de las dos que ellas entre sí), que las une
   * todas. Para cada par, el agua que las separa en la recta entre sus centros:
   *   hasta `wade` casillas    nada: se vadea
   *   hasta `maxBridge`        un puente corto y recto de orilla a orilla (`bridge`
   *                            de ancho), o (con `stones`) uno o dos islotes de
   *                            paso, con 1–2 casillas de agua entre uno y otro
   *   más                      uno o dos islotes de paso, más grandes cuanto más
   *                            lejos (un puente así de largo parecería un pasillo);
   *                            sin `stones`, un puente igualmente
   * Así siempre se llega a todas partes andando o vadeando como mucho dos casillas.
   * Con wade = 0 y stones = 0 (el pantano venenoso), todo se une por tierra.
   */
  const ISLE_BLOCK = 16;
  function archipelago(o) {
    const S = o.salt, C = o.cell, A = o.anchor, ai = Math.floor(A.tx / C), aj = Math.floor(A.ty / C);
    /** Isla de la celda (i, j), o null: centro, semiejes y giro. La del principio, grande y en el ancla. */
    const isle = cellCache((i, j, s) => {
      if (i === ai && j === aj) return { i, j, x: A.tx + 0.5, y: A.ty + 0.5, rx: 9, ry: 8, c: 1, sn: 0 };
      if (H(i, j, s + S + 1) > o.keep) return null;
      // Grandes (de vez en cuando, enormes: el tamaño va al cuadrado) o pequeñas.
      const big = H(i, j, s + S + 2) < o.big, [r0, r1] = big ? o.bigR : o.smallR;
      const h = H(i, j, s + S + 3), r = r0 + (big ? h * h : h) * (r1 - r0);
      const asp = Math.pow(o.aspect, H(i, j, s + S + 4) * 2 - 1);
      const th = H(i, j, s + S + 5) * Math.PI;
      return { i, j, x: (i + 0.1 + H(i, j, s + S + 6) * 0.8) * C, y: (j + 0.1 + H(i, j, s + S + 7) * 0.8) * C,
               rx: r * asp, ry: r / asp, c: Math.cos(th), sn: Math.sin(th) };
    });
    /** Radio de la isla en la dirección (ux, uy). */
    const radius = (a, ux, uy) => {
      const u = (ux * a.c + uy * a.sn) / a.rx, v = (-ux * a.sn + uy * a.c) / a.ry;
      return 1 / Math.sqrt(u * u + v * v);
    };
    /** Cuánto le falta a (x, y) para entrar en la isla (≤ 0 dentro): a lo largo del radio. */
    function outside(a, x, y) {
      const dx = x - a.x, dy = y - a.y, d = Math.hypot(dx, dy);
      return d < 1e-6 ? -Math.min(a.rx, a.ry) : d - radius(a, dx / d, dy / d);
    }

    function around(i, j, k, s) {
      const out = [];
      for (let b = j - k; b <= j + k; b++) for (let a = i - k; a <= i + k; a++) {
        const q = isle(a, b, s);
        if (q) out.push(q);
      }
      return out;
    }

    /**
     * Lo que une a dos islas vecinas (de orilla a orilla en la recta entre sus
     * centros): nada, un puente { ax, ay, bx, by, half } o islotes { stones: [x, y, r]... }.
     */
    function link(a, b, k, s) {
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
      const ra = radius(a, ux, uy), rb = radius(b, -ux, -uy), gap = d - ra - rb;
      if (gap <= o.wade) return null;
      // Las dos orillas (una casilla hacia dentro, para que el puente empiece en tierra).
      const ax = a.x + ux * (ra - 1), ay = a.y + uy * (ra - 1), bx = b.x - ux * (rb - 1), by = b.y - uy * (rb - 1);
      // Puente sólo si es corto (más largo parecería un pasillo): si no, islotes.
      if (!(o.stones && (gap > o.maxBridge || H(k, 21, s + S + 21) < o.stones))) {
        const half = (o.bridge[0] + H(k, 22, s + S + 22) * (o.bridge[1] - o.bridge[0])) / 2;
        return box({ ax, ay, bx, by, half }, Math.min(ax, bx) - half, Math.min(ay, by) - half, Math.max(ax, bx) + half, Math.max(ay, by) + half);
      }
      // Islotes de paso: uno o dos (nunca una ristra), con no más de MAXW casillas de
      // agua entre uno y otro y con las orillas. Si con dos de los pequeños no basta,
      // los dos más grandes (islitas), con WADE de agua entre cada uno.
      const MAXW = 2.2, WADE = 1.6;
      let sr = 1.7 + H(k, 23, s + S + 23) * 0.6;
      const n = gap - MAXW <= 2 * sr + MAXW ? 1 : 2;
      if (gap - 2 * sr * n > (n + 1) * MAXW) sr = (gap - (n + 1) * WADE) / (2 * n);
      const w = (gap - 2 * sr * n) / (n + 1);                        // agua entre cada dos
      const stones = [];
      for (let m = 0; m < n; m++) {
        const t = ra + w * (m + 1) + sr * (2 * m + 1);
        stones.push([a.x + ux * t, a.y + uy * t, sr]);
      }
      return box({ stones }, Math.min(ax, bx) - sr, Math.min(ay, by) - sr, Math.max(ax, bx) + sr, Math.max(ay, by) + sr);
    }
    function box(e, x0, y0, x1, y1) { return Object.assign(e, { x0, y0, x1, y1 }); }

    /** Uniones de la isla de la celda con las de celdas "mayores" (así cada una se guarda una vez). */
    const links = cellCache((i, j, s) => {
      const p = isle(i, j, s);
      if (!p) return [];
      const near = around(i, j, o.reach + 1, s), out = [];
      for (const q of near) {
        if (q.j < j || (q.j === j && q.i <= i)) continue;
        if (Math.abs(q.i - i) > o.reach || Math.abs(q.j - j) > o.reach) continue;
        const pq = d2(p, q);
        let rng = true;
        for (const r of near) {
          if (r !== p && r !== q && d2(p, r) < pq && d2(q, r) < pq) { rng = false; break; }
        }
        if (!rng) continue;
        const e = link(p, q, (i * 73856093) ^ (j * 19349663) ^ (q.i * 83492791) ^ (q.j * 2971215073), s);
        if (e) out.push(e);
      }
      return out;
    }, 2048);

    /** Lo que puede tocar un bloque de ISLE_BLOCK casillas (un chunk de world.js). */
    const block = cellCache((bi, bj, s) => {
      const B = ISLE_BLOCK, M = o.grow + 1;
      const x0 = bi * B - M, y0 = bj * B - M, x1 = (bi + 1) * B + M, y1 = (bj + 1) * B + M;
      const reach = o.reach + 1, isles = [], ways = [];
      for (let j = Math.floor(y0 / C) - reach; j <= Math.floor(y1 / C) + reach; j++) {
        for (let i = Math.floor(x0 / C) - reach; i <= Math.floor(x1 / C) + reach; i++) {
          const a = isle(i, j, s), r = a && Math.max(a.rx, a.ry);
          if (a && a.x + r > x0 && a.x - r < x1 && a.y + r > y0 && a.y - r < y1) isles.push(a);
          for (const e of links(i, j, s)) if (e.x1 > x0 && e.x0 < x1 && e.y1 > y0 && e.y0 < y1) ways.push(e);
        }
      }
      return { isles, ways };
    });

    /** Tierra o agua, antes de la pasada final. */
    function rawTile(tx, ty, seed) {
      const blk = block(Math.floor(tx / ISLE_BLOCK), Math.floor(ty / ISLE_BLOCK), seed);
      const x = tx + 0.5, y = ty + 0.5;
      // La orilla se ensancha poco a poco con un ruido ancho (sólo crece: las distancias de los vados, como mucho, encogen).
      const e = fbm(tx / 7, ty / 7, seed + S + 30) * o.grow;
      for (const a of blk.isles) {
        const out = outside(a, x, y);
        if (out > e) continue;
        // Dentro, lejos de la orilla, alguna roca suelta.
        return out < -3 && fbm(tx / 2.4, ty / 2.4, seed + S + 31) > 0.82 ? WALL : FLOOR;
      }
      for (const w of blk.ways) {
        if (x < w.x0 - 1 || x > w.x1 + 1 || y < w.y0 - 1 || y > w.y1 + 1) continue;
        if (w.stones) {
          for (const [sx, sy, sr] of w.stones) if (Math.hypot(x - sx, y - sy) < sr) return FLOOR;
          continue;
        }
        const dx = w.bx - w.ax, dy = w.by - w.ay, l2 = dx * dx + dy * dy;
        const u = l2 ? G.U.clamp(((x - w.ax) * dx + (y - w.ay) * dy) / l2, 0, 1) : 0;
        if (Math.hypot(x - w.ax - dx * u, y - w.ay - dy * u) < w.half) return FLOOR;
      }
      return LIQUID;
    }

    /**
     * La pasada final, por bloques (y guardada): la tierra metida en el agua (5+
     * de agua alrededor) se hunde y los charquitos casi rodeados de tierra (7+)
     * se rellenan. Los canales de 1–2 casillas entre islas se quedan.
     */
    const B = ISLE_BLOCK, BW = B + 2, SPIKE = 5, HOLE = 7;
    const finalBlock = cellCache((bi, bj, seed) => {
      const g = new Uint8Array(BW * BW), out = new Uint8Array(B * B);
      const x0 = bi * B - 1, y0 = bj * B - 1;
      for (let j = 0; j < BW; j++) for (let i = 0; i < BW; i++) g[j * BW + i] = rawTile(x0 + i, y0 + j, seed);
      for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) {
        const t = g[(j + 1) * BW + i + 1];
        let other = 0;
        if (t !== WALL) {
          for (let b = 0; b <= 2; b++) for (let a = 0; a <= 2; a++) {
            const u = (a !== 1 || b !== 1) && g[(j + b) * BW + i + a];
            if ((a !== 1 || b !== 1) && u !== WALL && u !== t) other++;
          }
        }
        out[j * B + i] = t === FLOOR && other >= SPIKE ? LIQUID : t === LIQUID && other >= HOLE ? FLOOR : t;
      }
      return out;
    }, 1024);

    const lay = {
      liquidHurts: false,
      terrain(tx, ty, seed) {
        const bi = Math.floor(tx / B), bj = Math.floor(ty / B);
        return finalBlock(bi, bj, seed)[(ty - bj * B) * B + (tx - bi * B)];
      },
      /** Para las pruebas: las uniones que guarda la celda (i, j). */
      _links: (i, j, seed) => links(i, j, seed)
    };
    // En la orilla, algún matojo de hierba alta.
    lay.edgeProp = (tx, ty, seed, at = (x, y) => lay.terrain(x, y, seed)) => {
      if (at(tx, ty) !== FLOOR) return null;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
        if ((a || b) && at(tx + a, ty + b) === LIQUID) return H(tx, ty, seed + S + 32) < 0.12 ? 'grass' : null;
      }
      return null;
    };
    return lay;
  }

  const ISLES = { salt: 2200, cell: 20, keep: 0.92, big: 0.4, bigR: [7, 24], smallR: [2.5, 6], aspect: 1.6, reach: 3, grow: 1.3 };
  /** Islas: se vadean los estrechos de hasta 2 casillas; puentes de 3–4 o islotes de paso (la mitad de las veces). */
  const islands = A => archipelago(Object.assign({ anchor: A }, ISLES, { wade: 2, stones: 0.5, maxBridge: 7, bridge: [3.2, 4.4] }));
  /** Pantano venenoso: las mismas islas, todo unido por puentes anchos (su agua quema: nada de vadear; anchos para que, en diagonal, quepan 4). */
  const bog = A => archipelago(Object.assign({ anchor: A }, ISLES, { wade: 0, stones: 0, maxBridge: Infinity, bridge: [6.5, 8] }));

  // ---------------- ríos: lava y pantano ----------------
  /*
   * La tierra son trozos de formas y tamaños al azar: cada celda de `cell`
   * casillas tiene un punto en cualquier sitio, y cada casilla es del trozo del
   * punto más cercano (un diagrama de Voronoi). Los ríos corren por las
   * fronteras entre trozos: cada frontera lleva río o no (con `p`), así se
   * juntan en Y y en T, unos largos y otros cortos, sin rejilla a la vista.
   * Puentes: si ningún otro punto cae dentro del círculo que tiene por diámetro
   * el segmento entre dos puntos vecinos (vecinos de Gabriel), el punto medio de
   * ese segmento está en su frontera; ahí va un puente de 4+ de ancho. El grafo
   * de Gabriel une todos los puntos, así que por tierra se llega a todas partes.
   * Las coordenadas se tuercen con ruido para que los ríos serpenteen.
   *   rocks  umbral de ruido para alguna roca suelta lejos de las fronteras (o null)
   *   banks  probabilidad de hierba alta en la orilla
   */
  function rivers(o) {
    const S = o.salt, C = o.cell, BRIDGE = 3.8, ROCK_AWAY = 5;    // puente: medio largo (torcido, deja 4+)
    const A = o.anchor, ai = Math.floor(A.tx / C), aj = Math.floor(A.ty / C);
    /**
     * Punto de la celda (el "centro" de un trozo de tierra), en cualquier sitio de
     * ella; el de la celda del ancla, en el ancla: así se empieza en mitad de un
     * trozo de tierra, lo más lejos de los ríos (que van por las fronteras).
     */
    const spot = cellCache((i, j, s) => (i === ai && j === aj ? { i, j, x: A.tx + 0.5, y: A.ty + 0.5 }
      : { i, j, x: (i + H(i, j, s + S + 1)) * C, y: (j + H(i, j, s + S + 2)) * C }));
    /**
     * Medio ancho del río de la frontera entre a y b (lo mismo se mire desde un
     * lado o desde el otro), o 0 si no lleva: cada río, de 0,75 a 1,25 veces `half`.
     */
    function riverHalf(a, b, s) {
      const [p, q] = a.i < b.i || (a.i === b.i && a.j < b.j) ? [a, b] : [b, a];
      const x = (p.i * 73856093) ^ (q.i * 83492791), y = (p.j * 19349663) ^ (q.j * 2971215073);
      return H(x, y, s + S + 3) < o.p ? o.half * (0.75 + 0.5 * H(x, y, s + S + 9)) : 0;
    }
    /** { wet: ¿río?, dist: a cuánto está de la frontera más cercana } */
    function river(tx, ty, seed) {
      const x = tx + (fbm(tx / 14, ty / 14, seed + S + 5) - 0.5) * o.warp * 2;
      const y = ty + (fbm(tx / 14 - 30, ty / 14 + 30, seed + S + 6) - 0.5) * o.warp * 2;
      const ci = Math.floor(x / C), cj = Math.floor(y / C);
      // Los dos puntos más cercanos (con un punto por celda, están en las 5×5 de alrededor).
      let a = null, b = null, da = Infinity, db = Infinity;
      for (let j = cj - 2; j <= cj + 2; j++) for (let i = ci - 2; i <= ci + 2; i++) {
        const q = spot(i, j, seed), d = (q.x - x) ** 2 + (q.y - y) ** 2;
        if (d < da) { db = da; b = a; da = d; a = q; } else if (d < db) { db = d; b = q; }
      }
      const ab = Math.sqrt(d2(a, b));
      const dist = (db - da) / (2 * ab);                        // distancia a la frontera (la mediatriz de a y b)
      if (dist >= o.half * 1.25 || dist >= riverHalf(a, b, seed)) return { wet: false, dist };
      // ¿En el puente? Junto al punto medio de a y b, a lo largo de la frontera.
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const along = ((x - mx) * -(b.y - a.y) + (y - my) * (b.x - a.x)) / ab;
      return { wet: Math.abs(along) >= BRIDGE, dist };
    }
    const lay = {
      liquidHurts: o.liquidHurts,
      terrain(tx, ty, seed) {
        const r = river(tx, ty, seed);
        if (r.wet) return LIQUID;
        // Rocas: sólo lejos de todas las fronteras (no tapan ríos ni puentes).
        if (o.rocks != null && r.dist > ROCK_AWAY && fbm(tx / 6, ty / 6, seed + S + 7) > o.rocks) return WALL;
        return FLOOR;
      },
      edgeProp: () => null
    };
    if (o.banks) {
      lay.edgeProp = (tx, ty, seed, at = (x, y) => lay.terrain(x, y, seed)) => {
        if (at(tx, ty) !== FLOOR) return null;
        for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
          if ((a || b) && at(tx + a, ty + b) === LIQUID) return H(tx, ty, seed + S + 8) < o.banks ? 'grass' : null;
        }
        return null;
      };
    }
    return lay;
  }

  /** Volcán: ríos de lava (queman) con puentes de piedra y rocas de ceniza. */
  const lava = A => rivers({ anchor: A, salt: 3100, cell: 18, p: 0.62, half: 1.6, warp: 5, rocks: 0.72, banks: 0, liquidHurts: true });
  /** Pantano: más ríos que el volcán (casi todas las fronteras llevan) y más anchos, de agua que frena; juncos en la orilla. */
  const marsh = A => rivers({ anchor: A, salt: 3300, cell: 14, p: 0.9, half: 2.2, warp: 4, rocks: null, banks: 0.35, liquidHurts: false });

  const BUILD = { plains: plainsAt, cave, plant, lava, islands, bog, marsh };
  const IDS = Object.keys(BUILD);
  const ORIGIN = { tx: 0, ty: 0 };
  /**
   * Un generador nuevo con su ancla (cachés propias): el sitio donde empieza.
   * Con el claro de 9 casillas alrededor (plains ya lo trae en su fórmula).
   */
  function make(id, A = ORIGIN) {
    const build = BUILD[id];
    if (!build) return null;
    const lay = build(A);
    if (id !== 'plains') {
      const raw = lay.terrain;
      lay.terrain = (tx, ty, seed) => ((tx - A.tx) ** 2 + (ty - A.ty) ** 2 < 81 ? FLOOR : raw(tx, ty, seed));
    }
    lay.anchor = A;
    return lay;
  }
  /** El de cada id con el ancla en el 0,0 (el del principio de la run; también para las pruebas). */
  const atOrigin = {};
  const get = id => (BUILD[id] ? atOrigin[id] || (atOrigin[id] = make(id)) : null);
  // Bioma de la run (G.Tiles.BIOMES) -> generador. Los colores de las grietas
  // que salen a partir del minuto 12 siguen con el campo abierto de momento.
  const BY_BIOME = ['plains', 'cave', 'lava'];       // el bosque, con el campo de siempre
  /** Generador de un bioma (G.Tiles.BIOMES): el que pida él (layout) o el de la lista; si no, el campo. */
  function forBiome(b) {
    const B = G.Tiles && G.Tiles.BIOMES[b];
    return (B && B.layout) || BY_BIOME[b] || 'plains';
  }

  return {
    IDS, fbm, get, make,
    forBiome
  };
})();
