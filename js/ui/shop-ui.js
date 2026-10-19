/* ============ shop-ui.js — Tienda Kecleon y Mochila ============
 * Tienda: caramelos, MT, Menta y Cápsulas Habilidad (se abren poco a poco, ver
 * data/shop.js). Mochila: lo que tienes, y usarlo con el Pokémon que elijas
 * (también se abre desde la ficha de la colección).
 */
G.ShopUI = (() => {
  const $ = G.UI.$;
  const tx = a => G.Mons.tx(a);
  let tab = 'candy', shopDex = null, bagDex = null, bagFrom = 'menu', picking = null;

  /** Tus Pokémon para un selector: el compañero primero, luego por nivel. */
  function monOptions(sel, cur) {
    const s = G.DB.save;
    const mons = Object.keys(s.owned).map(Number).filter(d => G.DEX_BY[d])
      .sort((a, b) => (b === s.partner) - (a === s.partner) || G.Mons.level(b) - G.Mons.level(a) || a - b);
    sel.innerHTML = mons.map(d => `<option value="${d}">${G.DEX_BY[d].name}${d === s.partner ? ' (compañero)' : ''} · Nv. ${G.Mons.level(d)}</option>`).join('');
    sel.value = cur;
  }

  function row(icon, title, desc, right) {
    const el = document.createElement('div');
    el.className = 'panel upg-item';
    el.innerHTML = `<div class="ic">${G.Icons.html(icon, 32)}</div><div>${title}<div class="sub" style="margin:2px 0 0">${desc}</div></div>
      <div class="upg-btns">${right}</div>`;
    return el;
  }

  function moveInfo(id) {
    const d = G.Moves.BY_ID[id], g = G.MOVES_GEN && G.MOVES_GEN[id];
    const cls = G.Moves.isStatus(id) ? 'Estado' : G.Mons.moveClass(d) === 's' ? 'Especial' : 'Físico';
    return `${G.UI.typeChips([d.type])} <small>${cls}${g && g.pw ? ' · Potencia ' + g.pw : ''}</small><br>${d.desc}`;
  }

  // ======================= TIENDA =======================

  function openShop() {
    G.UI.show('scr-shop', true);
    const s = G.DB.save;
    if (!shopDex || !s.owned[shopDex]) shopDex = s.partner;
    $('shop-back').onclick = () => G.MenuUI.open();
    renderShop();
  }

  function renderShop() {
    const s = G.DB.save;
    $('shop-greet').textContent = '¡Bienvenido a la Tienda Kecleon! Aquí todo se paga, ¿eh? Nada de llevarse cosas sin pagar.';
    const tabs = [['candy', 'Caramelos']];
    if (G.Shop.unlocked('tm')) tabs.push(['tm', 'MT']);
    if (G.Shop.unlocked('win')) tabs.push(['special', 'Menta y Cápsulas']);
    if (!tabs.some(t => t[0] === tab)) tab = 'candy';
    const seg = $('shop-tabs');
    seg.innerHTML = tabs.map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" data-t="${k}">${n}</button>`).join('');
    seg.querySelectorAll('button').forEach(b => { b.onclick = () => { tab = b.dataset.t; G.Audio.sfx('select'); renderShop(); }; });

    const body = $('shop-body');
    body.innerHTML = '';
    if (tab === 'tm') { renderShopTms(body); return; }
    const kinds = tab === 'candy' ? ['candy'] : ['mint', 'cap'];
    for (const id of G.Shop.ORDER) {
      const it = G.Shop.ITEMS[id];
      if (!kinds.includes(it.kind)) continue;
      const el = row(it.icon, `<b>${it.name}</b> <small class="sub">Tienes ${G.Shop.count(id)}</small>`, it.desc,
        `<button class="btn small gold" data-buy data-sfx="none" ${s.coins < it.price ? 'disabled' : ''}><span class="coin"></span> ${it.price}</button>`);
      el.querySelector('[data-buy]').onclick = () => buy(it.price, () => G.Shop.add(id), it.name);
      body.appendChild(el);
    }
    body.insertAdjacentHTML('beforeend', '<p class="sub" style="margin-top:8px">Lo que compras va a la Mochila. Úsalo desde la Mochila o desde la ficha de cada Pokémon en la colección.</p>');
  }

  function renderShopTms(body) {
    const s = G.DB.save;
    const head = document.createElement('div');
    head.className = 'row';
    head.innerHTML = `<label for="shop-mon" style="margin:0">MT para</label><select id="shop-mon" class="field" style="width:auto;min-width:220px"></select>`;
    body.appendChild(head);
    monOptions($('shop-mon'), shopDex);
    $('shop-mon').onchange = () => { shopDex = +$('shop-mon').value; G.Audio.sfx('select'); renderShop(); };
    const power = id => (G.MOVES_GEN[id] && G.MOVES_GEN[id].pw) || 0;
    const ids = G.Shop.tmsFor(shopDex).filter(id => !G.Shop.knows(shopDex, id)).sort((a, b) => power(b) - power(a));
    body.insertAdjacentHTML('beforeend', `<p class="sub" style="margin:8px 0">Movimientos que ${G.DEX_BY[shopDex].name} puede aprender con MT y aún no sabe. Cada MT se gasta al enseñarla.</p>`);
    if (!ids.length) body.insertAdjacentHTML('beforeend', '<p class="sub">No hay MT nuevas para este Pokémon.</p>');
    for (const id of ids) {
      const price = G.Shop.tmPrice(id), have = G.Shop.tmCount(id);
      const el = row('move:' + id, `<b>MT ${G.Moves.BY_ID[id].name}</b>${have ? ` <small class="sub">Tienes ${have}</small>` : ''}`, moveInfo(id),
        `<button class="btn small gold" data-buy data-sfx="none" ${s.coins < price ? 'disabled' : ''}><span class="coin"></span> ${price}</button>`);
      el.querySelector('[data-buy]').onclick = () => buy(price, () => G.Shop.addTm(id), 'MT ' + G.Moves.BY_ID[id].name);
      body.appendChild(el);
    }
  }

  function buy(price, give, name) {
    const s = G.DB.save;
    if (s.coins < price) { renderShop(); return; }
    s.coins -= price;
    give();
    G.DB.commit(true);
    G.Audio.sfx('buy');
    G.UI.refreshCoins();
    G.UI.toast(name + ' a la Mochila');
    renderShop();
  }

  // ======================= MOCHILA =======================

  function openBag(dex, from = 'menu') {
    G.UI.show('scr-bag', true);
    const s = G.DB.save;
    bagDex = dex && s.owned[dex] ? dex : bagDex && s.owned[bagDex] ? bagDex : s.partner;
    bagFrom = from;
    picking = null;
    $('bag-back').onclick = () => { if (bagFrom === 'dex') G.MenuUI.openDex(); else G.MenuUI.open(); };
    monOptions($('bag-mon'), bagDex);
    $('bag-mon').onchange = () => { bagDex = +$('bag-mon').value; picking = null; G.Audio.sfx('select'); renderBag(); };
    renderBag();
  }

  function renderBag() {
    const s = G.DB.save, dex = bagDex, mon = G.DEX_BY[dex];
    const shiny = dex === s.partner && !!s.partnerShiny && G.DB.ownsShiny(dex);
    G.UI.sprite($('bag-stage'), dex, { lively: true, scale: 2, hero: true, shiny });
    $('bag-stage').style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
    const pr = G.Mons.progress(dex), nat = G.Mons.nature(dex), ab = G.Mons.ability(dex);
    $('bag-info').innerHTML = `<div class="mon-lv"><b>Nv. ${pr.level}</b>${pr.level < G.Mons.MAX ? `<div class="bar"><i style="width:${Math.round(pr.frac * 100)}%"></i></div>
        <small>${(pr.need - pr.cur).toLocaleString('es')} exp. para el Nv. ${pr.level + 1}</small>` : '<small>Nivel máximo</small>'}</div>
      <p class="mon-line"><span>Naturaleza</span> <b translate="no">${tx(nat.n)}</b> <small>(${G.Mons.natureText(nat)})</small>
        · <span>Habilidad</span> <b translate="no">${ab && G.ABILITIES[ab] ? tx(G.ABILITIES[ab].n) : '—'}</b></p>`;

    const body = $('bag-body');
    body.innerHTML = '';
    if (picking) { renderPicker(body); return; }

    let any = false;
    for (const id of G.Shop.ORDER) {
      const n = G.Shop.count(id);
      if (!n) continue;
      any = true;
      const it = G.Shop.ITEMS[id];
      // Sin nada que hacer con este Pokémon (nivel máximo, o ninguna otra habilidad que pueda elegir), no se gasta.
      const can = it.kind === 'candy' ? pr.level < G.Mons.MAX
        : it.kind === 'cap' ? G.Shop.abilityChoices(dex, id).some(i => i !== G.Mons.abilitySlot(dex)) : true;
      const why = it.kind === 'candy' ? 'Nivel máximo' : 'No tiene otra habilidad que elegir';
      const el = row(it.icon, `<b>${it.name}</b> <small class="sub">×${n}</small>`, it.desc,
        can ? '<button class="btn small gold" data-use>Usar</button>' : `<small class="sub">${why}</small>`);
      if (can) el.querySelector('[data-use]').onclick = () => use(id);
      body.appendChild(el);
    }
    const tms = Object.keys(s.tms || {}).filter(id => G.Moves.BY_ID[id])
      .sort((a, b) => G.Shop.canTeach(dex, b) - G.Shop.canTeach(dex, a) || G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'es'));
    for (const id of tms) {
      any = true;
      const ok = G.Shop.canTeach(dex, id);
      const why = ok ? '' : G.Shop.knows(dex, id) ? 'Ya la sabe' : 'No puede aprenderla';
      const el = row('move:' + id, `<b>MT ${G.Moves.BY_ID[id].name}</b> <small class="sub">×${s.tms[id]}</small>`, moveInfo(id),
        ok ? '<button class="btn small gold" data-teach>Enseñar</button>' : `<small class="sub">${why}</small>`);
      if (ok) el.querySelector('[data-teach]').onclick = () => teach(id);
      body.appendChild(el);
    }
    if (!any) body.innerHTML = '<p class="sub">La Mochila está vacía. Compra caramelos en la Tienda Kecleon, o consigue MT venciendo jefes y abriendo cofres con candado.</p>';
  }

  function use(id) {
    const it = G.Shop.ITEMS[id], dex = bagDex, name = G.DEX_BY[dex].name;
    if (it.kind === 'candy') {
      const r = G.Shop.useCandy(id, dex);
      if (!r) return;
      G.DB.commit(true);
      G.Audio.sfx(r.to > r.from ? 'levelup' : 'xp');
      const learned = G.Moves.learnset(dex).filter(([lv]) => lv > r.from && lv <= r.to).map(([, m]) => G.Moves.BY_ID[m].name);
      G.UI.toast(r.to > r.from ? `¡${name} sube al Nv. ${r.to}!` + (learned.length ? ' Ha aprendido: ' + [...new Set(learned)].join(', ') : '') : `${name} gana experiencia`, 3600);
      renderBag();
      return;
    }
    picking = id;
    G.Audio.sfx('select');
    renderBag();
  }

  function teach(id) {
    const dex = bagDex;
    if (!confirm(`¿Enseñar ${G.Moves.BY_ID[id].name} a ${G.DEX_BY[dex].name}? La MT se gasta.`)) return;
    if (!G.Shop.teach(id, dex)) return;
    G.DB.commit(true);
    G.Audio.sfx('legend');
    G.UI.toast(`¡${G.DEX_BY[dex].name} ha aprendido ${G.Moves.BY_ID[id].name}! Ya puede salirte en las cartas de la partida.`, 3600);
    renderBag();
  }

  /** Elegir naturaleza (Menta) o habilidad (Cápsulas). */
  function renderPicker(body) {
    const dex = bagDex, it = G.Shop.ITEMS[picking], mon = G.DEX_BY[dex];
    const back = '<button class="btn small ghost" data-cancel>Cancelar</button>';
    if (it.kind === 'mint') {
      const cur = G.Mons.natureIndex(dex);
      body.innerHTML = `<div class="row between"><b>Menta: elige la naturaleza de ${mon.name}</b>${back}</div>
        <div class="nat-grid">${G.NATURES.map((n, i) => `<button class="chip ${i === cur ? 'on' : ''}" data-n="${i}" ${i === cur ? 'disabled' : ''}>
          <b translate="no">${tx(n.n)}</b> <small>${G.Mons.natureText(n)}</small></button>`).join('')}</div>`;
      body.querySelectorAll('[data-n]').forEach(b => {
        b.onclick = () => {
          const i = +b.dataset.n;
          if (!G.Shop.useMint(dex, i)) return;
          G.DB.commit(true);
          G.Audio.sfx('confirm');
          G.UI.toast(`${mon.name} ahora es ${tx(G.NATURES[i].n)}`);
          picking = null; renderBag();
        };
      });
    } else {
      const list = G.DEX_ABIL[dex] || [], cur = G.Mons.abilitySlot(dex);
      const choices = G.Shop.abilityChoices(dex, picking);
      body.innerHTML = `<div class="row between"><b>${it.name}: elige la habilidad de ${mon.name}</b>${back}</div>`;
      [0, 1, 2].filter(i => list[i]).forEach(i => {
        const a = G.ABILITIES[list[i]], fx = G.AbilityFX.of(list[i], mon);
        const ok = choices.includes(i) && i !== cur;
        const note = i === cur ? 'La que tiene' : !choices.includes(i) ? 'Oculta: hace falta la Cápsula Habilidad Oculta' : '';
        const el = row('star', `<b translate="no">${a ? tx(a.n) : list[i]}</b>${i === 2 ? ' <small class="gold">(oculta)</small>' : ''}`,
          `<span translate="no">${tx(fx.d)}</span>`, ok ? '<button class="btn small gold" data-pick>Elegir</button>' : `<small class="sub">${note}</small>`);
        if (ok) el.querySelector('[data-pick]').onclick = () => {
          if (!G.Shop.useCapsule(picking, dex, i)) return;
          G.DB.commit(true);
          G.Audio.sfx('confirm');
          G.UI.toast(`${mon.name} ahora tiene ${a ? tx(a.n) : list[i]}`);
          picking = null; renderBag();
        };
        body.appendChild(el);
      });
    }
    body.querySelector('[data-cancel]').onclick = () => { picking = null; renderBag(); };
  }

  return { openShop, openBag };
})();
