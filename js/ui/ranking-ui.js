/* ============ ranking-ui.js — pantalla del ranking ============
 * Pestañas Solo / Grupo, periodo (diario ... histórico), todos o sólo amigos,
 * filtro por Pokémon y tu puesto abajo aunque no salgas en el top.
 */
G.RankingUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let mode = 's', period = 'w', scope = 'all', dex = null;
  let token = 0;

  function init() {
    const dl = $('rk-dl');
    dl.innerHTML = G.DEX.map(p => `<option value="${esc(p.name)}">`).join('');
    $('rk-poke').onchange = () => {
      const v = $('rk-poke').value.trim().toLowerCase();
      const p = G.DEX.find(x => x.name.toLowerCase() === v);
      if (!v) { setDex(null); return; }
      if (!p) { G.UI.toast('No hay ningún Pokémon con ese nombre'); return; }
      setDex(p.dex);
    };
    $('rk-clear').onclick = () => { $('rk-poke').value = ''; setDex(null); };
  }

  function setDex(d) { dex = d; $('rk-clear').classList.toggle('hidden', !d); load(); }

  function open() {
    if (!G.SocialUI.needOnline()) return;
    G.UI.show('scr-rank', true);
    if (!G.Social.started) G.Social.start();
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
    mk($('rk-period'), G.Ranking.PERIODS, period, k => { period = k; }, 'chip');
    mk($('rk-scope'), [['all', 'Todos'], ['friends', 'Sólo amigos']], scope, k => { scope = k; }, 'chip');
  }

  const fmt = t => t >= 3600 ? Math.floor(t / 3600) + ':' + G.U.mmss(t % 3600).padStart(5, '0') : G.U.mmss(t);

  async function load() {
    const my = ++token;
    const list = $('rk-list');
    list.innerHTML = '<p class="sub">Cargando…</p>';
    $('rk-me').innerHTML = '';
    let rows = [], me = null;
    try {
      [rows, me] = await Promise.all([
        G.Ranking.top(mode, period, dex, scope === 'friends'),
        G.Social.me ? G.Ranking.myRank(mode, period, dex) : Promise.resolve(null)
      ]);
    } catch (e) {
      if (my !== token) return;
      list.innerHTML = '<p class="sub">No se pudo cargar el ranking (' + esc(e.code || e.message) + ').</p>';
      return;
    }
    if (my !== token) return;
    list.innerHTML = '';
    if (!rows.length) {
      list.innerHTML = '<p class="sub">Todavía no hay marcas aquí. ¡Sé el primero!</p>';
    }
    const uid = G.Social.uid;
    rows.forEach((r, i) => list.appendChild(rowEl(r, i + 1, r.uids.includes(uid))));

    const pn = { d: 'de hoy', w: 'de esta semana', m: 'de este mes', y: 'de este año', a: 'de siempre' }[period];
    const where = (mode === 's' ? 'en solitario' : 'en grupo') + (dex ? ' con ' + G.DEX_BY[dex].name : '');
    $('rk-me').innerHTML = !G.Social.me ? 'Elige un apodo (en Amigos) para salir en el ranking.'
      : me ? `Tu mejor puesto ${pn} ${where}: <b class="gold">#${me.pos}</b> · ${fmt(me.t)}`
      : `Aún no tienes marca ${pn} ${where}.`;
  }

  function rowEl(r, pos, mine) {
    const el = document.createElement('div');
    el.className = 'rk-row' + (mine ? ' mine' : '') + (pos <= 3 ? ' top' + pos : '');
    el.insertAdjacentHTML('beforeend', `<span class="pos">${pos <= 3 ? G.Icons.html('trophy', 20) : ''}${pos}</span>`);
    const mons = document.createElement('span');
    mons.className = 'mons';
    r.dex.forEach((d, i) => { if (G.DEX_BY[d]) mons.appendChild(G.UI.spriteCanvas(d, 44, 40, { scale: 1, shiny: !!r.shiny[i] })); });
    el.appendChild(mons);
    el.insertAdjacentHTML('beforeend',
      `<span class="who"><b>${r.names.map(esc).join(' · ')}</b><small>Nv. ${r.lv || 1} · ${(r.kills || 0).toLocaleString('es')} derrotados</small></span>
       <span class="time">${fmt(r.t)}</span>`);
    return el;
  }

  return { init, open };
})();
