/* ============ dex-query.js — filtro y orden de la colección ============
 * Lógica PURA: no toca el DOM ni G.DEX ni G.DB. Recibe la lista, unos
 * criterios y una "fuente" con los datos de la partida, y devuelve una lista
 * NUEVA ya filtrada y ordenada. Al ser pura se puede probar sin navegador.
 *
 *   G.DexQuery.run(G.DEX, criterios, fuente)
 *     criterios: { gen, types, rarity, status, shiny, fav, q, sort }
 *       gen     número de generación o 'all'
 *       types   tipos a mostrar (Set o array; vacío = todos)
 *       rarity  rarezas a mostrar (Set o array; vacío = todas)
 *       status  'all' | 'own' | 'miss'
 *       shiny   true = sólo shinies
 *       fav     true = sólo favoritos
 *       q       texto a buscar en el nombre
 *       sort    clave de SORTS
 *     fuente:    { has(dex), shiny(dex), fav(dex), at(dex) }
 *
 * Añadir un orden = añadir una entrada a SORTS (no tocar run).
 * Añadir un filtro = añadir una regla a RULES (no tocar run).
 */
G.DexQuery = (() => {
  const norm = s => String(s == null ? '' : s).toLowerCase();
  // Cualquier colección (Set, array o valor suelto) -> array.
  // Se detecta el Set por su forma (no con instanceof) para que funcione
  // también entre contextos distintos.
  const arr = v => !v ? [] : Array.isArray(v) ? v : (typeof v.has === 'function' ? Array.from(v) : [v]);

  const SORTS = {
    num:    { label: 'Número',   cmp: (a, b) => a.dex - b.dex },
    name:   { label: 'Nombre',   cmp: (a, b) => a.name.localeCompare(b.name, 'es') || a.dex - b.dex },
    rarity: { label: 'Rareza',   cmp: (a, b) => b.rarity - a.rarity || a.dex - b.dex },
    recent: { label: 'Recién conseguidos', cmp: (a, b, src) => (src.at(b.dex) - src.at(a.dex)) || a.dex - b.dex },
    used:   { label: 'Más usados', cmp: (a, b, src) => (src.used(b.dex) - src.used(a.dex)) || a.dex - b.dex }
  };
  const DEFAULT_SORT = 'num';

  // Reglas de filtrado: todas deben cumplirse (AND).
  const RULES = [
    (p, c) => c.gen == null || c.gen === 'all' || p.gen === c.gen,
    (p, c) => !c.types.length || p.types.some(t => c.types.indexOf(t) >= 0),
    (p, c) => !c.rarity.length || c.rarity.indexOf(p.rarity) >= 0,
    (p, c, src) => c.status === 'all' || (c.status === 'own' ? src.has(p.dex) : !src.has(p.dex)),
    (p, c, src) => !c.shiny || src.shiny(p.dex),
    (p, c, src) => !c.fav || src.fav(p.dex),
    (p, c) => !c.q || norm(p.name).includes(c.q)
  ];

  // Fuente vacía: nadie es tuyo (pruebas o partida ausente).
  const EMPTY = { has: () => false, shiny: () => false, fav: () => false, used: () => 0, at: () => 0 };

  function run(list, criteria, source) {
    const raw = criteria || {};
    const c = {
      gen: raw.gen, status: raw.status || 'all',
      q: raw.q ? norm(raw.q).trim() : '',
      shiny: !!raw.shiny, fav: !!raw.fav,
      types: arr(raw.types), rarity: arr(raw.rarity),
      sort: SORTS[raw.sort] ? raw.sort : DEFAULT_SORT
    };
    const src = Object.assign({}, EMPTY, source || {});
    const out = (list || []).filter(p => RULES.every(r => r(p, c, src)));
    out.sort((a, b) => SORTS[c.sort].cmp(a, b, src));
    return out;
  }

  return { SORTS, DEFAULT_SORT, RULES, run };
})();
