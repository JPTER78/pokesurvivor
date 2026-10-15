/* ============ evolution.js — cinemática de evolución del Pokémon ============
 * Sigue el mismo patrón que G.Judgment.cinematic: mientras G.Evolution.cinematic
 * es true, game.js salta el resto de update() y llama a cineTick().
 *
 * Secuencia (~5.5s):
 *   0.0s   -> empieza: se para la música del bioma y suena la de evolución,
 *             sonido evolve, anillos de luz blancos
 *   0.0-3.0s -> parpadeo entre la forma vieja y la nueva (cada vez más rápido)
 *   3.2s   -> se aplica la evolución: stats, sprite, bonus pasivo, guardado,
 *             movimiento exclusivo, ráfaga dorada de partículas
 *   3.2s   -> texto grande "¡X ha evolucionado a Y!" + "ding" brillante
 *   5.5s   -> fin; si la nueva forma también debe evolucionar, se encadena.
 *             La música del bioma se restablece sola en el siguiente update().
 */
G.Evolution = (() => {
  let cinematic = false;
  let pl = null;
  let oldMon = null;
  let newMon = null;
  let oldAnim = null;
  let newAnim = null;
  let ev = null;          // config de la evolución (bonus, move...)
  let t = 0;
  let applied = false;
  let lastRingT = -1;

  const BLINK_END = 3.0;  // fin del parpadeo
  const APPLY_T = 3.2;    // momento de aplicar la evolución
  const DUR = 5.5;        // duración total antes de cerrar (o encadenar)

  function start(player, target) {
    pl = player;
    oldMon = player.mon;
    newMon = target;
    ev = G.evolutionOf(oldMon.dex);   // { to, level, bonus, move }
    oldAnim = player.anim;
    newAnim = new G.Sprites.Animator(target.dex, 1, player.shiny);
    G.Sprites.preload([target.dex]);
    t = 0;
    applied = false;
    lastRingT = -1;
    cinematic = true;
    // Música de evolución (la del bioma se restablece al acabar la cinemática).
    G.Audio.music('evolution');
    G.Audio.sfx('evolve');
    // Destello inicial con anillos blancos.
    G.FX.ring(player.x, player.y, 6, player.r * 5, '#ffffff', 0.5, 3);
    G.FX.ring(player.x, player.y, 4, player.r * 3, '#fff3c8', 0.4, 2);
    // Partículas doradas subiendo por el fondo (energía de la evolución).
    spawnEnergyParticles();
    // Rayos de luz girando alrededor del Pokémon.
    spawnLightRays();
  }

  function cineTick(dt) {
    t += dt;

    // --- parpadeo entre forma vieja y nueva (cada vez más rápido) ---
    if (t < BLINK_END) {
      const speed = 0.28 - (t / BLINK_END) * 0.18;   // 0.28s -> 0.10s por ciclo
      const on = Math.floor(t / speed) % 2 === 0;
      pl.anim = on ? newAnim : oldAnim;
      // Anillo pulsante de luz blanca cada ~0.15s.
      const beat = Math.floor(t / 0.15);
      if (beat !== lastRingT) {
        lastRingT = beat;
        G.FX.ring(pl.x, pl.y, 5, pl.r * (3 + (beat % 3)), '#ffffff', 0.35, 2);
      }
    } else if (t >= APPLY_T && !applied) {
      apply();
    }

    pl.anim.update(dt);
    G.FX.update(dt);

    // Fin: encadenar con la siguiente evolución si toca, o cerrar.
    if (t >= DUR) {
      const next = G.evolutionOf(newMon.dex);
      if (next && pl.level >= next.level) {
        start(pl, G.DEX_BY[next.to]);
      } else {
        cinematic = false;
      }
    }
  }

  /** Crea partículas doradas que suben por el fondo (energía de la evolución). */
  function spawnEnergyParticles() {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.2832;
      const r = G.U.rand(pl.r * 0.5, pl.r * 1.6);
      const x = pl.x + Math.cos(a) * r;
      const y = pl.y + Math.sin(a) * r + pl.bodyH * 0.5;
      G.FX.px(x, y, '#ffd23f', {
        vx: Math.cos(a) * G.U.rand(-10, 10),
        vy: G.U.rand(-60, -20),
        life: G.U.rand(1.5, 3.0),
        size: G.U.rand(1, 3),
        grav: -10
      });
    }
    for (let i = 0; i < 15; i++) {
      const a = Math.random() * 6.2832;
      const r = G.U.rand(pl.r * 0.3, pl.r * 1.2);
      G.FX.px(pl.x + Math.cos(a) * r, pl.y + Math.sin(a) * r + pl.bodyH * 0.3,
        '#ffe14d', { vy: G.U.rand(-40, -15), life: G.U.rand(1.0, 2.2), size: 2 });
    }
  }

  /** Crea rayos de luz dorada/blanca girando alrededor del Pokémon. */
  function spawnLightRays() {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * 6.2832 + G.U.rand(-0.1, 0.1);
      const r = pl.r * 2.5;
      const x = pl.x + Math.cos(a) * r;
      const y = pl.y + Math.sin(a) * r * 0.7;
      G.FX.ring(x, y, 2, pl.r * 0.6, '#fff3c8', 3.5, 2);
    }
  }

  /** Aplica los cambios de la evolución al jugador y al guardado. */
  function apply() {
    applied = true;
    pl.anim = newAnim;                 // quedarse con la nueva forma
    pl.evolve(newMon, ev && ev.bonus);
    G.DB.evolvePartner(oldMon.dex, newMon.dex);

    // Efectos finales.
    G.FX.ring(pl.x, pl.y, 8, pl.r * 7, '#ffd23f', 0.9, 5);
    G.FX.ring(pl.x, pl.y, 6, pl.r * 5, '#ffffff', 0.7, 3);
    G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#ffe14d', 50, 260);
    G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#ffffff', 24, 180);

    // Texto grande y visible + "ding" brillante.
    const msg = '¡' + oldMon.name + ' ha evolucionado a ' + newMon.name + '!';
    G.Spawner.say(msg, 4);
    G.Audio.sfx('evolveDing');
    G.UI.toast(msg, 3800);

    // Resumen de mejora de stats base.
    const dAtk = Math.round((newMon.atk - oldMon.atk) * 100);
    const dHp = newMon.hp - oldMon.hp;
    const dSpd = newMon.spd - oldMon.spd;
    G.FX.dmgText(pl.x, pl.y - pl.bodyH - 16,
      'Ataque +' + dAtk + '%  Vida +' + dHp + '  Vel +' + dSpd, '#ffd23f', true);

    // Resumen de la habilidad pasiva única (si la hay).
    if (ev && ev.bonus) {
      const bits = [];
      if (ev.bonus.type && ev.bonus.dmg) bits.push('+' + Math.round(ev.bonus.dmg * 100) + '% daño ' + (ev.bonus.type));
      if (ev.bonus.regen) bits.push('+' + ev.bonus.regen + ' regen');
      if (ev.bonus.spd) bits.push('+' + Math.round(ev.bonus.spd * 100) + '% vel');
      if (bits.length) G.FX.dmgText(pl.x, pl.y - pl.bodyH - 32, bits.join('  '), '#7dffb0', true);
    }

    // Intentar aprender el movimiento exclusivo (o uno del pool si no hay hueco).
    learnNewMove();
  }

  /**
   * Aprende un movimiento nuevo si hay hueco libre.
   * Prioridad: el movimiento exclusivo de la evolución (ev.move) si está en el
   * pool de la nueva forma y aún no se conoce; si no, uno aleatorio del pool.
   */
  function learnNewMove() {
    if (!G.Moves || !pl.moves) return;
    if (pl.slots.length >= pl.maxMoves) return;
    const pool = G.Moves.poolFor(pl.mon).filter(id => !pl.hasMove(id));
    if (!pool.length) return;

    let id = null;
    if (ev && ev.move && pool.indexOf(ev.move) >= 0) {
      id = ev.move;       // movimiento exclusivo de esta evolución
    } else {
      id = G.U.pick(pool);
    }
    pl.addMove(id);
    const d = G.Moves.BY_ID[id];
    const name = d ? d.name : id;
    G.FX.dmgText(pl.x, pl.y - pl.bodyH - 50, '¡Aprende ' + name + '!', '#7dffb0', true);
  }

  return {
    get cinematic() { return cinematic; },
    start,
    cineTick
  };
})();
