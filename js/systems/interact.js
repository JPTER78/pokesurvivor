/* ============ interact.js — altares, manantiales, cofres, trampas, bayas y altares de riesgo ============
 * Los objetos los coloca world.js (raros, en el suelo libre); aquí está lo que
 * pasa al tocarlos. Todo se mira alrededor de TU Pokémon:
 *
 *   spring    cura mientras estás encima; se agota y se recarga sola
 *   bigchest  quédate a su lado CHEST_TIME segundos (mientras te atacan) y se
 *             abre: monedas, tickets y experiencia para subir un nivel
 *   trap      salta al pisarla (tú o un enemigo) y afecta a todo lo cercano:
 *             veneno, pegajosa (ralentiza) o explosiva
 *   berrytree al pasar a su lado lo sacudes: cura un 30 % y da la baya de su
 *             bioma, con un poder de 20 s (ver BERRIES). Vuelve a dar fruto a los 90 s.
 *             Desde el 20-10-2026 sustituyen a los altares de poder (mismos efectos).
 *   riskaltar quédate a su lado RISK_TIME s: despierta a un guardián fuerte y
 *             a su séquito; si lo vences, botín grande (ver Enemy.die)
 *
 * Cooperativo: árboles y manantiales son de cada uno (en cada ordenador); el
 * cofre y las trampas se rompen como cualquier objeto y el anfitrión reparte
 * el botín y el daño a los enemigos (ver world.destroyProp y coop.propBroken).
 */
