/* ============ combat.js — recargas, apuntado, daño y colisiones ============
 * TODOS los movimientos del jugador se lanzan a la vez, cada uno con su
 * recarga y su propio objetivo (aimFor). El cómo de cada familia está en
 * systems/move-kinds.js. Todo el daño del jugador a un enemigo pasa por
 * damage(): tabla de tipos, clima, enfoque, estados y (systems/reactions.js)
 * reacciones elementales.
 *
 * Todo ocurre en el plano del suelo: (x, y) son pies / sombra.
 *
 * Cooperativo: cada ordenador ejecuta los ataques de SU jugador. Los de los
 * compañeros llegan por la red y se repiten como "fantasma" (ghostCast): se
 * ven igual, pero no hacen daño aquí (ya lo hizo su dueño).
 */
G.Combat = (() => {
  const MK = () => G.MoveKinds;

  // ---------------- apuntado ----------------

  /**
   * Objetivo y ángulo de UN movimiento. A distancia: el jefe si está a tiro >
   * lo que te toca > el más cercano. Cuerpo a cuerpo y el resto: lo que te toca
   * > el jefe > el más cercano. (Con una horda encima casi siempre te toca
   * algo; si eso ganara siempre, los ataques a distancia no le darían nunca al
   * jefe.) Sin enemigos, la roca o cofre más cercano; sin nada, hacia donde
   * caminas (o donde ya mirabas). Guarda m.target y m.aim y los devuelve.
   */
  function aimFor(pl, m, all) {
    const ranged = MK().isRanged(m.kind);
    const threat = G.Projectiles.nearest(all, pl.x, pl.y, pl.r + 24);
    const boss = all.find(e => e.boss && !e.dead && G.U.dist(pl.x, pl.y, e.x, e.y) < 330) || null;
    const tg = (ranged ? boss || threat : threat || boss)
            || G.Projectiles.nearest(all, pl.x, pl.y, 520)
            || G.World.nearestBreakable(pl.x, pl.y, 200)
            || null;
    m.target = tg;
    m.aim = tg ? Math.atan2(tg.y - pl.y, tg.x - pl.x) : pl.walking ? pl.moveAngle : pl.aim;
    return { target: tg, aim: m.aim };
  }

  // ---------------- lanzar ----------------

  function tick(dt, pl, now) {
    if (pl.dead) return;
    const all = G.EnemyMgr.all();
    for (const m of pl.moves) tickMove(dt, pl, m, now, all);
  }

  function tickMove(dt, pl, m, now, all) {
    if (m.kind === 'orbit') { MK().orbit(pl, m, dt, now); return; }
    m.t -= dt;
    if (m.t > 0) return;
    aimFor(pl, m, all);
    // Los que necesitan blanco esperan a tenerlo a su alcance (no gastes animación al aire).
    if (MK().needsTarget(m.kind) && !(m.target && G.U.dist(pl.x, pl.y, m.target.x, m.target.y) <= MK().reach(m))) {
      m.t = 0.05;
      return;
    }
    m.t = Math.max(0.05, m.cd * pl.cdK);
    pl.cast(m);
    if (G.Coop.active) G.Coop.cast(pl, m);
    m.castAt = performance.now();   // destello en el HUD
    MK().run(pl, m, false);
  }

  // ---------------- daño ----------------

  /** Tabla de tipos × clima para un ataque de tipo `type` contra `e`. */
  function typeK(type, e) { return G.Types.mult(type, e.types) * G.Weather.mult(type); }

  /**
   * Todo el daño del jugador a un enemigo pasa por aquí.
   * @param m     instancia del movimiento (tipo, estados, si está enfocado)
   * @param opts  { ghost, noReact }
   * @returns daño hecho (0 si fantasma)
   */
  function damage(pl, e, dmg, m, dx, dy, knock = 0, opts = {}) {
    if (opts.ghost || !e || e.dead) return 0;
    const col = G.U.TYPE_COLOR[m.type];
    const tk = G.Types.mult(m.type, e.types);
    dmg *= tk * G.Weather.mult(m.type) * (pl.dmgMul ? pl.dmgMul(m) : 1);
    if (!opts.noReact && G.Reactions) dmg *= G.Reactions.check(pl, e, m, dmg);
    e.hurt(dmg, col, dx, dy, knock, G.Types.label(tk));
    if (m.burn) e.applyBurn(m.burn);
    if (m.poison) e.applyPoison(m.poison);
    if (m.slow) e.applySlow(m.slow);
    if ((m.wet || m.type === 'water') && e.applyWet) e.applyWet();
    if (pl.onDealt) pl.onDealt(dmg);
    pl.dmgDealt = (pl.dmgDealt || 0) + dmg;
    return dmg;
  }

  // ---------------- cooperativo: fantasmas ----------------

  /** Repite el ataque de un compañero sólo para verlo (sin daño). */
  function ghostCast(pl, id, lvl, aim, evolved) {
    const def = G.Moves.BY_ID[id];
    if (!def || def.kind === 'orbit') return;
    const m = G.Moves.instance(id, lvl);
    if (evolved) G.Moves.evolve(m);
    m.aim = aim; m.target = null;
    pl.aim = aim;
    pl.cast(m);
    MK().run(pl, m, true);
  }

  /** Orbes de un compañero por cada movimiento de órbita que lleve (sólo visual). */
  function ghostOrbit(pl, dt, now) {
    const orbits = pl.dead ? [] : pl.moves.filter(m => m.kind === 'orbit');
    for (const m of orbits) MK().orbit(pl, m, dt, now, true);
    if (!orbits.length && G.Projectiles.all().some(p => p.orb && p.owner === pl)) G.Projectiles.clearOrbs(pl);
  }

  // ---------------- colisiones ----------------

  function resolve(dt, pl, now) {
    const projectiles = G.Projectiles.all();
    const segDist2 = MK().segDist2;

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];

      // --- disparos enemigos: paredes y objetos sólidos dan cobertura ---
      if (!p.friendly) {
        if (G.World.projectileBlock(p.x, p.y, p.r)) {
          G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 70);
          projectiles.splice(i, 1);
          continue;
        }
        if (G.U.dist2(p.x, p.y, pl.x, pl.y) < (p.r + pl.r) * (p.r + pl.r)) {
          pl.hurt(p.dmg, p.mtype);
          G.FX.burst(p.x, p.y - G.LIFT, p.color, 7, 110);
          projectiles.splice(i, 1);
        }
        continue;
      }

      // --- disparos de jugadores ---
      // Orbes de un compañero: sólo se ven.
      if (p.orb && p.ghost) continue;
      if (!p.orb) {
        const block = G.World.projectileBlock(p.x, p.y, p.r);
        if (block === 'wall' || (block && !block.destructible)) {
          G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 80);
          projectiles.splice(i, 1);
          continue;
        }
      }

      // Objetos del escenario (rocas, cofres, hierba).
      let consumed = false;
      for (const prop of G.World.propsInCircle(p.x, p.y, p.r)) {
        if (p.orb) {
          const k = 'p' + prop.id, last = p.hitLog.get(k) || -99;
          if (now - last < p.rehit) continue;
          p.hitLog.set(k, now);
          G.World.damageProp(prop, p.dmg, p.color);
          continue;
        }
        if (p.phits.has(prop.id)) continue;
        p.phits.add(prop.id);
        if (!p.ghost) G.World.damageProp(prop, p.dmg, p.color);
        // La hierba no frena; lo sólido sí gasta perforación.
        if (prop.solid) {
          if (p.pierce > 0) p.pierce--;
          else { consumed = true; break; }
        }
      }
      if (consumed) {
        G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 80);
        projectiles.splice(i, 1);
        continue;
      }

      // Enemigos. Colisión BARRIDA: se comprueba todo el tramo recorrido en este
      // fotograma, no sólo el punto final. Un Impactrueno avanza 8 unidades por
      // fotograma: sin esto atravesaba a los enemigos pegados al jugador, que
      // eran inmunes a todos los movimientos de proyectil.
      const sx = p.orb || p.px == null ? p.x : p.px, sy = p.orb || p.py == null ? p.y : p.py;
      const half = Math.hypot(p.x - sx, p.y - sy) / 2;
      for (const e of G.EnemyMgr.queryCircle((sx + p.x) / 2, (sy + p.y) / 2, half + p.r)) {
        if (segDist2(sx, sy, p.x, p.y, e.x, e.y) > (p.r + e.r) * (p.r + e.r)) continue;
        if (p.orb) {
          const last = p.hitLog.get(e.id) || -99;
          if (now - last < p.rehit) continue;
          p.hitLog.set(e.id, now);
        } else {
          if (p.hits.has(e.id)) continue;
          p.hits.add(e.id);
        }

        // Disparo fantasma de un compañero: choca y se ve, pero no daña.
        if (p.ghost) {
          G.FX.sp('impact', p.vis ? p.vis.pal : 'normal', e.x, e.y - e.bodyH * 0.5, { life: 0.12, scale: 1 });
          if (p.pierce > 0) { p.pierce--; continue; }
          G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 80);
          projectiles.splice(i, 1);
          break;
        }

        // El movimiento del que salió (o uno mínimo con su tipo y estados, por si acaso).
        const src = p.src || { type: p.mtype, burn: p.burn, poison: p.poison, slow: p.slow, wet: p.wet };
        damage(p.owner || pl, e, p.dmg, src, p.vx || (e.x - pl.x), p.vy || (e.y - pl.y), p.knock);
        if (Math.random() < 0.5) G.FX.sp('impact', p.vis ? p.vis.pal : 'normal', e.x, e.y - e.bodyH * 0.5, { life: 0.12, scale: 1 });

        if (!p.orb) {
          if (p.pierce > 0) { p.pierce--; }
          else {
            G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 80);
            projectiles.splice(i, 1);
            break;
          }
        }
      }
    }

    // --- contacto enemigo <-> jugador ---
    if (pl.dead) return;
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, pl.r + 40)) {
      if (G.U.dist2(e.x, e.y, pl.x, pl.y) > (e.r + pl.r) * (e.r + pl.r)) continue;
      if (e.touchCd > 0 || e.behavior === 'thief') continue;
      e.touchCd = 0.55;
      e.strike(pl);
      pl.hurt(e.dmg, e.atkType);
      if (pl.hasItem('rockyhelmet')) e.hurt(15 + pl.level * 4, '#9aa6b5', e.x - pl.x, e.y - pl.y, 80);
      const [nx, ny] = G.U.norm(e.x - pl.x, e.y - pl.y);
      e.kx += nx * 150; e.ky += ny * 150;
    }
  }

  return { tick, aimFor, damage, typeK, resolve, ghostCast, ghostOrbit,
           updateFields: dt => MK().updateFields(dt),
           drawGroundFields: ctx => MK().drawGroundFields(ctx),
           drawAirFields: ctx => MK().drawAirFields(ctx),
           clearFields: owner => MK().clearFields(owner),
           get fieldCount() { return MK().fieldCount; } };
})();
