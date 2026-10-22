/* ============ mons.js — naturaleza, habilidad y MT de cada Pokémon ============
 * (20-10-2026, de la Tienda Kecleon del PR #236 de TheAdro7, adaptado.)
 *
 * Cada Pokémon de tu colección tiene:
 *   - NATURALEZA (data/natures.js): +10 % a un stat y −10 % a otro, como en los
 *     juegos (5 son neutras). Se cambia con una Menta.
 *   - HABILIDAD (data/abilities.js, efecto en data/ability-fx.js): una de las
 *     suyas; la oculta sale 1 de cada 20. Se cambia con una Cápsula Habilidad
 *     (la oculta, con la Cápsula Habilidad Oculta).
 *   - MT aprendidas: ataques que no son de sus tipos pero sí los aprende en los
 *     juegos (Mewtwo, Bola Sombra; Psyduck, Lanzallamas no). Salen en sus cartas
 *     de nivel y se pueden elegir de movimiento inicial (G.Moves.poolFor).
 *
 * Lo que le TOCÓ (naturaleza y habilidad) no se guarda: sale "al azar" pero fijo
 * para cada cuenta y Pokémon (semilla: fecha de creación de la partida + nº de la
 * Pokédex), así todos los aparatos de la misma cuenta ven lo mismo y también los
 * Pokémon que ya tenías antes de esto tienen la suya. Lo cambiado con Menta o
 * Cápsula sí se guarda (save.pnat / save.pabil, con la fecha para fusionar).
 */
G.Mons = (() => {
  const HIDDEN_RATE = 1 / 20;
  const save = () => G.DB && G.DB.save;

  /** Nombre en el idioma del juego: [es, en, fr, it, zh-Hans, zh-Hant] (pt-BR, el inglés). */
  const LANG_I = { es: 0, en: 1, fr: 2, it: 3, 'pt-BR': 1, 'zh-Hans': 4, 'zh-Hant': 5 };
  function name(n) {
    if (!Array.isArray(n)) return String(n || '');
    return n[LANG_I[G.I18n ? G.I18n.lang : 'es'] || 0] || n[1] || n[0];
  }

  // Número pseudoaleatorio fijo para (cuenta, Pokémon, sal), entre 0 y 1.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const roll = (dex, salt) => hash(((save() && save().created) || 0) + ':' + dex + ':' + salt);

  // ---------------- naturaleza ----------------

  /** La que le tocó (sin Menta). */
  function rolledNature(dex) { return G.NATURES[Math.floor(roll(dex, 'nat') * G.NATURES.length)]; }
  /** La que tiene ahora: la de la Menta o la que le tocó. */
  function natureOf(dex) {
    const s = save(), p = s && s.pnat && s.pnat[dex];
    return (p && G.NATURE_BY[p[0]]) || rolledNature(dex);
  }
  function setNature(dex, id) {
    const s = save();
    if (!s || !G.NATURE_BY[id]) return;
    s.pnat = s.pnat || {};
    s.pnat[dex] = [id, Date.now()];
  }

  /**
   * El Pokémon con su naturaleza aplicada (una copia: G.DEX_BY no se toca).
   * pa/sa: daño de sus ataques físicos/especiales · df/sd: defensas · spd: velocidad.
   */
  function monFor(dex) {
    const base = G.DEX_BY[dex];
    if (!base) return base;
    const n = natureOf(dex), m = Object.assign({}, base);
    if (n.up) m[n.up] = base[n.up] * 1.1;
    if (n.down) m[n.down] = base[n.down] * 0.9;
    m.atk = Math.max(m.pa, m.sa);
    m.nature = n.id;
    return m;
  }

  // ---------------- habilidad ----------------

  /** [habilidad 1, habilidad 2 o 0, oculta o 0] */
  const slots = dex => (G.DEX_ABIL && G.DEX_ABIL[dex]) || [0, 0, 0];
  /** Hueco que le tocó: 2 (oculta) 1 de cada 20 si tiene; si no, 0 o 1. */
  function rolledSlot(dex) {
    const l = slots(dex);
    if (l[2] && roll(dex, 'hid') < HIDDEN_RATE) return 2;
    return l[1] && roll(dex, 'abil') < 0.5 ? 1 : 0;
  }
  /** { id, slot }: la de la Cápsula o la que le tocó. */
  function abilityOf(dex) {
    const s = save(), p = s && s.pabil && s.pabil[dex], l = slots(dex);
    let slot = p && l[p[0]] ? p[0] : rolledSlot(dex);
    if (!l[slot]) slot = 0;
    return { id: l[slot] || '', slot };
  }
  /** Huecos a los que se puede cambiar (la oculta, sólo con la Cápsula Oculta). */
  function abilityChoices(dex, hidden) {
    const l = slots(dex), cur = abilityOf(dex).slot;
    return [0, 1, 2].filter(i => l[i] && i !== cur && (i < 2 || hidden) && !(i === 1 && l[1] === l[0]));
  }
  function setAbility(dex, slot) {
    const s = save();
    if (!s || !slots(dex)[slot]) return;
    s.pabil = s.pabil || {};
    s.pabil[dex] = [slot, Date.now()];
  }
  const abilityName = id => (id && G.ABIL[id] ? name(G.ABIL[id]) : '');

  // ---------------- MT ----------------

  /** Movimientos que ha aprendido con MT. */
  function taught(dex) {
    const s = save(), l = s && s.ptm && s.ptm[dex];
    return Array.isArray(l) ? l.filter(id => G.Moves.BY_ID[id]) : [];
  }
  /** ¿Ya lo sabe sin MT (es de sus tipos)? */
  const natural = (dex, id) => G.Moves.poolFor(G.DEX_BY[dex], true).includes(id);
  /** MT que puede aprender (las que no sabe ya). */
  function learnable(dex) { return G.TM_OF(dex).filter(id => G.Moves.BY_ID[id] && !natural(dex, id) && !taught(dex).includes(id)); }
  const canLearn = (dex, id) => learnable(dex).includes(id);
  /** Enseña una MT de la Mochila (se gasta). → true si se ha aprendido. */
  function teach(dex, id) {
    const s = save();
    if (!s || !canLearn(dex, id) || !G.Shop.takeTm(id)) return false;
    s.ptm = s.ptm || {};
    s.ptm[dex] = taught(dex).concat([id]);
    return true;
  }

  return { name, natureOf, setNature, rolledNature, monFor, abilityOf, abilityChoices, setAbility, abilityName,
           slots, taught, learnable, canLearn, teach, natural };
})();
