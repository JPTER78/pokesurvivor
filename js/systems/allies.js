/* ============ allies.js — Pokémon aliados durante la run ============
 *
 * En solitario, un par de veces por partida aparece en el mapa un Pokémon de
 * tu colección de la misma región que tu compañero (con un "!" encima y una
 * flecha en el borde de la pantalla). Si no tienes ninguno de esa región, sale
 * uno salvaje de allí. Quédate a su lado JOIN_TIME segundos y se une a ti hasta
 * el final de la run (como mucho MAX aliados). Si tardas más de WAIT_LIFE, se va.
 *
 * La experiencia es del grupo: el aliado va siempre a tu nivel. Su movimiento
 * sube con él y, como en los juegos, evoluciona (EVO_LV: su primera evolución
 * en la partida al nivel 10 y la segunda al 20, sea cual sea su forma de
 * evolucionar; si hay varias, como Eevee, una al azar). Ver data/evolutions.js.
 * En el grupo no se repite familia (ni la de tu compañero): así nadie acaba
 * evolucionando en otro del grupo.
 *
 * Te sigue en formación (en V, detrás de ti según hacia dónde caminas),
 * acelerando y frenando suave y sin pisarse con el resto del grupo. Apunta solo
 * al enemigo más cercano y lanza su movimiento inicial con las mismas funciones
 * que tú (combat.js: él es el dueño del ataque), con tus mejoras de ataque,
 * recarga y crítico, un poco menos que tú (DMG_K). Los enemigos que lo tocan y
 * sus disparos le hacen daño; si cae, quédate a su lado para levantarlo.
 *
 * Al unirse eliges su postura (STANCES), una "build" ya hecha: Atacante (pega
 * más), Guardián (aguanta más y los enemigos que tiene a menos de tauntR van a
 * por él: entra en la lista de blancos de EnemyMgr, ver taunts() y
 * EnemyMgr.nearestPlayer; las zonas con aviso de hazards.js también le dan) o
 * Apoyo (te cura cada pocos segundos).
 * La pantalla la abre game.js (offerStance) en cuanto se puede parar el juego.
 *
 * Cooperativo: no hay aliados (habría que mandarlos por la red).
 */
