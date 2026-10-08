/* ============ hazards.js — ataques con aviso de los enemigos ============
 * Un peligro se dibuja primero en el suelo como AVISO (se va llenando) y, al
 * cumplirse el tiempo, golpea a quien esté dentro:
 *
 *   zone  círculo (zonas de Tierra/Fuego/Veneno, explosiones, caídas de salto)
 *   beam  rayo recto desde el enemigo (Eléctrico, Psíquico, Dragón, Hielo)
 *
 * Cada ordenador dibuja los peligros y comprueba sólo SU Pokémon. En
 * cooperativo los crea el anfitrión y los manda con 'hz'.
 */
G.Hazards = (() => {
  let list = [];

  /** h: { kind, x, y, r | angle, len, w, delay, dmg, type, color } */
  function add(h, fromNet = false) {
    const o = Object.assign({ t: 0, hit: false, end: 0.3 }, h);
    list.push(o);
    if (!fromNet && G.Coop.isHost) {
      G.Coop.broadcast(['hz', { kind: o.kind, x: Math.round(o.x), y: Math.round(o.y), r: o.r, angle: o.angle, len: o.len, w: o.w,
                                delay: o.delay, dmg: Math.round(o.dmg), type: o.type, color: o.color }]);
    }
    return o;
  }

  function clear() { list = []; }

  function inside(h, x, y, r) {
    if (h.kind === 'zone') return G.U.dist2(x, y, h.x, h.y) < (h.r + r * 0.6) ** 2;
    const ca = Math.cos(h.angle), sa = Math.sin(h.angle);
    const px = x - h.x, py = y - h.y;
    const along = px * ca + py * sa;
    if (along < -r || along > h.len + r) return false;
    return Math.abs(-px * sa + py * ca) <= h.w / 2 + r * 0.6;
  }

  function update(dt) {
    const pl = G.Game.player;
    for (let i = list.length - 1; i >= 0; i--) {
      const h = list[i];
      h.t += dt;
      if (!h.hit && h.t >= h.delay) {
        h.hit = true;
        detonate(h);
        if (pl && !pl.dead && inside(h, pl.x, pl.y, pl.r)) { pl.invuln = 0; pl.hurt(h.dmg, h.type); }
      }
      if (h.hit && h.t >= h.delay + h.end) list.splice(i, 1);
    }
  }

  function detonate(h) {
    const near = G.Camera.sees(h.x, h.y, 120);
    if (h.kind === 'zone') {
      G.FX.ring(h.x, h.y, 4, h.r, h.color, 0.35, 5);
      G.FX.burst(h.x, h.y - 6, h.color, Math.round(h.r / 3), 160);
      if (near) { G.Audio.sfx('break'); if (h.r > 60) G.Camera.kick(0.35); }
    } else {
      G.FX.beam(h.x, h.y - G.LIFT, h.angle, h.len, h.w, h.color, G.VFX.forType(h.type || 'normal'));
      if (near) G.Audio.sfx('shot', { kind: 'beam', type: h.type });
    }
  }

  /** Avisos en el suelo (debajo de los Pokémon). */
  function draw(ctx) {
    const blink = Math.sin(performance.now() / 60) > 0;
    for (const h of list) {
      if (h.hit) continue;
      const k = Math.min(1, h.t / h.delay);
      ctx.save();
      if (h.kind === 'zone') {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = h.color;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.32;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * k, h.r * 0.75 * k, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = k > 0.75 && blink ? 0.95 : 0.6;
        ctx.strokeStyle = h.color; ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, 6.2832); ctx.stroke();
      } else {
        ctx.translate(h.x, h.y);
        ctx.rotate(h.angle);
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = h.color;
        ctx.fillRect(0, -h.w / 2, h.len, h.w);
        ctx.globalAlpha = 0.34;
        ctx.fillRect(0, -h.w / 2 * k, h.len, h.w * k);
        ctx.globalAlpha = k > 0.75 && blink ? 0.95 : 0.55;
        ctx.strokeStyle = h.color; ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(0, -h.w / 2, h.len, h.w);
      }
      ctx.restore();
    }
  }

  return { add, clear, update, draw, inside, get all() { return list; }, get count() { return list.length; } };
})();
