/* ============ stats-ui.js — tus estadísticas en la partida ============
 * Lo que vale ahora cada estadística, cuántas cartas de nivel suyas llevas
 * (y el tope) y, si tienes Danza Espada, Agilidad, Fortaleza o Acua Aro, lo
 * que vale con cada acumulación del efecto. Sale en la pausa; en las cartas de
 * nivel, cada mejora dice cuánto subiría (preview).
 */
G.StatsUI = (() => {
  const pct = v => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';
  // id: el de la carta de nivel (G.LevelUp.STATS) · buff: el efecto que la sube.
  // val(p, n, a): el valor con n acumulaciones de un efecto que da `a` cada una.
  const ROWS = [
    { id: 'hp', label: 'Vida', val: p => Math.ceil(p.hp) + ' / ' + Math.round(p.maxHp) },
    { id: 'atk', label: 'Daño', buff: 'atk', val: (p, n, a) => pct(p.atkMul * (1 + n * a) - 1) },
    { id: 'spd', label: 'Velocidad', buff: 'spd', val: (p, n, a) => pct(p.spdMul * (1 + n * a) - 1) },
    { id: 'def', label: 'Defensa', buff: 'def', val: (p, n, a) => Math.round(Math.min(0.8, p.dmgReduce + n * a) * 100) + '%' },
    { id: 'rgn', label: 'Regeneración', buff: 'regen', val: (p, n, a) => (p.regenFlat + n * a).toFixed(1) + ' vida/s' },
    { id: 'cd', label: 'Recarga', val: p => pct(p.cdMul - 1) },
    { id: 'mag', label: 'Radio de recogida', val: p => Math.round(p.magnet) + ' px' },
    { id: 'xp', label: 'Experiencia', val: p => pct(p.xpMul - 1) },
    { id: null, label: 'Crítico', val: p => Math.round(p.critChance * 100) + '%' },
    { id: null, label: 'Pokémonedas', val: p => pct(p.coinMul - 1) }
  ];

  /** El valor de ahora (con las acumulaciones del efecto que tengas activas). */
  function now(r, p) {
    const b = r.buff && p.buffs[r.buff];
    return b ? r.val(p, b.n, b.amount) : r.val(p, 0, 0);
  }
  /** Cartas de nivel de esa estadística cogidas: "3/8" (o "3" si no tiene tope). */
  function taken(p, id) {
    const s = id && G.LevelUp.STATS.find(x => x.id === id);
    if (!s) return '';
    const n = p.statsTaken[id] || 0;
    return s.max ? n + '/' + s.max : String(n);
  }

  function html(p) {
    return '<h3 class="st-h">Tus estadísticas</h3>' + ROWS.map(r => {
      const t = taken(p, r.id);
      let out = `<div class="st-row"><span class="st-l">${r.label}</span><b>${now(r, p)}</b>
        <span class="st-n" title="Cartas de nivel cogidas">${t}</span></div>`;
      const m = r.buff && p.moves.find(x => x.kind === 'buff' && x.stat === r.buff);
      if (m) {
        const cur = p.buffs[r.buff].n;
        out += `<div class="st-buff"><span class="st-m">${m.name}</span>` + Array.from({ length: (m.stacks | 0) + 1 }, (_, n) =>
          `<span class="${n === cur ? 'on' : ''}"><i>×${n}</i>${r.val(p, n, m.amount)}</span>`).join('') + '</div>';
      }
      return out;
    }).join('');
  }

  /** Carta de nivel de una estadística: "+21% → +29% · 3/8" (sin contar los efectos, que se acaban). */
  function preview(p, id) {
    const r = ROWS.find(x => x.id === id), s = G.LevelUp.STATS.find(x => x.id === id);
    if (!r || !s) return '';
    const q = Object.create(p);     // copia de mentira: lo que cambia la carta se queda en q
    s.apply(q);
    const t = taken(p, id);
    return r.val(p, 0, 0) + ' → ' + r.val(q, 0, 0) + (t ? ' · ' + t : '');
  }

  return { html, preview };
})();
