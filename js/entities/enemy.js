/* ============ enemy.js — Pokémon salvajes y su gestor ============
 * (x, y) son los PIES. Animaciones de Mundo Misterioso:
 *   Walk al moverse · Idle parado · Charge apuntando una embestida ·
 *   Attack al embestir o al golpearte · Shoot al disparar · Hurt al recibir ·
 *   Faint al caer (se queda en el suelo y se desvanece).
 *
 * Los voladores, los fantasma y los jefes ignoran el terreno. El resto choca
 * con paredes y objetos, va más lento en el agua y se quema en la lava.
 *
 * El gestor mantiene una rejilla espacial (reconstruida cada frame) para la
 * separación entre enemigos y las colisiones de proyectiles.
 */
(() => {
  let nextId = 1;
  /** Los jefes se agrandan hasta ~110 de alto, según lo grande que ya sea su sprite. */
  function bossScale(dex) {
    const m = G.Sprites.animMeta(dex, 'Idle');
    const h = (m ? m.ay : 30) * G.Sprites.PX;
    // En múltiplos de 0,5: con la cámara a ×2 cada píxel de arte ocupa un
    // número entero de píxeles de pantalla (escalas como 1,37 lo deforman).
    return G.U.clamp(Math.round(110 / h * 2) / 2, 1, 2);
  }

  class Enemy {
    constructor(def, x, y, sc, boss = false) {
      this.id = nextId++;
      this.def = def;
      this.dex = def.dex;
      this.name = (G.DEX_BY[def.dex] && G.DEX_BY[def.dex].name) || def.name;
      this.x = x; this.y = y;
      this.boss = boss;
      this.scale = boss ? bossScale(def.dex) : 1;
      this.anim = new G.Sprites.Animator(def.dex, this.scale);
      this.r = G.Sprites.bodyRadius(def.dex, this.scale);
      this.bodyH = G.Sprites.bodyHeight(def.dex, this.scale);

      this.maxHp = Math.round(def.hp * sc.hp);
      this.hp = this.maxHp;
      this.spd = def.spd * sc.spd;
      this.dmg = def.dmg * sc.dmg;
      this.xp = def.xp;
      this.behavior = def.behavior;

      const types = (G.DEX_BY[def.dex] && G.DEX_BY[def.dex].types) || [];
      this.flying = boss || types.includes('flying') || types.includes('ghost');

      this.flash = 0;
      this.slow = 0; this.slowT = 0;
      this.burn = 0; this.burnT = 0; this.burnTick = 0;
      this.poison = 0; this.poisonT = 0; this.poisonTick = 0;
      this.lavaTick = 0;
      this.kx = 0; this.ky = 0;
      this.touchCd = 0;
      this.dead = false;
      this.fade = 0;             // tiempo de desvanecimiento tras caer

      // embestida
      this.phase = 'walk'; this.pt = 0; this.dx = 0; this.dy = 0;
      // distancia
      this.shotCd = def.shotCd ? G.U.rand(0.3, def.shotCd) : 0;
      // desatasco
      this.stuckT = 0; this.sideT = 0; this.side = 1;
      this.bob = Math.random() * 6.28;
      this.shiny = false;
      this.sparkT = 0;
    }

    cy() { return this.y; }

    /** Lo convierte en shiny: otro sprite, más aguante y mucha más XP. */
    makeShiny() {
      this.shiny = true;
      this.anim = new G.Sprites.Animator(this.dex, this.scale, true);
      this.maxHp *= 2; this.hp = this.maxHp;
      this.xp *= 5;
      G.Sprites.preload([this.dex], 4000, true);
    }

    hurt(amount, color = '#fff', dirX = 0, dirY = 0, knock = 0) {
      if (this.dead) return;
      const d = Math.max(1, Math.round(amount));
      // Copia de un enemigo del anfitrión: el golpe se le manda a él, que es
      // quien decide si cae. Aquí sólo se ve (número, destello y animación).
      if (this.remote) {
        G.Coop.hit(this, d, color, dirX, dirY, knock);
        this.hp = Math.max(1, this.hp - d);
        this.showHurt(d, color, dirX, dirY);
        return;
      }
      this.hp -= d;
      this.showHurt(d, color, dirX, dirY);
      if (knock > 0 && !this.boss) {
        const [nx, ny] = G.U.norm(dirX, dirY);
        this.kx += nx * knock;
        this.ky += ny * knock;
      }
      if (G.Coop.isHost) G.Coop.hurtShown(this, d, color);
      if (this.hp <= 0) this.die();
    }

    /** Lo que se VE al recibir un golpe. */
    showHurt(d, color, dirX = 0, dirY = 0) {
      this.flash = 0.09;
      G.FX.dmgText(this.x, this.y - this.bodyH - 4, d, color, this.boss);
      G.FX.spark(this.x, this.y - this.bodyH * 0.5, color, dirX, dirY, 3);
      if (!this.anim.busy() && this.phase !== 'dash') this.anim.play('Hurt');
      G.Audio.sfx('hit');
    }

    applySlow(factor, dur = 1.2) {
      if (this.remote) { G.Coop.status(this, 's', factor); return; }
      this.slow = Math.max(this.slow, factor);
      this.slowT = Math.max(this.slowT, dur);
    }
    applyBurn(stacks = 1) {
      if (this.remote) { G.Coop.status(this, 'b', stacks); return; }
      this.burn = Math.min(8, this.burn + stacks); this.burnT = 3;
    }
    applyPoison(stacks = 1) {
      if (this.remote) { G.Coop.status(this, 'p', stacks); return; }
      this.poison = Math.min(8, this.poison + stacks); this.poisonT = 4;
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      this.fade = 0.9;
      this.anim.play('Faint', { hold: true });
      const col = this.boss ? '#ffd95e' : '#ffffff';
      const cy = this.y - this.bodyH * 0.5;
      G.FX.burst(this.x, cy, col, this.boss ? 34 : 9, this.boss ? 260 : 120);
      G.FX.ring(this.x, this.y, this.r, this.r * (this.boss ? 6 : 2.6), col, this.boss ? 0.6 : 0.3, this.boss ? 6 : 3);
      // En una copia, el botín y los shinies los reparte el anfitrión.
      if (this.remote) {
        if (this.boss) G.Camera.kick(0.9);
        G.Audio.sfx(this.boss ? 'bossDown' : 'faint');
        if (this.shiny) { G.FX.burst(this.x, cy, '#ffe9a0', 30, 220); G.FX.ring(this.x, this.y, this.r, this.r * 7, '#9ae6ff', 0.7, 5); }
        return;
      }
      if (this.boss) {
        G.Camera.kick(0.9);
        for (let i = 0; i < 10; i++) G.Pickups.drop('coin', this.x + G.U.rand(-40, 40), this.y + G.U.rand(-30, 30), 5);
      }
      G.Pickups.dropXp(this.x, this.y, this.xp, this.boss);
      if (this.legend) {
        // El legendario de la grieta: además del ticket ×10 de todo jefe.
        G.Pickups.drop('ticket10', this.x + 20, this.y - 16, 1);
        for (let i = 0; i < 3; i++) G.Pickups.drop('ticket', this.x + G.U.rand(-30, 30), this.y + G.U.rand(-20, 20), 1);
        for (let i = 0; i < 10; i++) G.Pickups.drop('coin', this.x + G.U.rand(-50, 50), this.y + G.U.rand(-35, 35), 8);
      }
      G.Audio.sfx(this.boss ? 'bossDown' : 'faint');
      if (this.shiny) {
        G.FX.burst(this.x, cy, '#ffe9a0', 30, 220);
        G.FX.ring(this.x, this.y, this.r, this.r * 7, '#9ae6ff', 0.7, 5);
        if (G.onShinyCaught) G.onShinyCaught(this);
      }
    }

    /**
     * Copia de un enemigo del anfitrión: va hacia la última posición recibida
     * (más la velocidad estimada, para que no avance a saltos) y anima según
     * se mueva o según la animación que tenga en el anfitrión.
     */
    netUpdate(dt) {
      this.anim.update(dt);
      if (this.flash > 0) this.flash -= dt;
      if (this.dead) { this.fade -= dt; return; }
      if (this.touchCd > 0) this.touchCd -= dt;
      this.bob += dt * 6;
      if (this.shiny) {
        this.sparkT -= dt;
        if (this.sparkT <= 0) { this.sparkT = 0.22; G.FX.twinkle(this.x + G.U.rand(-this.r, this.r) * 1.2, this.y - G.U.rand(4, this.bodyH * 1.1)); }
      }
      const n = this.net;
      if (!n) return;
      const lead = Math.min(0.25, n.age);
      n.age += dt;
      const tx = n.x + n.vx * lead, ty = n.y + n.vy * lead;
      const ox = this.x, oy = this.y;
      if (G.U.dist2(this.x, this.y, tx, ty) > 160 * 160) { this.x = tx; this.y = ty; }
      else { this.x = G.U.damp(this.x, tx, 12, dt); this.y = G.U.damp(this.y, ty, 12, dt); }
      const vx = (this.x - ox) / (dt || 1), vy = (this.y - oy) / (dt || 1);
      const moving = Math.abs(vx) + Math.abs(vy) > 8;
      this.anim.dir = n.dir;
      // Animaciones de una vez (embestida, disparo...) que ha empezado el anfitrión.
      if (n.anim !== this.lastNetAnim) {
        this.lastNetAnim = n.anim;
        const a = G.Coop.ANIMS[n.anim];
        if (a && a !== 'Idle' && a !== 'Walk' && a !== 'Faint') this.anim.play(a, { speed: 1.4 });
      }
      this.anim.loop(moving ? 'Walk' : 'Idle');
    }

    update(dt, pl) {
      this.anim.update(dt);
      if (this.dead) { this.fade -= dt; return; }
      if (this.flash > 0) this.flash -= dt;
      if (this.shiny) {
        this.sparkT -= dt;
        if (this.sparkT <= 0) {
          this.sparkT = 0.22;
          G.FX.twinkle(this.x + G.U.rand(-this.r, this.r) * 1.2, this.y - G.U.rand(4, this.bodyH * 1.1));
        }
      }
      if (this.touchCd > 0) this.touchCd -= dt;
      this.bob += dt * 6;

      // --- estados ---
      if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slow = 0; }
      if (this.burn > 0) {
        this.burnT -= dt; this.burnTick -= dt;
        if (this.burnTick <= 0) { this.burnTick = 0.5; this.hurt(1.6 * this.burn * (1 + pl.level * 0.06), '#ff9a4d'); }
        if (this.burnT <= 0) this.burn = 0;
      }
      if (this.poison > 0) {
        this.poisonT -= dt; this.poisonTick -= dt;
        if (this.poisonTick <= 0) { this.poisonTick = 0.6; this.hurt(this.maxHp * 0.012 * this.poison + 1, '#d47cf0'); }
        if (this.poisonT <= 0) this.poison = 0;
      }
      if (this.dead) return;

      // --- terreno ---
      let terrainMul = 1;
      if (!this.flying && G.World.isLiquid(this.x, this.y)) {
        if (G.World.liquidKind() === 'lava') {
          this.lavaTick -= dt;
          if (this.lavaTick <= 0) { this.lavaTick = 0.5; this.hurt(6 + this.maxHp * 0.04, '#ff8a3d'); }
          if (this.dead) return;
        } else terrainMul = 0.55;
      }

      const spd = this.spd * (1 - this.slow) * terrainMul;
      let [dx, dy] = G.U.norm(pl.x - this.x, pl.y - this.y);
      const dist = G.U.dist(this.x, this.y, pl.x, pl.y);

      // Si lleva rato atascado contra algo, rodea por un lado.
      if (this.sideT > 0) {
        this.sideT -= dt;
        const a = Math.atan2(dy, dx) + this.side * 1.25;
        dx = Math.cos(a); dy = Math.sin(a);
      }

      let vx = dx * spd, vy = dy * spd;
      let animBase = 'Walk';

      if (this.behavior === 'charger') {
        this.pt -= dt;
        if (this.phase === 'walk') {
          if (dist < 200 && this.pt <= 0) {
            this.phase = 'aim'; this.pt = 0.55;
            this.anim.play('Charge', { speed: 1.6 });
          }
        } else if (this.phase === 'aim') {
          vx = vy = 0; animBase = 'Idle';
          if (this.pt <= 0) {
            this.phase = 'dash'; this.pt = 0.42;
            this.dx = dx; this.dy = dy;
            this.anim.play('Attack', { speed: 1.4 });
            G.FX.ring(this.x, this.y, this.r, this.r * 2.4, '#ff6b6b', 0.25, 2);
          }
        } else if (this.phase === 'dash') {
          vx = this.dx * spd * 3.4; vy = this.dy * spd * 3.4;
          if (this.pt <= 0) { this.phase = 'walk'; this.pt = 1.1; }
        }
      } else if (this.behavior === 'ranged') {
        const range = this.def.range || 200;
        const keep = range * 0.82;
        if (dist < keep * 0.75) { vx = -dx * spd * 0.8; vy = -dy * spd * 0.8; }
        else if (dist < keep) { vx *= 0.1; vy *= 0.1; animBase = 'Idle'; }
        this.shotCd -= dt;
        if (this.shotCd <= 0 && dist < range) {
          this.shotCd = this.def.shotCd || 2;
          const sp = 190;
          const shot = G.Projectiles.spawn({
            x: this.x, y: this.y, vx: dx * sp, vy: dy * sp,
            dmg: (this.def.shotDmg || 10) * (this.dmg / this.def.dmg),
            r: 7, life: 2.4, friendly: false, color: '#ff7a9e',
            vis: G.VFX.forType(((G.DEX_BY[this.dex] || {}).types || ['normal'])[0])
          });
          if (G.Coop.isHost) G.Coop.enemyShot(shot, ((G.DEX_BY[this.dex] || {}).types || ['normal'])[0]);
          this.anim.play('Shoot');
          G.FX.ring(this.x, this.y - G.LIFT, 4, 14, '#ff7a9e', 0.2, 2);
        }
      }

      // --- integración ---
      const ox = this.x, oy = this.y;
      this.x += this.kx * dt; this.y += this.ky * dt;
      this.kx *= Math.pow(0.0015, dt); this.ky *= Math.pow(0.0015, dt);
      this.x += vx * dt; this.y += vy * dt;

      if (!this.flying && G.World.collide(this)) {
        // ¿Ha avanzado bastante menos de lo que quería?
        const want = Math.hypot(vx, vy) * dt;
        const got = Math.hypot(this.x - ox, this.y - oy);
        if (want > 0.5 && got < want * 0.35) {
          this.stuckT += dt;
          if (this.stuckT > 0.35 && this.sideT <= 0) {
            this.sideT = 0.7; this.stuckT = 0;
            this.side = Math.random() < 0.5 ? -1 : 1;
          }
        } else this.stuckT = 0;
      }

      // --- animación ---
      const moving = Math.abs(vx) + Math.abs(vy) > 2;
      const faceA = this.phase === 'dash' ? Math.atan2(this.dy, this.dx)
                  : moving ? Math.atan2(vy, vx) : Math.atan2(pl.y - this.y, pl.x - this.x);
      this.anim.dir = G.Sprites.dirFromAngle(faceA);
      this.anim.loop(moving ? animBase : 'Idle', moving ? Math.max(0.6, spd / 70) : 1);
    }

    /** Lo llama combat.js cuando te toca: anima el golpe. */
    strike(pl) {
      if (!this.anim.busy()) {
        this.anim.dir = G.Sprites.dirFromAngle(Math.atan2(pl.y - this.y, pl.x - this.x));
        this.anim.play('Attack', { speed: 1.5 });
      }
    }

    draw(ctx) {
      const alpha = this.dead ? G.U.clamp(this.fade / 0.5, 0, 1) : 1;
      if (alpha <= 0) return;

      if ((this.boss || this.shiny) && !this.dead) {
        ctx.save();
        ctx.globalAlpha = 0.22 + Math.sin(this.bob * 0.5) * 0.06;
        ctx.fillStyle = this.shiny ? '#9ae6ff' : '#ffd95e';
        ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 1.6, this.r * 0.6, 0, 0, 6.2832); ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      G.Sprites.drawShadow(ctx, this.dex, this.x, this.y, this.scale);
      // Los voladores flotan un poco.
      const lift = this.flying && !this.boss ? 6 + Math.sin(this.bob) * 2 : 0;
      this.anim.draw(ctx, this.x, this.y - lift, { flash: this.flash > 0, alpha });
      ctx.restore();

      if (this.dead) return;

      if (this.burn > 0 || this.poison > 0 || (this.net && this.net.st)) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = this.burn > 0 || (this.net && this.net.st & 1) ? '#ff8a3d' : '#c86bdc';
        ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 1.2, this.r * 0.5, 0, 0, 6.2832); ctx.fill();
        ctx.restore();
      }

      if (this.boss || this.hp < this.maxHp) {
        const w = this.boss ? 90 : Math.max(22, this.r * 2);
        const y = this.y - this.bodyH - 10;
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(this.x - w / 2, y, w, 3.4);
        ctx.fillStyle = this.boss ? '#ffcb3d' : '#ff5f6d';
        ctx.fillRect(this.x - w / 2, y, w * Math.max(0, this.hp / this.maxHp), 3.4);
      }
    }
  }

  // ---------------- gestor ----------------

  G.Enemy = Enemy;

  G.EnemyMgr = (() => {
    let list = [];            // vivos
    let corpses = [];         // cayendo / desvaneciéndose
    const CELL = 52;
    const grid = new Map();

    const byId = new Map();
    function clear() { list = []; corpses = []; grid.clear(); byId.clear(); }
    function all() { return list; }
    function add(e) {
      list.push(e);
      byId.set(e.id, e);
      if (G.Coop.isHost) G.Coop.enemyAdded(e);
      return e;
    }
    function get(id) { return byId.get(id); }

    /** Copia local de un enemigo del anfitrión (cooperativo). */
    function addRemote(o) {
      if (byId.has(o.id)) return byId.get(o.id);
      const def = { dex: o.dex, hp: o.hp, spd: 0, dmg: o.dmg, xp: 0, behavior: 'remote' };
      const e = new Enemy(def, o.x, o.y, { hp: 1, spd: 1, dmg: 1 }, o.boss);
      e.id = o.id;
      e.remote = true;
      if (o.shiny) e.makeShiny();
      e.maxHp = o.hp; e.hp = o.hp;
      e.net = { x: o.x, y: o.y, vx: 0, vy: 0, age: 0, dir: 0, anim: 0, st: 0 };
      list.push(e);
      byId.set(e.id, e);
      return e;
    }

    // --- arena de la grieta ---
    let stashed = null;

    /** Guarda los enemigos del mapa mientras dura la arena. */
    function stash() {
      stashed = list.filter(e => !e.dead);
      for (const e of stashed) byId.delete(e.id);
      list = []; corpses = [];
    }

    /** Al volver: quita los de la arena y devuelve los del mapa (avisando a los demás). */
    function restore() {
      for (const e of list) { byId.delete(e.id); if (G.Coop.isHost) G.Coop.enemyGone(e, false); }
      list = []; corpses = [];
      for (const e of stashed || []) add(e);
      stashed = null;
    }

    /** Invitado: borra las copias (llegarán otra vez del anfitrión). */
    function clearRemote() {
      for (const e of list) if (e.remote) byId.delete(e.id);
      list = list.filter(e => !e.remote);
      corpses = corpses.filter(e => !e.remote);
    }

    /** Quita una copia (el anfitrión dice que ha caído o que se ha alejado). */
    function removeRemote(id, died) {
      const e = byId.get(id);
      if (!e) return;
      byId.delete(id);
      if (died) e.die();
      const i = list.indexOf(e);
      if (i >= 0) list.splice(i, 1);
      if (died) corpses.push(e);
    }

    function key(cx, cy) { return cx * 73856093 ^ cy * 19349663; }

    function rebuildGrid() {
      grid.clear();
      for (const e of list) {
        if (e.dead) continue;
        const k = key(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
        let b = grid.get(k);
        if (!b) grid.set(k, b = []);
        b.push(e);
      }
    }

    /** Enemigos vivos cuyo círculo toca este círculo. */
    function queryCircle(x, y, r) {
      const out = [];
      const c0x = Math.floor((x - r) / CELL) - 1, c1x = Math.floor((x + r) / CELL) + 1;
      const c0y = Math.floor((y - r) / CELL) - 1, c1y = Math.floor((y + r) / CELL) + 1;
      for (let cy = c0y; cy <= c1y; cy++) {
        for (let cx = c0x; cx <= c1x; cx++) {
          const b = grid.get(key(cx, cy));
          if (!b) continue;
          for (const e of b) {
            if (e.dead) continue;
            const rr = r + e.r;
            if (G.U.dist2(x, y, e.x, e.y) <= rr * rr) out.push(e);
          }
        }
      }
      return out;
    }

    function separate(dt) {
      for (const e of list) {
        if (e.dead) continue;
        const cx = Math.floor(e.x / CELL), cy = Math.floor(e.y / CELL);
        let px = 0, py = 0, n = 0;
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const b = grid.get(key(cx + i, cy + j));
            if (!b) continue;
            for (const o of b) {
              if (o === e || o.dead) continue;
              const min = (e.r + o.r) * 0.82;
              const dx = e.x - o.x, dy = e.y - o.y;
              const d2 = dx * dx + dy * dy;
              if (d2 > min * min || d2 < 1e-4) continue;
              const d = Math.sqrt(d2);
              const f = (min - d) / min;
              px += (dx / d) * f; py += (dy / d) * f;
              if (++n > 6) break;
            }
          }
        }
        if (n) {
          e.x += px * 42 * dt;
          e.y += py * 42 * dt;
          if (!e.flying) G.World.collide(e);
        }
      }
    }

    /** El jugador vivo más cercano (los caídos no atraen a nadie). */
    function nearestPlayer(players, x, y) {
      let best = null, bd = Infinity;
      for (const p of players) {
        if (p.dead) continue;
        const d = G.U.dist2(x, y, p.x, p.y);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    }

    /**
     * @param players  [jugador local, ...compañeros]. Las estadísticas de la
     *                 run (derrotados, jefes) se apuntan en el primero.
     */
    function update(dt, players) {
      if (!Array.isArray(players)) players = [players];
      const pl = players[0];
      rebuildGrid();
      for (const e of list) {
        if (e.remote) e.netUpdate(dt);
        else e.update(dt, nearestPlayer(players, e.x, e.y) || pl);
      }
      if (!G.Coop.active || G.Coop.isHost) separate(dt);
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        if (e.remote) continue;
        if (e.dead) {
          pl.kills++;
          if (e.boss) pl.bosses++;
          corpses.push(e);
          list.splice(i, 1);
          byId.delete(e.id);
          if (G.Coop.isHost) G.Coop.enemyGone(e, true);
          continue;
        }
        const near = nearestPlayer(players, e.x, e.y) || pl;
        if (!e.boss && !e.shiny && G.U.dist2(e.x, e.y, near.x, near.y) > 1400 * 1400) {
          list.splice(i, 1);
          byId.delete(e.id);
          if (G.Coop.isHost) G.Coop.enemyGone(e, false);
        }
      }
      for (let i = corpses.length - 1; i >= 0; i--) {
        if (corpses[i].remote) corpses[i].netUpdate(dt); else corpses[i].update(dt, pl);
        if (corpses[i].fade <= 0) corpses.splice(i, 1);
      }
      if (corpses.length > 120) corpses.splice(0, corpses.length - 120);
    }

    /** Lo que hay que dibujar ordenado por Y junto al resto de la escena. */
    function drawables(cam) {
      const out = [];
      for (const e of corpses) if (cam.sees(e.x, e.y, 80)) out.push(e);
      for (const e of list) if (cam.sees(e.x, e.y, 80)) out.push(e);
      return out;
    }

    function bossAlive() { return list.some(e => e.boss && !e.dead); }
    function shinies() { return list.filter(e => e.shiny && !e.dead); }

    return { clear, all, add, get, addRemote, removeRemote, stash, restore, clearRemote, update, drawables, queryCircle, rebuildGrid, bossAlive, shinies, nearestPlayer,
             get count() { return list.length; } };
  })();
})();
