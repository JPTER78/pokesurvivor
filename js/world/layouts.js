/* ============ layouts.js — cómo se genera el terreno de cada bioma ============
 *
 * Cada bioma de la run tiene su forma de terreno, no sólo sus colores
 * (inspirado en Mundo Misterioso):
 *   plains  campo abierto con charcas y rocas (lo de siempre)
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

  const BUILD = { plains: plainsAt };
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
  const BY_BIOME = ['plains'];       // el bosque, con el campo de siempre
  /** Generador de un bioma (G.Tiles.BIOMES): el de la lista; si no, el campo. */
  function forBiome(b) {
    return BY_BIOME[b] || 'plains';
  }

  return {
    IDS, fbm, get, make,
    forBiome
  };
})();
