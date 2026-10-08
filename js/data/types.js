/* ============ types.js — tabla de tipos ============
 * La de los juegos (6.ª gen. en adelante), pero SUAVIZADA para un survivor,
 * donde sólo llevas un ataque activo y no puedes cambiar de Pokémon:
 *
 *   juegos   ×2      ×0,5    ×0 (inmune)
 *   aquí     ×1,6    ×0,6    ×0,3
 *
 * Con dos tipos se multiplican (×1,6 · ×1,6 = ×2,56), con tope en [×0,3, ×2,4].
 * Se usa en los dos sentidos: tus ataques contra los enemigos y los de los
 * enemigos contra ti (su tipo principal, o el de su disparo).
 */
G.Types = (() => {
  // atacante -> { defensor: multiplicador de los juegos } (los ×1 no se apuntan)
  const CHART = {
    normal:   { rock: .5, ghost: 0, steel: .5 },
    fire:     { fire: .5, water: .5, grass: 2, ice: 2, bug: 2, rock: .5, dragon: .5, steel: 2 },
    water:    { fire: 2, water: .5, grass: .5, ground: 2, rock: 2, dragon: .5 },
    electric: { water: 2, electric: .5, grass: .5, ground: 0, flying: 2, dragon: .5 },
    grass:    { fire: .5, water: 2, grass: .5, poison: .5, ground: 2, flying: .5, bug: .5, rock: 2, dragon: .5, steel: .5 },
    ice:      { fire: .5, water: .5, grass: 2, ice: .5, ground: 2, flying: 2, dragon: 2, steel: .5 },
    fighting: { normal: 2, ice: 2, poison: .5, flying: .5, psychic: .5, bug: .5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: .5 },
    poison:   { grass: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0, fairy: 2 },
    ground:   { fire: 2, electric: 2, grass: .5, poison: 2, flying: 0, bug: .5, rock: 2, steel: 2 },
    flying:   { electric: .5, grass: 2, fighting: 2, bug: 2, rock: .5, steel: .5 },
    psychic:  { fighting: 2, poison: 2, psychic: .5, dark: 0, steel: .5 },
    bug:      { fire: .5, grass: 2, fighting: .5, poison: .5, flying: .5, psychic: 2, ghost: .5, dark: 2, steel: .5, fairy: .5 },
    rock:     { fire: 2, ice: 2, fighting: .5, ground: .5, flying: 2, bug: 2, steel: .5 },
    ghost:    { normal: 0, psychic: 2, ghost: 2, dark: .5 },
    dragon:   { dragon: 2, steel: .5, fairy: 0 },
    dark:     { fighting: .5, psychic: 2, ghost: 2, dark: .5, fairy: .5 },
    steel:    { fire: .5, water: .5, electric: .5, ice: 2, rock: 2, steel: .5, fairy: 2 },
    fairy:    { fire: .5, fighting: 2, poison: .5, dragon: 2, dark: 2, steel: .5 }
  };
  const SOFT = { 2: 1.6, 0.5: 0.6, 0: 0.3 };
  const MIN = 0.3, MAX = 2.4;

  /** Multiplicador de un ataque de tipo `atk` contra un Pokémon de tipos `def`. */
  function mult(atk, def) {
    const row = CHART[atk];
    if (!row || !def) return 1;
    let m = 1;
    for (const t of def) if (row[t] != null) m *= SOFT[row[t]];
    return G.U.clamp(m, MIN, MAX);
  }

  /** 'super' | 'weak' | null, para enseñar el aviso. */
  function label(m) { return m > 1.05 ? 'super' : m < 0.95 ? 'weak' : null; }

  return { CHART, mult, label };
})();
