/* ============ moves-codex.js — ficha de movimientos: catálogo, popup y hover ============
 * La tabla de movimientos de la web (movimientos/), pero con los datos del
 * juego, sin copiar nada: todo sale de js/data/moves.js.
 *  - Catálogo en el menú (scr-moves), con filtros como la colección.
 *  - Ficha al tocar un icono de movimiento (elementos con data-move).
 *  - En PC, cartel al pasar el ratón por cualquiera de esos iconos.
 *  - En plena run, cartel sobre un hueco de la barra (lo llama hud.js,
 *    igual que el de las esferas: ver orbTip ahí).
 */
G.MovesCodexUI = (() => {
  const $ = G.UI.$;
  // La columna «Clase» de la web; las familias del 19-10-2026 van con su
  // nombre técnico, tal y como allí. Se traducen con el contexto 'kind'
  // para no pisar claves que ya existen («Rayo» es también el movimiento).
  const KIND = {
    projectile: 'Proyectil', melee: 'Cuerpo a cuerpo', beam: 'Rayo', orbit: 'Órbita', nova: 'Ráfaga',
    aura: 'Aura', buff: 'Mejora', boomerang: 'Bumerán', chain: 'Cadena', mine: 'Minas', meteor: 'Meteoros',
    turret: 'Torreta', dash: 'Embestida', trail: 'Rastro', cone: 'Abanico'
  };
  const kindOf = m => KIND[m.kind] ? G.T(KIND[m.kind], 'kind') : m.kind;
  const catOf = m => m.cat === 'physical' ? G.T('Físico') : m.cat === 'special' ? G.T('Especial') : '—';

  /** Lo que gana al evolucionar, o null si no evoluciona (los potenciadores). */
  function evoOf(id) {
    const def = G.Moves.BY_ID[id], needs = G.Moves.EVO[id];
    if (!needs) return null;
    // evoInfo pide una instancia al nivel máximo; aquí sólo interesa su texto.
    const text = G.Moves.evoInfo(G.Moves.instance(id, def.maxLvl)).text;
    // f() no traduce los huecos: el nombre de la carta, aparte.
    return { name: G.T(def.name, 'move') + ' +', need: G.I18n.f('con {x}', G.T(G.Moves.NEED_NAME[needs])), text: G.T(text) };
  }

  /** Ficha completa, columna a columna como en la web. */
  function renderDetail(id) {
    const m = G.Moves.BY_ID[id], evo = evoOf(id);
    return `
      <div class="center">
        <div style="margin:4px 0 2px">${G.Icons.html('move:' + id, 44)}</div>
        <h3 style="margin:2px 0">${G.T(m.name, 'move')}</h3>
        <div>${G.UI.typeChips([m.type])}</div>
      </div>
      <div class="mon-extra" style="margin-top:8px">
        <div class="mx-row"><span>Categoría</span><b>${catOf(m)}</b></div>
        <div class="mx-row"><span>Clase</span><b>${kindOf(m)}</b></div>
        <p class="sub" style="margin:4px 0 0">${G.T(m.desc)}</p>
      </div>
      <p class="sub" style="margin:10px 0 2px">Mejoras al subir de nivel</p>
      <ul class="mv-ups">${m.ups.map((u, i) => `<li><b>${i + 2}</b>${G.T(u.t)}</li>`).join('')}</ul>
      <p class="sub" style="margin:8px 0 2px">Evoluciona a</p>
      ${evo ? `<p style="margin:2px 0"><b class="gold">${evo.name}</b><br><small class="sub">${evo.need} · ${evo.text}</small></p>`
            : `<p class="sub" style="margin:2px 0">—</p>`}`;
  }

  // ---------------- catálogo (filtros como la colección) ----------------

  const F0 = () => ({ type: '', cat: '', evo: false, q: '' });
  let mvF = F0(), sel = null, qT = 0;

  function open() {
    G.UI.show('scr-moves', true);
    // Categoría (una) y sólo evolucionables.
    const fb = $('mv-filters');
    fb.innerHTML = '';
    const chip = (html, on, fn) => {
      const c = document.createElement('button');
      c.className = 'chip' + (on ? ' on' : '');
      c.innerHTML = html;
      c.onclick = () => { fn(); open(); };
      fb.appendChild(c);
    };
    for (const [k, label] of [['', 'Todos'], ['physical', 'Físico'], ['special', 'Especial'], ['buff', 'Mejora']])
      chip(G.T(label), mvF.cat === k, () => { mvF.cat = k; });
    chip(G.Icons.html('up', 12) + ' ' + G.T('Solo evolucionables'), mvF.evo, () => { mvF.evo = !mvF.evo; });

    // Tipo y búsqueda (sin tildes, como en la colección).
    const ts = $('mv-type');
    ts.innerHTML = `<option value="">${G.T('Todos los tipos')}</option>` +
      Object.keys(G.U.TYPE_NAME).map(t => `<option value="${t}">${G.U.TYPE_NAME[t]}</option>`).join('');
    ts.value = mvF.type;
    ts.onchange = () => { mvF.type = ts.value; open(); };
    const q = $('mv-q');
    if (q.value !== mvF.q) q.value = mvF.q;
    q.oninput = () => { clearTimeout(qT); qT = setTimeout(() => { mvF.q = q.value; render(); }, 150); };
    q.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); q.blur(); } };
    $('mv-clear').onclick = () => { mvF = F0(); open(); };
    render();
  }

  function render() {
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const q = norm(mvF.q.trim());
    const order = Object.keys(G.U.TYPE_NAME);
    const list = G.Moves.ALL.filter(m =>
      (!mvF.type || m.type === mvF.type) &&
      (!mvF.cat || m.cat === mvF.cat) &&
      (!mvF.evo || G.Moves.EVO[m.id]) &&
      (!q || [m.name, G.T(m.name, 'move')].some(n => norm(n).includes(q)))
    ).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) ||
      G.T(a.name, 'move').localeCompare(G.T(b.name, 'move'), G.I18n.locale));
    $('mv-total').textContent = `${list.length} / ${G.Moves.ALL.length}`;
    $('mv-clear').classList.toggle('hidden', !mvF.type && !mvF.cat && !mvF.evo && !mvF.q);
    const grid = $('mv-grid');
    grid.innerHTML = list.map(m =>
      `<button class="cell${m.id === sel ? ' on' : ''}" data-mv="${m.id}" type="button">${G.Icons.html('move:' + m.id, 32)}<b>${G.T(m.name, 'move')}</b></button>`).join('');
    grid.querySelectorAll('[data-mv]').forEach(b => { b.onclick = () => { sel = b.dataset.mv; render(); }; });
    $('mv-detail').innerHTML = sel && G.Moves.BY_ID[sel]
      ? renderDetail(sel)
      : `<p class="sub center" style="margin-top:12px">${G.T('Elige un movimiento para ver su ficha')}</p>`;
  }

  // ---------------- ficha al tocar un icono, y hover en PC ----------------
  // Cualquier elemento con data-move (los iconos de la colección, las MT,
  // los vetos...). Los que ya hacen algo al tocarlos (chips, botones) sólo
  // enseñan el cartel del ratón, para no estorbar.

  /** La ficha en grande: en el móvil no hay hover, y así se lee tranquilo. */
  function popup(id) {
    const m = G.Moves.BY_ID[id];
    if (!m) return;
    G.Audio.sfx('click');
    const el = document.createElement('section');
    el.className = 'scr dim';
    el.style.zIndex = 70;
    el.innerHTML = `<div class="box" style="max-width:400px">
        ${renderDetail(id)}
        <div class="center"><button class="btn small ghost" type="button">Cerrar</button></div>
      </div>`;
    document.body.appendChild(el);
    const end = () => { document.removeEventListener('keydown', esc, true); el.remove(); };
    // En captura: que el Esc no abra de paso el menú de atrás.
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); end(); } };
    document.addEventListener('keydown', esc, true);
    el.addEventListener('click', e => { if (!e.target.closest('.box')) end(); });
    el.querySelector('.btn').onclick = end;
  }

  let tipEl = null, hoverEl = null, tipMode = 'cursor', tipT = 0;

  function tipHtml(id) {
    const m = G.Moves.BY_ID[id], evo = evoOf(id);
    return `<div class="mv-tip-head">${G.Icons.html('move:' + id, 22)} <b>${G.T(m.name, 'move')}</b></div>
      <div class="mv-tip-meta">${catOf(m)} · ${kindOf(m)}</div>
      <div class="mv-tip-desc">${G.T(m.desc)}</div>
      ${evo ? `<div class="mv-tip-evo">→ <b>${evo.name}</b> · ${evo.need} · ${evo.text}</div>` : ''}`;
  }

  /** El cartel, sin salirse de la pantalla. */
  function place(x, y) {
    const r = tipEl.getBoundingClientRect();
    tipEl.style.left = Math.max(8, Math.min(x + 16, innerWidth - r.width - 8)) + 'px';
    tipEl.style.top = Math.max(8, Math.min(y + 18, innerHeight - r.height - 8)) + 'px';
  }

  function hideTip() { clearTimeout(tipT); if (tipEl) tipEl.style.display = 'none'; }

  /** Muestra el cartel de `el`; en las cartas, al lado (que no las tape). */
  function showTip(el, e) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'move-tip'; document.body.appendChild(tipEl); }
    tipEl.innerHTML = tipHtml(el.dataset.move);
    tipEl.style.display = 'block';
    const card = el.closest('.cards .card');
    if (card) {
      tipMode = 'card';
      const r = card.getBoundingClientRect(), W = tipEl.offsetWidth, H = tipEl.offsetHeight;
      tipEl.style.left = (r.right + 12 + W <= innerWidth - 8 ? r.right + 12 : Math.max(8, r.left - W - 12)) + 'px';
      tipEl.style.top = G.U.clamp(r.top, 8, innerHeight - H - 8) + 'px';
    } else { tipMode = 'cursor'; place(e.clientX, e.clientY); }
  }

  function init() {
    document.addEventListener('click', e => {
      hideTip(); hoverEl = null;          // al elegir una carta no se queda colgando
      const el = e.target.closest('[data-move]');
      if (el && !el.closest('.chip, .btn, .card, .cell')) popup(el.dataset.move);
    });
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    // Se puede apagar en Ajustes (hay quien se molesta con los carteles).
    const off = () => G.Settings.get('mvTips') === false;
    document.addEventListener('mouseover', e => {
      const el = e.target.closest('[data-move]');
      if (el === hoverEl) return;
      hoverEl = el;
      hideTip();
      if (!el || off()) return;
      // En las cartas (nivel, vínculo) sólo sale si te quedas quieto encima:
      // al repasarlas con el ratón, sin querer, molesta enseguida.
      if (el.closest('.cards .card')) tipT = setTimeout(() => { if (hoverEl === el) showTip(el, e); }, 2000);
      else showTip(el, e);
    });
    document.addEventListener('mousemove', e => {
      if (!tipEl || tipEl.style.display === 'none' || tipMode !== 'cursor') return;
      place(e.clientX, e.clientY);
    }, { passive: true });
  }

  // ---------------- cartel dentro de la run (lo llama hud.js) ----------------
  // Como orbTip: el nombre con el color del tipo y, debajo, lo que interesa
  // saber ahí mismo —qué hace, su próxima mejora o cómo evoluciona—.

  function tip(ctx, m, cx, by, w) {
    // Se puede apagar en Ajustes, igual que el cartel del ratón.
    if (G.Settings.get('mvTips') === false) return;
    const def = m.def || G.Moves.BY_ID[m.id];
    const col = G.U.TYPE_COLOR[def.type];
    const F = (wt, s) => `${wt} ${s}px Pixelify,"Segoe UI",system-ui,sans-serif`;
    const name = G.T(m.name, 'move');
    const lines = [catOf(def) + ' · ' + kindOf(def)];
    // La descripción, en varias líneas si no cabe.
    ctx.font = F(600, 11);
    let cur = '';
    for (const word of G.T(def.desc).split(' ')) {
      const t = cur ? cur + ' ' + word : word;
      if (ctx.measureText(t).width > 236 && cur) { lines.push(cur); cur = word; } else cur = t;
    }
    if (cur) lines.push(cur);
    const next = G.Moves.nextUpText(m);
    if (next) lines.push(G.I18n.f('Siguiente: {x}', G.T(next)));
    else if (m.evolved) lines.push(G.T('Ya está evolucionado'));
    else if (G.Moves.EVO[m.id]) lines.push(G.I18n.f('Evoluciona con {x}', G.T(G.Moves.NEED_NAME[G.Moves.EVO[m.id]])));
    ctx.font = F(800, 12);
    let bw = ctx.measureText(name).width;
    ctx.font = F(600, 11);
    for (const l of lines) bw = Math.max(bw, ctx.measureText(l).width);
    bw += 16;
    const bh = 20 + lines.length * 14, bx = G.U.clamp(cx - bw / 2, 4, w - bw - 4), y = by - bh;
    ctx.save();
    G.HUD.roundRect(ctx, bx, y, bw, bh, 8);
    ctx.fillStyle = 'rgba(10,14,28,.92)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = F(800, 12); ctx.fillStyle = col;
    ctx.fillText(name, bx + bw / 2, y + 14);
    ctx.font = F(600, 11); ctx.fillStyle = '#e6ecff';
    lines.forEach((l, k) => ctx.fillText(l, bx + bw / 2, y + 28 + k * 14));
    ctx.restore();
  }

  return { init, open, popup, tip };
})();
