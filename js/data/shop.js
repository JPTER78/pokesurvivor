/* ============ shop.js — Tienda Kecleon y Mochila ============
 * La tienda del menú (no se le puede robar) y lo que guardas en la Mochila.
 *
 * Guardado (js/core/db.js):
 *   save.bag[id]     caramelos, Mentas y Cápsulas (ITEMS de abajo)
 *   save.tms[move]   MT que tienes (cada una se gasta al enseñarla)
 *   save.ptm[dex]    movimientos que ese Pokémon ha aprendido con MT
 *                    (salen en las cartas de la partida: G.Moves.poolFor)
 *
 * Se abre poco a poco (punto medio de complejidad):
 *   shop  tras 2 partidas: caramelos
 *   tm    con la primera MT conseguida (botín raro de jefes y cofres con candado)
 *   win   Mentas y Cápsulas, con la primera victoria (systems/acts.js).
 * La Mochila aparece con la tienda (o con la primera MT, si llega antes).
 */
G.Shop = (() => {
  const ITEMS = {
    rare: { name: 'Caramelo Raro', icon: 'rarecandy', price: 150, unlock: 'shop', kind: 'candy', lv: 1,
            desc: 'Sube 1 nivel a un Pokémon.' },
    exps: { name: 'Caramelo Exp. S', icon: 'expS', price: 50, unlock: 'shop', kind: 'candy', xp: 800,
            desc: '+800 de experiencia a un Pokémon.' },
    expm: { name: 'Caramelo Exp. M', icon: 'expM', price: 180, unlock: 'shop', kind: 'candy', xp: 3000,
            desc: '+3.000 de experiencia a un Pokémon.' },
    expl: { name: 'Caramelo Exp. L', icon: 'expL', price: 550, unlock: 'shop', kind: 'candy', xp: 10000,
            desc: '+10.000 de experiencia a un Pokémon.' },
    mint: { name: 'Menta', icon: 'mint', price: 1500, unlock: 'win', kind: 'mint',
            desc: 'Cambia la naturaleza de un Pokémon por la que tú elijas.' },
    cap:  { name: 'Cápsula Habilidad', icon: 'capsule', price: 1500, unlock: 'win', kind: 'cap',
            desc: 'Cambia la habilidad de un Pokémon por otra de las suyas (la oculta, sólo si es la que le tocó).' },
    caph: { name: 'Cápsula Habilidad Oculta', icon: 'capsuleh', price: 5000, unlock: 'win', kind: 'cap', hidden: true,
            desc: 'Como la Cápsula Habilidad, pero deja elegir también su habilidad oculta.' }
  };
  const ORDER = ['exps', 'expm', 'expl', 'rare', 'mint', 'cap', 'caph'];

  const save = () => G.DB.save;

  // ---------------- qué está abierto ----------------

  function unlocked(key) {
    const s = save();
    if (!s) return false;
    if (key === 'shop') return (s.stats.runs || 0) >= 2;
    if (key === 'tm') return !!s.tmSeen || Object.keys(s.tms || {}).length > 0 || Object.keys(s.ptm || {}).length > 0;
    if (key === 'win') return (s.stats.wins || 0) >= 1;
    if (key === 'bag') return unlocked('shop') || unlocked('tm') || Object.keys(s.bag || {}).length > 0;
    return false;
  }

  // ---------------- Mochila ----------------

  function count(id) { const s = save(); return (s && s.bag && s.bag[id]) || 0; }
  function add(id, n = 1) {
    const s = save();
    s.bag = s.bag || {};
    s.bag[id] = Math.min(999, (s.bag[id] || 0) + n);
  }
  function take(id) {
    const s = save();
    if (!count(id)) return false;
    if (--s.bag[id] <= 0) delete s.bag[id];
    return true;
  }
  function tmCount(id) { const s = save(); return (s && s.tms && s.tms[id]) || 0; }
  function addTm(id) {
    const s = save();
    s.tms = s.tms || {};
    s.tms[id] = Math.min(99, (s.tms[id] || 0) + 1);
    s.tmSeen = true;
  }
  function takeTm(id) {
    const s = save();
    if (!tmCount(id)) return false;
    if (--s.tms[id] <= 0) delete s.tms[id];
    return true;
  }

  // ---------------- MT ----------------

  /** MT que puede aprender un Pokémon (las de su juego más reciente que existen aquí). */
  function tmsFor(dex) {
    const l = (G.TM && G.TM[dex]) || [];
    return l.map(i => G.MOVE_IDS[i]).filter(id => G.Moves.BY_ID[id]);
  }
  let ALL_TMS = null;
  function allTms() {
    if (!ALL_TMS) {
      const set = new Set();
      for (const d in G.TM || {}) for (const i of G.TM[d]) if (G.Moves.BY_ID[G.MOVE_IDS[i]]) set.add(G.MOVE_IDS[i]);
      ALL_TMS = [...set];
    }
    return ALL_TMS;
  }
  /** ¿Ya lo sabe (por nivel o enseñado)? */
  function knows(dex, id) {
    return G.Moves.poolFor(G.DEX_BY[dex]).includes(id);
  }
  function canTeach(dex, id) { return tmsFor(dex).includes(id) && !knows(dex, id); }

  /** Precio de una MT: según su potencia (las de estado, fijo). */
  function tmPrice(id) {
    const g = G.MOVES_GEN && G.MOVES_GEN[id];
    const pw = g && g.pw ? g.pw : 0;
    return pw ? 300 + Math.round(pw * 6 / 10) * 10 : 400;
  }

  /** MT que suelta un jefe o un cofre: casi siempre una que tu Pokémon pueda aprender. */
  function rollTm(dex) {
    const mine = tmsFor(dex).filter(id => !knows(dex, id));
    if (mine.length && Math.random() < 0.8) return G.U.pick(mine);
    return G.U.pick(allTms());
  }

  function teach(id, dex) {
    if (!canTeach(dex, id) || !takeTm(id)) return false;
    const s = save();
    s.ptm = s.ptm || {};
    s.ptm[dex] = (s.ptm[dex] || []).concat([id]);
    G.Progress.event('tmTaught', { dex, move: id });
    return true;
  }

  // ---------------- usar objetos ----------------

  /** Caramelo: devuelve { from, to } o null si no se puede (nivel máximo, no tienes). */
  function useCandy(id, dex) {
    const it = ITEMS[id];
    if (!it || it.kind !== 'candy' || !count(id) || G.Mons.level(dex) >= G.Mons.MAX) return null;
    take(id);
    const L = G.Mons.level(dex);
    const amount = it.lv ? G.Mons.xpAt(dex, L + 1) - G.Mons.xp(dex) : it.xp;
    const r = G.Mons.addXp(dex, amount);
    if (r.to > r.from) G.Progress.event('monLevel', { dex, from: r.from, to: r.to });
    return r;
  }

  function useMint(dex, nature) {
    if (!count('mint') || !Number.isInteger(nature) || nature < 0 || nature >= G.NATURES.length) return false;
    if (nature === G.Mons.natureIndex(dex)) return false;
    take('mint');
    const s = save();
    s.pnat = s.pnat || {};
    s.pnat[dex] = nature;
    return true;
  }

  /** Habilidades que se pueden elegir con esa cápsula. */
  function abilityChoices(dex, item) {
    const list = (G.DEX_ABIL && G.DEX_ABIL[dex]) || [];
    const hiddenOk = ITEMS[item].hidden || G.Mons.abilitySlot(dex, true) === 2;
    return [0, 1, 2].filter(i => list[i] && (i < 2 || hiddenOk));
  }
  function useCapsule(item, dex, slot) {
    if (!ITEMS[item] || ITEMS[item].kind !== 'cap' || !count(item)) return false;
    if (!abilityChoices(dex, item).includes(slot) || slot === G.Mons.abilitySlot(dex)) return false;
    take(item);
    const s = save();
    s.pabil = s.pabil || {};
    s.pabil[dex] = slot;
    return true;
  }

  return { ITEMS, ORDER, unlocked, count, add, take, tmCount, addTm, takeTm, tmsFor, allTms, knows, canTeach,
           tmPrice, rollTm, teach, useCandy, useMint, abilityChoices, useCapsule };
})();
