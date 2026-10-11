/* ============ reactions.js — reacciones elementales ============
 * Cuando el TIPO de un ataque encuentra un ESTADO que ya sufre el enemigo,
 * pasa algo más: los combos automáticos del juego. Las mira G.Combat.damage()
 * en cada golpe. Cada enemigo tiene un pequeño cooldown (reactCd) para que un
 * abanico de 7 burbujas no dispare 7 reacciones.
 *
 *   Vapor         agua sobre quemado: consume la quemadura, nube que daña y frena
 *   Rotura        roca/acero/lucha/tierra sobre frenado: ese golpe ×1,6
 *   Detonación    fuego sobre envenenado: consume el veneno, explosión que quema
 *   Conducción    eléctrico sobre empapado: salta a 3 vecinos y los empapa
 *   Congelación   hielo sobre empapado: congela 1,2 s
 *
 * En cooperativo el invitado conoce los estados de las copias por los bits
 * que manda el anfitrión (BIT); sin bits, no hay reacción.
 *
 *   check(pl, e, m, dmg) -> multiplicador del golpe actual (1 o 1,6)
 */
G.Reactions = (() => {
  const BIT = { burn: 1, poison: 2, shield: 4, slow: 8, wet: 16 };
  const CD = 0.5;
  const lvlK = pl => 1 + (pl.level || 1) * 0.06;

  /** ¿Sufre `status` este enemigo? (copia remota: por los bits sincronizados) */
  function has(e, status) {
    if (e.remote) return !!(e.net && (e.net.st & BIT[status]));
    if (status === 'burn') return e.burn > 0;
    if (status === 'poison') return e.poison > 0;
    if (status === 'slow') return e.slow > 0;
    if (status === 'wet') return e.wet > 0;
    return false;
  }
  const slowOf = e => e.remote ? (has(e, 'slow') ? 0.5 : 0) : e.slow || 0;
  const stacks = (e, k) => e.remote ? 2 : Math.max(1, e[k] || 0);

  function label(e, r) {
    G.FX.dmgText(e.x, e.y - e.bodyH - 14, r.label, r.color, true);
    G.FX.ring(e.x, e.y, 6, r.radius || 40, r.color, 0.35, 3);
  }

  /** Daño de área a los vecinos (sin volver a reaccionar). */
  function splash(pl, e, m, r, dmg, fn) {
    for (const n of G.EnemyMgr.queryCircle(e.x, e.y, r)) {
      if (n.dead) continue;
      G.Combat.damage(pl, n, dmg, m, n.x - e.x, n.y - e.y, 0, { noReact: true });
      if (fn) fn(n);
    }
  }

  const LIST = [
    { id: 'vapor', label: '¡Vapor!', color: '#cfe9ff', types: ['water'], needs: 'burn', radius: 60,
      fire(pl, e, m) { const d = 6 * stacks(e, 'burn') * lvlK(pl); e.clearStatus('burn'); splash(pl, e, m, 60, d, n => n.applySlow(0.5, 1.5)); return 1; } },
    { id: 'rotura', label: '¡Rotura!', color: '#ffd27a', types: ['rock', 'steel', 'fighting', 'ground'], needs: 'slow', radius: 30,
      test(e, m) { return slowOf(e) >= (G.Moves.MELEE_KINDS.includes(m.kind) ? 0.25 : 0.4); },
      fire(pl, e) { e.clearStatus('slow'); return 1.6; } },
    { id: 'detonacion', label: '¡Detonación!', color: '#ff9a4d', types: ['fire'], needs: 'poison', radius: 70,
      fire(pl, e, m) { const d = 8 * stacks(e, 'poison') * lvlK(pl); e.clearStatus('poison'); splash(pl, e, m, 70, d, n => n.applyBurn(1)); return 1; } },
    { id: 'conduccion', label: '¡Conducción!', color: '#ffe14d', types: ['electric'], needs: 'wet', radius: 120,
      fire(pl, e, m, dmg) {
        const near = G.EnemyMgr.queryCircle(e.x, e.y, 120).filter(n => n !== e && !n.dead)
          .sort((a, b) => G.U.dist2(e.x, e.y, a.x, a.y) - G.U.dist2(e.x, e.y, b.x, b.y)).slice(0, 3);
        for (const n of near) {
          G.Combat.damage(pl, n, dmg * 0.5, m, n.x - e.x, n.y - e.y, 0, { noReact: true });
          n.applyWet();
          G.FX.beam(e.x, e.y - 10, Math.atan2(n.y - e.y, n.x - e.x), G.U.dist(e.x, e.y, n.x, n.y), 6, '#ffe14d', G.VFX.forType('electric'));
        }
        return 1;
      } },
    { id: 'congelacion', label: '¡Congelación!', color: '#9ae6ff', types: ['ice'], needs: 'wet', radius: 36,
      fire(pl, e) { e.clearStatus('wet'); e.applyFreeze(1.2); return 1; } }
  ];

  function check(pl, e, m, dmg) {
    if (!e || e.dead || (e.reactCd || 0) > 0 || !m || !m.type) return 1;
    for (const r of LIST) {
      if (!r.types.includes(m.type) || !has(e, r.needs)) continue;
      if (r.test && !r.test(e, m)) continue;
      e.reactCd = CD;
      label(e, r);
      if (G.Camera.sees(e.x, e.y, 40)) G.Audio.sfx('break');
      return r.fire(pl, e, m, dmg) || 1;
    }
    return 1;
  }

  return { LIST, BIT, has, check, CD };
})();
