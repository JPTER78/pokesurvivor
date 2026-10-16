/* ============ second.js — segunda pantalla (consolas de dos pantallas) ============
 * En consolas como la AYN Thor la app Android abre en la pantalla de abajo un
 * panel aparte (second.html + js/second/panel.js). Aquí, en el juego, sólo se
 * hace de puente:
 *   - varias veces por segundo se le manda un resumen de la partida (vida,
 *     ataques, mapa...), y
 *   - se atiende lo que se toca en el panel (cambiar de ataque, pausa, cartas).
 *
 * Dos transportes, el mismo mensaje:
 *   - App Android: PSNativo.segunda(json) -> panel, y el panel responde con
 *     G.Second.accion(json) (ver android/.../SegundaPantalla.java).
 *   - Navegador: BroadcastChannel 'ps.second'. Sirve para probar en PC (o para
 *     un segundo monitor): se abre second.html en otra ventana.
 *
 * Qué enseña el panel lo decide el jugador (Ajustes > Controles, o las
 * pestañas del propio panel). Ajustes de G.Settings:
 *   second       'stats' | 'map' | 'moves' | 'off'
 *   secondCards  true/false   las cartas de subir de nivel se eligen abajo
 *
 * Para añadir un modo nuevo: un nombre en MODES, sus datos en resumen() y su
 * dibujo en js/second/panel.js.
 */