G.Allies = (() => {
  const MAX = 2;
  const FIRST = [150, 210], NEXT = [270, 360];   // segundos hasta que aparece el siguiente
  const JOIN_TIME = 2.5, WAIT_LIFE = 90, NEAR = 56;
  const DMG_K = 0.6;            // pegan algo menos que tú
  const LVL_EVERY = 4;          // su movimiento sube un nivel cada 4 del grupo
  const EVO_LV = [10, 20];      // nivel del grupo para la 1ª y la 2ª evolución
  const FAR = 600;              // vivo y más lejos que esto de ti (te has ido corriendo): aparece a tu lado
  const JUMP = 20000;           // incluso caído: has ido a la grieta o a Arceus (o vuelto), y se viene contigo
  const GAP = 12;               // hueco mínimo entre los del grupo
  const HALO = '#7dffb0';

  /** Posturas: multiplicadores sobre lo normal (dmg, cd, hp, taken) y lo especial. */
  const STANCES = {
    atk:  { name: 'Atacante', icon: 'fist', color: '#ff7b5c', dmg: 1.4, cd: 0.85, hp: 0.8,
            desc: 'Pega un 40 % más fuerte y ataca más rápido, pero tiene menos vida.' },
    tank: { name: 'Guardián', icon: 'shield', color: '#7fb4ff', dmg: 0.7, hp: 2, taken: 0.6, taunt: true, tauntR: 130,
            desc: 'El doble de vida y recibe menos daño, pero pega menos. Los enemigos que tiene cerca van a por él en vez de a por ti.' },
    sup:  { name: 'Apoyo', icon: 'heart', color: '#5fe08a', dmg: 0.6, heal: 0.04,
            desc: 'Pega menos, pero cada 3 s te cura un poco si estás cerca.' }
  };
  const NO_STANCE = {};             // mientras eliges (el juego está parado)
  const HEAL_EVERY = 3, HEAL_NEAR = 240;

  const PRE = G.PREVO;
  /** Primera forma de su familia (Charizard -> Charmander). */
  const rootOf = dex => { for (let n = 0; PRE[dex] && n < 3; n++) dex = PRE[dex]; return dex; };
  /** Fase dentro de su región (0 = forma básica allí: Pikachu en Kanto, aunque Pichu sea de Johto). */
  const stageIn = dex => {
    const gen = G.DEX_BY[dex].gen;
    let n = 0;
    while (PRE[dex] && G.DEX_BY[PRE[dex]] && G.DEX_BY[PRE[dex]].gen === gen && n < 3) { dex = PRE[dex]; n++; }
    return n;
  };
  /** Sus evoluciones directas que se pueden dibujar. */
  const nextOf = dex => (G.EVOS[dex] || []).filter(d => G.DEX_BY[d] && G.SPRITE_META[d]);

  class Ally {
    constructor(mon, owner, x, y) {
      this.ally = true;
      this.owner = owner;
      this.side = 0;               // su sitio en la V: -1 / 1 (o 0, detrás, si va solo); ver formation()
      this.setForm(mon);
      this.x = x; this.y = y; this.vx = 0; this.vy = 0;
      this.maxHp = this.hpFor(owner.level); this.hp = this.maxHp;
      this.aim = Math.PI / 2; this.moveAngle = Math.PI / 2;
      this.target = null; this.walking = false;
      this.invuln = 0; this.flash = 0; this.attackFace = 0; this.hitCd = 0;
      this.dead = false; this.reviveT = 0; this.dmgDealt = 0;
      this.evoT = 1.5;             // recién llegado: un momento antes de poder evolucionar
      this.evos = 0;               // evoluciones en esta partida (la 1ª al nivel EVO_LV[0], la 2ª al EVO_LV[1])
      this.stance = null;          // id de STANCES: lo eliges al unirse (ver game.js offerStance)
      this.healT = HEAL_EVERY;
      const m = G.Moves.instance(G.baseStartOf(mon.dex), 1);
      m.since = G.Game.st.time;
      this.moves = [m]; this.slots = [[m]]; this.active = 0;
      this.syncLevel(0);
    }

    /** Especie (al unirse y al evolucionar): sprite, tamaño y choque. */
    setForm(mon) {
      this.mon = mon; this.dex = mon.dex;
      this.scale = G.Sprites.playerScale(mon.dex);
      this.anim = new G.Sprites.Animator(mon.dex, this.scale);
      this.r = G.Sprites.playerRadius(mon.dex);
      this.bodyH = G.Sprites.bodyHeight(mon.dex, this.scale);
      G.Sprites.preload(nextOf(mon.dex));      // que la evolución ya esté cargada
    }

    hpFor(level) { return Math.round((this.mon.hp * 0.7 + level * 6) * (this.st.hp || 1)); }

    get st() { return STANCES[this.stance] || NO_STANCE; }

    setStance(id) {
      const k = this.hp / this.maxHp;
      this.stance = id;
      this.maxHp = this.hpFor(this.owner.level);
      this.hp = Math.max(1, this.maxHp * k);
      this.healT = HEAL_EVERY;
      G.FX.ring(this.x, this.y, 6, 70, this.st.color, 0.5, 4);
    }

    // Lo que combat.js (y los enemigos que van a por el Guardián) le piden.
    cy() { return this.y; }
    get level() { return this.owner.level; }
    get tauntR() { return this.st.tauntR || 0; }    // Guardián: los enemigos a menos de esto van a por él (EnemyMgr.nearestPlayer)
    get cdMul() { return this.owner.cdMul * (this.st.cd || 1); }
    get critChance() { return this.owner.critChance; }
    activeGroup() { return this.slots[0]; }
    activeMove() { return this.slots[0][0]; }
    hasItem() { return false; }
    onDealt() {}
    addBuff() {}
    atkFor(m) {
      const cat = m && m.cat;
      const mono = m && this.mon.types.length === 1 && m.type === this.mon.types[0] ? G.Player.MONO_K : 1;
      return this.mon.atk * this.owner.atkMul * G.Stats.fit(this.mon, cat) * mono * DMG_K * (this.st.dmg || 1);
    }
    cast(m) {
      if (m.kind === 'trail') return;
      if (this.anim.busy() && this.anim.progress() < 0.65) return;
      const anim = G.Player.CAST_ANIM[m.kind] || 'Attack';
      const meta = G.Sprites.animMeta(this.dex, anim);
      const len = meta ? meta.d.reduce((a, b) => a + b, 0) / 60 : 0.4;
      this.anim.play(anim, { speed: Math.max(1, len / (Math.max(0.12, m.cd * this.cdMul) * 0.9)) });
      this.attackFace = 0.35;
    }

    /** Experiencia del grupo: va a tu nivel. Su movimiento, su vida y su especie suben con él. */
    syncLevel(dt) {
      const lv = this.owner.level;
      const m = this.moves[0], want = G.U.clamp(1 + Math.floor((lv - 1) / LVL_EVERY), 1, m.def.maxLvl);
      while (m.lvl < want && G.Moves.levelUp(m));
      const hp = this.hpFor(lv);
      if (hp > this.maxHp) { if (!this.dead) this.hp += hp - this.maxHp; this.maxHp = hp; }
      if ((this.evoT -= dt) > 0 || this.dead) return;
      const lvNeed = EVO_LV[this.evos], next = nextOf(this.dex);
      if (lvNeed && lv >= lvNeed && next.length) this.evolve(G.DEX_BY[G.U.pick(next)]);
    }

    evolve(mon) {
      const from = this.mon.name, k = this.hp / this.maxHp;
      this.setForm(mon);
      this.maxHp = this.hpFor(this.owner.level);
      this.hp = Math.max(1, this.maxHp * Math.max(k, 0.5));      // evolucionar también cura un poco
      this.evoT = 1.5;                                           // la siguiente, como pronto en 1,5 s
      this.evos++;
      this.invuln = 1;
      G.FX.ring(this.x, this.y, 6, 90, '#ffffff', 0.7, 5);
      G.FX.burst(this.x, this.y - this.bodyH * 0.5, '#ffffff', 30, 200);
      G.FX.burst(this.x, this.y - this.bodyH * 0.5, HALO, 16, 140);
      G.Spawner.say('¡' + from + ' ha evolucionado en ' + mon.name + '!', 3, true);
      G.Audio.sfx('levelup');
    }

    /** Misma firma que Player.hurt (los enemigos que van a por el Guardián lo tratan como a ti). */
    hurt(amount, type = null, pure = false, cat = null) {
      if (this.invuln > 0 || this.dead) return;
      amount *= G.Stats.taken(this.mon, cat) * (this.st.taken || 1);
      if (type) amount *= G.Types.mult(type, this.mon.types) * G.Weather.mult(type);
      const d = Math.max(1, amount * (1 - Math.min(0.8, this.owner.dmgReduce || 0)));
      this.hp -= d;
      this.invuln = 0.45; this.flash = 0.14;
      G.FX.dmgText(this.x, this.y - this.bodyH - 4, '-' + Math.round(d), '#ff9aa5');
      if (this.hp > 0) return;
      this.hp = 0; this.dead = true; this.reviveT = 0;
      this.anim.play('Faint', { hold: true });
      G.Projectiles.clearOrbs(this);
      G.Spawner.say('¡' + this.mon.name + ' se ha debilitado! Quédate a su lado para levantarlo', 3, true);
      G.Audio.sfx('hurt');
    }

    heal(amount) {
      const before = this.hp;
      this.hp = Math.min(this.maxHp, this.hp + amount);
      const got = Math.round(this.hp - before);
      if (got >= 1) G.FX.dmgText(this.x, this.y - this.bodyH - 6, '+' + got, '#5fe08a');
    }

    revive() {
      this.dead = false; this.reviveT = 0;
      this.hp = Math.max(1, this.maxHp * 0.5);
      this.invuln = 2;
      this.anim._start('Idle', false);
      G.FX.ring(this.x, this.y, 6, 70, '#5fe08a', 0.5, 4);
      G.FX.burst(this.x, this.y - this.bodyH * 0.5, '#9dffb8', 18, 150);
      G.Audio.sfx('heal');
    }

    /** Su sitio en la formación, detrás de ti mirando hacia `heading`. */
    spot(heading, side = this.side) {
      const o = this.owner, a = heading + Math.PI + side * 0.65, back = o.r + this.r + 24;
      return [o.x + Math.cos(a) * back, o.y + Math.sin(a) * back * 0.8];
    }

    /** A tu lado, en su sitio (o encima de ti, que siempre está libre, si su sitio es pared). */
    regroup(heading) {
      const [x, y] = this.spot(heading);
      const free = G.World.isFree(x, y, this.r, true);
      this.x = free ? x : this.owner.x; this.y = free ? y : this.owner.y + 1;     // +1: la separación vuelve a actuar
      this.vx = this.vy = 0;
    }

    update(dt, heading) {
      this.anim.update(dt);
      const o = this.owner;
      // Grieta, Sentencia de Arceus o la vuelta: se viene contigo aunque esté caído
      // (si no, se quedaba en la arena para siempre, ocupando su hueco).
      if (G.U.dist2(this.x, this.y, o.x, o.y) > JUMP * JUMP) { this.regroup(heading); this.reviveT = 0; }
      if (this.dead) {
        // Caído: tú a su lado lo vas levantando (como un compañero en cooperativo).
        const near = !o.dead && G.U.dist2(o.x, o.y, this.x, this.y) < NEAR * NEAR;
        this.reviveT = near ? this.reviveT + dt : Math.max(0, this.reviveT - dt * 0.5);
        if (this.reviveT >= G.Player.REVIVE_TIME) this.revive();
        return;
      }
      if (this.invuln > 0) this.invuln -= dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.attackFace > 0) this.attackFace -= dt;
      if (o.regen > 0) this.hp = Math.min(this.maxHp, this.hp + o.regen * dt);
      // Apoyo: cada pocos segundos te cura un poco si estás cerca (y te hace falta).
      if (this.st.heal && (this.healT -= dt) <= 0) {
        this.healT = HEAL_EVERY;
        if (!o.dead && o.hp < o.maxHp && G.U.dist2(o.x, o.y, this.x, this.y) < HEAL_NEAR * HEAL_NEAR) {
          o.heal(o.maxHp * this.st.heal);
          G.FX.ring(o.x, o.y, 6, 50, this.st.color, 0.4, 3);
          G.FX.burst(this.x, this.y - this.bodyH * 0.6, this.st.color, 6, 70);
        }
      }

      // --- te sigue en formación: en V detrás de ti, según hacia dónde caminas ---
      const [tx, ty] = this.spot(heading);
      if (G.U.dist2(this.x, this.y, o.x, o.y) > FAR * FAR) {
        this.regroup(heading);
        G.FX.ring(this.x, this.y, 4, 40, HALO, 0.4, 3);
      }
      // Llega frenando (velocidad según lo lejos que está su sitio) y se aparta
      // de ti y de los otros aliados si se acercan demasiado.
      const max = Math.max(130, o.spd * 1.2);
      const d = G.U.dist(this.x, this.y, tx, ty);
      const want = d < 6 ? 0 : Math.min(max * (d > 160 ? 1.5 : 1), d * 4);
      const ux = d ? (tx - this.x) / d : 0, uy = d ? (ty - this.y) / d : 0;
      let wx = ux * want, wy = uy * want;
      // Si su sitio queda al otro lado de ti (al darte la vuelta), te rodea en
      // vez de pasarte por encima.
      const px = o.x - this.x, py = o.y - this.y, along = px * ux + py * uy, side = py * ux - px * uy;
      const round = o.r + this.r + GAP * 2;
      if (want && along > 0 && along < d && Math.abs(side) < round) {
        const s = side ? -Math.sign(side) : (this.side || 1), k = (1 - Math.abs(side) / round) * max;
        wx += -uy * s * k; wy += ux * s * k;
      }
      // Y si vienes hacia él, se aparta de tu camino hacia un lado.
      const ov = Math.hypot(o.svx || 0, o.svy || 0);
      if (ov > 20) {
        const vx = o.svx / ov, vy = o.svy / ov, rx = this.x - o.x, ry = this.y - o.y;
        const ahead = rx * vx + ry * vy, lat = ry * vx - rx * vy;
        if (ahead > -10 && ahead < 100 && Math.abs(lat) < round) {
          const s = lat ? Math.sign(lat) : (this.side || 1), k = (1 - Math.abs(lat) / round) * max * 1.5;
          wx += -vy * s * k; wy += vx * s * k;
        }
      }
      for (const p of [o, ...list]) {
        if (p === this || p.dead) continue;
        const sx = this.x - p.x, sy = this.y - p.y, sd = Math.hypot(sx, sy), min = this.r + p.r + GAP;
        if (sd >= min || sd < 0.01) continue;
        const push = (min - sd) / min * max * 1.5;
        wx += sx / sd * push; wy += sy / sd * push;
      }
      this.vx = G.U.damp(this.vx, wx, 11, dt); this.vy = G.U.damp(this.vy, wy, 11, dt);
      const x0 = this.x, y0 = this.y;
      this.x += this.vx * dt; this.y += this.vy * dt;
      // Contra una pared o un árbol (su sitio cae dentro): cuenta lo que se ha movido
      // de verdad, así no se queda andando sin avanzar.
      if (G.World.collide(this) && dt > 0) { this.vx = (this.x - x0) / dt; this.vy = (this.y - y0) / dt; }
      const sp = Math.hypot(this.vx, this.vy);
      this.walking = sp > (this.walking ? 12 : 28);             // sin parpadeo entre andar y parar
      if (this.walking) this.moveAngle = Math.atan2(this.vy, this.vx);

      // --- apunta al enemigo más cercano (o a la roca o cofre más cercano) ---
      const tg = G.Projectiles.nearest(G.EnemyMgr.all(), this.x, this.y, 520) || G.World.nearestBreakable(this.x, this.y, 200);
      this.target = tg;
      if (tg) this.aim = Math.atan2(tg.y - this.y, tg.x - this.x);
      else if (this.walking) this.aim = this.moveAngle;
      const face = this.attackFace > 0 || !this.walking ? this.aim : this.moveAngle;
      this.anim.dir = G.Sprites.dirFromAngle(face);
      this.anim.loop(this.walking ? 'Walk' : 'Idle', this.walking ? Math.max(0.6, sp / 110) : 1);

      // --- los enemigos que lo tocan le hacen daño ---
      if ((this.hitCd -= dt) > 0) return;
      for (const e of G.EnemyMgr.queryCircle(this.x, this.y, this.r + 40)) {
        if (e.dead || e.behavior === 'thief' || e.stunT > 0) continue;
        if (G.U.dist2(e.x, e.y, this.x, this.y) > (e.r + this.r) * (e.r + this.r)) continue;
        this.hitCd = 0.55;
        this.hurt(e.dmg, e.atkType, false, e.cat);
        const [nx, ny] = G.U.norm(e.x - this.x, e.y - this.y);
        e.kx += nx * 120; e.ky += ny * 120;
        break;
      }
    }

    draw(ctx) {
      // Aro en el suelo del color de su postura: es de tu equipo (no un enemigo).
      ctx.save();
      ctx.globalAlpha = this.dead ? 0.15 : 0.3;
      ctx.strokeStyle = this.st.color || HALO; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 1.5, this.r * 0.6, 0, 0, 6.2832); ctx.stroke();
      ctx.restore();
      G.Sprites.drawShadow(ctx, this.dex, this.x, this.y, this.scale);
      const alpha = this.invuln > 0 && !this.dead ? (Math.floor(this.invuln * 18) % 2 ? 0.45 : 1) : 1;
      this.anim.draw(ctx, this.x, this.y, { flash: this.flash > 0, softFlash: true, alpha, color: '#ffcb3d' });
      if (this.dead) {
        if (this.reviveT > 0) {
          ctx.save();
          ctx.strokeStyle = '#5fe08a'; ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(this.x, this.y, this.r * 2.4, this.r * 1.0, 0, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, this.reviveT / G.Player.REVIVE_TIME));
          ctx.stroke();
          ctx.restore();
        }
        return;
      }
      const w = 26, y = this.y - this.bodyH - 6;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(this.x - w / 2, y, w, 3);
      ctx.fillStyle = '#5fe08a'; ctx.fillRect(this.x - w / 2, y, w * Math.max(0, this.hp / this.maxHp), 3);
    }
  }

  let list = [], cand = null, nextT = 0, heading = Math.PI / 2;

  function reset() {
    list = []; cand = null; heading = Math.PI / 2;
    nextT = G.U.rand(FIRST[0], FIRST[1]);
  }

  // ---------------- el que quiere unirse ----------------

  /**
   * Un Pokémon de la región de tu compañero (ni él ni los que ya van contigo)
   * aparece cerca: de tu colección si tienes alguno; si no, uno salvaje de allí
   * en su forma básica (para que pueda evolucionar).
   */
  function spawnCandidate(pl) {
    const owned = G.DB.save && G.DB.save.owned || {};
    const ok = mon => mon && mon.gen === pl.mon.gen && G.SPRITE_META[mon.dex] && rootOf(mon.dex) !== rootOf(pl.dex)
                      && !list.some(a => rootOf(a.dex) === rootOf(mon.dex));
    let pool = Object.keys(owned).map(d => G.DEX_BY[d]).filter(ok);
    if (!pool.length) pool = G.DEX.filter(m => ok(m) && !m.leg && m.rarity <= 3 && !stageIn(m.dex));
    if (!pool.length) { nextT = Infinity; return; }
    const mon = G.U.pick(pool);
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(220, 300);
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d * 0.8;
      if (!G.World.isFree(x, y, 16)) continue;
      cand = { mon, x, y, t: 0, hold: 0, anim: new G.Sprites.Animator(mon.dex, 1), r: G.Sprites.bodyRadius(mon.dex) };
      G.Sprites.preload([mon.dex]);
      G.FX.ring(x, y, 4, 40, HALO, 0.5, 3);
      G.Spawner.say('¡' + mon.name + ' quiere unirse a ti! Quédate a su lado', 3.4, true);
      G.Audio.sfx('surge');
      return;
    }
    nextT = 10;                                          // no había sitio libre: luego
  }

  function candTick(dt, pl) {
    const c = cand;
    c.anim.update(dt);
    c.anim.dir = G.Sprites.dirFromAngle(Math.atan2(pl.y - c.y, pl.x - c.x));
    c.anim.loop('Idle');
    if (G.Rift.inArena) return;
    c.t += dt;
    const near = !pl.dead && G.U.dist2(pl.x, pl.y, c.x, c.y) < (NEAR + c.r) * (NEAR + c.r);
    c.hold = near ? c.hold + dt : Math.max(0, c.hold - dt);
    if (c.hold >= JOIN_TIME) join(pl);
    else if (c.t > WAIT_LIFE) {
      G.Spawner.say(c.mon.name + ' se ha cansado de esperar y se ha ido…', 3, true);
      cand = null;
      nextT = G.U.rand(NEXT[0], NEXT[1]);
    }
  }

  function join(pl) {
    const c = cand;
    const a = new Ally(c.mon, pl, c.x, c.y);
    list.push(a);
    cand = null;
    nextT = G.U.rand(NEXT[0], NEXT[1]);
    G.FX.ring(a.x, a.y, 6, 80, HALO, 0.6, 4);
    G.FX.burst(a.x, a.y - a.bodyH * 0.5, '#b3ffd0', 24, 180);
    G.Spawner.say('¡' + a.mon.name + ' se une a ti hasta el final de la partida!', 3.2, true);
    G.Audio.sfx('legend');
  }

  // ---------------- ciclo ----------------

  /**
   * La formación mira hacia donde caminas (parado no gira, así no se recolocan
   * a cada momento). Con dos, cada uno va al lado de la V que le queda más
   * cerca: al darte la vuelta no se cruzan, cada uno te rodea por su lado.
   */
  function formation(dt, pl) {
    if (pl.walking) {
      const da = Math.atan2(Math.sin(pl.moveAngle - heading), Math.cos(pl.moveAngle - heading));   // la vuelta más corta
      heading += da * Math.min(1, dt * 7);
    }
    const live = list.filter(a => !a.dead);
    if (live.length < 2) { if (live[0]) live[0].side = 0; return; }
    const [a, b] = live;
    const cost = (x, s) => { const [tx, ty] = x.spot(heading, s); return G.U.dist2(x.x, x.y, tx, ty); };
    const keep = cost(a, a.side || 1) + cost(b, -(a.side || 1)), swap = cost(a, -(a.side || 1)) + cost(b, a.side || 1);
    a.side = (a.side || 1) * (swap < keep * 0.8 ? -1 : 1);       // un margen, para que no cambien a cada momento
    b.side = -a.side;
  }

  function update(dt, pl, time) {
    if (G.Coop.active || !pl) return;
    formation(dt, pl);
    for (const a of list) {
      a.syncLevel(dt);
      a.update(dt, heading);
      G.Combat.tick(dt, a, time);
    }
    if (cand && G.Judgment.active) cand = null;        // ya no se puede ir a buscarlo (la Sentencia no acaba)
    if (cand) { candTick(dt, pl); return; }
    if (list.length >= MAX || pl.dead || G.Rift.inArena || G.Judgment.active) return;
    if ((nextT -= dt) > 0) return;
    if (G.EnemyMgr.bossAlive()) { nextT = 10; return; }
    spawnCandidate(pl);
  }

  /** El aliado vivo al que le da un disparo enemigo `p` (o null). */
  function hitBy(p) {
    for (const a of list) if (!a.dead && G.U.dist2(p.x, p.y, a.x, a.y) < (p.r + a.r) * (p.r + a.r)) return a;
    return null;
  }

  // ---------------- dibujo ----------------

  /** Aliados y el que quiere unirse, para ordenarlos por Y con el resto. */
  function drawables() {
    const out = list.slice();
    if (!cand) return out;
    const c = cand;
    out.push({
      y: c.y,
      draw(ctx) {
        const now = performance.now() / 1000;
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = HALO;
        ctx.beginPath(); ctx.ellipse(c.x, c.y, NEAR + c.r, (NEAR + c.r) * 0.6, 0, 0, 6.2832); ctx.fill();
        if (c.hold > 0) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = HALO; ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, NEAR + c.r, (NEAR + c.r) * 0.6, 0, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, c.hold / JOIN_TIME));
          ctx.stroke();
        }
        ctx.restore();
        G.Sprites.drawShadow(ctx, c.mon.dex, c.x, c.y, 1);
        c.anim.draw(ctx, c.x, c.y);
        // "!" que bota encima: quiere unirse.
        const by = c.y - G.Sprites.bodyHeight(c.mon.dex, 1) - 14 - Math.abs(Math.sin(now * 5)) * 6;
        ctx.save();
        ctx.font = '700 16px Pixelify, monospace'; ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText('!', c.x, by);
        ctx.fillStyle = HALO; ctx.fillText('!', c.x, by);
        ctx.restore();
      }
    });
    return out;
  }

  /** Flechas en el borde: hacia el que quiere unirse y hacia los aliados caídos. */
  function drawHud(ctx, w, h, pl, F) {
    const m = (x, y) => Math.round(G.U.dist(pl.x, pl.y, x, y) / 32);
    if (cand && !G.Rift.inArena) G.Events.edgeArrow(ctx, w, h, G.Camera, cand.x, cand.y - 10, HALO, '¡' + cand.mon.name + ' quiere unirse! · ' + m(cand.x, cand.y) + ' m', F);
    for (const a of list) {
      if (a.dead) G.Events.edgeArrow(ctx, w, h, G.Camera, a.x, a.y - 10, '#ff8a96', '¡' + a.mon.name + ' se ha debilitado! · ' + m(a.x, a.y) + ' m', F);
    }
  }

  return {
    reset, update, hitBy, drawables, drawHud, STANCES,
    get list() { return list; },
    /** Guardianes vivos: también son blanco de los enemigos (game.js → EnemyMgr.update). */
    taunts() { return list.filter(a => !a.dead && a.st.taunt); },
    /** Un aliado recién llegado al que aún no le has elegido postura. */
    pendingStance() { return list.find(a => !a.stance) || null; },
    /** Para pruebas: aparece ya el siguiente. */
    debugSpawn() { const pl = G.Game.player; if (pl && !cand && list.length < MAX) spawnCandidate(pl); },
    /** Para pruebas: el siguiente se une ya (sin ir a buscarlo). */
    debugJoin() { const pl = G.Game.player; if (!pl || G.Coop.active || list.length >= MAX) return; if (!cand) spawnCandidate(pl); if (cand) join(pl); },
    _dbg() { return cand && { x: cand.x, y: cand.y, hold: cand.hold, t: cand.t }; }
  };
})();
