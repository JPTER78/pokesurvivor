/* ============ evolutions.js — cadenas evolutivas por nivel ============
 * Datos de evolución por nivel. Cada entrada:
 *   dex -> { to (dex destino), level, bonus (habilidad pasiva única), move (movimiento exclusivo) }
 *
 * bonus: { type, dmg (frac), regen, spd }  — el daño se aplica sólo al tipo indicado.
 *   Ej: { type: 'grass', dmg: 0.10 }  => +10% de daño de tipo Planta.
 *   Ej: { type: 'fire', dmg: 0.20, spd: 0.10 }  => +20% Fuego, +10% velocidad.
 *
 * move: id de un movimiento del pool de la nueva forma que se intenta aprender
 *   automáticamente al evolucionar (si hay hueco libre). Si no está en el pool
 *   o no hay hueco, se ignora.
 *
 * Sólo evoluciones por nivel. Las de piedra/intercambio/amistad requieren otro sistema.
 *
 * PRUEBA: de momento sólo la línea de Bulbasaur.
 */
G.EVOLUTIONS = {
  1: { // Bulbasaur -> Ivysaur (nivel 16)
    to: 2, level: 16,
    bonus: { type: 'grass', dmg: 0.10 },
    move: 'vine-whip'
  },
  2: { // Ivysaur -> Venusaur (nivel 32)
    to: 3, level: 32,
    bonus: { type: 'grass', dmg: 0.20, regen: 0.5 },
    move: 'leaf-storm'
  }
};

/** Devuelve la evolución de un Pokémon o null si no tiene. */
G.evolutionOf = dex => G.EVOLUTIONS[dex] || null;
