/* ============ layouts.js — cómo se genera el terreno de cada bioma ============
 *
 * Cada bioma de la run tiene su forma de terreno, no sólo sus colores
 * (inspirado en Mundo Misterioso):
 *   plains  campo abierto con charcas y rocas (lo de siempre)
 *   cave    cueva de salas rectangulares al azar (se pisan) y pasillos rectos
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

  const BUILD = { plains: plainsAt, cave, plant, lava, marsh };
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
  /** Generador de un bioma (G.Tiles.BIOMES): el de la lista; si no, el campo. */
  function forBiome(b) {
    return BY_BIOME[b] || 'plains';
  }

  return {
    IDS, fbm, get, make,
    forBiome
  };
})();
