/* ============ run-ui.js — cartas de nivel, pausa y fin de run ============ */
G.RunUI = (() => {
  const $ = G.UI.$;
  let offers = null, offerCb = null, coopMode = false;

  /** @param coop  en grupo: tras elegir, se queda esperando a los demás */
  function showLevelUp(level, list, cb, coop = false) {
    offerCb = cb; coopMode = coop;
    $('lvl-num').textContent = level;
    $('lvl-wait').textContent = '';
    $('lvl-wait').classList.toggle('hidden', !coop);
    $('cards').classList.remove('done');

    const p = G.Game.player;
    const statBox = $('lvl-stat-gains');
    if (statBox) {
      const g = (p && p.consumeStatGains) ? p.consumeStatGains() : null;
      if (g) {
        statBox.innerHTML = `
          <div class="lvl-stats-badge">
            <div class="lvl-stats-title">▲ ¡Características aumentadas!</div>
            <div class="lvl-stats-grid">
              <div class="stat-pill"><span class="stat-lbl stat-hp">PS</span><span class="stat-val">+${g.hp}</span></div>
              <div class="stat-pill"><span class="stat-lbl stat-atk">ATAQUE</span><span class="stat-val">+${g.atk}</span></div>
              <div class="stat-pill"><span class="stat-lbl stat-def">DEFENSA</span><span class="stat-val">+${g.def}</span></div>
              <div class="stat-pill"><span class="stat-lbl stat-spa">AT. ESP.</span><span class="stat-val">+${g.spatk}</span></div>
              <div class="stat-pill"><span class="stat-lbl stat-spd">DEF. ESP.</span><span class="stat-val">+${g.spdef}</span></div>
              <div class="stat-pill"><span class="stat-lbl stat-spe">VELOCIDAD</span><span class="stat-val">+${g.spd}</span></div>
            </div>
          </div>`;
        statBox.classList.remove('hidden');
      } else {
        statBox.innerHTML = '';
        statBox.classList.add('hidden');
      }
    }

    renderCards(list);
    $('lvl-reroll').onclick = reroll;
    $('lvl-skip').classList.remove('hidden');
    $('lvl-skip').onclick = skip;
    G.UI.show('scr-levelup');
  }

  /**
   * Cambiar las cartas: 1 vez gratis por partida y 1 más por cada jefe
   * derrotado (en grupo cuentan los jefes del equipo; cada uno tiene los suyos).
   */
  function rerollsLeft() {
    const p = G.Game.player;
    // 1 gratis + los comprados en Mejoras (antes, 1 más por cada jefe).
    return p ? Math.max(0, 1 + (p.rerollBonus || 0) - (p.rerolls || 0)) : 0;
  }

  function reroll() {
    if (!offers || rerollsLeft() <= 0) return;
    const p = G.Game.player;
    p.rerolls = (p.rerolls || 0) + 1;
    G.Audio.sfx('select');
    renderCards(G.LevelUp.offer(p));
  }

  function renderCards(list) {
    offers = list;
    const left = rerollsLeft();
    $('lvl-rr-n').textContent = left;
    $('lvl-reroll').classList.toggle('hidden', left <= 0);
    const box = $('cards');
    box.innerHTML = '';
    list.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'card';
      const tag = c.type === 'new'
        ? `<span class="tag-chip" style="background:${c.color}">Nuevo · ${c.tag}</span>`
        : c.type === 'up' || c.type === 'evo'
          ? `<span class="tag-chip" style="background:${c.color}">${c.tag}</span>`
          : `<span class="tag-chip" style="background:${c.color === '#ffd23f' ? '#ffd23f' : '#9fb1c9'}">${c.tag}</span>`;
      if (c.type === 'evo') el.classList.add('evo');
      el.innerHTML =
        `<div class="ico" style="background:${c.color}33">${G.Icons.html(c.icon, 32)}</div>
         <div class="txt"><div class="nm">${c.title} ${tag}</div><div class="ds">${c.desc}</div></div>
         <div class="key">${i + 1}</div>`;
      el.dataset.sfx = 'none';             // el juego pone su propio sonido al elegir
      el.onclick = () => pick(i);
      box.appendChild(el);
    });
  }

  function pick(i) {
    if (!offers || !offers[i]) return;
    const c = offers[i], cb = offerCb;
    offers = null; offerCb = null;
    $('lvl-reroll').classList.add('hidden');
    $('lvl-skip').classList.add('hidden');
    if (coopMode) {
      // Se queda la carta elegida a la vista mientras eligen los demás.
      $('cards').querySelectorAll('.card').forEach((el, j) => el.classList.toggle('picked', j === i));
      $('cards').classList.add('done');
    } else G.UI.hide('scr-levelup');
    cb(c);
  }

  /**
   * Omitir recompensa: no coge cartas y potencia aún más las estadísticas del Pokémon.
   */
  function skip() {
    if (!offerCb) return;
    const cb = offerCb;
    offers = null; offerCb = null;
    $('lvl-reroll').classList.add('hidden');
    $('lvl-skip').classList.add('hidden');
    if (coopMode) {
      $('cards').querySelectorAll('.card').forEach(el => el.classList.remove('picked'));
      $('cards').classList.add('done');
    } else G.UI.hide('scr-levelup');
    cb(null);
  }

  /** Cooperativo: quién falta por elegir. */
  function setWaiting(names) {
    const me = G.Social.me ? G.Social.me.name : '';
    const others = names.filter(n => n !== me);
    const list = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1] : a[0];
    $('lvl-wait').textContent = !names.length ? ''
      : !others.length ? 'Elige tu carta'
      : names.includes(me) ? 'Faltan por elegir: ' + list([...others, 'tú'])
      : 'Esperando a ' + list(others) + '…';
  }

  function closeLevelUp() {
    offers = null; offerCb = null;
    $('cards').classList.remove('done');
    $('lvl-skip').classList.add('hidden');
    G.UI.hide('scr-levelup');
  }

  /**
   * Mensaje de apoyo (Ko-fi) al acabar: tras un récord o cada 10 partidas,
   * nunca en la primera y como mucho una vez al día. Se cierra con la X.
   */
  function askSupport(r) {
    if (!G.Funding || !G.Funding.url) return false;
    const runs = (G.DB.save && G.DB.save.stats && G.DB.save.stats.runs) || 0;
    if (runs < 2 || !(r.record || runs % 10 === 0)) return false;
    const today = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem('ps.ask') === today) return false; localStorage.setItem('ps.ask', today); } catch (e) { return false; }
    return true;
  }

  function showOver(r, onBack) {
    $('over-title').textContent = r.dead ? 'Has caído…' : 'Run terminada';
    $('over-stats').innerHTML = `
      <div><span>Tiempo</span><b>${G.U.mmss(r.time)}</b></div>
      <div><span>Nivel</span><b>${r.level}</b></div>
      <div><span>Derrotados</span><b>${r.kills}</b></div>
      <div><span>Jefes</span><b>${r.bosses}</b></div>
      <div style="grid-column:1/-1"><span>Pokémonedas ganadas</span>
        <b class="gold"><span class="coin"></span> +${r.coins}</b>
        <div style="font-size:12px;color:var(--muted)">${r.breakdown}</div></div>
      ${r.t1 || r.t10 ? `<div style="grid-column:1/-1"><span>Tickets del gacha</span><b>
        ${r.t1 ? G.Icons.html('ticket', 22) + ' +' + r.t1 + ' ' : ''}${r.t10 ? G.Icons.html('ticket10', 22) + ' +' + r.t10 + ' ×10' : ''}</b></div>` : ''}
      ${r.runStats ? `<div style="grid-column:1/-1"><span>Stats ganados al subir de nivel</span><b style="font-size:13px;color:var(--gold)">
        PS +${r.runStats.hp} · ATQ +${r.runStats.atk} · DEF +${r.runStats.def} · AT.ESP +${r.runStats.spatk} · DEF.ESP +${r.runStats.spdef} · VEL +${r.runStats.spd}</b></div>` : ''}
      <div style="grid-column:1/-1"><span>Movimientos</span><b style="font-size:15px">
        ${r.moves.map(m => `${G.Icons.html('move:' + m.id, 16)} ${m.name} Nv.${m.lvl}`).join(' · ') || '—'}</b></div>
      ${r.caught && r.caught.length ? `<div style="grid-column:1/-1" class="caught"><span>${G.Icons.html('shiny', 12)} Shinies conseguidos</span>
        <div class="caught-row" id="over-caught"></div></div>` : ''}
      ${r.record ? '<div style="grid-column:1/-1;text-align:center" class="gold">¡Nuevo récord de tiempo!</div>' : ''}
      ${askSupport(r) ? `<div class="support-ask" id="over-ask" style="grid-column:1/-1">
        <button class="x" type="button" aria-label="Cerrar">×</button>
        <p>¿Te está gustando PokéSurvivor? Lo hago yo solo y los servidores cuestan dinero. Si quieres, puedes ayudarme a mantenerlo en línea.</p>
        <a class="btn small gold" href="${G.Funding.url}" target="_blank" rel="noopener">${G.Icons.html('heart', 14)} Apoyar en Ko-fi</a>
      </div>` : ''}`;
    const ask = $('over-ask');
    if (ask) ask.querySelector('.x').onclick = () => ask.remove();
    $('btn-again').onclick = onBack;
    if (r.caught && r.caught.length) {
      const row = $('over-caught');
      for (const c of r.caught) {
        const w = document.createElement('div');
        w.appendChild(G.UI.spriteCanvas(c.dex, 90, 72, { shiny: true, lively: true, scale: 2 }));
        w.insertAdjacentHTML('beforeend', `<small>${G.DEX_BY[c.dex].name}${c.isNew ? ' · ¡nuevo!' : ''}</small>`);
        row.appendChild(w);
      }
    }
    G.UI.show('scr-over');
  }

  /** Has encontrado un objeto llevando ya otro: ¿con cuál te quedas? */
  function showItemChoice(cur, next, cb) {
    const box = $('item-cards');
    box.innerHTML = '';
    [[cur, 'Quedarme con'], [next, 'Cambiar a']].forEach(([id, verb], i) => {
      const it = G.Items.BY[id];
      const el = document.createElement('div');
      el.className = 'card' + (i === 1 ? ' evo' : '');
      el.innerHTML = `<div class="ico">${G.Icons.html(id, 36)}</div>
        <div class="txt"><div class="nm">${verb} ${it.name}</div><div class="ds">${it.desc}</div></div>
        <div class="key">${i + 1}</div>`;
      el.onclick = () => { G.UI.hide('scr-item'); cb(id); };
      box.appendChild(el);
    });
    G.UI.show('scr-item');
  }

  // ---------------- vínculo: qué movimientos se fusionan ----------------

  let bond = null;          // { opt, cb, first, list }

  /**
   * @param opt  pl.bondOptions(): 'add' (uno suelto al grupo) o 'pair' (dos sueltos, en dos pasos)
   * @param cb   recibe la lista de movimientos que se juntan
   */
  function showBond(opt, cb) {
    bond = { opt, cb, first: null, list: [] };
    $('bond-back').onclick = bondBack;
    renderBond();
    G.UI.show('scr-bond');
  }

  function renderBond() {
    const { opt, first } = bond;
    const names = ms => ms.map(m => m.name).join(' + ');
    const step2 = opt.mode === 'pair' && first;
    $('bond-sub').textContent = opt.mode === 'add' ? 'Elige qué movimiento se une a ' + names(opt.group)
      : step2 ? '¿Con cuál unes ' + first.name + '?' : 'Elige el primer movimiento que vas a unir';
    $('bond-back').classList.toggle('hidden', !step2);
    bond.list = step2 ? opt.loose.filter(m => m !== first) : opt.loose;
    const box = $('bond-cards');
    box.innerHTML = '';
    bond.list.forEach((m, i) => {
      const col = G.U.TYPE_COLOR[m.type];
      const desc = opt.mode === 'add' ? 'Se lanzará a la vez que ' + names(opt.group) + '.'
        : step2 ? 'Se lanzará a la vez que ' + first.name + '. Queda un hueco libre.'
        : m.desc || '';
      const el = document.createElement('div');
      el.className = 'card' + (opt.mode === 'add' || step2 ? ' bond' : '');
      el.innerHTML =
        `<div class="ico" style="background:${col}33">${G.Icons.html('move:' + m.id, 32)}</div>
         <div class="txt"><div class="nm">${m.name} <span class="tag-chip" style="background:${col}">Nv.${m.lvl}</span></div><div class="ds">${desc}</div></div>
         <div class="key">${i + 1}</div>`;
      el.dataset.sfx = 'none';
      el.onclick = () => pickBond(i);
      box.appendChild(el);
    });
  }

  function pickBond(i) {
    if (!bond || !bond.list[i]) return;
    const m = bond.list[i];
    if (bond.opt.mode === 'pair' && !bond.first) {
      bond.first = m;
      G.Audio.sfx('select');
      renderBond();
      return;
    }
    const picked = bond.opt.mode === 'add' ? [m] : [bond.first, m];
    const cb = bond.cb;
    bond = null;
    G.UI.hide('scr-bond');
    cb(picked);
  }

  function bondBack() {
    if (!bond) return;
    bond.first = null;
    renderBond();
  }

  function populateStatsCard(p) {
    if (!p) return;
    const dex = p.dex;
    const mon = p.mon;
    const dexNum = String(dex).padStart(3, '0');

    const dexEl = $('poke-stat-dex');
    if (dexEl) dexEl.textContent = 'Nº ' + dexNum;
    const nameEl = $('poke-stat-name');
    if (nameEl) nameEl.textContent = mon.name;
    const lvlEl = $('poke-stat-lvl');
    if (lvlEl) lvlEl.textContent = 'Nv. ' + p.level;

    const shinyBadge = $('poke-stat-shiny-badge');
    if (shinyBadge) {
      shinyBadge.innerHTML = p.shiny ? `<span title="Shiny" style="color:var(--gold);font-size:16px;margin-left:4px">★</span>` : '';
    }

    const typesEl = $('poke-stat-types');
    if (typesEl) {
      typesEl.innerHTML = G.UI.typeChips(mon.types);
    }

    const cv = $('poke-stat-sprite');
    if (cv) {
      G.UI.sprite(cv, dex, { shiny: p.shiny, lively: true, hero: true, scale: 2.2 });
    }

    // Objeto
    const itemEl = $('poke-stat-item');
    if (itemEl) {
      if (p.item && G.Items.BY[p.item]) {
        const it = G.Items.BY[p.item];
        itemEl.innerHTML = `
          <div class="poke-item-row">
            <div class="poke-item-ico">${G.Icons.html(it.id, 28)}</div>
            <div class="poke-item-text">
              <b class="poke-item-name">${it.name}</b>
              <div class="poke-item-desc">${it.desc}</div>
            </div>
          </div>`;
      } else {
        itemEl.innerHTML = `<span class="poke-item-none">NO TIENE</span>`;
      }
    }

    // Características
    const atkBuff = p.buffs.atk.n > 0 ? ` <small class="buff-bonus">(+${Math.round(p.buffs.atk.n * p.buffs.atk.amount * 100)}%)</small>` : '';
    const defBuff = p.buffs.def.n > 0 ? ` <small class="buff-bonus">(+${Math.round(p.buffs.def.n * p.buffs.def.amount * 100)}%)</small>` : '';
    const spdBuff = p.buffs.spd.n > 0 ? ` <small class="buff-bonus">(+${Math.round(p.buffs.spd.n * p.buffs.spd.amount * 100)}%)</small>` : '';
    const rgnBuff = p.buffs.regen.n > 0 ? ` <small class="buff-bonus">(+${(p.buffs.regen.n * p.buffs.regen.amount).toFixed(1)}/s)</small>` : '';

    if ($('pstat-val-hp')) $('pstat-val-hp').innerHTML = `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;
    if ($('pstat-val-spa')) $('pstat-val-spa').innerHTML = `-${Math.round((1 - p.cdMul) * 100)}%`;
    if ($('pstat-val-atk')) $('pstat-val-atk').innerHTML = `×${p.atk.toFixed(2)}${atkBuff}`;
    if ($('pstat-val-spd')) $('pstat-val-spd').innerHTML = `+${p.regen.toFixed(1)}/s${rgnBuff}`;
    if ($('pstat-val-def')) $('pstat-val-def').innerHTML = `${Math.round(p.reduction * 100)}%${defBuff}`;
    if ($('pstat-val-spe')) $('pstat-val-spe').innerHTML = `${Math.round(p.spd)} px/s${spdBuff}`;

    // Stats ganados en la run
    const s = p.runStats || { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, spd: 0 };
    const gainsEl = $('poke-stat-gains');
    if (gainsEl) {
      gainsEl.innerHTML = `
        <span class="pgain-pill c-hp">PS +${s.hp}</span>
        <span class="pgain-pill c-atk">ATQ +${s.atk}</span>
        <span class="pgain-pill c-def">DEF +${s.def}</span>
        <span class="pgain-pill c-spa">AT.ESP +${s.spatk}</span>
        <span class="pgain-pill c-spd">DF.ESP +${s.spdef}</span>
        <span class="pgain-pill c-spe">VEL +${s.spd}</span>`;
    }

    // Experiencia
    const curXp = Math.floor(p.xp);
    const neededXp = Math.max(0, Math.ceil(p.xpNext - p.xp));
    const xpPct = G.U.clamp(p.xp / p.xpNext * 100, 0, 100);
    if ($('poke-stat-xp')) $('poke-stat-xp').textContent = curXp.toLocaleString('es');
    if ($('poke-stat-xpnext')) $('poke-stat-xpnext').textContent = neededXp.toLocaleString('es');
    const xpBar = $('poke-stat-xpbar');
    if (xpBar) xpBar.style.width = xpPct + '%';

    // Buffs activos
    const buffsBox = $('poke-stat-buffs-box');
    const buffsList = $('poke-stat-buffs-list');
    if (buffsBox && buffsList) {
      const active = [];
      if (p.buffs.atk.n > 0) active.push({ name: 'Ataque', txt: `+${Math.round(p.buffs.atk.n * p.buffs.atk.amount * 100)}%`, t: p.buffs.atk.t, col: '#ff6b4d' });
      if (p.buffs.def.n > 0) active.push({ name: 'Defensa', txt: `+${Math.round(p.buffs.def.n * p.buffs.def.amount * 100)}%`, t: p.buffs.def.t, col: '#5fb4ff' });
      if (p.buffs.spd.n > 0) active.push({ name: 'Velocidad', txt: `+${Math.round(p.buffs.spd.n * p.buffs.spd.amount * 100)}%`, t: p.buffs.spd.t, col: '#ffd23f' });
      if (p.buffs.regen.n > 0) active.push({ name: 'Regeneración', txt: `+${(p.buffs.regen.n * p.buffs.regen.amount).toFixed(1)}/s`, t: p.buffs.regen.t, col: '#5fe08a' });
      if (p.power) active.push({ name: p.power.def.name, txt: 'Altar', t: p.power.t, col: p.power.def.color });

      if (active.length > 0) {
        buffsBox.classList.remove('hidden');
        buffsList.innerHTML = active.map(b => `
          <div class="poke-buff-pill" style="border-color:${b.col}">
            <b style="color:${b.col}">${b.name}:</b> ${b.txt} · <span class="buff-timer">${b.t.toFixed(1)}s</span>
          </div>
        `).join('');
      } else {
        buffsBox.classList.add('hidden');
        buffsList.innerHTML = '';
      }
    }
  }

  function showPause(coop = false) {
    G.UI.soundControls($('pause-sound'));
    $('pause-coop').classList.toggle('hidden', !coop);
    $('btn-quit').textContent = coop ? 'Salir de la partida' : 'Abandonar run';

    const p = G.Game.player;
    if (p) populateStatsCard(p);

    G.UI.show('scr-pause');
  }

  function wirePause(onResume, onQuit) {
    $('btn-resume').onclick = onResume;
    $('btn-quit').onclick = onQuit;
    $('btn-pause-settings').onclick = () => G.SettingsUI.open();
  }

  return { showLevelUp, reroll, skip, showItemChoice, showBond, pickBond, bondBack, pick, setWaiting, closeLevelUp, showOver, wirePause, showPause, populateStatsCard };
})();
