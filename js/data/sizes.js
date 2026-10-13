/* ============ sizes.js — tallas de los Pokémon (XS, S, M, L, XL) ============
 * Cada Pokémon (menos los legendarios y singulares, siempre M como en
 * Escarlata/Púrpura) puede tener cinco tallas. La M es la de siempre: la que
 * ya tienes. No es una mejora sino un intercambio: los pequeños son más
 * rápidos y más difíciles de golpear pero tienen menos vida; los grandes al
 * revés. Contando la zona de golpe, todas quedan a ±3 % de la M.
 *
 * Las tallas se consiguen derrotando a la versión salvaje con esa talla de un
 * Pokémon que ya tienes (systems/spawner.js, más o menos cada 5 minutos).
 * Se guardan en save.sizes (core/db.js): dex -> { xs|s|l|xl -> { at, from } }.
 */
G.Sizes = (() => {
  // TODOS los números de las tallas, en esta tabla:
  //   scale  tamaño del sprite y de la zona de golpe (el choque con el terreno es siempre el de la M)
  //   hp     vida máxima · atk ataque · taken daño que recibe · spd velocidad
  //   w      parte de las apariciones de talla (de cada 100)
  // Con hp, atk, taken y spd a 1 las tallas son sólo de aspecto: cambia el
  // tamaño (y con él la zona de golpe), nada más.
  const LIST = [
    { id: 'xs', name: 'XS', scale: 0.756, hp: 0.826, atk: 0.943, taken: 1.061, spd: 1.166, w: 10 },
    { id: 's',  name: 'S',  scale: 0.87,  hp: 0.909, atk: 0.971, taken: 1.03,  spd: 1.08,  w: 40 },
    { id: 'm',  name: 'M',  scale: 1,     hp: 1,     atk: 1,     taken: 1,     spd: 1,     w: 0 },
    { id: 'l',  name: 'L',  scale: 1.15,  hp: 1.10,  atk: 1.03,  taken: 0.971, spd: 0.926, w: 40 },
    { id: 'xl', name: 'XL', scale: 1.322, hp: 1.21,  atk: 1.061, taken: 0.943, spd: 0.857, w: 10 }
  ];
  const BY = {};
  for (const z of LIST) BY[z.id] = z;
  /** Las que se coleccionan (la M es tener el Pokémon). */
  const EXTRA = LIST.filter(z => z.id !== 'm').map(z => z.id);

  // Aura de los salvajes con talla (como en Let's Go): azul los pequeños, roja los grandes.
  const AURA_SMALL = '#4fa8ff', AURA_BIG = '#ff5a4a';
  const isSmall = id => !!BY[id] && BY[id].scale < 1;
  const aura = id => (isSmall(id) ? AURA_SMALL : AURA_BIG);

  /** ¿Puede tener tallas? (los legendarios y singulares no) */
  function can(dex) {
    const p = G.DEX_BY && G.DEX_BY[dex];
    return !!(p && !p.leg && G.SPRITE_META && G.SPRITE_META[p.dex]);
  }

  /** Tallas que tiene un Pokémon en una partida (sin la M). */
  function ownedOf(save, dex) {
    const z = save && save.sizes && save.sizes[dex];
    return z ? EXTRA.filter(id => z[id]) : [];
  }

  /** Tallas que le faltan (sin la M). */
  function missing(save, dex) {
    const have = ownedOf(save, dex);
    return EXTRA.filter(id => !have.includes(id));
  }

  /** Cuántas tallas tienes en total (de Pokémon que tienes y que pueden tenerlas). */
  function count(save) {
    let n = 0;
    for (const d of Object.keys((save && save.sizes) || {})) if (can(d) && save.owned && save.owned[d]) n += ownedOf(save, d).length;
    return n;
  }

  /** ¿Tienes las cinco tallas de algún Pokémon? */
  function fullSets(save) {
    let n = 0;
    for (const d of Object.keys((save && save.sizes) || {})) if (can(d) && save.owned && save.owned[d] && ownedOf(save, d).length === EXTRA.length) n++;
    return n;
  }

  /** ¿Tienes alguna talla `id` (de cualquier Pokémon)? */
  function hasAny(save, id) {
    return Object.keys((save && save.sizes) || {}).some(d => save.sizes[d] && save.sizes[d][id] && save.owned && save.owned[d]);
  }

  /** Tallas que se pueden coleccionar en todo el juego (4 por Pokémon). */
  let totalN = 0;
  function total() {
    if (!totalN && G.DEX) totalN = G.DEX.filter(p => can(p.dex)).length * EXTRA.length;
    return totalN;
  }

  /** Sortea una de las tallas `allowed` según su parte (w). null si no hay ninguna. */
  function roll(allowed, rnd = Math.random) {
    const pool = LIST.filter(z => z.w > 0 && allowed.includes(z.id));
    const sum = pool.reduce((a, z) => a + z.w, 0);
    if (!sum) return null;
    let r = rnd() * sum;
    for (const z of pool) { if ((r -= z.w) < 0) return z.id; }
    return pool[pool.length - 1].id;
  }

  return { LIST, BY, EXTRA, can, ownedOf, missing, count, fullSets, hasAny, total, roll, aura, isSmall };
})();
