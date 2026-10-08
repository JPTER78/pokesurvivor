/* ============ coop.js — partida cooperativa (hasta 4 jugadores) ============
 *
 * Quién manda en qué:
 *   ANFITRIÓN   enemigos (aparición, IA, vida, muerte), objetos del suelo,
 *               experiencia y nivel del equipo, reloj, fin de la partida.
 *   CADA UNO    su propio Pokémon: posición, vida, ataques y lo que le golpea.
 *               Sus golpes a enemigos se mandan al anfitrión, que los aplica.
 *
 * Los invitados ven COPIAS de los enemigos del anfitrión (enemy.remote) y los
 * ataques de los compañeros como "fantasmas" que no hacen daño (ver combat.js).
 *
 * Mensajes (por net.js, unas 15 veces por segundo; 5 si va por el relé):
 *   invitado -> anfitrión  { k:'f', p:[estado], ev:[eventos] }
 *   anfitrión -> invitado  { k:'f', t, lv, xp, xn, ki, bo, co, p:{uid:[estado]},
 *                            e:[[id,x,y,vida,anim,dir,estados]], ev:[eventos] }
 *   anfitrión -> todos     { k:'start', seed, host, members:[{uid,name,dex,shiny}] }
 */
G.Coop = (() => {
  const ANIMS = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint'];
  const COLORS = ['#ffcb3d', '#5fc8ff', '#7ee07a', '#ff8ad8'];
  const RATE_FAST = 1 / 15, RATE_SLOW = 1 / 5;
  const NEAR = 950;                     // radio de enemigos que se mandan a cada uno

  let active = false, host = false, me = null, hostUid = null;
  let local = null;                     // tu Player
  const mates = new Map();              // uid -> { uid, name, color, pl, connected, q:[], flushT, xpMul }
  let outEv = [];                       // invitado: eventos para el anfitrión
  let flushT = 0;
  let hitFrom = null;                   // invitado cuyo golpe se está aplicando (no repetirle el número)
  let api = {};                         // callbacks del juego (game.js)
  let waiting = new Set();              // subida de nivel: quién falta por elegir
  let members = [];

  // ---------------- escalado de dificultad ----------------

  const scaleRate = n => 1 + 0.75 * Math.max(0, n - 1);
  const scaleHp = n => 1 + 0.3 * Math.max(0, n - 1);

  // ---------------- arranque / fin ----------------

  /**
   * @param cfg   { seed, host, members }
   * @param pl    tu Player (ya creado)
   * @param cb    { levelStart(lv), resume(), waiting(names), over(data), lost(msg), team(t), shiny(dex) }
   */
  function begin(cfg, pl, cb) {
    active = true;
    me = G.Net.uid; hostUid = cfg.host;
    host = me === hostUid;
    local = pl;
    api = cb;
    members = cfg.members;
    mates.clear();
    outEv = []; flushT = 0; waiting = new Set();
    cfg.members.forEach((m, i) => {
      const x = (i - (cfg.members.length - 1) / 2) * 34, y = 0;
      if (m.uid === me) { pl.x = x; pl.y = y; pl.uid = me; pl.coopHost = host; pl.tagColor = COLORS[i]; return; }
      const mon = G.DEX_BY[m.dex] || G.DEX_BY[25];
      const p = new G.Player(mon, {}, !!m.shiny);
      p.remote = true; p.uid = m.uid; p.tag = m.name; p.tagColor = COLORS[i]; p.revLabel = 'Quédate a su lado';
      p.x = x; p.y = y;
      p.net = { x, y, ang: Math.PI / 2, walk: 0, hp: p.maxHp, maxHp: p.maxHp, dead: 0, mv: G.startMoveOf(mon.dex), ml: 1, mag: 78, aim: Math.PI / 2, rev: 0 };
      G.Sprites.preload([mon.dex], 8000, p.shiny);
      mates.set(m.uid, { uid: m.uid, name: m.name, color: COLORS[i], pl: p, connected: true, q: [], flushT: 0, xpMul: 1 });
    });
  }

  function end() {
    active = false; host = false; local = null;
    mates.clear(); outEv = []; waiting = new Set();
  }

  /** Te vas de la partida (los demás siguen). */
  function leave() {
    if (!active) return;
    if (host) {
      // Si se va el anfitrión, la partida termina para todos.
      emit(['ov', Object.assign(api.summary ? api.summary() : {}, { why: 'host' })]);
      flushAll();
    } else {
      outEv.push(['bye']);
      flushClient(true);
    }
    end();
  }

  // ---------------- lista de jugadores ----------------

  function players() {
    const out = [local];
    for (const m of mates.values()) if (m.connected) out.push(m.pl);
    return out;
  }
  function puppets() { const out = []; for (const m of mates.values()) if (m.connected) out.push(m.pl); return out; }

  /**
   * Multiplicador de la experiencia del equipo: la media de los bonus de
   * cada uno, y repartida entre los que sois (en grupo cae mucho más, y si no
   * se subiría de nivel el triple de rápido que en solitario).
   */
  function xpFactor() {
    let s = local.xpMul, n = 1;
    for (const m of mates.values()) if (m.connected) { s += m.xpMul || 1; n++; }
    return (s / n) / local.xpMul / (1 + 0.6 * (n - 1));
  }

  // ---------------- estado de un jugador ----------------

  const r1 = v => Math.round(v), r2 = v => Math.round(v * 100) / 100;

  function myState() {
    const m = local.activeMove();
    return [r1(local.x), r1(local.y), r2(local.moveAngle), local.walking ? 1 : 0, r1(local.hp), r1(local.maxHp),
            local.dead ? 1 : 0, m ? m.id : '', m ? m.lvl : 1, r1(local.magnet), r2(local.aim), r2(local.xpMul),
            r2(local.reviveT || 0)];
  }

  function readState(a) {
    return { x: a[0], y: a[1], ang: a[2], walk: a[3], hp: a[4], maxHp: a[5], dead: a[6], mv: a[7], ml: a[8],
             mag: a[9], aim: a[10], xpMul: a[11], rev: a[12] };
  }

  // ---------------- envío ----------------

  /** Anfitrión: evento para todos los invitados (menos `except`). */
  function emit(ev, except) {
    if (!host) return;
    for (const m of mates.values()) if (m.connected && m.uid !== except) m.q.push(ev);
  }

  /** Anfitrión: evento sólo para los que están cerca (números de daño). */
  function emitNear(ev, x, y, except) {
    for (const m of mates.values()) {
      if (!m.connected || m.uid === except) continue;
      if (G.U.dist2(m.pl.x, m.pl.y, x, y) > 700 * 700) continue;
      if (m.q.length > 400) continue;
      m.q.push(ev);
    }
  }

  function enemyList(near) {
    const out = [];
    const r2n = NEAR * NEAR;
    for (const e of G.EnemyMgr.all()) {
      if (e.dead || G.U.dist2(e.x, e.y, near.x, near.y) > r2n) continue;
      const a = ANIMS.indexOf(e.anim.cur);
      out.push([e.id, r1(e.x), r1(e.y), Math.ceil(e.hp), a < 0 ? 0 : a, e.anim.dir,
                (e.burn > 0 ? 1 : 0) | (e.poison > 0 ? 2 : 0) | (e.shield > 0 ? 4 : 0)]);
    }
    return out;
  }

  function hostFrame(m) {
    const st = api.team();
    const p = { [me]: myState() };
    for (const o of mates.values()) {
      if (o.connected && o.uid !== m.uid && o.state) p[o.uid] = o.state;
    }
    const ev = m.q; m.q = [];
    return { k: 'f', t: r2(st.time), lv: st.level, xp: r2(st.xp), xn: st.xpNext, ki: st.kills, bo: st.bosses, co: st.coins, tk: [st.t1, st.t10],
             p, e: enemyList(m.pl), ev };
  }

  function flushAll() { for (const m of mates.values()) if (m.connected) G.Net.send(m.uid, hostFrame(m)); }

  function flushClient(force) {
    if (!force && !outEv.length && flushT > 0) return;
    G.Net.toHost({ k: 'f', p: myState(), ev: outEv });
    outEv = [];
  }

  /** Cada fotograma (también en la pantalla de subida de nivel). */
  function tick(dt) {
    if (!active) return;
    if (host) {
      for (const m of mates.values()) {
        if (!m.connected) continue;
        m.flushT -= dt;
        if (m.flushT > 0) continue;
        m.flushT = G.Net.slow(m.uid) ? RATE_SLOW : RATE_FAST;
        G.Net.send(m.uid, hostFrame(m));
      }
    } else {
      flushT -= dt;
      if (flushT <= 0) {
        flushT = G.Net.slow(hostUid) ? RATE_SLOW : RATE_FAST;
        G.Net.toHost({ k: 'f', p: myState(), ev: outEv });
        outEv = [];
      }
    }
  }

  // ---------------- recepción ----------------

  G.Net.on((from, msg) => {
    if (!msg) return;
    if (msg.k === 'start') { if (G.Flow.startCoop) G.Flow.startCoop(msg); return; }
    if (!active || msg.k !== 'f') return;
    if (host) onClientFrame(from, msg); else if (from === hostUid) onHostFrame(msg);
  });

  G.Net.onPeer((u, mode) => {
    if (!active || mode !== 'closed') return;
    if (host) mateGone(u);
    else if (u === hostUid) { const cb = api.lost; end(); if (cb) cb('Se ha perdido la conexión con el anfitrión.'); }
  });

  function mateGone(u) {
    const m = mates.get(u);
    if (!m || !m.connected) return;
    m.connected = false;
    G.Projectiles.clearOrbs(m.pl);
    G.Spawner.say(m.name + ' ha dejado la partida', 2.6);
    if (waiting.has(u)) picked(u);
    if (api.mateLeft) api.mateLeft(m);
  }

  // --- en el anfitrión ---

  function onClientFrame(from, msg) {
    const m = mates.get(from);
    if (!m || !m.connected) return;
    if (msg.p) { m.state = msg.p; m.pl.net = readState(msg.p); m.xpMul = m.pl.net.xpMul || 1; }
    for (const ev of msg.ev || []) {
      switch (ev[0]) {
        case 'h': {
          const e = G.EnemyMgr.get(ev[1]);
          if (!e || e.dead || e.remote) break;
          hitFrom = from;
          e.hurt(ev[2], ev[3], ev[4], ev[5], ev[6]);
          hitFrom = null;
          break;
        }
        case 's': {
          const e = G.EnemyMgr.get(ev[1]);
          if (!e || e.dead) break;
          if (ev[2] === 'b') e.applyBurn(ev[3]);
          else if (ev[2] === 'p') e.applyPoison(ev[3]);
          else if (ev[2] === 's') e.applySlow(ev[3]);
          break;
        }
        case 'c':
          G.Combat.ghostCast(m.pl, ev[1], ev[2], ev[3], ev[4]);
          emit(['c', from, ev[1], ev[2], ev[3], ev[4]], from);
          break;
        case 'pb':
          G.World.breakAt(ev[1], ev[2]);
          emit(['pb', ev[1], ev[2]], from);
          break;
        case 'lp': picked(from); break;
        case 're': G.Rift.enterRequest(); break;
        case 'bye': mateGone(from); break;
      }
    }
  }

  // --- en el invitado ---

  function onHostFrame(msg) {
    for (const ev of msg.ev || []) applyHostEvent(ev);
    api.syncTeam({ time: msg.t, level: msg.lv, xp: msg.xp, xpNext: msg.xn, kills: msg.ki, bosses: msg.bo, coins: msg.co,
                   t1: (msg.tk || [])[0], t10: (msg.tk || [])[1] });
    for (const u in msg.p || {}) {
      const m = mates.get(u);
      if (m) m.pl.net = readState(msg.p[u]);
    }
    const now = performance.now();
    for (const a of msg.e || []) {
      const e = G.EnemyMgr.get(a[0]);
      if (!e || !e.remote || e.dead) continue;
      const n = e.net;
      const dts = (now - (n.last || now)) / 1000;
      if (dts > 0.02 && dts < 1) {
        n.vx = G.U.clamp((a[1] - n.x) / dts, -600, 600);
        n.vy = G.U.clamp((a[2] - n.y) / dts, -600, 600);
      } else { n.vx = 0; n.vy = 0; }
      n.x = a[1]; n.y = a[2]; n.age = 0; n.last = now;
      e.hp = Math.min(e.maxHp, a[3]);
      n.anim = a[4]; n.dir = a[5]; n.st = a[6];
    }
  }

  function applyHostEvent(ev) {
    switch (ev[0]) {
      case 'ne':
        G.EnemyMgr.addRemote({ id: ev[1], dex: ev[2], x: ev[3], y: ev[4], boss: !!ev[5], shiny: !!ev[6], hp: ev[7], dmg: ev[8] });
        break;
      case 'ed': G.EnemyMgr.removeRemote(ev[1], true); break;
      case 'eg': G.EnemyMgr.removeRemote(ev[1], false); break;
      case 'hn': { const e = G.EnemyMgr.get(ev[1]); if (e && !e.dead) e.showHurt(ev[2], ev[3]); break; }
      case 'es':
        G.Projectiles.spawn({ x: ev[1], y: ev[2], vx: ev[3], vy: ev[4], dmg: ev[5], r: ev[6], life: ev[7],
                              friendly: false, color: '#ff7a9e', vis: G.VFX.forType(ev[8]), mtype: ev[8] });
        break;
      case 'c': { const m = mates.get(ev[1]); if (m) G.Combat.ghostCast(m.pl, ev[2], ev[3], ev[4], ev[5]); break; }
      case 'item': api.item(ev[1]); break;
      case 'pk': G.Pickups.addRemote(ev[1], ev[2], ev[3], ev[4], ev[5]); break;
      case 'pc': G.Pickups.removeId(ev[1]); break;
      case 'mag': G.Pickups.pullAll(); G.FX.ring(local.x, local.y, 10, 420, '#ff9ed8', 0.6, 4); break;
      case 'bomb':
        G.FX.ring(ev[1], ev[2], 20, G.Camera.outerRadius(), '#ff7b3d', 0.5, 6);
        if (G.U.dist2(ev[1], ev[2], local.x, local.y) < 500 * 500) G.Camera.kick(0.8);
        G.Audio.sfx('break');
        break;
      case 'pb': G.World.breakAt(ev[1], ev[2]); break;
      case 'say': G.Spawner.say(ev[1], ev[2]); break;
      case 'heal': if (!local.dead) { local.heal(local.maxHp * ev[1]); G.FX.ring(local.x, local.y, 6, 60, '#5fe08a', 0.4, 3); } break;
      case 'lu': api.levelStart(ev[1]); break;
      case 'lw': api.waiting(ev[1]); break;
      case 'lr': api.resume(); break;
      case 'sh': api.shiny(ev[1]); break;
      case 'ov': { const cb = api.over; const d = ev[1]; end(); cb(d); break; }
      case 'rift': case 'riftx': case 'arena': case 'aw': case 'al': G.Rift.onEvent(ev); break;
      case 'wx': G.Weather.onEvent(ev); break;
      case 'hz': G.Hazards.add(ev[1], true); break;
      case 'fxr': G.FX.ring(ev[1], ev[2], 8, ev[3], ev[4], 0.5, 3); break;
    }
  }

  // ---------------- ganchos que llaman los módulos del juego ----------------

  /** Tu ataque: los demás lo repiten como fantasma. */
  function cast(pl, m) {
    if (!active || pl !== local) return;
    if (host) emit(['c', me, m.id, m.lvl, r2(pl.aim), m.evolved ? 1 : 0]);
    else outEv.push(['c', m.id, m.lvl, r2(pl.aim), m.evolved ? 1 : 0]);
  }

  // invitado
  function hit(e, d, color, dx, dy, knock) { outEv.push(['h', e.id, d, color, r1(dx), r1(dy), knock || 0]); }
  function status(e, kind, val) { outEv.push(['s', e.id, kind, val]); }

  // anfitrión
  function hurtShown(e, d, color) { emitNear(['hn', e.id, d, color], e.x, e.y, hitFrom); }
  function enemyAdded(e) {
    emit(['ne', e.id, e.dex, r1(e.x), r1(e.y), e.boss ? 1 : 0, e.shiny ? 1 : 0, Math.ceil(e.maxHp), r2(e.dmg)]);
  }
  function enemyGone(e, died) { emit([died ? 'ed' : 'eg', e.id]); }
  function enemyShot(p, type) { emit(['es', r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), r2(p.dmg), p.r, p.life, type]); }
  function pickupAdded(o) { emit(['pk', o.id, o.kind, r1(o.x), r1(o.y), o.value]); }
  function pickupGone(id) { emit(['pc', id]); }
  function say(text, secs) { emit(['say', text, secs]); }

  function propBroken(p) {
    if (host) emit(['pb', p.tx, p.ty]);
    else outEv.push(['pb', p.tx, p.ty]);
  }

  /** Anfitrión: alguien ha cogido un objeto. Devuelve true si es para ti. */
  function collected(p, who) {
    emit(['pc', p.id]);
    if (p.kind === 'magnet') emit(['mag']);
    if (p.kind === 'bomb') emit(['bomb', r1(who.x), r1(who.y)]);
    if ((p.kind === 'heal' || p.kind === 'item') && who !== local) {
      const m = mates.get(who.uid);
      if (m) m.q.push(p.kind === 'heal' ? ['heal', 0.3] : ['item', p.value]);
    }
  }

  function shinyCaught(e) { emit(['sh', e.dex]); }

  // ---------------- subida de nivel compartida ----------------

  function levelStart(level) {
    waiting = new Set([me]);
    for (const m of mates.values()) if (m.connected) waiting.add(m.uid);
    emit(['lu', level]);
    flushAll();
    api.levelStart(level);
    sendWaiting();
  }

  function nameOf(u) { return u === me ? (G.Social.me ? G.Social.me.name : 'Tú') : (mates.get(u) || {}).name || '?'; }

  function sendWaiting() {
    const names = [...waiting].map(nameOf);
    emit(['lw', names]);
    api.waiting(names);
  }

  /** Alguien ha elegido carta (anfitrión). */
  function picked(u) {
    if (!waiting.delete(u)) return;
    if (waiting.size) { sendWaiting(); return; }
    emit(['lr']);
    flushAll();
    api.resume();
  }

  /** Has elegido tu carta. */
  function localPicked() {
    if (host) picked(me);
    else { outEv.push(['lp']); flushClient(true); }
  }

  /** Anfitrión: se acabó para todos. */
  function over(data) {
    emit(['ov', data]);
    flushAll();
    end();
  }

  return {
    ANIMS, COLORS, begin, end, leave, tick, players, puppets, xpFactor, scaleRate, scaleHp,
    cast, hit, status, hurtShown, enemyAdded, enemyGone, enemyShot, pickupAdded, pickupGone, say,
    propBroken, collected, shinyCaught, levelStart, localPicked, over,
    /** Anfitrión: evento para todos. Invitado: evento para el anfitrión. */
    broadcast(ev) { emit(ev); },
    toHost(ev) { if (active && !host) { outEv.push(ev); flushClient(true); } },
    mate(u) { return mates.get(u); },
    get mates() { return [...mates.values()]; },
    get members() { return members; },
    get active() { return active; },
    get isHost() { return active && host; },
    get local() { return local; }
  };
})();
