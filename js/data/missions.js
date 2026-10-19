/* ============ missions.js — plantillas de misiones diarias y semanales ============
 * Cada día salen 3 diarias y cada semana 2 semanales (hora de España), con
 * objetivos y tipos sorteados. Se completan jugando y el premio se recoge en
 * la pantalla de Misiones. La lógica está en systems/progress.js.
 *
 *   ev      evento que la hace avanzar (ver G.Progress.event)
 *   match   (datos, parámetro) -> ¿cuenta este evento?
 *   value   datos -> cuánto vale; con mode 'max' se queda el mayor, con
 *           'add' (por defecto) se suma (1 si no hay value)
 *   param   'type': sortea un tipo Pokémon para la misión
 *   when    partida guardada -> ¿puede salir? (las de sistemas que aún no
 *           tienes, como las MT o el modo infinito, no salen hasta que los tengas)
 */
G.MissionDefs = (() => {
  const T = t => G.U.TYPE_NAME[t];
  const min = d => Math.floor(d.time / 60);
  const lvls = d => Math.max(0, (d.to | 0) - (d.from | 0));
  const runs = n => s => (s.stats.runs || 0) >= n;
  const infinite = s => G.Acts.rankOf(s) >= G.Acts.MAX_RANK;

  const daily = [
    { id: 'kill', ev: 'kill', goals: [300, 500, 800], reward: { t1: 2, coins: 150 },
      text: n => `Derrota a ${n} Pokémon` },
    { id: 'killType', ev: 'kill', param: 'type', goals: [30, 50, 80], reward: { t1: 2, coins: 200 },
      match: (d, t) => d.types.includes(t), text: (n, t) => `Derrota a ${n} Pokémon de tipo ${T(t)}` },
    { id: 'survive', ev: 'runEnd', mode: 'max', value: min, goals: [5, 7, 9], reward: { t1: 3, coins: 200 },
      text: n => `Aguanta ${n} minutos en una run` },
    { id: 'level', ev: 'runEnd', mode: 'max', value: d => d.level, goals: [8, 12, 15], reward: { t1: 2, coins: 200 },
      text: n => `Llega al nivel ${n} en una run` },
    { id: 'boss', ev: 'kill', match: d => d.boss, goals: [1, 2], reward: { t1: 3, coins: 250 },
      text: n => (n === 1 ? 'Derrota a un jefe' : `Derrota a ${n} jefes`) },
    { id: 'chest', ev: 'chest', goals: [1, 2], reward: { t1: 2, coins: 200 },
      text: n => (n === 1 ? 'Abre un cofre con candado' : `Abre ${n} cofres con candado`) },
    { id: 'coins', ev: 'runEnd', value: d => d.coins, goals: [100, 200, 300], reward: { t1: 2, coins: 150 },
      text: n => `Recoge ${n} monedas en tus runs` },
    { id: 'playType', ev: 'runEnd', param: 'type', mode: 'max', value: min, goals: [3], reward: { t1: 3, coins: 200 },
      match: (d, t) => d.types.includes(t), text: (n, t) => `Aguanta ${n} minutos con un Pokémon de tipo ${T(t)}` },
    { id: 'item', ev: 'item', goals: [1], reward: { t1: 2, coins: 150 },
      text: () => 'Encuentra un objeto equipable' },
    { id: 'evolve', ev: 'evolve', goals: [1], reward: { t1: 3, coins: 250 },
      text: () => 'Evoluciona un movimiento' },
    // Desde el 16-10-2026: actos, jefes de zona, nivel del Pokémon y MT.
    { id: 'zone', ev: 'zoneBoss', goals: [1, 2], reward: { t1: 3, coins: 250 }, when: runs(1),
      text: n => (n === 1 ? 'Vence a un jefe de zona' : `Vence a ${n} jefes de zona`) },
    { id: 'act', ev: 'runEnd', mode: 'max', value: d => d.act || 1, goals: [2, 3], reward: { t1: 3, coins: 250 }, when: runs(1),
      text: n => `Llega al acto ${n} en una partida` },
    { id: 'monLv', ev: 'monLevel', value: lvls, goals: [2, 3, 4], reward: { t1: 2, coins: 150 },
      text: n => `Sube ${n} niveles a tus Pokémon` },
    { id: 'tm', ev: 'tmTaught', goals: [1], reward: { t1: 3, coins: 300 }, when: () => G.Shop.unlocked('tm'),
      text: () => 'Enseña una MT a un Pokémon' }
  ];

  const weekly = [
    { id: 'wkill', ev: 'kill', goals: [4000, 6000], reward: { t10: 1, coins: 800 },
      text: n => `Derrota a ${n.toLocaleString('es')} Pokémon` },
    { id: 'wrift', ev: 'rift', goals: [1, 2], reward: { t10: 1, coins: 1000 },
      text: n => (n === 1 ? 'Gana una pelea en una grieta' : `Gana ${n} peleas en grietas`) },
    { id: 'wboss', ev: 'kill', match: d => d.boss, goals: [4, 6], reward: { t10: 1, coins: 900 },
      text: n => `Derrota a ${n} jefes` },
    { id: 'wsurvive', ev: 'runEnd', mode: 'max', value: min, goals: [12, 15], reward: { t10: 1, coins: 1000 },
      text: n => `Aguanta ${n} minutos en una run` },
    { id: 'wevolve', ev: 'evolve', goals: [3, 5], reward: { t10: 1, coins: 900 },
      text: n => `Evoluciona ${n} movimientos` },
    { id: 'wdaily', ev: 'missionDone', match: d => d.daily, goals: [8, 12], reward: { t10: 1, coins: 800 },
      text: n => `Completa ${n} misiones diarias` },
    { id: 'wwin', ev: 'win', goals: [1, 2], reward: { t10: 1, coins: 1200 }, when: runs(5),
      text: n => (n === 1 ? 'Gana una partida' : `Gana ${n} partidas`) },
    { id: 'wzone', ev: 'zoneBoss', goals: [4, 6], reward: { t10: 1, coins: 900 }, when: runs(3),
      text: n => `Vence a ${n} jefes de zona` },
    { id: 'wmonLv', ev: 'monLevel', value: lvls, goals: [10, 15], reward: { t10: 1, coins: 800 },
      text: n => `Sube ${n} niveles a tus Pokémon` },
    { id: 'winf', ev: 'infEnd', mode: 'max', value: min, goals: [3, 5], reward: { t10: 2, coins: 1500 }, when: infinite,
      text: n => `Aguanta ${n} minutos en el modo infinito` }
  ];

  const BY = {};
  for (const m of daily.concat(weekly)) BY[m.id] = m;

  return { daily, weekly, BY };
})();
