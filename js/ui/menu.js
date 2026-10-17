/* ============ menu.js — menú principal, colección y mejoras ============ */
G.MenuUI = (() => {
  const $ = G.UI.$;
  const GEN_NAMES = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'];
  let dexGen = 1, dexSel = null, dexQ = '';
  let dexSort = (G.DexQuery && G.DexQuery.DEFAULT_SORT) || 'num';
  let dexStatus = 'all', dexShiny = false, dexFav = false;   // facetas del filtro
  const dexRarity = new Set();       // rarezas marcadas (1-5)
  const dexTypes = new Set();        // tipos marcados
  let dexTypesOpen = false;          // ¿fila de tipos desplegada?

  function init() {
    const ICON = { play: 'ball', dex: 'book', upgrades: 'up', gacha: 'ball4', goals: 'medal3', friends: 'friends', rank: 'trophy', settings: 'gear' };
    document.querySelectorAll('#scr-menu [data-go]').forEach(b => {
      b.insertAdjacentHTML('afterbegin', `<span class="mi-ico">${G.Icons.html(ICON[b.dataset.go], 26)}</span>`);
      b.dataset.sfx = b.dataset.go === 'play' ? 'confirm' : 'click';
      b.onclick = () => {
        const go = b.dataset.go;
        if (go === 'play') { if (G.Social.room) G.LobbyUI.open(); else G.Flow.play(); }
        else if (go === 'dex') openDex();
        else if (go === 'upgrades') openUpgrades();
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
    G.UI.sprite($('menu-partner'), mon.dex, { lively: true, scale: 4, hero: true, shiny });
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
      `Mejor nivel <b style="color:#fff">${st.bestLevel}</b> · Derrotados <b style="color:#fff">${st.totalKills.toLocaleString('es')}</b>` +
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

  /** Texto bajo "Amigos" y "Jugar": quién está en línea, solicitudes, sala. */
  function socialLine() {
    const room = G.Social.room;
    const play = document.querySelector('#scr-menu [data-go=play] small');
    if (play) play.textContent = room ? 'Volver a tu sala (' + room.members.length + '/' + G.Social.MAX_PLAYERS + ')' : 'Entra en la mazmorra';
    const fr = G.Social.friends;
    const on = fr.filter(f => f.status === 'ok' && f.online).length;
    const req = fr.filter(f => f.status === 'in').length;
    const parts = [];
    if (on) parts.push(on + ' en línea');
    if (req) parts.push(req + (req === 1 ? ' solicitud' : ' solicitudes'));
    $('menu-friends-sub').textContent = parts.length ? parts.join(' · ') : 'Juega en grupo, hasta 4';
    $('menu-friends-sub').classList.toggle('gold', req > 0);
  }

  // ---------------- colección ----------------

  // Favoritos: preferencia personal, por dispositivo Y por cuenta (localStorage).
  // No van a la partida ni a la nube (no gastan escrituras); así dos cuentas en
  // el mismo navegador no comparten favoritos.
  const FAV_PREFIX = 'ps.dex.fav';
  const favKey = () => FAV_PREFIX + '.' + (((G.DB && G.DB.save && G.DB.save.name) || 'guest') + '').toLowerCase();
  let dexFavs = new Set();
  function readFavs() {
    try {
      const a = JSON.parse(localStorage.getItem(favKey()) || '[]');
      return new Set(Array.isArray(a) ? a.map(Number) : []);
    } catch (e) { return new Set(); }
  }
  function writeFavs() {
    try { localStorage.setItem(favKey(), JSON.stringify([...dexFavs])); } catch (e) {}
  }
  function toggleFav(dex) {
    if (dexFavs.has(dex)) dexFavs.delete(dex); else dexFavs.add(dex);
    writeFavs();
    G.Audio.sfx(!dexFavs.has(dex) ? 'click' : 'select');
  }

  // Datos de la partida para el filtro/orden (lo que G.DexQuery no conoce).
  function dexSource() {
    const s = G.DB.save;
    return {
      has: d => !!s.owned[d],
      shiny: d => !!(s.shiny && s.shiny[d]),
      fav: d => dexFavs.has(d),
      used: d => Number(s.pused && s.pused[d]) || 0,
      at: d => (s.owned[d] && s.owned[d].at) || 0
    };
  }

  // ¿Hay algún filtro activo? (para el botón Limpiar)
  const anyDexFilter = () => dexStatus !== 'all' || dexShiny || dexFav || dexRarity.size > 0 || dexTypes.size > 0;
  function clearDexFilters() {
    dexStatus = 'all'; dexShiny = false; dexFav = false;
    dexRarity.clear(); dexTypes.clear();
    refreshDex();
  }

  // Traduce el estado de la pantalla a los criterios de G.DexQuery.
  function dexCriteria() {
    return {
      gen: dexGen, q: dexQ, sort: dexSort, status: dexStatus,
      shiny: dexShiny, fav: dexFav, rarity: dexRarity, types: dexTypes
    };
  }

  // Buscador y selector de orden: se construyen una sola vez.
  function buildDexTools() {
    const box = $('dex-tools');
    if (!box || box.dataset.ready) return;
    box.dataset.ready = '1';
    const sel = G.DexQuery.SORTS;
    box.innerHTML = `
      <input id="dex-q" class="field dex-search" type="search" placeholder="Buscar por nombre" autocomplete="off" spellcheck="false">
      <select id="dex-sort" class="field dex-sort" aria-label="Ordenar"></select>
      <span id="dex-count" class="sub" aria-live="polite"></span>`;
    const sort = $('dex-sort');
    sort.innerHTML = Object.keys(sel).map(k => `<option value="${k}">${sel[k].label}</option>`).join('');
    sort.onchange = () => { dexSort = sort.value; G.Audio.sfx('select'); renderGrid(); };
    let timer = 0;
    $('dex-q').oninput = e => {
      dexQ = e.target.value;                     // el estado va al día...
      clearTimeout(timer);
      timer = setTimeout(renderGrid, 150);       // ...pero no repintamos en cada tecla
    };
  }

  function syncDexTools() {
    const q = $('dex-q'), sort = $('dex-sort'), count = $('dex-count');
    if (q && q.value !== dexQ) q.value = dexQ;
    if (sort) sort.value = dexSort;
    if (count) count.textContent = '';
  }

  function openDex() {
    G.UI.show('scr-dex', true);
    const s = G.DB.save;
    dexFavs = readFavs();                    // favoritos de la cuenta actual
    if (dexSel == null) { dexSel = s.partner; dexGen = G.DEX_BY[s.partner].gen; }
    const owned = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    $('dex-total').textContent = `${owned} / ${G.DEX.length}`;
    buildDexTools();
    syncDexTools();
    renderDexTabs();
    refreshDex();
    showDetail(dexSel);
  }

  // Cambiar un filtro no toca ni las pestañas ni la ficha: sólo controles y rejilla.
  function refreshDex() {
    renderDexChips();
    renderGrid();
  }

  // Pestañas de generación, con cuántos tienes de cada una.
  function renderDexTabs() {
    const s = G.DB.save;
    const tabs = $('dex-gens');
    tabs.innerHTML = '';
    GEN_NAMES.forEach((name, i) => {
      const g = i + 1;
      const total = G.DEX.filter(p => p.gen === g).length;
      const have = G.DEX.filter(p => p.gen === g && s.owned[p.dex]).length;
      const b = document.createElement('button');
      b.className = 'gen-tab' + (g === dexGen ? ' on' : '');
      b.innerHTML = `<b>${name}</b><small>${have}/${total}</small>`;
      b.onclick = () => { dexGen = g; openDex(); };
      tabs.appendChild(b);
    });
  }

  // Botón de filtro (chip) reutilizable. `aria-pressed` para lectores de pantalla.
  function chip(txt, on, onClick, extra) {
    const b = document.createElement('button');
    b.className = 'chip' + (on ? ' on' : '') + (extra ? ' ' + extra : '');
    b.innerHTML = txt;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.onclick = onClick;
    return b;
  }
  function row(cls, aria) {
    const d = document.createElement('div');
    d.className = 'dex-frow' + (cls ? ' ' + cls : '');
    d.setAttribute('role', 'group');
    if (aria) d.setAttribute('aria-label', aria);
    return d;
  }
  function label(txt) { const s = document.createElement('span'); s.className = 'dex-flab'; s.textContent = txt; return s; }

  // Filtros como facetas INDEPENDIENTES (todas se combinan entre sí).
  function renderDexChips() {
    const fb = $('dex-filters');
    fb.innerHTML = '';

    // Estado (Todos/Tengo/Me faltan) + Shiny + Favoritos + Limpiar.
    const r1 = row(null, 'Estado');
    for (const [k, txt] of [['all', 'Todos'], ['own', 'Tengo'], ['miss', 'Me faltan']])
      r1.appendChild(chip(txt, dexStatus === k, () => { dexStatus = k; refreshDex(); }));
    r1.appendChild(chip(G.Icons.html('shiny', 12) + ' Shiny', dexShiny, () => { dexShiny = !dexShiny; refreshDex(); }));
    r1.appendChild(chip(G.Icons.html('star', 12) + ' Favoritos', dexFav, () => { dexFav = !dexFav; refreshDex(); }));
    if (anyDexFilter()) r1.appendChild(chip('Limpiar', false, clearDexFilters, 'dex-clear'));
    fb.appendChild(r1);

    // Rareza (se pueden marcar varias).
    const r2 = row(null, 'Rareza');
    r2.appendChild(label('Rareza'));
    for (let n = 5; n >= 1; n--)
      r2.appendChild(chip(G.Icons.rarity(n, 12) + ' ' + G.Gacha.RARITY_NAME[n], dexRarity.has(n),
        () => { dexRarity.has(n) ? dexRarity.delete(n) : dexRarity.add(n); refreshDex(); }));
    fb.appendChild(r2);

    // Tipos (plegables, para no llenar la pantalla).
    const r3 = row(null, 'Tipos');
    r3.appendChild(chip('<span>Tipos</span>' + (dexTypes.size ? ' <b>' + dexTypes.size + '</b>' : '') + ' ' + (dexTypesOpen ? '▲' : '▼'),
      dexTypesOpen, () => { dexTypesOpen = !dexTypesOpen; renderDexChips(); }));
    if (dexTypes.size) r3.appendChild(chip('Limpiar tipos', false, () => { dexTypes.clear(); refreshDex(); }, 'dex-clear'));
    fb.appendChild(r3);
    if (dexTypesOpen) {
      const r4 = row('dex-types', 'Tipos');
      for (const ty of Object.keys(G.U.TYPE_NAME)) {
        const b = chip(G.U.TYPE_NAME[ty], dexTypes.has(ty), () => {
          dexTypes.has(ty) ? dexTypes.delete(ty) : dexTypes.add(ty); refreshDex();
        }, 'ty-chip');
        b.style.setProperty('--ty', G.U.TYPE_COLOR[ty]);
        r4.appendChild(b);
      }
      fb.appendChild(r4);
    }
  }

  function renderGrid() {
    const s = G.DB.save;
    const grid = $('dex-grid');
    const list = G.DexQuery.run(G.DEX, dexCriteria(), dexSource());
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const p of list) {
      const own = !!s.owned[p.dex], sh = !!(s.shiny && s.shiny[p.dex]);

      const cell = document.createElement('div');
      cell.className = 'cell' + (own ? '' : ' locked') + (p.dex === dexSel ? ' on' : '');
      cell.insertAdjacentHTML('beforeend', `<span class="no">${String(p.dex).padStart(3, '0')}</span>`);
      if (dexFavs.has(p.dex)) cell.insertAdjacentHTML('beforeend', `<span class="badge-fav" title="Favorito">${G.Icons.html('star', 12)}</span>`);
      if (p.dex === s.partner) cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="Compañero">${G.Icons.html('crown', 14)}</span>`);
      else if (sh) cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="Tienes su shiny">${G.Icons.html('shiny', 12)}</span>`);
      const useShiny = sh && p.dex === s.partner && s.partnerShiny;
      cell.appendChild(G.UI.spriteCanvas(p.dex, 92, 80, { scale: 2, silhouette: !own, shadow: own, shiny: useShiny }));
      cell.insertAdjacentHTML('beforeend', `<b>${own ? p.name : '???'}</b>${G.UI.stars(p.rarity, 9)}`);
      cell.onclick = () => {
        dexSel = p.dex;
        grid.querySelectorAll('.cell').forEach(c => c.classList.remove('on'));
        cell.classList.add('on');
        showDetail(p.dex);
      };
      frag.appendChild(cell);
    }
    grid.appendChild(frag);
    const count = $('dex-count');
    if (count) count.textContent = list.length === 1 ? '1 resultado' : list.length + ' resultados';
    if (!list.length) grid.innerHTML = '<p class="sub" style="grid-column:1/-1">Ninguno con este filtro.</p>';
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
    showDetail.last = dex;

    const max = { hp: 183, atk: 1.55, spd: 137 };
    const bar = (label, v, m, txt) =>
      `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, v / m * 100)}%"></i></div><span>${txt}</span></div>`;
    const usingThis = isPartner && (!hasSh || !!s.partnerShiny === viewShiny);

    const box = $('dex-detail');
    box.innerHTML = `
      <button id="dex-fav" class="dex-fav-btn${dexFavs.has(dex) ? ' on' : ''}" title="Favorito">${G.Icons.html('star', 22)}</button>
      <canvas id="dex-big" class="stage" width="220" height="190"></canvas>
      ${hasSh ? `<div class="seg">
          <button class="${viewShiny ? '' : 'on'}" data-v="0">Normal</button>
          <button class="${viewShiny ? 'on' : ''}" data-v="1">${G.Icons.html('shiny', 12)} Shiny</button></div>` : ''}
      <div class="center">
        <div style="color:var(--muted);font-size:13px">Nº ${String(p.dex).padStart(3, '0')} · ${GEN_NAMES[p.gen - 1]}</div>
        <h3>${own ? p.name : '???'}</h3>
        <div style="color:${G.Gacha.RARITY_COLOR[p.rarity]}">${G.UI.stars(p.rarity, 24)} ${G.Gacha.RARITY_NAME[p.rarity]}</div>
        <div style="margin:6px 0">${own ? G.UI.typeChips(p.types) : ''}</div>
      </div>
      ${own ? `
        ${bar('Vida', p.hp, max.hp, p.hp)}
        ${bar('Ataque', p.atk, max.atk, '×' + p.atk.toFixed(2))}
        ${bar('Velocidad', p.spd, max.spd, p.spd)}
        <p style="font-size:14px;margin:10px 0 4px">Empieza con <b class="gold">${G.Moves.BY_ID[G.startMoveOf(dex)].name}</b></p>
        <p class="move-icons" title="Movimientos que puede aprender">
          ${G.Moves.poolFor(p).map(id => `<span title="${G.Moves.BY_ID[id].name}">${G.Icons.html('move:' + id, 16)}</span>`).join('')}</p>
        ${usingThis
          ? '<button class="btn grow" disabled style="width:100%">Es tu compañero</button>'
          : `<button id="dex-pick" class="btn gold" data-sfx="confirm" style="width:100%">Elegir de compañero${viewShiny ? ' (shiny)' : ''}</button>`}
      ` : `<p class="center" style="color:var(--muted)">Aún no lo tienes.<br>Consíguelo en el banner de <b class="gold">${GEN_NAMES[p.gen - 1]}</b>
            o derrotándolo cuando salga shiny.</p>`}
    `;
    $('dex-big').style.setProperty('--stage-c', !own ? '#5b83d6' : viewShiny ? '#9ae6ff' : G.U.TYPE_COLOR[p.types[0]]);
    $('dex-big').classList.toggle('shiny', own && viewShiny);
    G.UI.sprite($('dex-big'), dex, { lively: own, spin: own, silhouette: !own, scale: 3, hero: true, shiny: own && viewShiny });
    box.querySelectorAll('.seg button').forEach(b => {
      b.onclick = () => { viewShiny = b.dataset.v === '1'; showDetail(dex); };
    });
    $('dex-fav').onclick = () => { toggleFav(dex); $('dex-fav').classList.toggle('on', dexFavs.has(dex)); renderGrid(); };
    const pick = $('dex-pick');
    if (pick) pick.onclick = () => {
      s.partner = dex;
      s.partnerShiny = hasSh && viewShiny;
      G.DB.commit();
      G.UI.toast(p.name + (s.partnerShiny ? ' shiny' : '') + ' es ahora tu compañero');
      renderGrid(); showDetail(dex);
    };
  }

  // ---------------- mejoras ----------------

  let upgDex = null;

  function openUpgrades() {
    G.UI.show('scr-upgrades', true);
    const s = G.DB.save;
    if (!upgDex || !s.owned[upgDex]) upgDex = s.partner;
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
          <button class="btn small ${maxed ? '' : 'gold'}" data-buy data-sfx="none" ${maxed || s.coins < cost ? 'disabled' : ''}>
          ${maxed ? 'Máx.' : `<span class="coin"></span> ${cost}`}</button></div>`;
      if (u.id === 'ban' && lvl > 0) el.querySelector('[data-ban]').onclick = () => { banOpen = !banOpen; renderUpgrades(); };
      el.querySelector('[data-buy]').onclick = () => {
        // Se vuelve a leer todo al pulsar (la partida puede haber cambiado desde que se dibujó).
        const sv = G.DB.save, lv = G.DB.upgradesOf(upgDex), now = lv[u.id] || 0;
        if (now >= u.max) { renderUpgrades(); return; }
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
          `<option value="${id}" ${list[i] === id ? 'selected' : ''}>${G.Moves.BY_ID[id].name}</option>`).join('')}</select></label>`).join('')}</div>`;
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
    const start = G.startMoveOf(upgDex);
    const ids = G.Moves.poolFor(mon).filter(id => id !== start)
      .sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'es'));
    const list = banList();
    const el = document.createElement('div');
    el.className = 'panel ban-picker';
    el.innerHTML = `<p class="sub" style="margin:0 0 8px">Toca los movimientos que no quieres que te salgan en las cartas (${list.length}/${max}). El movimiento de inicio no se puede vetar.</p>
      <div class="ban-moves">${ids.map(id => { const d = G.Moves.BY_ID[id]; const on = list.includes(id);
        return `<button class="chip ${on ? 'on ban' : ''}" data-id="${id}">${G.Icons.html('move:' + id, 16)} ${d.name}${on ? ' ' + G.Icons.html('ban', 14) : ''}</button>`; }).join('')}</div>`;
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

  return { init, open, GEN_NAMES };
})();
