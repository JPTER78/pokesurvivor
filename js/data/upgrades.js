/* ============ upgrades.js — mejoras permanentes entre runs ============
 * Se compran con Pokémonedas en el menú. Desde el 16-10-2026 son de la CUENTA
 * (cuentan con cualquier Pokémon), salvo el Veto (`per`), que es de cada
 * Pokémon porque cada uno tiene su propia lista de movimientos.
 * Las de stats (Vitalidad, Fuerza, Zancada, Reflejos, Coraza, Síntesis) se
 * quitaron: eso ya lo da el nivel del Pokémon. Sus monedas se devolvieron
 * (ver migrate en js/core/db.js, con LEGACY de abajo).
 */
G.Upgrades = (() => {
  const LIST = [
    { id: 'magnet', icon: 'magnet', name: 'Imán',           unit: '+12% recogida',      max: 6,  base: 50,  grow: 1.4 },
    { id: 'xp',     icon: 'book', name: 'Sabiduría',      unit: '+5% experiencia',    max: 8,  base: 100, grow: 1.42 },
    { id: 'coins',  icon: 'coin', name: 'Fortuna',        unit: '+8% Pokémonedas',    max: 8,  base: 120, grow: 1.45 },
    { id: 'moves',  icon: 'cards', name: 'Repertorio',     unit: 'Empiezas con 2 movimientos', max: 1, base: 1500, grow: 1 },
    { id: 'crit',   icon: 'star', name: 'Golpe Crítico',  unit: '+3% de críticos (x1,5 de daño)', max: 10, base: 90, grow: 1.4 },
    { id: 'reroll', icon: 'up', name: 'Cambio de cartas', unit: '+1 cambio de cartas de nivel por run', max: 5, base: 150, grow: 1.6 },
    { id: 'ban',    icon: 'ban', name: 'Veto',           unit: 'Bloquea 1 movimiento: no te sale en las cartas', max: 3, base: 300, grow: 1.9, per: true }
  ];
  // Las que ya no existen (sólo para calcular lo que se devuelve).
  const LEGACY = {
    hp: { base: 60, grow: 1.35, max: 10 }, atk: { base: 80, grow: 1.38, max: 10 }, spd: { base: 70, grow: 1.4, max: 8 },
    cd: { base: 90, grow: 1.42, max: 8 }, def: { base: 80, grow: 1.4, max: 8 }, regen: { base: 120, grow: 1.5, max: 5 }
  };
  const BY = {};
  for (const u of LIST) BY[u.id] = u;

  const price = (u, lvl) => Math.round(u.base * Math.pow(u.grow, lvl) / 10) * 10;
  function cost(id, lvl) { return price(BY[id], lvl); }

  /** Monedas gastadas en llegar al nivel `lvl` de una mejora (de las de ahora o de las quitadas). */
  function spent(id, lvl) {
    const u = BY[id] || LEGACY[id];
    if (!u) return 0;
    let t = 0;
    for (let i = 0; i < Math.min(lvl, u.max); i++) t += price(u, i);
    return t;
  }

  /**
   * Niveles comprados -> modificadores para G.Player.
   * @param acc  mejoras de la cuenta · @param mon  las del Pokémon (Veto)
   */
  function perks(acc = {}, mon = {}) {
    // Nunca por encima del máximo (una partida editada a mano no da más poder).
    const L = id => Math.max(0, Math.min(BY[id].max, Math.floor(+(BY[id].per ? mon : acc)[id] || 0)));
    return {
      magnetMul: 1 + L('magnet') * 0.12,
      xpMul: 1 + L('xp') * 0.05,
      coinMul: 1 + L('coins') * 0.08,
      startMoves: 1 + L('moves'),
      crit: L('crit') * 0.03,
      rerolls: L('reroll'),
      bans: L('ban')
    };
  }

  return { LIST, BY, cost, spent, perks };
})();
