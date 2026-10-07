/* ============ projectile.js — proyectiles y orbes ============
 * Una sola lista para todo lo que vuela: disparos del jugador, disparos
 * enemigos y los orbes que giran alrededor del Pokémon (los orbes son
 * proyectiles con `orb`, anclados al jugador y que vuelven a golpear cada
 * `rehit` segundos).
 *
 * Viven en el plano del SUELO (como los pies de las entidades) y se dibujan
 * elevados G.LIFT unidades con su sombra debajo. Las paredes y los objetos
 * sólidos los paran (ver combat.js).
 */
G.Projectiles = (() => {
  let list = [];
  let nextId = 1;

  function clear() { list = []; }
  function all() { return list; }

  /** Proyectil del jugador. */
  function spawn(o) {
    const p = Object.assign({
      id: nextId++, x: 0, y: 0, vx: 0, vy: 0,
      dmg: 10, r: 6, life: 1.4, t: 0,
      pierce: 0, hits: null, friendly: true,
      color: '#fff', homing: 0, slow: 0, burn: 0, poison: 0, knock: 0,
      orb: false, rehit: 0.34, hitLog: null, phits: null
    }, o);
    if (p.friendly && !p.orb && !p.phits) p.phits = new Set();
    list.push(p);
    return p;
  }

  /** Orbe anclado a un jugador (`owner`): vive mientras el movimiento esté activo. */
  function spawnOrb(o) {
    return spawn(Object.assign({
      orb: true, life: Infinity, pierce: Infinity, hitLog: new Map()
    }, o));
  }

  /** Borra los orbes de un jugador (o todos) al cambiar de movimiento activo. */
  function clearOrbs(owner) { list = list.filter(p => !p.orb || (owner && p.owner !== owner)); }

  function update(dt, player, enemies) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.t += dt;

      if (p.orb) {
        // Gira alrededor de su jugador.
        const o = p.owner || player;
        p.oa += p.ospeed * dt;
        p.x = o.x + Math.cos(p.oa) * p.orad;
        p.y = o.y + Math.sin(p.oa) * p.orad * 0.7;
        continue;
      }

      if (p.t >= p.life) { list.splice(i, 1); continue; }

      // Teledirigido: curva la velocidad hacia el enemigo más cercano.
      if (p.homing > 0 && p.friendly) {
        const tg = nearest(enemies, p.x, p.y, 340);
        if (tg) {
          const [dx, dy] = G.U.norm(tg.x - p.x, tg.cy() - p.y);
          const sp = Math.hypot(p.vx, p.vy);
          p.vx = G.U.damp(p.vx, dx * sp, p.homing, dt);
          p.vy = G.U.damp(p.vy, dy * sp, p.homing, dt);
        }
      }

      p.px = p.x; p.py = p.y;          // para la colisión barrida (ver combat.js)
      if (p.vis && p.vis.trail && G.Camera.sees(p.x, p.y, 20)) {
        p.trailT = (p.trailT || 0) - dt;
        if (p.trailT <= 0) { p.trailT = 0.04; G.FX.trail(p.vis.trail, p.vis.pal, p.x, p.y - G.LIFT, p.vx, p.vy); }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Fuera de la vista con margen generoso -> se descarta.
      if (!G.Camera.sees(p.x, p.y, 260)) { list.splice(i, 1); continue; }
    }
  }

  function nearest(enemies, x, y, maxDist) {
    let best = null, bd = maxDist * maxDist;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = G.U.dist2(x, y, e.x, e.cy());
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function remove(p) {
    const i = list.indexOf(p);
    if (i >= 0) list.splice(i, 1);
  }

  function draw(ctx) {
    const L = G.LIFT;
    // Sombras primero, todas juntas.
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    for (const p of list) {
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 0.9, p.r * 0.38, 0, 0, 6.2832); ctx.fill();
    }
    // Los disparos enemigos llevan un aro rojo en el suelo: "esto te hace daño".
    ctx.fillStyle = 'rgba(255,60,80,.35)';
    for (const p of list) {
      if (p.friendly) continue;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 1.5, p.r * 0.6, 0, 0, 6.2832); ctx.fill();
    }
    for (const p of list) {
      const v = p.vis || G.VFX.forType('normal');
      const shape = v.proj;
      const a = p.orb ? 1 : Math.min(1, (p.life - p.t) * 4);
      let angle = 0;
      if (G.VFX.isDir(shape)) angle = p.orb ? p.oa + Math.PI / 2 : Math.atan2(p.vy, p.vx);
      else if (G.VFX.spins(shape)) angle = p.t * 9;
      G.VFX.draw(ctx, shape, v.pal, p.x, p.y - L, {
        angle, alpha: a, scale: p.r >= 8 ? 1.5 : 1,
        frame: Math.floor(p.t * 12)
      });
    }
  }

  return { clear, all, spawn, spawnOrb, clearOrbs, update, remove, draw, nearest,
           get count() { return list.length; } };
})();
