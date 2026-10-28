/* ============ menu.js — menú principal, colección y mejoras ============ */
G.MenuUI = (() => {
  const $ = G.UI.$;
  const GEN_NAMES = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'];
  let dexGen = 1, dexSel = null;
  // Filtros de la colección (se combinan): tengo / me faltan, rarezas (varias),
  // shiny, favoritos, tipo y búsqueda; y el orden. Duran mientras no recargas.
  const DEX0 = () => ({ status: 'all', rar: new Set(), shiny: false, fav: false, type: '', q: '', sort: 'num' });
  let dexF = DEX0();
  const SORTS = [['num', 'Nº'], ['name', 'Nombre'], ['rar', 'Rareza'], ['new', 'Recién conseguidos'], ['used', 'Más usados']];

  function init() {
    const ICON = { play: 'ball', dex: 'book', upgrades: 'up', shop: 'shop', bag: 'bag', gacha: 'ball4', goals: 'medal3', friends: 'friends', rank: 'trophy', settings: 'gear' };
    document.querySelectorAll('#scr-menu [data-go]').forEach(b => {
      b.insertAdjacentHTML('afterbegin', `<span class="mi-ico">${G.Icons.html(ICON[b.dataset.go], 26)}</span>`);
      b.dataset.sfx = b.dataset.go === 'play' ? 'confirm' : 'click';
      b.onclick = () => {
        const go = b.dataset.go;
        if (go === 'play') { if (G.Social.room) G.LobbyUI.open(); else G.Flow.play(); }
        else if (go === 'dex') openDex();
        else if (go === 'upgrades') openUpgrades();
        else if (go === 'shop') G.ShopUI.open();
        else if (go === 'bag') G.ShopUI.openBag();
        else if (go === 'gacha') G.GachaUI.open();
        else if (go === 'goals') G.GoalsUI.open();
        else if (go === 'friends') G.FriendsUI.open();
        else if (go === 'rank') G.RankingUI.open();
        else if (go === 'settings') G.SettingsUI.open();
      };
    });
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = open; });
    G.Social.on(() => { if (G.UI.isOpen('scr-menu')) socialLine(); });
    $('btn-logout').onclick = () => {
      if (G.DB.guest && !confirm('Eres invitado: se perderá todo el progreso. ¿Salir?')) return;
      G.Audio.music(null);
      G.DB.logout().then(() => G.Flow.toLogin());
    };
  }

  // ---------------- menú principal ----------------

  function open() {
    const s = G.DB.save;
    const mon = G.DEX_BY[s.partner];
    const shiny = !!s.partnerShiny && G.DB.ownsShiny(mon.dex);
    G.UI.chrome(true);
    G.UI.show('scr-menu');
    bagLine();
    hwLine();
    G.UI.sprite($('menu-partner'), mon.dex, { lively: true, scale: 4, hero: true, shiny, skin: G.Skins.worn(s, mon.dex) });
    $('menu-partner').style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
    $('menu-partner').classList.toggle('shiny', shiny);
    $('menu-partner-name').innerHTML = mon.name + (shiny ? ' ' + G.Icons.html('shiny', 24) : '');
    $('menu-partner-info').innerHTML = G.UI.typeChips(mon.types) + ' ' + G.UI.stars(mon.rarity);
    // Normal / shiny a mano, aquí mismo (en el móvil no se encontraba en la ficha).
    const seg = $('menu-shiny');
    seg.classList.toggle('hidden', !G.DB.ownsShiny(mon.dex));
    seg.lastChild.innerHTML = G.Icons.html('shiny', 12) + ' Shiny';
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', (b.dataset.v === '1') === shiny);
      b.onclick = () => {
        if ((b.dataset.v === '1') === shiny) return;
        s.partnerShiny = b.dataset.v === '1';
        G.DB.commit();
        G.Audio.sfx('confirm');
        open();
      };
    });

    const owned = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    const shinies = Object.keys(s.shiny || {}).length;
    $('menu-dex-count').textContent = `${owned} / ${G.DEX.length}` + (shinies ? ` · ${shinies} shiny` : '');

    const st = s.stats;
    $('menu-stats').innerHTML =
      `Runs <b style="color:#fff">${st.runs}</b> · Mejor tiempo <b style="color:#fff">${G.U.mmss(st.bestTime)}</b><br>` +
      `Mejor nivel <b style="color:#fff">${st.bestLevel}</b> · Derrotados <b style="color:#fff">${st.totalKills.toLocaleString(G.I18n.locale)}</b>` +
      (G.DB.guest ? '<br><span style="color:#ffb0b8">Modo invitado: no se guarda</span>' : '');

    socialLine();
    // Premios de misiones por recoger.
    G.Progress.checkAch();
    const pend = G.Progress.pending();
    $('menu-goals-sub').textContent = pend ? pend + (pend === 1 ? ' premio por recoger' : ' premios por recoger') : 'Misiones, logros y perfil';
    $('menu-goals-sub').classList.toggle('gold', pend > 0);
    // Con cuenta en la nube: amigos en línea, invitaciones y (una vez) el apodo.
    if (G.DB.online && !G.Social.started) {
      G.Social.start().then(r => {
        if (r === 'need-nick' && !G.NickUI.skipped && G.UI.isOpen('scr-menu')) G.NickUI.open();
        socialLine();
      });
    }
    G.InvitePop.refresh();
  }

  /** Texto bajo "Mochila": cuántos objetos y MT llevas (y los Amuletos Iris, si hay). */
  /*
   * Halloween: cuenta atrás bajo el título (systems/halloween.js): 14 días antes,
   * cuánto falta; durante el evento, cuánto queda. Se pone al día cada segundo
   * mientras se ve el menú.
   */
  const hms = ms => { const t = Math.floor(ms / 1000); return [Math.floor(t / 3600) % 24, Math.floor(t / 60) % 60, t % 60].map(v => String(v).padStart(2, '0')).join(':'); };
  const left = ms => { const d = Math.floor(ms / 864e5); return d ? G.I18n.f('{x} d {x}', d, hms(ms)) : hms(ms); };
  let hwT = 0;
  function hwLine() {
    const el = $('menu-hw'), c = G.Halloween.countdown();
    const txt = G.Halloween.on ? (c && c.on ? G.I18n.f('¡Halloween! Termina en {x}', left(c.ms)) : G.T('¡Halloween!'))
      : c && !c.on ? G.I18n.f('Halloween empieza en {x}', left(c.ms)) : '';
    el.classList.toggle('hidden', !txt);
    if (txt) el.innerHTML = `${G.Icons.html('pumpkin', 18)} <span>${txt}</span>`;
    if (!hwT && txt) hwT = setInterval(() => { if (G.UI.isOpen('scr-menu')) hwLine(); }, 1000);
  }

  function bagLine() {
    const s = G.DB.save, sum = o => Object.values(o || {}).reduce((a, b) => a + (+b || 0), 0);
    const candy = (s.bag && s.bag.candy) || 0;
    const items = sum(s.bag) - candy, tms = sum(s.tms), iris = G.Gacha.BANNERS.filter(b => G.Gacha.hasIris(s, b.gen)).length;
    const parts = [];
    if (items || tms) parts.push(G.I18n.f('Objetos: {x} · MT: {x}', items, tms));
    if (candy) parts.push(G.I18n.f('Caramelos: {x}', candy));
    if (iris) parts.push(G.I18n.f('Amuletos Iris: {x}', iris));
    $('menu-bag-sub').textContent = parts.join(' · ') || G.T('Vacía');
  }

  /** Texto bajo "Amigos" y "Jugar": quién está en línea, solicitudes, sala. */
  function socialLine() {
    const room = G.Social.room;
    const play = document.querySelector('#scr-menu [data-go=play] small');
    if (play) play.textContent = room ? 'Volver a tu sala (' + room.members.length + '/' + G.Social.MAX_PLAYERS + ')' : 'Entra en la mazmorra';
    const fr = G.Social.friends;
    const req = fr.filter(f => f.status === 'in').length;
    const parts = [];
    if (req) parts.push(req + (req === 1 ? ' solicitud' : ' solicitudes'));
    $('menu-friends-sub').textContent = parts.length ? parts.join(' · ') : 'Juega en grupo, hasta 4';
    $('menu-friends-sub').classList.toggle('gold', req > 0);
  }

  // ---------------- colección ----------------

  function openDex() {
    G.UI.show('scr-dex', true);
    const s = G.DB.save;
    if (dexSel == null) { dexSel = s.partner; dexGen = G.DEX_BY[s.partner].gen; }
    const owned = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    $('dex-total').textContent = `${owned} / ${G.DEX.length}`;

    // Pestañas de generación (y "Todas"), con cuántos tienes de cada una.
    const tabs = $('dex-gens');
    tabs.innerHTML = '';
    ['Todas', ...GEN_NAMES].forEach((name, g) => {
      const list = g ? G.DEX.filter(p => p.gen === g) : G.DEX;
      const have = list.filter(p => s.owned[p.dex]).length;
      const b = document.createElement('button');
      b.className = 'gen-tab' + (g === dexGen && !dexF.q ? ' on' : '');
      b.innerHTML = `<b>${name}</b><small>${have}/${list.length}</small>`;
      b.onclick = () => { dexGen = g; openDex(); };
      tabs.appendChild(b);
    });

    // Tengo / me faltan (uno), rarezas (las que quieras), shiny y favoritos.
    const fb = $('dex-filters');
    fb.innerHTML = '';
    const chip = (html, on, fn) => {
      const c = document.createElement('button');
      c.className = 'chip' + (on ? ' on' : '');
      c.innerHTML = html;
      c.onclick = () => { fn(); openDex(); };
      fb.appendChild(c);
    };
    for (const [k, label] of [['all', 'Todos'], ['own', 'Tengo'], ['miss', 'Me faltan']]) chip(label, dexF.status === k, () => { dexF.status = k; });
    chip(G.Icons.html('shiny', 12) + ' Shiny', dexF.shiny, () => { dexF.shiny = !dexF.shiny; });
    chip(G.Icons.html('star', 12) + ' Favoritos', dexF.fav, () => { dexF.fav = !dexF.fav; });
    for (const r of [5, 4, 3, 2, 1]) {
      chip(G.Icons.rarity(r, 12) + ' ' + G.Gacha.RARITY_NAME[r], dexF.rar.has(r), () => { dexF.rar.has(r) ? dexF.rar.delete(r) : dexF.rar.add(r); });
    }

    // Orden.
    const sb = $('dex-sort');
    sb.innerHTML = '<span class="sub">Orden:</span>';
    for (const [k, label] of SORTS) {
      const c = document.createElement('button');
      c.className = 'chip' + (dexF.sort === k ? ' on' : '');
      c.textContent = label;
      c.onclick = () => { dexF.sort = k; openDex(); };
      sb.appendChild(c);
    }

    // Tipo y búsqueda (la búsqueda mira en todas las generaciones).
    const ts = $('dex-type');
    ts.innerHTML = `<option value="">Todos los tipos</option>` +
      Object.keys(G.U.TYPE_NAME).map(t => `<option value="${t}">${G.U.TYPE_NAME[t]}</option>`).join('');
    ts.value = dexF.type;
    ts.onchange = () => { dexF.type = ts.value; openDex(); };
    const q = $('dex-q');
    if (q.value !== dexF.q) q.value = dexF.q;
    q.oninput = () => {
      clearTimeout(qT);
      qT = setTimeout(() => {
        dexF.q = q.value; renderGrid();
        $('dex-gens').querySelectorAll('.gen-tab').forEach((b, g) => b.classList.toggle('on', g === dexGen && !dexF.q));
      }, 150);
    };
    q.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); q.blur(); } };
    $('dex-clear').onclick = () => { dexF = DEX0(); openDex(); };
    renderGrid();
    showDetail(dexSel);
  }

  /** Lo que se ve con la generación, los filtros y el orden de ahora. */
  function dexList() {
    const s = G.DB.save, f = dexF;
    const q = f.q.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const num = /^#?\d+$/.test(q) ? +q.replace('#', '') : null;
    const list = G.DEX.filter(p => {
      const own = !!s.owned[p.dex];
      if (q) {
        // Por número, o por nombre (sin tildes); de los que no tienes no se busca el nombre.
        if (num != null ? p.dex !== num : !(own && [p.name, G.T(p.name)].some(name => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)))) return false;
      } else if (dexGen && p.gen !== dexGen) return false;
      if (f.status === 'own' && !own) return false;
      if (f.status === 'miss' && own) return false;
      if (f.shiny && !(s.shiny && s.shiny[p.dex])) return false;
      if (f.fav && !G.DB.isFav(p.dex)) return false;
      if (f.rar.size && !f.rar.has(p.rarity)) return false;
      if (f.type && !(own && p.types.includes(f.type))) return false;
      return true;
    });
    const at = p => (s.owned[p.dex] && s.owned[p.dex].at) || 0, used = p => +(s.pused || {})[p.dex] || 0;
    const by = { num: (a, b) => a.dex - b.dex, name: (a, b) => G.T(a.name).localeCompare(G.T(b.name), G.I18n.locale),
                 rar: (a, b) => b.rarity - a.rarity || a.dex - b.dex, new: (a, b) => at(b) - at(a) || a.dex - b.dex,
                 used: (a, b) => used(b) - used(a) || a.dex - b.dex }[f.sort];
    // Los que no tienes no tienen nombre a la vista: al ordenar por nombre van al final.
    if (f.sort === 'name') list.sort((a, b) => (!s.owned[a.dex]) - (!s.owned[b.dex]) || by(a, b)); else list.sort(by);
    return list;
  }

  /*
   * La rejilla se pinta por tandas de PAGE: con "Todas" son 966 Pokémon, cada
   * uno con su animación y su hoja de sprites, y pintarlos de golpe paraba el
   * juego (y la música) un segundo al borrar la búsqueda o cambiar el orden.
   * Al acercarse al final de la lista se pinta la siguiente tanda.
   * keep: volver a pintar los mismos que había (marcar un favorito no te
   * devuelve arriba).
   */
  const PAGE = 48;
  let qT = 0, gridList = [], gridShown = 0, gridIO = null;
  function renderGrid(keep = false) {
    const grid = $('dex-grid');
    const want = keep ? Math.max(PAGE, gridShown) : PAGE;
    const top = grid.scrollTop;
    grid.innerHTML = '';
    gridList = dexList();
    gridShown = 0;
    const f = dexF, busy = f.q || f.status !== 'all' || f.shiny || f.fav || f.rar.size || f.type || f.sort !== 'num';
    $('dex-count').textContent = gridList.length === 1 ? '1 Pokémon' : gridList.length + ' Pokémon';
    $('dex-clear').classList.toggle('hidden', !busy);
    if (!gridList.length) { grid.innerHTML = '<p class="sub" style="grid-column:1/-1">Ninguno con estos filtros.</p>'; return; }
    moreCells(want);
    if (keep) grid.scrollTop = top;
  }

  function moreCells(n = PAGE) {
    const grid = $('dex-grid');
    const old = grid.querySelector('.dex-more');
    if (old) { if (gridIO) gridIO.unobserve(old); old.remove(); }
    const end = Math.min(gridList.length, gridShown + n);
    for (let i = gridShown; i < end; i++) grid.appendChild(dexCell(gridList[i]));
    gridShown = end;
    if (gridShown >= gridList.length) return;
    // Marca al final: cuando se acerca a la vista, la siguiente tanda.
    const more = document.createElement('div');
    more.className = 'dex-more';
    grid.appendChild(more);
    if (!('IntersectionObserver' in window)) { moreCells(gridList.length); return; }
    gridIO = gridIO || new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) moreCells(); }, { rootMargin: '300px' });
    gridIO.observe(more);
  }

  function dexCell(p) {
    const s = G.DB.save;
    const own = !!s.owned[p.dex], sh = !!(s.shiny && s.shiny[p.dex]);
    const cell = document.createElement('div');
    cell.className = 'cell' + (own ? '' : ' locked') + (p.dex === dexSel ? ' on' : '');
    cell.dataset.pad = '1';
    cell.insertAdjacentHTML('beforeend', `<span class="no">${String(p.dex).padStart(3, '0')}${G.DB.isFav(p.dex) ? ' ' + G.Icons.html('star', 10) : ''}</span>`);
    if (p.dex === s.partner) cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="Compañero">${G.Icons.html('crown', 14)}</span>`);
    else if (sh) cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="Tienes su shiny">${G.Icons.html('shiny', 12)}</span>`);
    const useShiny = sh && p.dex === s.partner && s.partnerShiny;
    cell.appendChild(G.UI.spriteCanvas(p.dex, 92, 80, { scale: 2, silhouette: !own, shadow: own, shiny: useShiny }));
    cell.insertAdjacentHTML('beforeend', `<b>${own ? p.name : '???'}</b>${G.UI.stars(p.rarity, 9)}`);
    cell.onclick = () => {
      dexSel = p.dex;
      $('dex-grid').querySelectorAll('.cell').forEach(c => c.classList.remove('on'));
      cell.classList.add('on');
      showDetail(p.dex);
    };
    return cell;
  }

  // Variante que se está viendo en la ficha (normal o shiny).
  let viewShiny = false;

  function showDetail(dex) {
    const s = G.DB.save;
    const p = G.DEX_BY[dex];
    const own = !!s.owned[dex];
    const hasSh = G.DB.ownsShiny(dex);
    const isPartner = dex === s.partner;
    if (!hasSh) viewShiny = false;
    else if (isPartner && dex !== showDetail.last) viewShiny = !!s.partnerShiny;
    if (dex !== showDetail.last) extraOpen = '';
    // Al redibujar el mismo Pokémon (abrir el selector de Menta, enseñar una MT...)
    // no se vuelve arriba: se quedaba fuera de la vista lo que acababas de abrir.
    const sameMon = dex === showDetail.last, d0 = $('dex-detail');
    const scrolls = sameMon && d0 ? [d0, d0.closest('.box')].filter(Boolean).map(el => [el, el.scrollTop]) : [];
    showDetail.last = dex;

    const max = { hp: 183, atk: 1.55, spd: 137, def: 160 };
    // Con su naturaleza (20-10-2026): el stat que sube, en verde; el que baja, en rojo.
    const nat = own ? G.Mons.natureOf(dex) : null, q = own ? G.Mons.monFor(dex) : p;
    const natCls = k => (!nat ? '' : nat.up === k ? ' nat-up' : nat.down === k ? ' nat-down' : '');
    const bar = (label, v, m, txt, k) =>
      `<div class="stat${natCls(k)}"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, v / m * 100)}%"></i></div><span>${txt}</span></div>`;
    const usingThis = isPartner && (!hasSh || !!s.partnerShiny === viewShiny);

    const box = $('dex-detail');
    box.innerHTML = `
      <canvas id="dex-big" class="stage" width="220" height="190"></canvas>
      ${hasSh ? `<div class="seg">
          <button class="${viewShiny ? '' : 'on'}" data-v="0">Normal</button>
          <button class="${viewShiny ? 'on' : ''}" data-v="1">${G.Icons.html('shiny', 12)} Shiny</button></div>` : ''}
      <div class="center">
        <div style="color:var(--muted);font-size:13px">Nº ${String(p.dex).padStart(3, '0')} · ${GEN_NAMES[p.gen - 1]}</div>
        <h3>${own ? p.name : '???'}</h3>
        ${own ? `<button id="dex-fav" class="chip${G.DB.isFav(dex) ? ' on' : ''}" type="button">${G.Icons.html(G.DB.isFav(dex) ? 'star' : 'starDim', 12)} ${G.DB.isFav(dex) ? 'Favorito' : 'Marcar como favorito'}</button>` : ''}
        <div style="color:${G.Gacha.RARITY_COLOR[p.rarity]}">${G.UI.stars(p.rarity, 24)} ${G.Gacha.RARITY_NAME[p.rarity]}</div>
        <div style="margin:6px 0">${own ? G.UI.typeChips(p.types) : ''}</div>
      </div>
      ${own ? `
        ${bar('Vida', q.hp, max.hp, q.hp)}
        ${bar('Ataque', q.pa, max.atk, '×' + q.pa.toFixed(2), 'pa')}
        ${bar('At. Esp.', q.sa, max.atk, '×' + q.sa.toFixed(2), 'sa')}
        ${bar('Defensa', q.df, max.def, Math.round(q.df), 'df')}
        ${bar('Def. Esp.', q.sd, max.def, Math.round(q.sd), 'sd')}
        ${bar('Velocidad', q.spd, max.spd, Math.round(q.spd), 'spd')}
        <p class="sub center" style="margin:6px 0 0">Pega mejor con ataques <b class="gold">${G.Stats.sideOf(q) === 'special' ? 'especiales' : 'físicos'}</b></p>
        ${monExtras(dex)}
        ${p.types.length === 1 ? `<p class="sub center" style="margin:2px 0 0">Monotipo: +20 % de daño con sus ataques de tipo ${G.U.TYPE_NAME[p.types[0]]}</p>` : ''}
        <p style="font-size:14px;margin:10px 0 4px">Empieza con <b class="gold">${G.T(G.Moves.BY_ID[G.startMoveOf(dex)].name, 'move')}</b></p>
        <p class="move-icons" id="dex-moves">
          ${G.Moves.poolFor(p).map(id => `<span data-move="${id}">${G.Icons.html('move:' + id, 32)}</span>`).join('')}</p>
        ${usingThis
          ? '<button class="btn grow" disabled style="width:100%">Es tu compañero</button>'
          : `<button id="dex-pick" class="btn gold" data-sfx="confirm" style="width:100%">Elegir de compañero${viewShiny ? ' (shiny)' : ''}</button>`}
      ` : `<p class="center" style="color:var(--muted)">Aún no lo tienes.<br>Consíguelo en el banner de <b class="gold">${GEN_NAMES[p.gen - 1]}</b>
            o derrotándolo cuando salga shiny.</p>`}
    `;
    for (const [el, t] of scrolls) el.scrollTop = t;
    moveTips($('dex-moves'));
    $('dex-big').style.setProperty('--stage-c', !own ? '#5b83d6' : viewShiny ? '#9ae6ff' : G.U.TYPE_COLOR[p.types[0]]);
    $('dex-big').classList.toggle('shiny', own && viewShiny);
    G.UI.sprite($('dex-big'), dex, { lively: own, spin: own, silhouette: !own, scale: 3, hero: true, shiny: own && viewShiny,
                                     skin: own ? G.Skins.worn(s, dex) : '' });
    box.querySelectorAll('.seg button').forEach(b => {
      b.onclick = () => { viewShiny = b.dataset.v === '1'; showDetail(dex); };
    });
    const fav = $('dex-fav');
    if (fav) fav.onclick = () => { G.DB.setFav(dex, !G.DB.isFav(dex)); renderGrid(true); showDetail(dex); };
    const pick = $('dex-pick');
    if (pick) pick.onclick = () => {
      s.partner = dex;
      s.partnerShiny = hasSh && viewShiny;
      G.DB.commit();
      G.UI.toast(p.name + (s.partnerShiny ? ' shiny' : '') + ' es ahora tu compañero');
      renderGrid(true); showDetail(dex);
    };
    if (own) wireExtras(dex, box);
  }

  // ---------------- ficha: lo que hace cada ataque (24-10-2026) ----------------
  /* Los iconos de los ataques que puede aprender: al pasar el ratón (o al
   * tocarlos en el móvil) sale un recuadro con su nombre, su tipo, si es físico
   * o especial y lo que hace (lo mismo que enseña la Tienda Kecleon). El
   * recuadro va en #scr-dex: se va con la pantalla. */
  let tipOn = null;
  function moveTipHtml(id) {
    const m = G.Moves.BY_ID[id];
    const cat = G.Stats.NAME[m.cat || (m.stat === 'patk' ? 'physical' : m.stat === 'satk' ? 'special' : '')];
    return `<b>${G.T(m.name, 'move')}</b>
      <div class="move-tip-tags"><span class="tag-chip" style="background:${G.U.TYPE_COLOR[m.type]}">${G.U.TYPE_NAME[m.type]}</span>${cat ? `<span class="tag-chip cat">${cat}</span>` : ''}</div>
      <div class="sub">${G.T(m.desc)}</div>`;
  }
  function hideMoveTip() { tipOn = null; const t = $('move-tip'); if (t) t.classList.add('hidden'); }
  function showMoveTip(ic) {
    let tip = $('move-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'move-tip'; tip.className = 'move-tip hidden';
      const scr = $('scr-dex');
      scr.appendChild(tip);
      // Tocar fuera de los iconos o desplazar la lista lo quita (en el móvil no hay "salir con el ratón").
      scr.addEventListener('pointerdown', e => { if (!e.target.closest('#dex-moves')) hideMoveTip(); }, true);
      scr.addEventListener('scroll', hideMoveTip, true);
    }
    tipOn = ic;
    tip.innerHTML = moveTipHtml(ic.dataset.move);
    tip.classList.remove('hidden');
    // Encima del icono (si no cabe, debajo), sin salirse por los lados.
    const r = ic.getBoundingClientRect(), t = tip.getBoundingClientRect(), M = 8;
    tip.style.left = G.U.clamp(r.left + r.width / 2 - t.width / 2, M, innerWidth - t.width - M) + 'px';
    tip.style.top = (r.top - t.height - M >= M ? r.top - t.height - M : r.bottom + M) + 'px';
  }
  function moveTips(row) {
    hideMoveTip();
    if (!row) return;
    let touch = false;
    row.onpointerdown = e => { touch = e.pointerType === 'touch'; };
    row.onpointerover = e => {
      const ic = e.target.closest('[data-move]');
      if (ic && e.pointerType !== 'touch' && ic !== tipOn) showMoveTip(ic);
    };
    row.onpointerleave = e => { if (e.pointerType !== 'touch') hideMoveTip(); };
    // En el móvil: tocar un icono lo enseña; tocarlo otra vez, lo quita.
    row.onclick = e => {
      const ic = e.target.closest('[data-move]');
      if (!ic || !touch) return;
      if (ic === tipOn) hideMoveTip(); else showMoveTip(ic);
    };
  }

  // ---------------- naturaleza, habilidad y MT (Tienda Kecleon, 20-10-2026) ----------------
  // Se ven en la ficha de cada Pokémon y aquí se usan la Menta, las Cápsulas y las MT de la Mochila.
  const STAT_NAME = { pa: 'Ataque', sa: 'At. Esp.', df: 'Defensa', sd: 'Def. Esp.', spd: 'Velocidad' };
  let extraOpen = '';          // 'nat' | 'cap' | 'caph' | 'tm' | 'forget' | '' (qué selector está abierto)
  const natLine = n => (n.up ? `+${G.T(STAT_NAME[n.up])} −${G.T(STAT_NAME[n.down])}` : G.T('neutra'));

  function monExtras(dex) {
    const p = G.DEX_BY[dex], n = G.Mons.natureOf(dex), ab = G.Mons.abilityOf(dex);
    const fx = G.AbilityFX.of(ab.id, p), taught = G.Mons.taught(dex);
    const tmsHere = G.Mons.learnable(dex).filter(id => G.Shop.tmCount(id) > 0);
    const btn = (key, icon, label, count) => count > 0
      ? `<button class="btn small" data-extra="${key}">${G.Icons.html(icon, 14)} <span>${label}</span> <small>×${count}</small></button>` : '';
    const capN = G.Mons.abilityChoices(dex, false).length ? G.Shop.count('cap') : 0;
    const caphN = G.Mons.abilityChoices(dex, true).length ? G.Shop.count('caph') : 0;
    return `<div class="mon-extra">
      <div class="mx-row"><span>Naturaleza</span><b translate="no">${G.Mons.name(n.n)}</b><small>${natLine(n)}</small>
        ${btn('nat', 'mint', 'Menta', G.Shop.count('mint'))}</div>
      <div class="mx-row"><span>Habilidad</span><b translate="no">${G.Mons.abilityName(ab.id)}</b>${ab.slot === 2 ? `<small class="gold">${G.T('oculta')}</small>` : ''}
        ${btn('cap', 'capsule', 'Cápsula', capN)}${btn('caph', 'capsuleh', 'Cápsula Oculta', caphN)}</div>
      <p class="sub mx-desc"><span>${fx.d}</span>${fx.d2 ? ` <span>${fx.d2}</span>` : ''}</p>
      <div class="mx-row"><span>MT</span>${taught.length
        ? `<span class="move-icons">${taught.map(id => `<span title="${G.T(G.Moves.BY_ID[id].name, 'move')}">${G.Icons.html('move:' + id, 16)}</span>`).join('')}</span>`
        : `<small>${G.T('Aún no ha aprendido ninguna')}</small>`}
        ${btn('tm', 'tm', 'Enseñar MT', tmsHere.length)}${btn('forget', 'forget', 'Olvidar MT', taught.length ? G.Shop.count('forget') : 0)}</div>
      ${skinRow(dex)}
      <div id="mx-picker"></div>
    </div>`;
  }

  /** Skins (Halloween 2026): las compradas de este Pokémon, para ponerlas o quitarlas. */
  function skinRow(dex) {
    const s = G.DB.save, mine = G.Skins.LIST.filter(id => G.Skins.SKINS[id].dex === +dex && G.Skins.owns(s, id));
    if (!mine.length) return '';
    const on = G.Skins.worn(s, dex);
    return `<div class="mx-row"><span>${G.T('Skin')}</span><b>${on ? G.T(G.Skins.SKINS[on].name) : G.T('Sin skin')}</b>
      ${mine.map(id => `<button class="btn small${on === id ? '' : ' gold'}" data-skin="${on === id ? '' : id}">${G.Icons.html('witch', 14)}
        <span>${G.T(on === id ? 'Quitársela' : 'Ponérsela')}</span></button>`).join('')}</div>`;
  }

  function wireExtras(dex, box) {
    box.querySelectorAll('[data-skin]').forEach(b => {
      b.onclick = () => {
        G.Skins.wear(G.DB.save, dex, b.dataset.skin);
        G.DB.commit();
        G.Audio.sfx(b.dataset.skin ? 'buy' : 'select');
        showDetail(dex);
      };
    });
    box.querySelectorAll('[data-extra]').forEach(b => {
      b.onclick = () => { extraOpen = extraOpen === b.dataset.extra ? '' : b.dataset.extra; G.Audio.sfx('select'); showDetail(dex); };
    });
    const host = box.querySelector('#mx-picker');
    if (!host || !extraOpen) return;
    const mon = G.DEX_BY[dex];
    const chips = (list, label, onPick) => {
      host.innerHTML = `<div class="panel ban-picker"><div class="ban-moves">${list.map(x => `<button class="chip" data-v="${x.v}">${x.html}</button>`).join('')}</div></div>`;
      host.querySelectorAll('[data-v]').forEach(c => { c.onclick = () => onPick(c.dataset.v); });
    };
    const done = msg => { extraOpen = ''; G.DB.commit(); G.Audio.sfx('buy'); G.UI.toast(msg, 2600); showDetail(dex); };
    if (extraOpen === 'nat' && G.Shop.count('mint')) {
      const cur = G.Mons.natureOf(dex).id;
      chips(G.NATURES.filter(n => n.id !== cur).map(n => ({ v: n.id, html: `<b translate="no">${G.Mons.name(n.n)}</b> <small>${natLine(n)}</small>` })), '', id => {
        if (!G.Shop.take('mint')) return;
        G.Mons.setNature(dex, id);
        done(G.I18n.f('{x} ahora tiene naturaleza {x}', mon.name, G.Mons.name(G.NATURE_BY[id].n)));
      });
    } else if ((extraOpen === 'cap' || extraOpen === 'caph') && G.Shop.count(extraOpen)) {
      const l = G.Mons.slots(dex);
      chips(G.Mons.abilityChoices(dex, extraOpen === 'caph').map(i => ({ v: i, html: `<b translate="no">${G.Mons.abilityName(l[i])}</b>${i === 2 ? ` <small class="gold">${G.T('oculta')}</small>` : ''}` })), '', v => {
        if (!G.Shop.take(extraOpen)) return;
        G.Mons.setAbility(dex, +v);
        done(G.I18n.f('{x} ahora tiene la habilidad {x}', mon.name, G.Mons.abilityName(l[+v])));
      });
    } else if (extraOpen === 'tm') {
      const list = G.Mons.learnable(dex).filter(id => G.Shop.tmCount(id) > 0);
      chips(list.map(id => ({ v: id, html: `${G.Icons.html('move:' + id, 16)} ${G.T(G.Moves.BY_ID[id].name, 'move')} <small>×${G.Shop.tmCount(id)}</small>` })), '', id => {
        if (!G.Mons.teach(dex, id)) return;
        done(G.I18n.f('¡{x} ha aprendido {x}!', mon.name, G.T(G.Moves.BY_ID[id].name, 'move')));
      });
    } else if (extraOpen === 'forget' && G.Shop.count('forget')) {
      // Sólo las aprendidas con MT: las suyas propias no salen (no se pueden olvidar).
      chips(G.Mons.taught(dex).map(id => ({ v: id, html: `${G.Icons.html('move:' + id, 16)} ${G.T(G.Moves.BY_ID[id].name, 'move')}` })), '', id => {
        if (!G.Mons.forget(dex, id)) return;
        done(G.I18n.f('{x} ha olvidado {x}. Puede volver a aprenderlo con su MT.', mon.name, G.T(G.Moves.BY_ID[id].name, 'move')));
      });
      host.querySelector('.panel').insertAdjacentHTML('afterbegin',
        `<p class="sub" style="margin:0 0 8px">${G.Icons.html('forget', 14)} ${G.T('¿Qué movimiento aprendido con MT olvida? Se gasta un Olvidamovimientos. Sus movimientos propios no se pueden olvidar.')}</p>`);
    }
  }

  // ---------------- mejoras ----------------

  let upgDex = null, upgPartner = null;

  function openUpgrades() {
    G.UI.show('scr-upgrades', true);
    const s = G.DB.save;
    // Se recuerda el último que miraste, salvo que hayas cambiado de compañero: entonces se abre en el nuevo.
    if (!upgDex || !s.owned[upgDex] || s.partner !== upgPartner) upgDex = s.partner;
    upgPartner = s.partner;
    // Selector con tus Pokémon: el compañero primero, luego los que ya tienen mejoras.
    const sel = $('upg-mon');
    const lv = d => Object.values(s.pupg[d] || {}).reduce((a, b) => a + b, 0);
    const mons = Object.keys(s.owned).map(Number).filter(d => G.DEX_BY[d])
      .sort((a, b) => (b === s.partner) - (a === s.partner) || lv(b) - lv(a) || a - b);
    sel.innerHTML = mons.map(d => `<option value="${d}">${G.DEX_BY[d].name}${d === s.partner ? ' (compañero)' : ''}${lv(d) ? ' · ' + lv(d) + ' niveles' : ''}</option>`).join('');
    sel.value = upgDex;
    sel.onchange = () => { upgDex = +sel.value; G.Audio.sfx('select'); renderUpgrades(); };
    renderUpgrades();
  }

  function renderUpgrades() {
    const s = G.DB.save;
    const levels = G.DB.upgradesOf(upgDex);
    const mon = G.DEX_BY[upgDex];
    const shiny = upgDex === s.partner && !!s.partnerShiny && G.DB.ownsShiny(upgDex);
    G.UI.sprite($('upg-stage'), upgDex, { lively: true, scale: 2, hero: true, shiny });
    $('upg-stage').style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
    const box = $('upg-list');
    box.innerHTML = '';
    for (const u of G.Upgrades.LIST) {
      const lvl = levels[u.id] || 0;
      const maxed = lvl >= u.max;
      const cost = maxed ? 0 : G.Upgrades.cost(u.id, lvl);
      // Mejoras que necesitan otra (Segundo movimiento inicial → Repertorio).
      const locked = !maxed && u.needs && !levels[u.needs];
      const pick2 = u.id === 'start2' && lvl > 0 ? G.startMove2Of(upgDex) : null;
      const el = document.createElement('div');
      el.className = 'panel upg-item';
      el.innerHTML = `
        <div class="ic">${G.Icons.html(u.icon, 32)}</div>
        <div>
          <b>${u.name}</b> <span style="color:var(--muted);font-size:13px">${u.unit}</span>
          <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
        </div>
        <div class="upg-btns">
          ${u.id === 'ban' && lvl > 0 ? `<button class="btn small" data-ban>Elegir (${banList().length}/${lvl})</button>` : ''}
          ${u.id === 'start' && lvl > 0 ? `<button class="btn small" data-start>Elegir: ${G.Moves.BY_ID[G.startMoveOf(upgDex)].name}</button>` : ''}
          ${u.id === 'start2' && lvl > 0 ? `<button class="btn small" data-start2>Elegir: ${pick2 ? G.Moves.BY_ID[pick2].name : G.T('Al azar')}</button>` : ''}
          <button class="btn small ${maxed ? '' : 'gold'}" data-buy data-sfx="none" ${maxed || locked || s.coins < cost ? 'disabled' : ''}
            ${locked ? `title="${G.T('Primero compra Repertorio')}"` : ''}>
          ${maxed ? 'Máx.' : locked ? G.T('Necesita Repertorio') : `<span class="coin"></span> ${cost}`}</button></div>`;
      if (u.id === 'ban' && lvl > 0) el.querySelector('[data-ban]').onclick = () => { banOpen = !banOpen; renderUpgrades(); };
      if (u.id === 'start' && lvl > 0) el.querySelector('[data-start]').onclick = () => { startOpen = !startOpen; renderUpgrades(); };
      if (u.id === 'start2' && lvl > 0) el.querySelector('[data-start2]').onclick = () => { start2Open = !start2Open; renderUpgrades(); };
      el.querySelector('[data-buy]').onclick = () => {
        // Se vuelve a leer todo al pulsar (la partida puede haber cambiado desde que se dibujó).
        const sv = G.DB.save, lv = G.DB.upgradesOf(upgDex), now = lv[u.id] || 0;
        if (now >= u.max || (u.needs && !lv[u.needs])) { renderUpgrades(); return; }
        const price = G.Upgrades.cost(u.id, now);
        if (sv.coins < price) { renderUpgrades(); return; }
        sv.coins -= price;
        lv[u.id] = now + 1;
        G.DB.commit(true);
        G.Audio.sfx('buy');
        G.UI.refreshCoins();
        G.UI.toast(`${mon.name} · ${u.name}: nivel ${now + 1}`);
        renderUpgrades();
      };
      box.appendChild(el);
      if (u.id === 'ban' && lvl > 0 && banOpen) box.appendChild(banPicker(lvl));
      if (u.id === 'start' && lvl > 0 && startOpen) box.appendChild(startPicker());
      if (u.id === 'start2' && lvl > 0 && start2Open) box.appendChild(start2Picker());
    }
    box.appendChild(bindPanel());
  }

  // ---------------- atajos: hueco fijo para cada movimiento ----------------
  // save.pbind[dex] = [movimiento del hueco 1, del 2, del 3, del 4] (o null).
  function bindPanel() {
    const s = G.DB.save;
    s.pbind = s.pbind || {};
    const list = s.pbind[upgDex] || [null, null, null, null];
    const mon = G.DEX_BY[upgDex];
    const ids = G.Moves.poolFor(mon).concat([G.startMoveOf(upgDex)]).filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'es'));
    const el = document.createElement('div');
    el.className = 'panel bind-panel';
    el.innerHTML = `<b>Atajos de movimientos</b>
      <p class="sub" style="margin:2px 0 8px">Elige qué movimiento va siempre en cada hueco (teclas 1-4 o los iconos de abajo), para la memoria muscular. Si aún no tienes tantos movimientos, va al hueco más cercano.</p>
      <div class="bind-slots">${[0, 1, 2, 3].map(i => `<label class="bind-slot"><span>${i + 1}</span>
        <select class="field" data-slot="${i}"><option value="">Libre</option>${ids.map(id =>
          `<option value="${id}" ${list[i] === id ? 'selected' : ''}>${G.T(G.Moves.BY_ID[id].name, 'move')}</option>`).join('')}</select></label>`).join('')}</div>`;
    el.querySelectorAll('select[data-slot]').forEach(sel => {
      sel.onchange = () => {
        const l = (s.pbind[upgDex] || [null, null, null, null]).slice(0, 4);
        while (l.length < 4) l.push(null);
        const i = +sel.dataset.slot, id = sel.value || null;
        // Un movimiento sólo puede estar en un hueco.
        for (let j = 0; j < 4; j++) if (id && l[j] === id) l[j] = null;
        l[i] = id;
        s.pbind[upgDex] = l;
        G.DB.commit();
        G.Audio.sfx('select');
        renderUpgrades();
      };
    });
    return el;
  }

  // ---------------- movimiento inicial (Mejoras → Movimiento inicial) ----------------
  let startOpen = false;
  function startPicker() {
    const s = G.DB.save, cur = G.startMoveOf(upgDex), base = G.baseStartOf(upgDex);
    const ids = G.startChoices(upgDex).sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'es'));
    const el = document.createElement('div');
    el.className = 'panel ban-picker';
    el.innerHTML = `<p class="sub" style="margin:0 0 8px">Elige con qué ataque empieza. Lo puedes cambiar cuando quieras, gratis.</p>
      <div class="ban-moves">${ids.map(id => { const d = G.Moves.BY_ID[id];
        return `<button class="chip ${id === cur ? 'on' : ''}" data-id="${id}">${G.Icons.html('move:' + id, 16)} ${d.name}${id === base ? ' <small>(de serie)</small>' : ''}</button>`; }).join('')}</div>`;
    el.querySelectorAll('[data-id]').forEach(b => {
      b.onclick = () => {
        const id = b.dataset.id;
        s.pstart = s.pstart || {};
        if (id === base) delete s.pstart[upgDex]; else s.pstart[upgDex] = id;
        // Si era el segundo inicial, el segundo vuelve a salir al azar.
        if (s.pstart2 && s.pstart2[upgDex] === id) delete s.pstart2[upgDex];
        // El inicial no puede estar vetado.
        const l = banList(), i = l.indexOf(id);
        if (i >= 0) l.splice(i, 1);
        G.DB.commit();
        G.Audio.sfx('select');
        G.UI.toast(G.DEX_BY[upgDex].name + ' empezará con ' + G.Moves.BY_ID[id].name);
        renderUpgrades();
      };
    });
    return el;
  }

  // ---------------- segundo movimiento inicial (con Repertorio) ----------------
  // save.pstart2[dex]; sin elegir (o "Al azar"), el segundo sale al azar como siempre.
  let start2Open = false;
  function start2Picker() {
    const s = G.DB.save, cur = G.startMove2Of(upgDex), first = G.startMoveOf(upgDex);
    const ids = G.startChoices(upgDex).filter(id => id !== first)
      .sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'es'));
    const el = document.createElement('div');
    el.className = 'panel ban-picker';
    el.innerHTML = `<p class="sub" style="margin:0 0 8px">Elige el segundo ataque con el que empieza. Lo puedes cambiar cuando quieras, gratis.</p>
      <div class="ban-moves"><button class="chip ${!cur ? 'on' : ''}" data-id="">${G.T('Al azar')}</button>${ids.map(id => { const d = G.Moves.BY_ID[id];
        return `<button class="chip ${id === cur ? 'on' : ''}" data-id="${id}">${G.Icons.html('move:' + id, 16)} ${d.name}</button>`; }).join('')}</div>`;
    el.querySelectorAll('[data-id]').forEach(b => {
      b.onclick = () => {
        const id = b.dataset.id;
        s.pstart2 = s.pstart2 || {};
        if (!id) delete s.pstart2[upgDex]; else s.pstart2[upgDex] = id;
        // El elegido no puede estar vetado.
        const l = banList(), i = id ? l.indexOf(id) : -1;
        if (i >= 0) l.splice(i, 1);
        G.DB.commit();
        G.Audio.sfx('select');
        G.UI.toast(id ? G.I18n.f('{x} empezará también con {x}', G.DEX_BY[upgDex].name, G.Moves.BY_ID[id].name)
                      : G.T('El segundo ataque saldrá al azar'));
        renderUpgrades();
      };
    });
    return el;
  }

  // ---------------- veto: movimientos bloqueados ----------------
  // Lista por Pokémon en save.pban[dex]; con N niveles de Veto, N movimientos.
  let banOpen = false;
  function banList() {
    const s = G.DB.save;
    s.pban = s.pban || {};
    return s.pban[upgDex] || (s.pban[upgDex] = []);
  }
  function banPicker(max) {
    const mon = G.DEX_BY[upgDex];
    const start = G.startMoveOf(upgDex), start2 = G.startMove2Of(upgDex);
    const ids = G.Moves.poolFor(mon).filter(id => id !== start && id !== start2)
      .sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'es'));
    const list = banList();
    const el = document.createElement('div');
    el.className = 'panel ban-picker';
    el.innerHTML = `<p class="sub" style="margin:0 0 8px">Toca los movimientos que no quieres que te salgan en las cartas (${list.length}/${max}). El movimiento de inicio no se puede vetar.</p>
      <div class="ban-moves">${ids.map(id => { const d = G.Moves.BY_ID[id]; const on = list.includes(id);
        return `<button class="chip ${on ? 'on ban' : ''}" data-id="${id}">${G.Icons.html('move:' + id, 16)} ${G.T(d.name, 'move')}${on ? ' ' + G.Icons.html('ban', 14) : ''}</button>`; }).join('')}</div>`;
    el.querySelectorAll('[data-id]').forEach(b => {
      b.onclick = () => {
        const l = banList(), id = b.dataset.id, i = l.indexOf(id);
        if (i >= 0) l.splice(i, 1);
        else if (l.length >= max) { G.UI.toast('Ya tienes ' + max + ' vetados: quita uno primero'); return; }
        else l.push(id);
        G.DB.commit();
        G.Audio.sfx('select');
        renderUpgrades();
      };
    });
    return el;
  }

  return { init, open, openDex, GEN_NAMES };
})();
