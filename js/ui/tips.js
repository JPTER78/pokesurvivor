/* ============ tips.js — avisos de primera vez (caja de diálogo de Mundo Misterioso) ============
 * La primera vez que pasa algo, tu compañero te lo cuenta en una caja abajo,
 * con el texto escribiéndose solo. Clic, toque, Intro o Espacio: sigue (si el
 * texto aún se está escribiendo, lo termina). Esc: cierra.
 *
 * Cada aviso sale UNA vez por cuenta: save.told[id] (se junta entre aparatos
 * en db.js). Los de 'shop', 'tm' y 'win' son los mismos que los avisos cortos
 * de antes: quien ya los vio, no los vuelve a ver.
 *
 *   where 'menu'  en el menú principal (sin nada encima)
 *         'run'   en partida: en solitario la partida se para mientras lees;
 *                 en grupo no (los demás siguen) y cada página se pasa sola
 *   when  () -> ¿toca ya?  (se mira cuatro veces por segundo)
 *   pages () -> [textos]   (en español: se traducen al enseñarlos)
 */
G.Tips = (() => {
  const S = () => G.DB.save;
  const rankName = i => G.Acts.RANKS[i].name;

  const TIPS = [
    // ---------------- menú ----------------
    { id: 'monlv', where: 'menu', when: s => (s.stats.runs || 0) >= 1, pages: () => [
      '¡Primera partida terminada! Cada Pokémon tiene su propio nivel (Nv.), que sube con la experiencia que gana jugando contigo.',
      'Al subir de nivel aprende movimientos nuevos, los mismos que en los juegos, y te pueden salir en las cartas. Lo verás todo en su ficha (botón Pokémon del menú).'] },
    { id: 'shop', where: 'menu', when: () => G.Shop.unlocked('shop'), pages: () => [
      '¡Ha abierto la Tienda Kecleon! Vende caramelos para subir de nivel a tus Pokémon.',
      'Se paga con las Pokémonedas que ganas en cada partida. Lo que compres va a la Mochila.',
      // Las MT sólo si su aviso ya salió antes (si no, lo dice él justo después).
      ...((S().told || {}).tm ? ['También vende MT, para enseñar movimientos nuevos.'] : [])] },
    { id: 'tm', where: 'menu', when: () => G.Shop.unlocked('tm'), pages: () => [
      'Has conseguido una MT: está en la Mochila. Sirve para enseñar a un Pokémon un movimiento que no aprende por nivel.',
      ...(G.Shop.unlocked('shop') ? ['Desde ahora la Tienda Kecleon también vende MT.'] : [])] },
    { id: 'win', where: 'menu', when: () => G.Shop.unlocked('win'), pages: () => [
      '¡Has ganado tu primera partida! Has desbloqueado el rango ' + rankName(1) + '.',
      'Cada rango es más duro, pero da más monedas y experiencia. Debajo de Jugar eliges con cuál juegas; en grupo, el anfitrión elige hasta el más alto del grupo.',
      'Además, la Tienda Kecleon ya vende Mentas (cambian la naturaleza) y Cápsulas Habilidad.'] },
    { id: 'master', where: 'menu', when: s => G.Acts.rankOf(s) >= G.Acts.MAX_RANK, pages: () => [
      '¡Has llegado al rango ' + rankName(G.Acts.MAX_RANK) + '!',
      'Si vences al jefe final y no cruzas el portal, empieza el modo infinito: oleadas sin fin. El ranking cuenta cuánto aguantas ahí.'] },

    // ---------------- partida ----------------
    { id: 'start', where: 'run', when: () => G.Game.st.time > 2.5 && !G.Rift.inArena, pages: () => [
      '¡Vamos allá! Muévete y yo ataco solo. Recoge la experiencia para subir de nivel y elegir cartas.',
      'La partida tiene 3 actos de 10 minutos. Al final de cada uno llega un jefe de zona.'] },
    { id: 'coop', where: 'run', when: () => G.Coop.active && G.Game.st.time > 8, pages: () => [
      'Jugáis en grupo: si alguien cae, quédate a su lado para levantarle. Mensajes rápidos con las teclas 5-8 (o el bocadillo en el móvil).'] },
    { id: 'zone', where: 'run', when: () => G.Acts.phase === 'zone', pages: () => [
      '¡Un jefe de zona! Véncelo para pasar al siguiente acto, en otro bioma. Si tardas mucho, se enfurece.'] },
    { id: 'final', where: 'run', when: () => G.Acts.phase === 'final', pages: () => [
      '¡El jefe final! Es un legendario con fases. Si lo vences, se abrirá un portal: crúzalo para ganar la partida.'] },
    { id: 'rift', where: 'run', when: () => !!G.Rift.rift && !G.Rift.inArena, pages: () => [
      '¡Una grieta! Si entras, te espera un legendario en su arena. Si lo vences, consigues un vínculo para lanzar varios movimientos a la vez.'] },
    { id: 'special', where: 'run', when: () => G.EnemyMgr.all().some(e => (e.alpha || e.totem) && !e.dead && G.Camera.sees(e.x, e.y, 0)), pages: () => [
      'Ese jefe es Alfa (enorme, ojos rojos) o Dominante (aura dorada, llama a ayudantes). Es más fuerte, pero suelta mucho más botín.'] }
  ];

  let el = null, face = null, nameEl = null, textEl = null;
  let cur = null;            // { id, pages, i, shown, full, where, t, typeT }
  const extra = [];          // avisos sueltos (sin id): G.Tips.say([...])
  const TYPE_CPS = 55;       // letras por segundo
  const COOP_PAGE = 8;       // en grupo, segundos por página

  function build() {
    if (el) return;
    el = document.createElement('div');
    el.id = 'tip';
    el.className = 'box tip hidden';
    el.innerHTML = '<div class="tip-face"></div><div class="tip-body"><b class="tip-name" translate="no"></b>' +
                   '<p class="tip-text" translate="no"></p><span class="tip-next">▼</span></div>';
    document.body.appendChild(el);
    face = el.querySelector('.tip-face'); nameEl = el.querySelector('.tip-name'); textEl = el.querySelector('.tip-text');
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); next(); });
    addEventListener('keydown', e => {
      if (!cur) return;
      const k = e.key;
      if (k !== 'Enter' && k !== ' ' && k !== 'Escape') return;
      e.preventDefault(); e.stopPropagation();
      if (k === 'Escape') close(); else next();
    }, true);
  }

  // ¿Se puede enseñar un aviso de este sitio ahora mismo?
  function free(where) {
    if (!S() || G.SettingsUI.isOpen) return false;
    if (where === 'menu') return G.Game.state === 'ui' && G.UI.isOpen('scr-menu')
      && document.getElementById('pull-fx').classList.contains('hidden');
    return G.Game.state === 'playing' && !G.UI.isOpen('scr-pause') && !G.UI.isOpen('scr-item') && !G.UI.isOpen('scr-bond');
  }

  function speaker() {
    const pl = G.Game.state !== 'ui' && G.Game.player;
    const dex = pl ? pl.dex : S().partner;
    const shiny = pl ? pl.shiny : !!S().partnerShiny && G.DB.ownsShiny(S().partner);
    return { dex, shiny, name: (G.DEX_BY[dex] || {}).name || '' };
  }

  function open(id, pages, where) {
    build();
    cur = { id, pages: pages.map(p => G.I18n.t(p)), i: 0, where, t: 0 };
    const sp = speaker();
    face.innerHTML = '';
    face.appendChild(G.UI.spriteCanvas(sp.dex, 64, 64, { lively: true, shiny: sp.shiny }));
    nameEl.textContent = sp.name;
    el.classList.toggle('run', where === 'run');
    el.classList.remove('hidden');
    if (where === 'run' && !G.Coop.active) G.Game.tipHold(true);
    page();
  }

  function page() {
    cur.full = cur.pages[cur.i]; cur.shown = 0; cur.t = 0;
    textEl.textContent = '';
    el.classList.remove('done');
    G.Audio.sfx('select');
  }

  function next() {
    if (!cur) return;
    if (cur.shown < cur.full.length) { cur.shown = cur.full.length; textEl.textContent = cur.full; el.classList.add('done'); return; }
    if (++cur.i < cur.pages.length) page(); else close();
  }

  function close() {
    if (!cur) return;
    if (cur.where === 'run') G.Game.tipHold(false);
    cur = null;
    el.classList.add('hidden');
    face.innerHTML = '';
    G.Audio.sfx('click');
  }

  function tell(t) {
    const s = S();
    s.told = s.told || {};
    s.told[t.id] = Date.now();
    G.DB.commit();
    open(t.id, t.pages(), t.where);
  }

  // Cuatro veces por segundo: ¿toca algún aviso? Y el texto que se va escribiendo.
  let last = performance.now(), checkT = 0;
  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!G.Game || !G.DB || !G.SettingsUI) return;          // aún cargando
    try { step(dt); } catch (e) { console.warn('[Tips]', e); }
  }
  function step(dt) {
    if (cur) {
      // Si la partida se acaba (o se va al menú) con un aviso de partida abierto, se cierra.
      if (cur.where === 'run' && G.Game.state !== 'playing' && G.Game.state !== 'tip') close();
      // Y uno del menú, si empieza una partida (no la paraba y se comía Esc).
      else if (cur.where !== 'run' && G.Game.state !== 'ui') close();
      else if (cur.shown < cur.full.length) {
        cur.shown = Math.min(cur.full.length, cur.shown + dt * TYPE_CPS);
        textEl.textContent = cur.full.slice(0, Math.floor(cur.shown));
        if (cur.shown >= cur.full.length) el.classList.add('done');
      } else if (cur.where === 'run' && G.Coop.active && (cur.t += dt) > COOP_PAGE) next();
    } else if ((checkT -= dt) <= 0) {
      checkT = 0.25;
      check();
    }
  }

  function check() {
    const s = S();
    if (!s) return;
    if (extra.length && free('menu')) { open(null, extra.shift(), 'menu'); return; }
    const told = s.told || {};
    for (const t of TIPS) {
      if (told[t.id] || !free(t.where)) continue;
      let ok = false;
      try { ok = t.when(s); } catch (e) { ok = false; }
      if (ok) { tell(t); return; }
    }
  }

  requestAnimationFrame(loop);

  return {
    TIPS,
    /** Aviso suelto en el menú (no se apunta: p. ej. la devolución de monedas). */
    say(pages) { extra.push(pages); },
    get open() { return !!cur; },
    /** Para pruebas: vuelve a enseñar todos. */
    reset() { const s = S(); if (s && s.told) for (const t of TIPS) delete s.told[t.id]; }
  };
})();
