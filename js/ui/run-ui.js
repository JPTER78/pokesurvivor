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
    renderCards(list);
    $('lvl-reroll').onclick = reroll;
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
    if (coopMode) {
      // Se queda la carta elegida a la vista mientras eligen los demás.
      $('cards').querySelectorAll('.card').forEach((el, j) => el.classList.toggle('picked', j === i));
      $('cards').classList.add('done');
    } else G.UI.hide('scr-levelup');
    cb(c);
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
      ${r.judge ? `<div style="grid-column:1/-1"><span>Ante Arceus</span><b class="gold">${G.U.mmss(r.judge.time)} · ${r.judge.bosses} ${r.judge.bosses === 1 ? 'legendario' : 'legendarios'}</b></div>` : ''}
      <div style="grid-column:1/-1"><span>Pokémonedas ganadas</span>
        <b class="gold"><span class="coin"></span> +${r.coins}</b>
        <div style="font-size:12px;color:var(--muted)">${r.breakdown}</div></div>
      ${r.t1 || r.t10 ? `<div style="grid-column:1/-1"><span>Tickets del gacha</span><b>
        ${r.t1 ? G.Icons.html('ticket', 22) + ' +' + r.t1 + ' ' : ''}${r.t10 ? G.Icons.html('ticket10', 22) + ' +' + r.t10 + ' ×10' : ''}</b></div>` : ''}
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

  // ---------------- panel "Tu partida" (pausa) ----------------

  let buildTimer = 0;
  let legendOpen = false;   // ayuda del panel (se cierra al volver a pausar)

  /** Deja de refrescar el panel de la pausa. */
  function stopBuildTimer() {
    if (buildTimer) { clearInterval(buildTimer); buildTimer = 0; }
  }

  /** Pinta el resumen de la run: movimientos, objeto, mejoras activas y números. */
  function renderRunBuild() {
    const box = $('pause-build');
    const r = G.RunSummary.build(G.Game.player, G.Game.st.time);
    if (!r) { box.innerHTML = ''; return; }

    // Valor de una mejora: porcentaje (ataque, velocidad, defensa) o vida/s.
    const val = b => b.pct ? `+${b.pct}%${b.unit ? ' ' + b.unit : ''}` : `+${b.rate} ${b.unit}`;
    // Lo que le queda a una mejora activa, bien dicho.
    const left = s => s <= 1 ? 'queda 1 s' : `quedan ${s} s`;

    const moveHtml = m => {
      const name = `${G.Icons.html('move:' + m.id, 18)} <b>${m.name}</b> <em>Nv.${m.lvl}</em>`;
      // Todo en una sola línea que envuelve sola: los movimientos cortos ocupan
      // una línea y los que tienen muchos números pasan a dos.
      const d = [];
      if (m.buff) {
        d.push(`Efecto <b>${val(m.buff)}</b>`);
        // Cuánto se puede acumular: si no, no se entiende que en la lista de
        // mejoras activas salga un número mayor (4 × 1.6 = 6.4).
        if (m.buff.stacks > 1) d.push(`hasta ×${m.buff.stacks}`);
        if (m.buff.dur) d.push(`<b>dura ${m.buff.dur} s</b>`);
      } else {
        d.push(`Daño <b>${m.dmg}</b>`);
        if (m.hits > 1) d.push(`Golpes <b>×${m.hits}</b>`);
        if (m.cd) d.push(`Recarga <b>${m.cd}s</b>`);
        if (m.dps) d.push(`DPS <b>${m.dps}</b>`);
        if (m.pierce > 1) d.push(`Perfora <b>×${m.pierce}</b>`);
        if (m.dur) d.push(`Duración <b>${m.dur}s</b>`);
      }
      const tags = m.buff ? ''
        : [m.burn && 'Quema', m.poison && 'Veneno', m.slow && 'Ralentiza', m.drain && 'Drena']
          .filter(Boolean).map(t => `<span class="pb-tag">${t}</span>`).join('');
      const stats = d.map(x => `<span class="pb-st">${x}</span>`).join('<span class="pb-sep">·</span>');
      return `<div class="pb-mv"><span class="pb-mv-n">${name}</span>${stats}${tags}</div>`;
    };

    const moves = r.slots.map(s =>
      `<div class="pb-slot${s.active ? ' on' : ''}">
         <span class="pb-key">${s.n}</span>
         <span class="pb-slot-body">${s.moves.map(moveHtml).join('') || '—'}</span>
       </div>`).join('');

    const item = r.item
      ? `<div class="pb-line">${G.Icons.html(r.item.id, 24)} <b>${r.item.name}</b> <small>${r.item.desc}</small></div>`
      : `<div class="pb-line off">${G.Icons.html('ban', 24)} <span>Sin objeto</span></div>`;

    const buffs = r.buffs.map(b =>
      `<span class="pb-buff">${G.Icons.html(b.icon, 15)} ${b.label} <em>${val(b)}</em>${b.n > 1 ? ` <span class="pb-n">×${b.n}</span>` : ''}${b.t > 0 ? ` <span class="pb-time">${G.Icons.html('clock', 12)} ${left(Math.ceil(b.t))}</span>` : ''}</span>`).join('');

    // Poder de altar: como las mejoras, es temporal, así que va con ellas.
    // Sólo lleva reloj si le queda tiempo (como las mejoras activas).
    const power = r.power
      ? `<span class="pb-buff pw">${G.Icons.html(r.power.icon, 15)} <b>${r.power.name}</b> <em>${r.power.desc}</em>${r.power.t > 0 ? ` <span class="pb-time">${G.Icons.html('clock', 12)} ${left(Math.ceil(r.power.t))}</span>` : ''}</span>`
      : '';

    // Cartas de nivel cogidas: lo que has ido eligiendo (Potencia, Vigor...).
    const upgrades = r.upgrades.map(u =>
      `<span class="pb-upg">${G.Icons.html(u.icon, 14)} ${u.name} <b>×${u.n}</b> <em>${u.effect}</em></span>`).join('');

    const tickets = r.stats.t1 || r.stats.t10
      ? `<div style="grid-column:1/-1"><span>Tickets</span><b>${G.Icons.html('ticket', 20)} +${r.stats.t1}${r.stats.t10 ? ' · ' + G.Icons.html('ticket10', 20) + ' +' + r.stats.t10 : ''}</b></div>`
      : '';

    const atkPct = `${r.stats.atkPct > 0 ? '+' : ''}${r.stats.atkPct}% de daño`;

    box.innerHTML =
      `<h3 class="pb-h">Tu partida</h3>
       <div class="pb-head">
         <span class="pb-sprite"></span>
         <span class="pb-title"><b>${r.name}</b> <span class="pb-lv">Nv.${r.level}</span>${r.bonds ? ` <span class="pb-bond">${G.Icons.html('bond', 14)} ${r.bonds}</span>` : ''}
           <span class="pb-hp"><i style="width:${Math.round(r.hpFrac * 100)}%"></i></span></span>
       </div>
       <div class="pb-moves">${moves}</div>
       ${item}
       ${buffs || power ? `<div class="pb-buffs">${buffs}${power}</div>` : ''}
       ${upgrades ? `<div class="pb-upgs"><span class="pb-sub">Mejoras de la run</span>${upgrades}</div>` : ''}
       <div class="stats pb-stats">
         <div class="pb-atk"><span>Ataque</span><b>×${r.stats.atk}</b> <small>${atkPct}</small></div>
         <div><span>Crítico</span><b>${r.stats.crit}%</b></div>
         <div><span>Tiempo</span><b>${G.U.mmss(r.stats.time)}</b></div>
         <div><span>Derrotados</span><b>${r.stats.kills}</b></div>
         <div><span>Jefes</span><b>${r.stats.bosses}</b></div>
         <div><span>Daño total</span><b>${r.stats.damage}</b></div>
         <div><span>Pokémonedas</span><b class="gold">${r.stats.coins}</b></div>
         ${tickets}
       </div>
       <button type="button" class="pb-help" aria-expanded="${legendOpen ? 'true' : 'false'}">${legendOpen ? 'Ocultar la ayuda' : '¿Qué es cada número?'}</button>
       <div class="pb-legend${legendOpen ? '' : ' hidden'}">
         <p>Daño: lo que quita cada golpe. Ya lleva tu ataque y el nivel del movimiento; no cuenta el tipo del enemigo.</p>
         <p>Golpes: cuántas balas u orbes lanza de una vez. Recarga: segundos entre un lanzamiento y el siguiente.</p>
         <p>DPS: daño por segundo aproximado (daño × golpes ÷ recarga).</p>
         <p>Las mejoras activas (Ataque, Defensa...) se van acumulando mientras su movimiento siga lanzándose; el ×N son las veces que se han acumulado y el reloj, el tiempo que les queda.</p>
         <p>Mejoras de la run: las cartas de nivel que has ido eligiendo (Potencia, Vigor, Reflejos...). El ×N es cuántas veces has cogido cada una y el +X lo que te da en total; valen para toda la partida.</p>
       </div>`;

    const help = box.querySelector('.pb-help');
    if (help) help.onclick = () => { legendOpen = !legendOpen; renderRunBuild(); };

    const sp = box.querySelector('.pb-sprite');
    if (sp) sp.appendChild(G.UI.spriteCanvas(r.dex, 52, 46, { shiny: r.shiny, scale: 2 }));
  }

  function showPause(coop = false) {
    G.UI.soundControls($('pause-sound'));
    $('pause-coop').classList.toggle('hidden', !coop);
    $('btn-quit').textContent = coop ? 'Salir de la partida' : 'Abandonar run';
    legendOpen = false;
    renderRunBuild();
    // En solitario la pausa congela el juego, así que no hace falta refrescar.
    // En grupo el juego sigue: el panel se pone al día cada segundo y, si la
    // pantalla se cierra por cualquier vía, el propio tic se detiene.
    stopBuildTimer();
    if (coop) buildTimer = setInterval(() => {
      if (!G.UI.isOpen('scr-pause')) { stopBuildTimer(); return; }
      renderRunBuild();
    }, 1000);
    G.UI.show('scr-pause');
  }

  function wirePause(onResume, onQuit) {
    $('btn-resume').onclick = () => { stopBuildTimer(); onResume(); };
    $('btn-quit').onclick = () => { stopBuildTimer(); onQuit(); };
  }

  return { showLevelUp, reroll, showItemChoice, showBond, pickBond, bondBack, pick, setWaiting, closeLevelUp, showOver, wirePause, showPause };
})();
