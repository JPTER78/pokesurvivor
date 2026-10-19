/* ============ stats.js — ataque físico / especial y defensas ============
 * Como en los juegos: cada ataque es físico o especial (G.Moves, m.cat). Los
 * físicos pegan con el Ataque de tu Pokémon (mon.pa) y los especiales con su
 * Ataque Especial (mon.sa); 'atk' sigue siendo el mayor de los dos, así que
 * con los ataques de su lado bueno pega lo mismo que antes del 18-10-2026.
 *
 * Defensas (mon.df / mon.sd, las base de los juegos), en suave para que
 * ninguna se vuelva imposible: con 75 (la media) igual; con mucha, hasta un
 * 22 % menos de daño; con poca, hasta un 25 % más.
 *   - Los enemigos se defienden de tus ataques físicos con su Defensa y de
 *     los especiales con su Defensa Especial.
 *   - Cada enemigo pega con su lado fuerte (físico si su Ataque es mayor que
 *     su Ataque Especial) y tú te defiendes con la defensa que toque.
 * El daño de Arceus (pure) y de las trampas ignora todo esto.
 */
G.Stats = (() => {
  const REF = 75, EXP = 0.35, LO = 0.78, HI = 1.25;
  const NAME = { physical: 'Físico', special: 'Especial' };

  /** Multiplicador del daño que recibe quien tiene esa defensa base. */
  function guard(def) { return G.U.clamp(Math.pow(REF / Math.max(5, def || REF), EXP), LO, HI); }

  return {
    NAME,
    /**
     * Daño que recibe un Pokémon (mon con df/sd) de un golpe de categoría cat.
     * Sin categoría o sin datos: ×1.
     */
    taken(mon, cat) {
      if (!mon || !cat) return 1;
      return guard(cat === 'special' ? mon.sd : mon.df);
    },
    /** Lado fuerte de un Pokémon: 'physical' | 'special' (empate: físico). */
    sideOf(mon) {
      if (!mon || mon.pa == null || mon.sa == null) return 'physical';
      return mon.sa > mon.pa ? 'special' : 'physical';
    },
    /** Lo que rinde un ataque con este Pokémon respecto a su lado bueno (1 = igual). */
    fit(mon, cat) {
      if (!mon || !cat || mon.pa == null) return 1;
      return (cat === 'special' ? mon.sa : mon.pa) / mon.atk;
    }
  };
})();
