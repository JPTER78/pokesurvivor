/* ============ events.js — eventos a mitad de partida y duendes del tesoro ============
 *
 * Cada 4-5 minutos (nunca con un jefe vivo ni en la grieta) pasa uno de estos:
 *
 *   horde   Horda de un tipo: 30 s en los que todos los que salen son de un
 *           mismo tipo (si tu tipo les gana, es tu momento)
 *   gold    Hora dorada: 30 s de enemigos dorados que dan el doble de
 *           experiencia y a veces sueltan monedas
 *   lost    Pokémon perdido: lo tocas, te sigue y lo llevas hasta la marca.
 *           Los enemigos le hacen daño; si cae (o tardas más de 2 min), se va.
 *           Premio: cura la mitad de la vida, monedas, un ticket y, 1 de cada
 *           5 veces, se une a tu colección.
 *
 * Duendes del tesoro (1-2 por partida, ver Enemy behavior 'thief'): un
 * Meowth cargado de monedas (o, 1 de cada 4, un Gholdengo con un ticket ×10)
 * que huye y se escapa a los 15 s si no lo atrapas.
 *
 * Cooperativo: decide el anfitrión y avisa con 'ev' (ver coop.js). Todos ven lo
 * mismo y el premio es para todos.
 */
G.Events = (() => {
  const EVERY = [240, 300], DUR = 30, LOST_TIME = 120;
  const THIEF_FIRST = [120, 240], THIEF_NEXT = [240, 360], THIEF_LIFE = 15;
  const authority = () => !G.Coop.active || G.Coop.isHost;

  let nextT = 0, cur = null, last = null, thiefT = 0, thieves = 0;
  let lost = null;      // { dex, name, x, y, hp, maxHp, state, follow, tx, ty, t, anim, r, hitCd, netT, grant }

  function reset() {
    nextT = G.U.rand(EVERY[0], EVERY[1]);
    cur = null; last = null; lost = null;
    thiefT = G.U.rand(THIEF_FIRST[0], THIEF_FIRST[1]); thieves = 0;
  }

  // ---------------- ciclo ----------------

  function update(dt, players, time) {
    if (cur) {
      cur.t += dt;
      if (cur.id !== 'lost' && cur.t >= cur.dur && authority()) end();
    }
    if (lost) lostTick(dt, players);
    if (!authority() || G.Rift.inArena) return;

    if (thieves < 2) {
      thiefT -= dt;
      if (thiefT <= 0) {
        if (G.EnemyMgr.bossAlive()) thiefT = 8;
        else { spawnThief(players, time); thieves++; thiefT = G.U.rand(THIEF_NEXT[0], THIEF_NEXT[1]); }
      }
    }

    if (cur) return;
    nextT -= dt;
    if (nextT > 0) return;
    if (G.EnemyMgr.bossAlive()) { nextT = 10; return; }
    nextT = G.U.rand(EVERY[0], EVERY[1]);
    const ids = ['horde', 'gold', 'lost'].filter(id => id !== last);
    start(G.U.pick(ids), time, players);
  }

  function start(id, time, players) {
    last = id;
    if (id === 'horde') {
      const types = G.Enemies.hordeTypes(time);
      if (!types.length) return start('gold', time, players);
      const type = G.U.pick(types);
      const defs = G.Enemies.hordeDefs(type, time);
      G.Sprites.preload(defs.map(d => d.dex));
      cur = { id, t: 0, dur: DUR, type, defs };
      G.Spawner.burst(Math.round(6 * G.Coop.scaleRate(players.length)));
    } else if (id === 'gold') {
      cur = { id, t: 0, dur: DUR };
      for (const e of G.EnemyMgr.all()) if (!e.remote) e.makeGolden();
    } else {
      if (!spawnLost(players)) return;
      cur = { id, t: 0, dur: Infinity };
    }
    announce();
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 's', id, cur.type || '']);
  }

  function announce() {
    if (!cur) return;
    if (cur.id === 'horde') say('¡Horda de tipo ' + G.U.TYPE_NAME[cur.type] + '!', 3, G.U.TYPE_COLOR[cur.type]);
    else if (cur.id === 'gold') say('¡Hora dorada! Doble de experiencia', 3, '#ffd23f');
    else if (lost) say('¡Un ' + lost.name + ' se ha perdido! Búscalo y llévalo a la marca', 3.4, '#7dffb0');
    G.Audio.sfx(cur.id === 'gold' ? 'shiny' : 'surge');
  }

  function say(text, secs) { G.Spawner.say(text, secs, true); }

  function end() {
    if (!cur) return;
    cur = null;
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'e']);
  }

  /** Lo que sale durante una horda (lo usa G.Enemies.bagAt). */
  function bag() { return cur && cur.id === 'horde' && cur.defs.length ? cur.defs : null; }

  // ---------------- duende del tesoro ----------------

  function spawnThief(players, time) {
    const gold = Math.random() < 0.25;
    const dex = gold ? 1000 : 52;
    const mon = G.DEX_BY[dex];
    if (!mon || !G.SPRITE_META[dex]) return;
    const pl = G.U.pick(players.filter(p => !p.dead).length ? players.filter(p => !p.dead) : players);
    G.Sprites.preload([dex]);
    const def = { dex, name: mon.name, behavior: 'thief', hp: Math.round(60 * (1 + time / 95) * (gold ? 1.5 : 1)),
                  spd: 92, dmg: 0, xp: 10, loot: gold ? 'ticket10' : 'coins' };
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(230, 300);
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d * 0.8;
      if (!G.World.isFree(x, y, 14)) continue;
      const e = new G.Enemy(def, x, y, { hp: 1, spd: 1, dmg: 1 });
      e.life = THIEF_LIFE;
      G.EnemyMgr.add(e);
      G.FX.ring(x, y, 4, 40, '#ffd23f', 0.5, 3);
      G.Spawner.say(gold ? '¡Un ' + mon.name + ' con un ticket ×10! ¡Atrápalo antes de que huya!'
                         : '¡Un ' + mon.name + ' cargado de monedas! ¡Atrápalo antes de que huya!', 3.2);
      G.Audio.sfx('shiny');
      return;
    }
  }

  // ---------------- Pokémon perdido ----------------

  function spawnLost(players) {
    const alive = players.filter(p => !p.dead);
    const pl = G.U.pick(alive.length ? alive : players);
    const pool = G.DEX.filter(p => p.rarity <= 3 && !p.leg && G.SPRITE_META[p.dex] && !G.Sprites.hovers(p.dex));
    const mon = G.U.pick(pool);
    let at = null, to = null;
    for (let i = 0; i < 20 && !at; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(220, 300);
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d * 0.8;
      if (G.World.isFree(x, y, 16)) at = [x, y];
    }
    for (let i = 0; i < 30 && at && !to; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(700, 850);
      const x = at[0] + Math.cos(a) * d, y = at[1] + Math.sin(a) * d * 0.85;
      if (G.World.isFree(x, y, 30)) to = [x, y];
    }
    if (!at || !to) return false;
    makeLost({ dex: mon.dex, x: at[0], y: at[1], tx: to[0], ty: to[1], state: 'wait', hp: 100, grant: Math.random() < 0.2 });
    G.Sprites.preload([mon.dex]);
    return true;
  }

  function makeLost(o) {
    const mon = G.DEX_BY[o.dex];
    lost = Object.assign({ name: mon ? mon.name : '', maxHp: 100, t: 0, hitCd: 0, netT: 0, follow: null,
                           anim: new G.Sprites.Animator(o.dex, 1), r: G.Sprites.bodyRadius(o.dex) }, o);
  }

  function lostTick(dt, players) {
    const L = lost;
    L.t += dt;
    L.anim.update(dt);
    if (!authority()) { L.anim.loop(L.moving ? 'Walk' : 'Idle'); return; }

    if (L.state === 'wait') {
      const p = players.find(o => !o.dead && G.U.dist2(o.x, o.y, L.x, L.y) < (o.r + L.r + 18) ** 2);
      if (p) { L.state = 'follow'; L.follow = p; say('¡' + L.name + ' te sigue! Llévalo a la marca verde', 3, '#7dffb0'); G.Audio.sfx('confirm'); }
      L.moving = false;
    } else {
      const p = L.follow && !L.follow.dead ? L.follow : players.find(o => !o.dead) || L.follow;
      const d = G.U.dist(L.x, L.y, p.x, p.y), keep = p.r + L.r + 14;
      L.moving = d > keep;
      if (L.moving) {
        const sp = Math.min(d - keep, Math.max(120, p.spd * 1.15) * dt);
        const [nx, ny] = G.U.norm(p.x - L.x, p.y - L.y);
        L.x += nx * sp; L.y += ny * sp;
        G.World.collide(L);
        L.anim.dir = G.Sprites.dirFromAngle(Math.atan2(ny, nx));
      }
      if (G.U.dist2(L.x, L.y, L.tx, L.ty) < 56 * 56) return rescued();
    }
    L.anim.loop(L.moving ? 'Walk' : 'Idle');

    // Los enemigos que lo tocan le hacen daño.
    if ((L.hitCd -= dt) <= 0) {
      const hits = G.EnemyMgr.queryCircle(L.x, L.y, L.r).filter(e => !e.dead && e.behavior !== 'thief');
      if (hits.length) {
        L.hitCd = 0.5;
        L.hp -= Math.min(30, hits.reduce((a, e) => a + 4 + e.dmg * 0.12, 0));
        L.flash = 0.1;
        G.FX.burst(L.x, L.y - 10, '#ff5f6d', 4, 60);
        if (L.hp <= 0) return gone('¡' + L.name + ' se ha asustado y ha huido…!');
      }
    }
    if (L.flash > 0) L.flash -= dt;
    if (L.t > LOST_TIME) return gone(L.name + ' se ha cansado de esperar y se ha ido…');

    if (G.Coop.isHost && (L.netT -= dt) <= 0) {
      L.netT = 0.1;
      G.Coop.broadcast(['ev', 'lp', L.dex, Math.round(L.x), Math.round(L.y), Math.round(L.hp), L.state === 'follow' ? 1 : 0,
                        Math.round(L.tx), Math.round(L.ty), L.anim.dir, L.moving ? 1 : 0]);
    }
  }

  function rescued() {
    const L = lost;
    for (let i = 0; i < 12; i++) G.Pickups.drop('coin', L.tx + G.U.rand(-40, 40), L.ty + G.U.rand(-30, 30), 5);
    G.Pickups.drop('ticket', L.tx, L.ty - 12, 1);
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'rw', L.dex, L.grant ? 1 : 0]);
    reward(L.dex, L.grant);
    lost = null;
    end();
  }

  /** En cada ordenador: cura, y si toca, el Pokémon se une a tu colección. */
  function reward(dex, grant) {
    const pl = G.Game.player;
    if (pl && !pl.dead) { pl.heal(pl.maxHp * 0.5); G.FX.ring(pl.x, pl.y, 6, 70, '#5fe08a', 0.5, 3); }
    const name = (G.DEX_BY[dex] || {}).name || '';
    G.FX.burst(lost ? lost.tx : pl.x, lost ? lost.ty - 10 : pl.y, '#7dffb0', 24, 180);
    G.Audio.sfx('legend');
    if (grant && G.onRescue) G.onRescue(dex, name);
    else say('¡Has llevado a ' + name + ' a casa! Te lo agradece', 3.2, '#7dffb0');
  }

  function gone(msg) {
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'lx', msg]);
    say(msg, 3);
    lost = null;
    end();
  }

  // ---------------- red ----------------

  function onNet(ev) {
    switch (ev[1]) {
      case 's': cur = { id: ev[2], t: 0, dur: ev[2] === 'lost' ? Infinity : DUR, type: ev[3] || null }; break;
      case 'e': cur = null; break;
      case 'lp': {
        const [, , dex, x, y, hp, follow, tx, ty, dir, moving] = ev;
        if (!lost || lost.dex !== dex) makeLost({ dex, x, y, tx, ty, hp, state: follow ? 'follow' : 'wait' });
        Object.assign(lost, { x, y, hp, tx, ty, moving: !!moving, state: follow ? 'follow' : 'wait' });
        lost.anim.dir = dir;
        break;
      }
      case 'rw': reward(ev[2], !!ev[3]); lost = null; break;
      case 'lx': say(ev[2], 3); lost = null; break;
    }
  }

  // ---------------- dibujo ----------------

  /** El Pokémon perdido y la marca, para ordenarlos por Y con el resto. */
  function drawables() {
    if (!lost) return [];
    const L = lost;
    const now = performance.now() / 1000;
    const goal = {
      y: L.ty - 4000,          // en el suelo, debajo de todo
      draw(ctx) {
        const k = 0.5 + Math.sin(now * 4) * 0.5;
        ctx.save();
        ctx.globalAlpha = 0.25 + k * 0.15;
        ctx.fillStyle = '#5fe08a';
        ctx.beginPath(); ctx.ellipse(L.tx, L.ty, 56, 40, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.ellipse(L.tx, L.ty, 56, 40, 0, 0, 6.2832); ctx.stroke();
        ctx.restore();
        G.Icons.draw(ctx, 'heart', Math.round(L.tx - 8), Math.round(L.ty - 30 - k * 6), 16);
      }
    };
    const mon = {
      y: L.y,
      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#7dffb0';
        ctx.beginPath(); ctx.ellipse(L.x, L.y, L.r * 1.5, L.r * 0.6, 0, 0, 6.2832); ctx.fill();
        ctx.restore();
        G.Sprites.drawShadow(ctx, L.dex, L.x, L.y, 1);
        L.anim.draw(ctx, L.x, L.y, { flash: L.flash > 0 });
        const h = G.Sprites.bodyHeight(L.dex, 1);
        if (L.state === 'wait') {
          // "!" que bota encima: está esperando a que lo toques.
          const by = L.y - h - 14 - Math.abs(Math.sin(now * 5)) * 6;
          ctx.save();
          ctx.font = '700 16px Pixelify, monospace'; ctx.textAlign = 'center';
          ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText('!', L.x, by);
          ctx.fillStyle = '#7dffb0'; ctx.fillText('!', L.x, by);
          ctx.restore();
        }
        const w = 30, y = L.y - h - 6;
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(L.x - w / 2, y, w, 3.4);
        ctx.fillStyle = '#5fe08a'; ctx.fillRect(L.x - w / 2, y, w * Math.max(0, L.hp / L.maxHp), 3.4);
      }
    };
    return [goal, mon];
  }

  /** Flecha en el borde hacia el Pokémon perdido (o hacia la marca, si ya te sigue). */
  function drawHud(ctx, w, h, pl, F) {
    const cam = G.Camera;
    if (lost) {
      const L = lost, to = L.state === 'wait' ? [L.x, L.y - 10] : [L.tx, L.ty];
      edgeArrow(ctx, w, h, cam, to[0], to[1], '#7dffb0', (L.state === 'wait' ? L.name : 'Marca') + ' · ' +
                Math.round(G.U.dist(pl.x, pl.y, to[0], to[1]) / 32) + ' m', F);
    }
    for (const e of G.EnemyMgr.all()) {
      if (e.behavior === 'thief' && !e.dead) edgeArrow(ctx, w, h, cam, e.x, e.y - 10, '#ffd23f', e.name, F);
    }
    if (cur && cur.id !== 'lost') {
      const left = Math.max(0, Math.ceil(cur.dur - cur.t));
      const txt = (cur.id === 'gold' ? 'HORA DORADA' : 'HORDA ' + G.U.TYPE_NAME[cur.type].toUpperCase()) + ' · ' + left + ' s';
      ctx.save();
      ctx.font = F(800, 12); ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(txt, w / 2, 112);
      ctx.fillStyle = cur.id === 'gold' ? '#ffd23f' : G.U.TYPE_COLOR[cur.type] || '#fff';
      ctx.fillText(txt, w / 2, 112);
      ctx.restore();
    }
  }

  function edgeArrow(ctx, w, h, cam, x, y, col, label, F) {
    const sx = (x - cam.left()) * cam.scale, sy = (y - cam.top()) * cam.scale;
    if (sx > 0 && sx < w && sy > 0 && sy < h) return;
    const M = 44, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
    const a = Math.atan2(sy - ey, sx - ex), ca = Math.cos(a), sa = Math.sin(a);
    const pulse = 0.65 + Math.sin(performance.now() / 160) * 0.35;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.moveTo(ca * 30, sa * 30);
    ctx.lineTo(Math.cos(a + 2.45) * 15, Math.sin(a + 2.45) * 15);
    ctx.lineTo(Math.cos(a - 2.45) * 15, Math.sin(a - 2.45) * 15);
    ctx.closePath();
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = F(800, 11);
    ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.strokeText(label, -ca * 26, -sa * 24 + 4);
    ctx.fillStyle = col; ctx.fillText(label, -ca * 26, -sa * 24 + 4);
    ctx.restore();
  }

  return {
    reset, update, bag, onNet, drawables, drawHud,
    get golden() { return !!cur && cur.id === 'gold'; },
    get current() { return cur ? cur.id : null; },
    /** Para pruebas. */
    debugStart(id) { G.Guard.flag('debug'); start(id, G.Game.st.time, G.Game.everyone()); },
    debugThief() { G.Guard.flag('debug'); spawnThief(G.Game.everyone(), G.Game.st.time); },
    _dbg() { return lost && { x: lost.x, y: lost.y, tx: lost.tx, ty: lost.ty, state: lost.state, hp: lost.hp }; }
  };
})();
