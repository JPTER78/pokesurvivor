/* ============ stages.js — gestor de etapas y combates de gimnasio ============
 * Controla la progresión de la etapa activa (10 min), el inicio del combate en la
 * arena de gimnasio con los Pokémon del líder (Geodude y Onix) y la condición de victoria.
 */
G.StageMgr = (() => {
  let activeStage = null;
  let gymState = 'none'; // 'none' | 'battle' | 'won'
  let bossIds = [];
  let winTriggered = false;

  let winTimer = 0;

  const TS = () => G.Tiles.T * G.Sprites.PX;

  function begin(stageId) {
    activeStage = stageId ? G.Stages.get(stageId) : null;
    G.Stages.current = stageId;
    gymState = 'none';
    bossIds = [];
    winTriggered = false;
    winTimer = 0;
  }

  function end() {
    activeStage = null;
    G.Stages.clearCurrent();
    gymState = 'none';
    bossIds = [];
    winTriggered = false;
    winTimer = 0;
  }

  function isGymFight() {
    return gymState === 'battle';
  }

  /** Se invoca en cada fotograma desde el bucle principal. */
  function tick(dt, time, pl) {
    if (!activeStage || pl.dead) return;

    // Al llegar a la duración (600s / 10 min) comienza el combate de gimnasio
    if (gymState === 'none' && time >= activeStage.duration && !G.Rift.inArena) {
      startGymBattle(pl);
    }

    // Monitoreo del combate de gimnasio
    if (gymState === 'battle' && !winTriggered) {
      keepInside(pl);

      // Comprobar si ambos Pokémon del líder han sido derrotados
      const alive = bossIds.some(id => {
        const e = G.EnemyMgr.get(id);
        return e && !e.dead;
      });

      if (!alive && bossIds.length > 0) {
        winTriggered = true;
        gymState = 'won';
        winTimer = 2.0;
        G.Audio.sfx('legend');
        G.Spawner.say('¡Has derrotado al Líder ' + activeStage.leader + '!', 3.5, true);
      }
    }

    // Espera a que termine cualquier pantalla de elección para cerrar la etapa
    if (gymState === 'won') {
      keepInside(pl);
      winTimer -= dt;
      const inChoice = G.Game.state === 'choice' || G.Game.state === 'levelup';
      if (winTimer <= 0 && !inChoice && G.Game.state !== 'over') {
        gymState = 'ended';
        G.Game.winStage(activeStage);
      }
    }
  }

  /** Inicia el combate de gimnasio en la arena cerrada de roca. */
  function startGymBattle(pl) {
    gymState = 'battle';
    bossIds = [];
    winTriggered = false;

    const gym = activeStage.gym;
    const ts = TS();
    const arenaX = 5000 * ts + ts / 2;
    const arenaY = 5000 * ts + ts / 2;

    // 1. Limpiar proyectiles, trampas y esconder enemigos comunes del mapa
    G.EnemyMgr.stash();
    G.Projectiles.clear();
    G.Combat.clearFields();
    G.Hazards.clear();

    // 2. Construir la arena circular cerrada de gimnasio (tipo Roca)
    G.World.setArena({ tx: 5000, ty: 5000, r: 12, type: gym.arenaType || 'rock' });
    G.World.setBiome(G.Tiles.arenaBiome(gym.arenaType || 'rock'), true);

    // 3. Posicionar al jugador en el sur de la arena
    const everyone = G.Game.everyone ? G.Game.everyone() : [pl];
    everyone.forEach((p, i) => {
      p.x = arenaX + (i - (everyone.length - 1) / 2) * 36;
      p.y = arenaY + ts * 3.5;
    });
    G.Camera.x = pl.x;
    G.Camera.y = pl.y;

    // 4. Efectos audiovisuales del reto de gimnasio
    G.Game.flash('#ffd23f', 0.9);
    G.Audio.music('boss');
    G.Audio.sfx('boss');
    G.Spawner.say(gym.introText || ('¡Combate de Gimnasio contra ' + gym.leaderName + '!'), 3.6, true);

    // 5. Spawnear el equipo completo del líder (Geodude y Onix simultáneamente)
    const offsets = [
      { x: -ts * 2.5, y: -ts * 3.5 }, // Geodude a la izquierda
      { x: ts * 2.5,  y: -ts * 3.5 }  // Onix a la derecha
    ];

    gym.team.forEach((spec, i) => {
      const mon = G.DEX_BY[spec.dex];
      if (!mon) return;

      const off = offsets[i] || { x: 0, y: -ts * 3.5 };
      const def = {
        dex: spec.dex,
        name: spec.name || mon.name,
        hp: spec.hp,
        spd: Math.round(mon.spd * 0.75),
        dmg: spec.dmg || 28,
        xp: spec.xp || 600,
        behavior: spec.behavior || 'charger',
        shotDmg: spec.shotDmg || 16,
        shotCd: spec.shotCd || 1.1,
        range: 280
      };

      const e = new G.Enemy(def, arenaX + off.x, arenaY + off.y, { hp: 1, spd: 1, dmg: 1 }, true);
      e.legend = false; // No usa el botín masivo de tickets de las grietas
      e.isGymBoss = true;
      e.flying = false;
      G.EnemyMgr.add(e);
      bossIds.push(e.id);
    });

    G.Camera.kick(1.2);
  }

  /** Se llama al derrotar un mini-jefe durante la etapa para otorgar un Vínculo (fusión de habilidades). */
  function onBossKilled(enemy) {
    if (!activeStage) return;
    const pl = G.Game.player;
    if (pl) {
      pl.bonds = (pl.bonds || 0) + 1;
      G.Audio.sfx('legend');
      G.FX.dmgText(enemy.x, enemy.y - 20, '¡VÍNCULO!', '#ff8ad8', true);
      G.FX.ring(enemy.x, enemy.y, 10, 110, '#ff8ad8', 0.8, 6);
      G.Spawner.say('¡' + enemy.name + ' derrotado! ¡Has obtenido un Vínculo!', 3.2, true);
      setTimeout(() => {
        if (G.Game.state === 'playing') G.Game.offerBond();
      }, 1200);
    }
  }

  /** Asegura que ninguna entidad se salga del círculo de la arena. */
  function keepInside(pl) {
    const ts = TS();
    const arenaX = 5000 * ts + ts / 2;
    const arenaY = 5000 * ts + ts / 2;
    const max = 10.6 * ts;

    // Mantener jugadores dentro
    const everyone = G.Game.everyone ? G.Game.everyone() : [pl];
    for (const p of everyone) {
      const dx = p.x - arenaX, dy = p.y - arenaY, d = Math.hypot(dx, dy);
      if (d > max) { p.x = arenaX + dx / d * max; p.y = arenaY + dy / d * max; }
    }

    // Mantener jefes dentro
    for (const id of bossIds) {
      const e = G.EnemyMgr.get(id);
      if (!e || e.dead) continue;
      const dx = e.x - arenaX, dy = e.y - arenaY, d = Math.hypot(dx, dy);
      if (d > max) { e.x = arenaX + dx / d * max; e.y = arenaY + dy / d * max; }
    }
  }

  return {
    begin,
    end,
    tick,
    isGymFight,
    onBossKilled,
    get active() { return activeStage; },
    get isGym() { return isGymFight(); },
    get gymWon() { return gymState === 'won'; }
  };
})();
