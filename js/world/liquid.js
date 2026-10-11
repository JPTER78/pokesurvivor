/* ============ liquid.js — qué hace cada líquido a un Pokémon ============
 * Lo usa world.js (liquidEffect) para el jugador y los enemigos.
 *   { slow, dmg, flat, every, color, slide }   (dmg en % de vida máxima)
 * Los de su tipo no sufren el suyo (Fuego en lava, Veneno en veneno...).
 * Privilegios (2026-10-11):
 *   Agua en agua/ciénaga: nada (×1,15 velocidad, +1 vida/s) pero recibe un 15% más de daño.
 *   Volador: planea sobre todo (sin frenazo ni resbalón; la lava y compañía, a la mitad),
 *            pero sus recargas son un 10% más lentas mientras (ver Player.cdK).
 */
G.Liquid = (() => {
  const TABLE = {
    water:  { slow: 0.6 },
    swamp:  { slow: 0.45 },
    lava:   { dmg: 0.06, flat: 5, every: 0.5, color: '#ff8a3d', immune: ['fire'] },
    poison: { dmg: 0.035, flat: 3, every: 0.5, color: '#c86bdc', immune: ['poison', 'steel'] },
    spark:  { dmg: 0.045, flat: 4, every: 0.7, color: '#ffe14d', immune: ['electric', 'ground'] },
    ice:    { slide: true, immune: ['ice'] }
  };

  function effect(kind, types) {
    const e = TABLE[kind] || TABLE.water;
    const has = t => !!(types && types.includes(t));
    if (e.immune && types && types.some(t => e.immune.includes(t))) return {};
    if (has('flying')) return e.dmg ? { hover: true, dmg: e.dmg / 2, flat: e.flat / 2, every: e.every, color: e.color } : { hover: true };
    if (has('water') && (kind === 'water' || kind === 'swamp')) return { swim: true, speed: 1.15, regen: 1, dmgTaken: 1.15 };
    return e;
  }

  return { TABLE, effect };
})();
