/* ============ mod-ui.js — moderación del ranking (pantalla oculta) ============
 * Sólo la ve la cuenta de moderación (G.Ranking.isAdmin, y firestore.rules
 * admin(): aunque alguien abriera esta pantalla, el servidor no le dejaría
 * hacer nada). Se abre con el botón "Moderación" del ranking.
 *
 *   Reportes          marcas reportadas por los jugadores, las más reportadas
 *                     primero: borrar la marca, banear (marca la cuenta: no
 *                     puede volver a subir marcas, y se borra su marca de todas
 *                     las tablas de ahora) o descartar el reporte.
 *   Cuentas marcadas  las que ha marcado el servidor (partida imposible) o el
 *                     admin; se pueden desmarcar (p. ej. un falso positivo).
 */
G.ModUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let tab = 'rep';

  function init() {
    $('mod-back').onclick = () => G.RankingUI.open();
    document.querySelectorAll('#mod-tabs .tab').forEach(t => { t.onclick = () => { tab = t.dataset.tab; render(); }; });
  }

  function open() {
    if (!G.Ranking.isAdmin()) return;
    G.UI.show('scr-mod', true);
    render();
  }

  const fmt = t => G.U.mmss(t || 0);
  const btn = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn small ' + cls; b.textContent = label; b.onclick = fn; return b; };

  async function render() {
    document.querySelectorAll('#mod-tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
    const list = $('mod-list');
    list.innerHTML = '<p class="sub">Cargando…</p>';
    try {
      if (tab === 'rep') await renderReports(list);
      else await renderMarked(list);
    } catch (e) {
      list.innerHTML = '<p class="sub">No se pudo cargar (' + esc(e.code || e.message) + ').</p>';
    }
  }

  async function renderReports(list) {
    const groups = await G.Ranking.reports();
    list.innerHTML = groups.length ? '' : '<p class="sub">No hay reportes.</p>';
    for (const g of groups) {
      const row = document.createElement('div');
      row.className = 'rk-row mod-row';
      const mode = g.board.startsWith('g_') ? 'g' : 's';
      row.innerHTML = `<span class="pos" title="reportes">${g.n}×</span>
        <span class="who"><b translate="no">${g.names.map(esc).join(' · ')}</b><small translate="no">${esc(g.board)} · ${fmt(g.t)}</small></span>`;
      const acts = document.createElement('span');
      acts.className = 'mod-acts';
      const busy = async (fn, msg) => {
        acts.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try { await fn(); G.UI.toast(msg); row.remove(); }
        catch (e) { G.UI.toast('No se pudo: ' + (e.code || e.message)); acts.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
      };
      acts.append(
        btn('Borrar marca', 'ghost', () => busy(async () => {
          await G.Ranking.removeEverywhere(g.e, mode, [], g.board);
          await G.Ranking.dismiss(g.ids);
        }, 'Marca borrada')),
        btn('Banear', 'danger', () => {
          if (!confirm('¿Banear a ' + g.names.join(', ') + '? No podrán volver a salir en el ranking y se borra su marca.')) return;
          busy(async () => {
            const uids = g.e.split('_');
            for (const u of uids) await G.Ranking.setMarked(u, true).catch(() => {});
            await G.Ranking.removeEverywhere(g.e, mode, [], g.board);
            await G.Ranking.dismiss(g.ids);
          }, 'Baneado');
        }),
        btn('Descartar', 'ghost', () => busy(() => G.Ranking.dismiss(g.ids), 'Reporte descartado'))
      );
      row.appendChild(acts);
      list.appendChild(row);
    }
  }

  async function renderMarked(list) {
    const accs = await G.Ranking.markedAccounts();
    list.innerHTML = accs.length ? '' : '<p class="sub">No hay cuentas marcadas.</p>';
    for (const a of accs) {
      const row = document.createElement('div');
      row.className = 'rk-row mod-row';
      row.innerHTML = `<span class="pos"></span>
        <span class="who"><b translate="no">${esc(a.name)}</b><small translate="no">${a.coins.toLocaleString('es')} monedas · ${a.t1} tickets · ${a.t10} ×10 · ${a.owned} Pokémon · ${esc(a.uid)}</small></span>`;
      const acts = document.createElement('span');
      acts.className = 'mod-acts';
      acts.append(btn('Desmarcar', 'ghost', async () => {
        try { await G.Ranking.setMarked(a.uid, false); G.UI.toast('Desmarcada'); row.remove(); }
        catch (e) { G.UI.toast('No se pudo: ' + (e.code || e.message)); }
      }));
      row.appendChild(acts);
      list.appendChild(row);
    }
  }

  return { init, open };
})();
