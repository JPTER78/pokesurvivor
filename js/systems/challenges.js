/* Desafíos V0.1: reglas, reloj activo y progreso independiente.
 * Sin premio monetario: el guardado cliente y sus reglas actuales no validan
 * una victoria ni una reclamación única. No se reutilizan runs del ranking.
 */
G.Challenges = (() => {
  const LIST = Object.freeze([Object.freeze({
    id: 'extreme-survival-v1', name: 'Supervivencia Extrema', duration: 600,
    description: 'Resiste diez minutos con tu Pokémon actual y tus mejoras compradas.',
    rules: 'En solitario. Los golpes de enemigos causan un 25 % más de daño. La cantidad, velocidad, vida, experiencia y aparición de enemigos se mantienen. Morir o abandonar falla el intento.',
    hostileDamage: 1.25, rewardCoins: 500, rewardEnabled: false
  })]);
  let active = null, previous = null, player = null;
  const positive = v => Number.isFinite(v) && v > 0 ? v : 0;

  function progress(save, id) {
    const p = save && save.challenges && save.challenges[id] || {};
    const def = LIST.find(d => d.id === id);
    const bestTime = Math.min(def ? def.duration : 0, positive(p.bestTime));
    return { bestTime, completedAt: bestTime === (def && def.duration) ? Math.floor(positive(p.completedAt)) : 0 };
  }

  // Máximo de marcas y primera fecha de finalización: unión conmutativa e
  // idempotente. No sumar monedas ni contadores al fusionar dos dispositivos.
  function mergeProgress(a, b) {
    const result = {};
    for (const def of LIST) {
      const x = progress({ challenges: a }, def.id), y = progress({ challenges: b }, def.id);
      if (!x.bestTime && !y.bestTime && !x.completedAt && !y.completedAt) continue;
      const dates = [x.completedAt, y.completedAt].filter(Boolean);
      result[def.id] = { bestTime: Math.max(x.bestTime, y.bestTime), completedAt: dates.length ? Math.min(...dates) : 0 };
    }
    return result;
  }

  function begin(id = null) {
    const def = id && LIST.find(d => d.id === id);
    if (id && !def) throw new Error('Desafío desconocido');
    active = def ? { def, time: 0 } : null;
    previous = null; player = null;
  }
  function bindPlayer(p) { player = p; }
  function suspend() { previous = null; }
  function tick(now, running) {
    if (!active || !running) { suspend(); return; }
    if (previous !== null) {
      const seconds = (now - previous) / 1000;
      // No contar suspensión del SO, cierre de pestaña ni grandes saltos de
      // reloj. Las pausas y elecciones tampoco suman. Nunca usar Date.now.
      if (seconds > 0 && seconds <= 1) active.time = Math.min(active.def.duration, active.time + seconds);
    }
    previous = now;
  }
  function finish(won = false) {
    if (!active) return null;
    const run = active;
    active = null; suspend(); player = null; // resolución única, incluso pagehide/offline repetidos
    const s = G.DB.save;
    const old = progress(s, run.def.id);
    won = !!won && run.time >= run.def.duration && navigator.onLine !== false && !document.hidden;
    const p = { bestTime: Math.max(old.bestTime, run.time), completedAt: old.completedAt || (won ? Date.now() : 0) };
    s.challenges = s.challenges || {};
    s.challenges[run.def.id] = p;
    return { id: run.def.id, name: run.def.name, time: run.time, won, ...p };
  }
  return {
    LIST, begin, bindPlayer, suspend, tick, finish, progress, mergeProgress,
    damageMultiplier(p) { return active && p === player ? active.def.hostileDamage : 1; },
    get active() { return active; },
    get ready() { return !!active && active.time >= active.def.duration; }
  };
})();
