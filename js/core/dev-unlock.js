/* ============ dev-unlock.js — todo desbloqueado para probar (sólo en local) ============
 * Abre el juego con ?todo en modo local (sin nube) y, al entrar
 * (como invitado o con una cuenta local), la partida pasa a tenerlo todo:
 * todos los Pokémon (y sus shinies) al Nv. 100, monedas y tickets de sobra,
 * rango Maestro, mejoras al máximo, Mochila llena, MT y la tienda abierta.
 *   http://ps.localhost:8765/dev.html?todo · https://pokesurvivor-pruebas.vercel.app/?todo
 * Vale en cualquier dirección que vaya en modo local (tu ordenador, un túnel, la
 * copia de pruebas de Vercel...): ahí la partida sólo se guarda en ese navegador,
 * sin nube ni ranking. En la web oficial no hace nada, ni aunque se quede sin
 * nube. (OJO: con localhost o 127.0.0.1 el juego usa la nube de verdad, db.js
 * HOSTS: en tu ordenador, ps.localhost.) Los avisos de primera vez del menú se
 * dan por vistos (los de la partida, no); G.Tips.reset() los devuelve.
 */
G.DevUnlock = (() => {
  const OFFICIAL = ['pokesurvivor.com', 'www.pokesurvivor.com', 'jpter78.github.io'];

  function allowed() {
    return /[?&]todo\b/.test(location.search) && G.DB.mode === 'local' && !OFFICIAL.includes(location.hostname);
  }

  function apply() {
    const s = G.DB.save;
    if (!s) return;
    for (const p of G.DEX) {
      G.DB.grant(p.dex, 'dev');
      if (!G.Sprites.hasShiny || G.Sprites.hasShiny(p.dex)) G.DB.grantShiny(p.dex, 'dev');
      s.pxp[p.dex] = G.Mons.xpAt(p.dex, 100);
    }
    if (!s.partner) { s.partner = 25; s.starter = s.starter || 25; }
    s.coins = Math.max(s.coins, 999999);
    s.tickets.t1 = Math.max(s.tickets.t1, 9999);
    s.tickets.t10 = Math.max(s.tickets.t10, 999);
    s.rank = G.Acts.MAX_RANK;
    for (let r = 0; r <= G.Acts.MAX_RANK; r++) s.wins[r] = Math.max(s.wins[r] || 0, 1);
    s.stats.runs = Math.max(s.stats.runs || 0, 10);
    s.stats.wins = Math.max(s.stats.wins || 0, 1);
    for (const u of G.Upgrades.LIST) if (!u.per) s.aupg[u.id] = u.max;
    for (const id of Object.keys(G.Shop.ITEMS)) s.bag[id] = 99;
    // Unas cuantas MT de ataque al azar (3 de cada).
    const atk = G.Moves.ALL.filter(m => !G.Moves.isStatus(m.id));
    for (let i = 0; i < 30; i++) { const m = G.U.pick(atk); s.tms[m.id] = 3; }
    s.tmSeen = true;
    s.told = s.told || {};
    for (const k of ['monlv', 'shop', 'tm', 'win', 'master']) s.told[k] = s.told[k] || Date.now();
    G.DB.commit();
    G.UI.toast('Modo pruebas: todo desbloqueado', 3000);
  }

  return { allowed, apply };
})();