G.Interact = (() => {
  const CHEST_TIME = 3.5, RISK_TIME = 2.5, BERRY_REGROW = 90;
  // Cada bioma, su baya (las de los juegos que suben un stat en apuros) y su poder:
  // los mismos efectos que tenían los altares, que se han quitado.
  const BERRY_TIME = 20;
  const BERRIES = {
    forest:  { id: 'liechi', name: 'Baya Lichi', desc: '+40% de daño', color: '#ff4f6a',
               on: p => { p.atkMul *= 1.4; }, off: p => { p.atkMul /= 1.4; } },
    desert:  { id: 'salac', name: 'Baya Aslac', desc: '+40% de velocidad', color: '#5fd4ff',
               on: p => { p.spdMul *= 1.4; }, off: p => { p.spdMul /= 1.4; } },
    volcano: { id: 'custap', name: 'Baya Chiri', desc: '-30% de recarga', color: '#ffd23f',
               on: p => { p.cdMul *= 0.7; }, off: p => { p.cdMul /= 0.7; } },
    cave:    { id: 'ganlon', name: 'Baya Gonlan', desc: '-25% de daño recibido', color: '#b0b8c8',
               on: p => { p.dmgReduce += 0.25; }, off: p => { p.dmgReduce -= 0.25; } },
    tower:   { id: 'starf', name: 'Baya Arabol', desc: 'un poder al azar', color: '#c98aff' }
  };
  const MAGNET = { id: 'magnet', name: 'Imán', desc: 'atraes todo desde lejos', color: '#ff8ad8',
                   on: p => { p.magnet *= 4; }, off: p => { p.magnet /= 4; } };
  // Baya Arabol (Torre Lavanda): uno de los poderes al azar, también el Imán.
  const STARF = [BERRIES.forest, BERRIES.desert, BERRIES.volcano, BERRIES.cave, MAGNET];
  const TRAP_R = 74;
  const authority = () => !G.Coop.active || G.Coop.isHost;
  let healShown = 0, healAcc = 0;

  function update(dt, pl) {
    if (!pl) return;
    for (const p of G.World.specialsNear(pl.x, pl.y, 720)) {
      const d2 = G.U.dist2(pl.x, pl.y, p.x, p.type === 'spring' || p.type === 'trap' ? p.y - 8 : p.y);
      switch (p.type) {
        case 'spring': spring(dt, pl, p, d2); break;
        case 'bigchest':
          if (!pl.dead && d2 < Math.max(46, p.r + pl.r + 24) ** 2) {
            if (p.open === 0) G.Audio.sfx('select');
            p.open += dt;
            if (p.open >= CHEST_TIME) { p.open = 0; G.World.breakProp(p); }
          } else if (p.open > 0) p.open = Math.max(0, p.open - dt * 1.5);
          break;
        case 'berrytree':
          if (p.charge < 1) p.charge = Math.min(1, p.charge + dt / BERRY_REGROW);
          else if (!pl.dead && d2 < (p.r + pl.r + 18) ** 2) shakeTree(pl, p);
          break;
        case 'riskaltar':
          if (!pl.dead && d2 < Math.max(46, p.r + pl.r + 24) ** 2) {
            if (p.open === 0) { G.Audio.sfx('select'); G.Spawner.say('Altar de riesgo: quédate y despertará a su guardián…', 2.4, true); }
            p.open += dt;
            if (p.open >= RISK_TIME) { p.open = 0; G.World.breakProp(p); }
          } else if (p.open > 0) p.open = Math.max(0, p.open - dt * 1.5);
          break;
        case 'trap':
          if (!pl.dead && !pl.levitate && d2 < 13 * 13) G.World.breakProp(p);
          else if (authority() && G.EnemyMgr.queryCircle(p.x, p.y - 8, 3).some(e => !e.flying && !e.remote)) G.World.breakProp(p);
          break;
      }
    }
  }

  function spring(dt, pl, p, d2) {
    if (p.charge < 1) p.charge = Math.min(1, p.charge + dt / 45);
    if (pl.dead || d2 > 26 * 26 || p.charge <= 0.02 || pl.hp >= pl.maxHp) return;
    const before = pl.hp;
    pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.14 * dt);
    healAcc += pl.hp - before;
    p.charge = Math.max(0, p.charge - dt * 0.09);
    if (Math.random() < dt * 14) G.FX.px(pl.x + G.U.rand(-pl.r, pl.r), pl.y - G.U.rand(0, pl.bodyH), '#7dffb0', { vy: -50, life: 0.5 });
    healShown -= dt;
    if (healShown <= 0 && healAcc >= 1) {
      healShown = 0.6;
      G.FX.dmgText(pl.x, pl.y - pl.bodyH - 6, '+' + Math.round(healAcc), '#5fe08a');
      healAcc = 0;
      G.Audio.sfx('xp');
    }
    if (p.charge <= 0.02) G.Spawner.say('El manantial se ha secado (se recarga solo)', 2.2, true);
  }

  /** Árbol de bayas: cada uno el suyo. Cura y da el poder de la baya de su bioma. */
  function shakeTree(pl, p) {
    p.charge = 0;
    const own = BERRIES[G.World.biomeKey] || BERRIES.forest;
    const b = own.id === 'starf' ? G.U.pick(STARF) : own;
    G.FX.burst(p.x, p.y - 30, own.color, 14, 120);
    pl.heal(pl.maxHp * 0.3, true);
    pl.addPower(b, BERRY_TIME);
    G.FX.ring(pl.x, pl.y, 6, 70, b.color, 0.5, 4);
    G.Audio.sfx('heal');
    G.Spawner.say('¡' + own.name + '! Recuperas vida y ' + b.desc + ' durante ' + BERRY_TIME + ' s', 2.8, true);
  }

  /** Altar de riesgo (quien manda): el guardián y su séquito. */
  function riskAwaken(p) {
    G.FX.ring(p.x, p.y - 10, 6, 110, '#ff3a3a', 0.7, 6);
    G.FX.burst(p.x, p.y - 14, '#ff5f5f', 30, 200);
    G.Camera.kick(0.6);
    G.Audio.sfx('boss');
    if (G.Coop.active && !G.Coop.isHost) return;
    const t = G.Game.st.time, R = G.Acts.RANKS[G.Acts.rank];
    const mon = G.Enemies.zoneBoss(G.World.biome);
    const n = G.Game.everyone().length;
    const def = {
      dex: mon.dex, name: mon.name,
      hp: Math.round(4000 * (1 + t / 600) * R.hp * G.Coop.scaleHp(n)),
      spd: Math.round(G.U.clamp(46 + (mon.spd - 78) * 0.5, 46, 95)),
      dmg: Math.round(40 * (1 + t / 900) * R.dmg), xp: Math.round(600 + t * 0.6),
      behavior: 'charger', shotDmg: Math.round(20 * R.dmg), shotCd: 1.1, range: 260
    };
    G.Sprites.preload([mon.dex], 3000);
    const e = G.Spawner.spawnBossDef(def, '¡El altar despierta a ' + mon.name + '! Véncelo y tendrás su premio');
    if (e) { e.x = p.x + G.U.rand(-60, 60); e.y = p.y - 80; e.riskReward = true; }
    G.Spawner.burst(Math.round(10 * G.Coop.scaleRate(n)));
  }

  /**
   * Una trampa salta (en cada ordenador; ver la cabecera). El daño a enemigos
   * sólo lo hace quien manda; a ti te afecta si estás dentro.
   */
  function trapEffect(p) {
    const x = p.x, y = p.y - 8, k = p.kind;
    const col = ['#c86bdc', '#8bd94a', '#ff7b3d'][k];
    const pal = ['poison', 'grass', 'fire'][k];
    G.FX.ring(x, y, 6, TRAP_R, col, 0.5, k === 2 ? 7 : 4);
    G.FX.burst(x, y - 6, col, k === 2 ? 40 : 22, k === 2 ? 260 : 140);
    for (let i = 0; i < (k === 2 ? 10 : 7); i++) {
      const a = Math.random() * 6.2832, r = G.U.rand(8, TRAP_R * 0.8);
      G.FX.sp(k === 2 ? 'impact' : 'blob', pal, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7 - 6,
              { vy: k === 2 ? -30 : -45, life: G.U.rand(0.4, 0.8) });
    }
    G.Audio.sfx(k === 2 ? 'boss' : 'surge');
    if (k === 2 && G.U.dist2(x, y, G.Camera.x, G.Camera.y) < 500 * 500) G.Camera.kick(0.7);

    const pl = G.Game.player;
    const lvl = pl ? pl.level : 1;
    if (authority()) {
      for (const e of G.EnemyMgr.queryCircle(x, y, TRAP_R)) {
        if (e.remote) continue;
        if (k === 0) { e.applyPoison(5); e.hurt(14 + lvl * 3, '#d47cf0'); }
        else if (k === 1) { e.applySlow(0.65, 4.5); e.hurt(4, '#8bd94a'); }
        else e.hurt(90 + lvl * 18, '#ff7b3d', e.x - x, e.y - y, 220);
      }
    }
    if (pl && !pl.dead && G.U.dist2(x, y, pl.x, pl.y) < (TRAP_R * 0.7) ** 2) {
      pl.breakShortInvuln();
      if (k === 0) { if (!pl.guard && !pl.levitate) pl.hurt(pl.maxHp * 0.1); }
      else if (k === 1) { if (pl.steady || pl.levitate) return; pl.slowT = 3.5; G.FX.dmgText(pl.x, pl.y - pl.bodyH - 6, '¡Pegajoso!', '#8bd94a'); }
      else pl.hurt(pl.maxHp * 0.2);
    }
  }

  return { update, trapEffect, riskAwaken, BERRIES, CHEST_TIME };
})();
