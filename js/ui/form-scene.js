/* Cambio de forma con los sprites originales; el juego conserva su pausa de recompensa. */
G.FormScene = (() => {
  let scene = null;
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const stats = mon => Object.fromEntries(['hp', 'pa', 'sa', 'df', 'sd', 'spd'].map(k => [k, mon[k]]));

  function cancel() {
    if (!scene) return;
    scene.el.remove(); scene = null;
  }
  function start(player, form, apply, done) {
    cancel();
    const el = document.createElement('section');
    el.id = 'form-cinematic'; el.className = 'form-cinematic';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'form-cinematic-name');
    el.innerHTML = `<div class="fc-bar fc-top"></div><div class="fc-bar fc-bottom"></div>
      <div class="fc-content"><h2 id="form-cinematic-name">${G.T(player.mon.name)}</h2>
      <div class="fc-item">${G.Icons.html(form.stone, 64)}</div>
      <div class="fc-sprites"></div><div class="fc-results" hidden>
      <p class="fc-complete">${G.T(form.category === 'fusion' ? '¡Fusión completada!' : '¡Mega Evolución!')}</p>
      <div class="fc-types"></div><p class="fc-stat-heading">${G.T('Estadísticas base')}</p><div class="fc-stats"></div></div>
      <button class="btn gold fc-continue" hidden>${G.T('Continuar')}</button></div>`;
    const host = el.querySelector('.fc-sprites');
    const opts = { shiny: player.shiny, hero: true, scale: 16, frameFit: true, shadow: false, twinkle: false };
    const old = G.UI.spriteCanvas(player.spriteKey, 800, 640, { ...opts, frameFill: .76, skin: player.anim.skin });
    const next = G.UI.spriteCanvas(form.sprite.key, 800, 640, { ...opts, frameFill: .96 });
    old.className = 'fc-old'; next.className = 'fc-new';
    host.append(old, next); next.style.opacity = '0';
    scene = { el, old, next, player, form, apply, done, before: stats(player.mon), t: 0, stage: 'intro',
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, deferred: [], closing: 0 };
    el.addEventListener('keydown', e => {
      e.stopPropagation();
      if (['Enter', ' '].includes(e.key)) { e.preventDefault(); advance(); }
      if (e.key === 'Tab' && scene?.stage !== 'result') e.preventDefault();
    });
    el.querySelector('.fc-continue').onclick = advance;
    el.tabIndex = -1; document.body.appendChild(el); el.focus();
    // Already preloaded when the reward is offered; request again for a recovered tab.
    G.Sprites.preload([player.spriteKey, form.sprite.key], 8000, player.shiny);
    G.Audio.sfx('confirm');
  }
  function reveal(s) {
    if (!s.apply()) { const done = s.done; cancel(); done(); return false; }
    s.el.querySelector('h2').textContent = G.T(s.player.mon.name);
    s.el.querySelector('.fc-types').innerHTML = G.UI.typeChips(s.player.mon.types);
    const after = stats(s.player.mon), box = s.el.querySelector('.fc-stats');
    const labels = { hp: 'Vida', pa: 'Ataque', sa: 'At. Esp.', df: 'Defensa', sd: 'Def. Esp.', spd: 'Velocidad' };
    const number = (k, v) => k === 'pa' || k === 'sa' ? '×' + v.toFixed(2) : String(Math.round(v));
    for (const k of Object.keys(labels)) {
      const row = document.createElement('div');
      const delta = after[k] - s.before[k];
      row.className = 'fc-stat ' + (delta > .00001 ? 'fc-up' : delta < -.00001 ? 'fc-down' : '');
      const label = document.createElement('span'); label.textContent = G.T(labels[k]);
      const value = document.createElement('b'); value.textContent = number(k, s.before[k]) + ' → ' + number(k, after[k]);
      row.append(label, value); box.appendChild(row);
    }
    G.Audio.sfx('legend');
    return true;
  }
  function advance() { if (scene?.stage === 'result') { scene.stage = 'closing'; scene.closing = 0; } }
  function update(dt) {
    const s = scene; if (!s) return;
    s.t += Math.max(0, Math.min(.05, dt));
    const t = s.t, el = s.el;
    el.style.setProperty('--fc-bars', smooth(t / .65));
    const rise = smooth((t - .2) / 1.1);
    const item = el.querySelector('.fc-item');
    // Measure the resting slot without its animated transform; resizing stays safe.
    item.style.transform = '';
    const slot = item.getBoundingClientRect(), screen = el.getBoundingClientRect();
    const fromY = screen.top + screen.height / 2 - (slot.top + slot.height / 2);
    item.style.transform = `translateY(${(1 - rise) * fromY}px)`;
    el.querySelector('.fc-item').style.opacity = String(clamp(t / .4));
    if (s.stage === 'closing') {
      s.closing += dt;
      el.style.opacity = String(1 - smooth(s.closing / .45));
      el.style.setProperty('--fc-bars', 1 - smooth(s.closing / .45));
      if (s.closing >= .45) {
        const done = s.done, deferred = s.deferred.slice(); cancel(); done();
        for (const fn of deferred) fn();
      }
      return;
    }
    const revealAt = s.reduced ? 1.7 : 4.8;
    if (t < revealAt) {
      s.stage = t < 1.4 ? 'intro' : 'transform';
      const p = clamp((t - 1.4) / (revealAt - 1.4));
      // Alternating silhouettes only; no full-screen flashing or imported VFX.
      const phase = p * 2 + p * p * 4;
      const isNew = !s.reduced && Math.floor(phase * 2) % 2 === 1;
      s.old.style.opacity = isNew ? '0' : '1'; s.next.style.opacity = isNew ? '1' : '0';
      const white = smooth((t - 1) / .6);
      const pulse = s.reduced ? 1 : .78 + .22 * Math.cos(phase * Math.PI * 2);
      const filter = `brightness(${1 - white}) invert(${white}) opacity(${1 - white + white * pulse})`;
      s.old.style.filter = s.next.style.filter = filter;
    } else {
      if (s.stage !== 'reveal' && s.stage !== 'result') {
        if (!reveal(s)) return;
        s.stage = 'reveal';
      }
      s.old.style.opacity = '0'; s.next.style.opacity = '1';
      s.next.style.filter = `brightness(${smooth((t - revealAt) / .7)}) invert(${1 - smooth((t - revealAt) / .7)})`;
      if (t >= revealAt + .85 && s.stage !== 'result') {
        s.stage = 'result'; el.classList.add('fc-finished');
        el.querySelector('.fc-results').hidden = false;
        const button = el.querySelector('.fc-continue'); button.hidden = false; button.focus();
      }
    }
    el.dataset.stage = s.stage;
  }
  return { start, update, cancel, continue: advance, after(fn) { if (scene) scene.deferred.push(fn); },
    get active() { return !!scene; }, get stage() { return scene?.stage || null; } };
})();
