/* ============ ranking-ui.js — pantalla del ranking ============
 * Pestañas Solo / Grupo, periodo (diario ... histórico), todos o sólo amigos,
 * filtro por Pokémon (sólo en el histórico) y tu puesto abajo aunque no salgas
 * en el top. Lo leído se guarda 2 h (ver ranking.js).
 * Dos mitades (23-10-2026): a la izquierda el daño a Arceus y a la derecha el
 * tiempo aguantado. Salen de la misma lectura (el mismo resumen).
 */
G.RankingUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let mode = 's', period = 'w', scope = 'all', dex = null;
  let token = 0;

  function init() {
    const dl = $('rk-dl');
    dl.innerHTML = G.DEX.map(p => `<option value="${esc(G.T(p.name))}">`).join('');
    $('rk-poke').onchange = () => {
      const v = $('rk-poke').value.trim().toLowerCase();
      const p = G.DEX.find(x => (x.name.toLowerCase() === v || G.T(x.name).toLowerCase() === v));
      if (!v) { setDex(null); return; }
      if (!p) { G.UI.toast('No hay ningún Pokémon con ese nombre'); return; }
      setDex(p.dex);
    };
    $('rk-clear').onclick = () => { $('rk-poke').value = ''; setDex(null); };
    $('rk-mod').onclick = () => G.ModUI.open();
  }

  /** El filtro por Pokémon sólo existe en el histórico: al elegir uno se pasa a esa pestaña. */
  function setDex(d) {
    dex = d;
    if (d && period !== 'a') period = 'a';
    $('rk-clear').classList.toggle('hidden', !d);
    tabs(); load();
  }

  function open() {
    if (!G.SocialUI.needOnline()) return;
    G.UI.show('scr-rank', true);
    if (!G.Social.started) G.Social.start();
    $('rk-mod').classList.toggle('hidden', !G.Ranking.isAdmin());
    tabs();
    load();
  }

  function tabs() {
    const mk = (box, items, cur, set, cls) => {
      box.innerHTML = '';
      for (const [k, label] of items) {
        const b = document.createElement('button');
        b.className = cls + (k === cur ? ' on' : '');
        b.innerHTML = label;
        b.onclick = () => { set(k); tabs(); load(); };
        box.appendChild(b);
      }
    };
    mk($('rk-mode'), [['s', `<b>${G.Icons.html('user', 16)} Solo</b>`], ['g', `<b>${G.Icons.html('friends', 16)} Grupo</b>`]],
       mode, k => { mode = k; }, 'gen-tab');
    mk($('rk-period'), G.Ranking.PERIODS, period, k => {
      period = k;
      if (k !== 'a' && dex) { dex = null; $('rk-poke').value = ''; $('rk-clear').classList.add('hidden'); }
    }, 'chip');
    mk($('rk-scope'), [['all', 'Todos'], ['friends', 'Sólo amigos']], scope, k => { scope = k; }, 'chip');
  }

  const fmt = t => t >= 3600 ? Math.floor(t / 3600) + ':' + G.U.mmss(t % 3600).padStart(5, '0') : G.U.mmss(t);

  async function load() {
    const my = ++token;
    const list = $('rk-list'), dlist = $('rk-dlist');
    list.innerHTML = dlist.innerHTML = '<p class="sub">Cargando…</p>';
    $('rk-me').innerHTML = $('rk-dme').innerHTML = '';
    let rows = [], me = null, dmg = { rows: [], me: null };
    try {
      [rows, me, dmg] = await Promise.all([
        G.Ranking.top(mode, period, dex, scope === 'friends'),
        G.Social.me ? G.Ranking.myRank(mode, period, dex) : Promise.resolve(null),
        dex ? Promise.resolve(dmg) : G.Ranking.topDmg(mode, period, scope === 'friends')
      ]);
    } catch (e) {
      if (my !== token) return;
      list.innerHTML = dlist.innerHTML = '<p class="sub">No se pudo cargar el ranking (' + esc(e.code || e.message) + ').</p>';
      return;
    }
    if (my !== token) return;
    list.innerHTML = dlist.innerHTML = '';
    if (!rows.length) {
      list.innerHTML = '<p class="sub">Todavía no hay marcas aquí. ¡Sé el primero!</p>';
    }
    const uid = G.Social.uid;
    const b = G.Ranking.board(mode, period, dex), done = G.Ranking.reported();
    rows.forEach((r, i) => list.appendChild(rowEl(r, i + 1, r.uids.includes(uid), b, done)));

    // Daño a Arceus (no hay por Pokémon).
    if (dex) dlist.innerHTML = '<p class="sub">El daño a Arceus no tiene ranking por Pokémon.</p>';
    else if (!dmg.rows.length) dlist.innerHTML = '<p class="sub">Todavía nadie le ha hecho daño a Arceus aquí. ¡Llega al minuto 30 y pégale!</p>';
    const db = G.Ranking.board(mode, period);
    dmg.rows.forEach((r, i) => dlist.appendChild(rowEl(r, i + 1, r.uids.includes(uid), db, done, true)));
    const dme = $('rk-dme');
    dme.setAttribute('translate', 'no');
    dme.textContent = dex || !dmg.me ? '' : dmg.me.out ? G.T('Aún no estás en el top 50 de daño.')
      : G.I18n.f('Tu puesto: {x}', '#' + dmg.me.pos) + ' · ' + num(dmg.me.d);
    dme.classList.toggle('hidden', !dme.textContent);

    // La frase se monta en cada idioma (traducirla por trozos sale rara).
    const lang = G.I18n.lang, en = lang === 'en', pos = '#' + (me && me.capped ? '1000+' : me && me.pos);
    if (lang !== 'es' && !en) {
      // Otros idiomas: frases enteras sin periodo ni Pokémon (ya se ven en los filtros).
      const rk = $('rk-me');
      rk.setAttribute('translate', 'no');
      rk.textContent = !G.Social.me ? G.T('Elige un apodo (en Amigos) para salir en el ranking.')
        : me && me.out ? G.T('Aún no estás en el top 50. Tu puesto está en Histórico.')
        : me ? G.I18n.f('Tu mejor puesto: {x}', pos) + ' · ' + fmt(me.t)
        : G.T('Aún no tienes marca.');
      return;
    }
    const pn = en ? { d: 'today', w: 'this week', m: 'this month', y: 'this year', a: 'of all time' }[period]
                  : { d: 'de hoy', w: 'de esta semana', m: 'de este mes', y: 'de este año', a: 'de siempre' }[period];
    const mon = dex ? G.DEX_BY[dex].name : '';
    const where = en ? (mode === 's' ? 'solo' : 'group') + (dex ? ' with ' + mon : '')
                     : (mode === 's' ? 'en solitario' : 'en grupo') + (dex ? ' con ' + mon : '');
    $('rk-me').removeAttribute('translate');
    $('rk-me').innerHTML = !G.Social.me ? 'Elige un apodo (en Amigos) para salir en el ranking.'
      : me && me.out ? (en ? `<span translate="no">You're not in the top 50 ${where} ${pn} yet. Your rank is in All-time.</span>`
                           : `Aún no estás en el top 50 ${pn} ${where}. Tu puesto está en Histórico.`)
      : me ? (en ? `<span translate="no">Your best ${where} rank ${pn}: <b class="gold">${pos}</b> · ${fmt(me.t)}</span>`
                 : `Tu mejor puesto ${pn} ${where}: <b class="gold">${pos}</b> · ${fmt(me.t)}`)
      : (en ? `<span translate="no">You don't have a ${where} record ${pn} yet.</span>` : `Aún no tienes marca ${pn} ${where}.`);
  }

  const num = n => (n || 0).toLocaleString(G.I18n.locale);

  /** Una fila: de tiempo o, con dmg, de daño a Arceus. */
  function rowEl(r, pos, mine, b, done, dmg = false) {
    const el = document.createElement('div');
    el.className = 'rk-row' + (mine ? ' mine' : '') + (pos <= 3 ? ' top' + pos : '');
    el.insertAdjacentHTML('beforeend', `<span class="pos">${pos <= 3 ? G.Icons.html('trophy', 20) : ''}${pos}</span>`);
    const mons = document.createElement('span');
    mons.className = 'mons';
    r.dex.forEach((d, i) => { if (G.DEX_BY[d]) mons.appendChild(G.UI.spriteCanvas(d, 44, 40, { scale: 1, shiny: !!r.shiny[i] })); });
    el.appendChild(mons);
    el.insertAdjacentHTML('beforeend',
      `<span class="who"><b translate="no">${r.names.map((n, i) => `<a href="#" class="plink" data-u="${esc(r.uids[i] || '')}">${esc(n)}</a>`).join(' · ')}</b>${dmg ? '' : `<small>Nv. ${r.lv || 1} · ${num(r.kills)} derrotados</small>`}</span>
       <span class="time">${dmg ? num(r.d) : fmt(r.t)}</span>`);
    el.querySelectorAll('.plink').forEach(a => { a.onclick = e => { e.preventDefault(); G.ProfileUI.show(a.dataset.u); }; });
    // Reportar una marca sospechosa (no la tuya). Lo revisa el admin (mod-ui.js).
    if (!mine && G.Social.me) {
      const rep = document.createElement('button');
      const sent = done.has(b + '__' + r.id);
      rep.className = 'rk-rep' + (sent ? ' sent' : '');
      rep.title = sent ? 'Ya la has reportado' : 'Reportar marca sospechosa';
      rep.innerHTML = G.Icons.html('flag', 16);
      rep.onclick = async () => {
        if (rep.classList.contains('sent')) { G.UI.toast('Ya has reportado esta marca'); return; }
        if (!confirm('¿Reportar la marca de ' + r.names.join(', ') + ' como trampa?')) return;
        rep.classList.add('sent'); rep.title = 'Ya la has reportado';
        await G.Ranking.report(b, r);
        G.UI.toast('Gracias: la revisaremos');
      };
      el.appendChild(rep);
    } else el.appendChild(document.createElement('span'));
    return el;
  }

  return { init, open };
})();