G.Second = (() => {
  const MODES = ['stats', 'map', 'moves', 'off'];
  const MAP_R = 900, MAP_MAX = 160;      // radio del mapa (px de mundo) y enemigos como mucho
  const nat = window.PSNativo && PSNativo.segunda ? PSNativo : null;
  let canal = null;
  if (!nat) { try { canal = new BroadcastChannel('ps.second'); } catch (e) { /* navegador sin BroadcastChannel */ } }

  let hay = nat ? !!nat.segundaDisponible() : false;   // ¿hay un panel al otro lado?
  let t = 0;
  let visto = 0;             // navegador: último saludo del panel (si se cierra la ventana, deja de saludar)
  let avisado = false;

  const APAGADA = { t: 'e', s: 'ui', modo: 'off', lang: G.I18n.lang };

  const modo = () => (MODES.includes(G.Settings.get('second')) ? G.Settings.get('second') : 'stats');

  function enviar(o) {
    const s = JSON.stringify(o);
    if (nat) nat.segunda(s);
    else if (canal) canal.postMessage(s);
  }

  // ---------------- lo que se manda ----------------

  const r1 = v => Math.round(v);
  const cdOf = (m, pl) => m.kind === 'orbit' ? 0 : G.U.clamp(m.t / (m.cd * pl.cdMul), 0, 1);

  function mapa(pl) {
    const e = [];
    const todos = G.EnemyMgr.all();
    // Jefes y shinies siempre; del resto, los que quepan.
    for (const x of todos) {
      if (x.dead) continue;
      const dx = x.x - pl.x, dy = x.y - pl.y;
      const f = x.boss ? 2 : x.shiny ? 1 : 0;
      if (!f && (e.length >= MAP_MAX * 3 || Math.abs(dx) > MAP_R || Math.abs(dy) > MAP_R)) continue;
      e.push(r1(dx), r1(dy), f);
    }
    const rift = G.Rift.rift;
    return {
      r: MAP_R, e,
      rift: rift ? [r1(rift.x - pl.x), r1(rift.y - pl.y), Math.ceil(rift.ttl)] : null,
      mates: G.Coop.active ? G.Coop.mates.filter(m => m.connected).map(m => [r1(m.pl.x - pl.x), r1(m.pl.y - pl.y), m.color, m.pl.dead ? 1 : 0, m.name]) : []
    };
  }

  function cartas() {
    if (!G.Settings.get('secondCards') || !G.UI.isOpen('scr-levelup')) return null;
    const list = G.RunUI.offers;
    return list ? list.map(c => ({ n: c.title, d: c.desc, tag: c.tag, c: c.color, ty: c.type })) : null;
  }
  /** Identifica una tanda de cartas: un toque que llega tarde no elige de la siguiente. */
  const tanda = list => (list || []).map(c => c.key || c.title).join('|');

  function resumen() {
    const pl = G.Game.player, s = G.Game.state, m = modo();
    const o = { t: 'e', s, modo: m, lang: G.I18n.lang, cartasOn: !!G.Settings.get('secondCards') };
    if (!pl || s === 'ui') { o.s = 'ui'; return o; }
    const boss = G.EnemyMgr.all().find(e => e.boss && !e.dead);
    const wx = G.Weather.current;
    o.p = {
      n: pl.mon.name, lv: pl.level, hp: Math.ceil(pl.hp), mh: r1(pl.maxHp), xp: G.U.clamp(pl.xp / pl.xpNext, 0, 1),
      k: pl.kills, c: pl.coins, tm: G.U.mmss(G.Game.st.time), bio: G.World.biomeName(), act: pl.active,
      buffs: Object.keys(pl.buffs).filter(k => pl.buffs[k].n > 0).map(k => [k, pl.buffs[k].n]),
      power: pl.power ? [pl.power.def.name, Math.ceil(pl.power.t), pl.power.def.color] : null,
      item: pl.item ? G.Items.BY[pl.item].name : null
    };
    o.m = pl.slots.map(g => {
      const mv = g[0];
      return { n: mv.name, c: G.U.TYPE_COLOR[mv.type], ty: G.U.TYPE_NAME[mv.type], cd: +cdOf(mv, pl).toFixed(2),
               lv: mv.lvl, mx: mv.def.maxLvl, ev: mv.evolved ? 1 : 0, f: g.length - 1 };
    });
    o.boss = boss ? [boss.name, G.U.clamp(boss.hp / boss.maxHp, 0, 1)] : null;
    o.wx = wx ? [wx.name, Math.ceil(wx.left), wx.color] : null;
    if (m === 'map') o.map = mapa(pl);
    o.cards = cartas();
    if (o.cards) o.ck = tanda(G.RunUI.offers);
    return o;
  }

  /** Lo llama el bucle del juego en cada fotograma. */
  function tick(dt) {
    if (!hay || modo() === 'off') return;
    t -= dt;
    if (t > 0) return;
    // En partida, unas 12 veces por segundo; en los menús basta con una.
    t = G.Game.state === 'ui' || G.Game.state === 'over' ? 1 : 0.08;
    // La ventana del panel se ha cerrado (navegador): no hay a quién mandar nada.
    if (canal && performance.now() - visto > 8000) { hay = false; return; }
    // Un fallo aquí no puede llevarse por delante el fotograma del juego.
    try { enviar(resumen()); }
    catch (e) { if (!avisado) { avisado = true; console.warn('[Segunda pantalla]', e); } }
  }

  // ---------------- lo que llega del panel ----------------

  /** El panel avisa de lo que se toca: { a: 'mov', i: 2 }, { a: 'pausa' }... */
  function accion(a) {
    if (typeof a === 'string') { try { a = JSON.parse(a); } catch (e) { return; } }
    if (!a || typeof a !== 'object') return;
    const pl = G.Game.player;
    visto = performance.now();
    if (a.a === 'hola') {
      if (!hay) t = 0;
      hay = true;
      if (modo() === 'off') enviar(APAGADA);   // en 'off' no hay resúmenes: que el panel lo sepa
    }
    else if (a.a === 'modo') { if (MODES.includes(a.v)) G.Settings.set('second', a.v); }
    // Con Ajustes abierto encima de la pausa, igual que las teclas: no se toca.
    else if (a.a === 'pausa') { if (!G.SettingsUI.isOpen) G.Game.togglePause(); }
    else if (a.a === 'mov') {
      const i = a.i | 0;
      if (pl && G.Game.state === 'playing' && pl.slots[i] && pl.active !== i) { pl.setActive(i); G.Audio.sfx('click'); }
    }
    else if (a.a === 'carta') { if (G.UI.isOpen('scr-levelup') && a.k === tanda(G.RunUI.offers)) G.RunUI.pick(a.i | 0); }
  }

  if (canal) canal.onmessage = e => accion(e.data);

  /** La app avisa cuando aparece o desaparece la pantalla de abajo. */
  function pantalla(si) { hay = !!si; t = 0; }

  // En 'off' la app suelta la pantalla de abajo (el sistema puede usarla para otra cosa).
  function aplicar() {
    if (nat) nat.segundaVisible(modo() !== 'off');
    t = 0;
    if (hay && modo() === 'off') enviar(APAGADA);
  }
  G.Settings.on(k => { if (k === 'second' || k === 'secondCards') aplicar(); });
  aplicar();

  return {
    MODES, tick, accion, pantalla,
    /** ¿Hay segunda pantalla (o un panel abierto en otra ventana)? */
    get disponible() { return hay; },
    get nativa() { return !!nat; }
  };
})();
