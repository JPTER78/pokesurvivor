/* Runtime transformations. Collection identity and run progress belong to Player,
 * never to the form definition. No Player construction or save writes here.
 */
G.Forms = (() => {
  const BY = Object.fromEntries(G.FORM_DEFS.map(f => [f.id, f]));
  const get = id => Object.prototype.hasOwnProperty.call(BY, id) ? BY[id] : null;
  const rewardFormsForDex = dex => G.FORM_DEFS.filter(f => f.baseDex === dex && f.stone && ['mega', 'fusion'].includes(f.category));
  const rewardForDex = dex => rewardFormsForDex(dex)[0] || null;
  const rewardFormsFor = p => p ? rewardFormsForDex(p.mon.dex) : [];
  const canClaimReward = p => !!(p && rewardFormsFor(p).length && !p.megaStone && !['mega', 'fusion'].includes(p.transformation?.kind));

  function withNature(base, id, prestige = 0) {
    const mon = Object.assign({}, base, { types: base.types.slice(), nature: id });
    const n = G.NATURE_BY[id];
    if (n && n.up) mon[n.up] *= 1.1;
    if (n && n.down) mon[n.down] *= 0.9;
    G.Mons.applyPrestige(mon, prestige);
    mon.atk = Math.max(mon.pa, mon.sa);
    return mon;
  }

  function transform(p, id, options = {}) {
    if (!p || !p.mon) return false;
    if (p.formId === id) return true;
    const f = get(id);
    const base = !f && G.DEX.find(m => String(m.dex) === String(id) || m.name.toLowerCase() === id);
    const reverting = p._originalForm && id === p._originalForm.id;
    if (!reverting && !f && !base) return false;
    if (f && f.baseDex !== p.mon.dex) return false;
    const raw = reverting ? null : f ? Object.assign({}, G.DEX_BY[f.baseDex], f.stats, { name: f.name, types: f.types }) : base;
    const key = reverting ? p._originalForm.spriteKey : f ? f.sprite.key : base.dex;
    if (!G.SPRITE_META[key]) return false;
    // Build and validate before touching the player. Keep the run's original nature.
    const mon = reverting ? Object.assign({}, p._originalForm.mon) : withNature(raw, p.nature || p.mon.nature, p.prestige);
    if (![mon.hp, mon.atk, mon.spd, mon.pa, mon.sa, mon.df, mon.sd].every(v => Number.isFinite(v) && v > 0)) return false;
    const ability = reverting ? p._originalForm.ability : f && f.ability !== undefined ? f.ability : p.abilId;
    const ratio = G.U.clamp(p.hp / p.maxHp, 0, 1), dir = p.anim.dir;
    p.clearAbility();
    if (!p._originalForm) p._originalForm = {
      id: p.formId, mon: Object.assign({}, p.mon), spriteKey: p.spriteKey, ability: p.abilId, skin: p.anim.skin
    };
    // Add only the base-stat difference: purchased HP, cards and active powers survive.
    p.maxHp += mon.hp - p.mon.hp;
    p.baseAtk += mon.atk - p.mon.atk;
    p.baseSpd += mon.spd - p.mon.spd;
    p.mon = mon;
    p.formId = id; p.spriteKey = key;
    p.scale = G.Sprites.playerScale(key);
    p.r = G.Sprites.playerRadius(key);
    p.bodyH = G.Sprites.bodyHeight(key, p.scale);
    p.anim = new G.Sprites.Animator(key, p.scale, p.shiny);
    p.anim.dir = dir;
    p.anim.skin = reverting ? p._originalForm.skin : null;
    if (p.dead) p.anim.play('Faint', { hold: true });
    p.setAbility(ability);
    p.hp = Math.min(p.maxHp, p.maxHp * ratio);
    p.transformation = reverting ? null : { kind: f ? f.category : 'evolution', source: options.source || null,
      originalForm: p._originalForm.id, targetForm: id };
    G.Sprites.preload([key], 8000, p.shiny);
    if (!options.silent) {
      G.FX.ring(p.x, p.y, 8, 100, '#ff5473', 0.8, 5);
      G.FX.burst(p.x, p.y - p.bodyH / 2, '#ffdfef', 28, 150);
      G.FX.dmgText(p.x, p.y - p.bodyH - 14, mon.name, '#ff8aa2', true);
    }
    return true;
  }

  // Reserve the reward until its screen is acknowledged; no stats change yet.
  function queueReward(p) {
    if (!canClaimReward(p) || p.pendingMegaForm) return false;
    // Legacy field names remain stable in Player/co-op. This ID reserves the
    // reward item; it does not select a form when that item has several choices.
    p.pendingMegaForm = rewardFormsFor(p)[0].id;
    return true;
  }
  function claimReward(p, id) {
    const pending = p && get(p.pendingMegaForm), choices = rewardFormsFor(p);
    if (!pending || !choices.includes(pending)) return false;
    const f = get(id || (choices.length === 1 ? pending.id : ''));
    return !!f && choices.includes(f) && f.stone === pending.stone && awardReward(p, f.id);
  }

  function awardReward(p, id) {
    if (!canClaimReward(p)) return false;
    const choices = rewardFormsFor(p), f = get(id || (choices.length === 1 ? choices[0].id : ''));
    if (!f || !choices.includes(f)) return false;
    if (!transform(p, f.id, { source: f.stone })) return false;
    p.megaStone = f.stone;
    p.pendingMegaForm = null;
    G.Spawner.say(G.T(f.category === 'mega' ? '¡Mega Evolución!' : '¡Fusión completada!') + ' ' + G.T(p.mon.name), 3.4, true);
    return true;
  }

  function preload(p) {
    const forms = rewardFormsFor(p);
    if (forms.length) return G.Sprites.preload(forms.map(f => f.sprite.key), 8000, p.shiny);
    return Promise.resolve();
  }

  // Each peer owns its form; validate identifiers against trusted definitions.
  function applyRemote(p, state) {
    const f = get(state.form);
    if (!p.transformation) {
      if ((!p.nature || p.prestige !== (state.prestige || 0)) && G.NATURE_BY[state.nature]) {
        p.prestige = state.prestige || 0;
        p.nature = state.nature;
        p.mon = withNature(G.DEX_BY[p.baseSpecies], p.nature, p.prestige);
        p.baseAtk = p.mon.atk; p.baseSpd = p.mon.spd;
      }
      const allowed = G.DEX_ABIL[p.baseSpecies] || [];
      if (allowed.includes(state.ability) && p.abilId !== state.ability) p.setAbility(state.ability);
    }
    if (f && f.baseDex === p.baseSpecies) {
      transform(p, f.id, { silent: true, source: f.stone });
      p.megaStone = state.stone === f.stone ? f.stone : null;
    } else if (state.form === p._originalForm?.id) {
      revert(p); p.megaStone = null;
    }
  }
  function revert(p) { return !!p._originalForm && transform(p, p._originalForm.id, { silent: true }); }
  const megaForDex = dex => rewardFormsForDex(dex).find(f => f.category === 'mega') || null;
  const api = { get, transform, revert, preload, awardReward, queueReward, claimReward, applyRemote,
    rewardForDex, rewardFormsForDex, rewardFormsFor, canClaimReward,
    // Compatibility for existing debug scripts and Mega-only callers.
    awardMega: awardReward, queueMega: queueReward, claimMega: claimReward,
    megaFormFor: p => p && megaForDex(p.mon.dex), canMegaEvolve: p => !!(p && megaForDex(p.mon.dex) && canClaimReward(p)),
    hasMegaForm: dex => !!megaForDex(dex), megaForDex };
  if (G.Dev && G.Dev.enabled) api.debugMegaEvolve = id => awardReward(G.Game.player, id);
  return api;
})();
