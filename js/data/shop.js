/* ============ shop.js — Tienda Kecleon y Mochila ============
 * (20-10-2026, del PR #236 de TheAdro7, adaptado: sin niveles ni caramelos.)
 *
 * Se compra con Pokémonedas y lo comprado va a la Mochila:
 *   save.bag[id]     Menta, Cápsula Habilidad y Cápsula Habilidad Oculta
 *   save.tms[move]   MT sin usar (cada una se gasta al enseñarla: G.Mons.teach)
 * Las dos van en la libreta de las monedas (core/db.js): lo gastado en un
 * aparato no reaparece al fusionar con otro.
 *
 * MT a la venta: 8 cada día, iguales para todos (semilla: la fecha en España).
 * Si ninguna sirve a tu compañero, la última se cambia por una que sí aprenda.
 */
G.Shop = (() => {
  const ITEMS = {
    mint: { name: 'Menta', icon: 'mint', price: 1500,
            desc: 'Cambia la naturaleza de un Pokémon por la que tú elijas.' },
    cap:  { name: 'Cápsula Habilidad', icon: 'capsule', price: 1500,
            desc: 'Cambia la habilidad de un Pokémon por otra de las suyas (no la oculta).' },
    caph: { name: 'Cápsula Habilidad Oculta', icon: 'capsuleh', price: 5000, hidden: true,
            desc: 'Cambia la habilidad de un Pokémon por cualquiera de las suyas, también la oculta.' },
    // Halloween (25-10-2026): no se vende; se consigue jugando esos días y se gasta en las skins.
    candy: { name: 'Caramelo de Halloween', icon: 'candy', price: 0, event: true,
             desc: 'Lo sueltan los Pokémon Fantasma y las calabazas en Halloween. Con ellos se compran las skins de bruja en la Tienda Kecleon.' }
  };
  const ORDER = ['mint', 'cap', 'caph'];
  const DAILY = 8;

  const save = () => G.DB.save;

  // ---------------- Mochila ----------------

  const count = id => { const s = save(); return (s && s.bag && s.bag[id]) || 0; };
  function take(id) {
    const s = save();
    if (!count(id)) return false;
    if (--s.bag[id] <= 0) delete s.bag[id];
    return true;
  }
  const tmCount = id => { const s = save(); return (s && s.tms && s.tms[id]) || 0; };
  function takeTm(id) {
    const s = save();
    if (!tmCount(id)) return false;
    if (--s.tms[id] <= 0) delete s.tms[id];
    return true;
  }

  // ---------------- MT del día ----------------

  /** Fecha de hoy en España (todos ven la misma tienda el mismo día). */
  function today() {
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())) p[x.type] = x.value;
    return p.year + p.month + p.day;
  }
  function rng(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  /** Las 8 MT a la venta hoy. */
  function dailyTms() {
    const all = Object.keys(G.TM_MOVES).sort(), r = rng('kecleon:' + today());
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const list = all.slice(0, DAILY);
    const s = save(), dex = s && s.partner;
    if (dex && !list.some(id => G.Mons.canLearn(dex, id))) {
      const mine = G.Mons.learnable(dex).sort();
      if (mine.length) list[DAILY - 1] = mine[Math.floor(rng('kecleon:' + today() + ':' + dex)() * mine.length)];
    }
    return list;
  }
  const tmPrice = id => G.TM_PRICE[id] || 400;

  // ---------------- comprar ----------------

  /** Compra un objeto ('mint'...) o una MT ('tm:flamethrower'). → { ok, error? } */
  function buy(key) {
    const s = save();
    if (!s) return { ok: false };
    const tm = key.startsWith('tm:') ? key.slice(3) : null;
    if (tm && !dailyTms().includes(tm)) return { ok: false, error: 'Esa MT ya no está a la venta.' };
    if (!tm && (!ITEMS[key] || ITEMS[key].event)) return { ok: false };
    const price = tm ? tmPrice(tm) : ITEMS[key].price;
    if (s.coins < price) return { ok: false, error: 'No tienes Pokémonedas suficientes.' };
    s.coins -= price;
    if (tm) { s.tms = s.tms || {}; s.tms[tm] = Math.min(999, (s.tms[tm] || 0) + 1); }
    else { s.bag = s.bag || {}; s.bag[key] = Math.min(999, (s.bag[key] || 0) + 1); }
    G.DB.commit();
    return { ok: true };
  }

  /** Halloween: una skin de bruja por caramelos (sólo esos días; luego se queda para siempre). → { ok, error? } */
  function buySkin(id) {
    const s = save(), sk = G.Skins.SKINS[id], price = G.Halloween.SKIN_PRICE;
    if (!s || !sk) return { ok: false };
    if (!G.Halloween.on) return { ok: false, error: 'Las skins de bruja sólo se venden en Halloween.' };
    if (G.Skins.owns(s, id)) return { ok: false, error: 'Ya tienes esta skin.' };
    if (count('candy') < price) return { ok: false, error: 'No tienes caramelos suficientes.' };
    s.bag.candy -= price;
    if (s.bag.candy <= 0) delete s.bag.candy;
    s.skins = s.skins || {};
    s.skins[id] = Date.now();
    // Si ya tienes ese Pokémon, se la pone.
    if (G.DB.owns(sk.dex)) G.Skins.wear(s, sk.dex, id);
    G.DB.commit(true);
    return { ok: true };
  }

  return { ITEMS, ORDER, count, take, tmCount, takeTm, dailyTms, tmPrice, buy, buySkin, today };
})();
