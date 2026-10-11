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
  // Mensajes por segundo: 15 directo, 7 por el TURN de Cloudflare (se paga por
  // GB) y 3 por el relé de la Realtime Database (1 $ el GB: sólo si todo lo demás falla).
  const RATE_FAST = 1 / 15, RATE_TURN = 1 / 7, RATE_SLOW = 1 / 3;
  const rateFor = u => (G.Net.slow(u) ? RATE_SLOW : G.Net.viaTurn(u) ? RATE_TURN : RATE_FAST);
  const SILENT = 3000, GRACE = 30000;
  let session = null, world = 0, tx = 0, rx = 0, evTx = 0, evRx = 0;
  let lastHost = 0, hostHiddenAt = 0, hiddenAt = 0, hostPaused = false;
  let netTimer = 0, round = 0, pauseShown = false;
  const now = () => performance.now();
  const hidden = () => typeof document !== 'undefined' && document.hidden;
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
    end();
    active = true;
    me = G.Net.uid; hostUid = cfg.host;
    host = me === hostUid;
    local = pl;
    api = cb;
    session = cfg.session;
    world = tx = rx = evTx = evRx = round = 0;
    lastHost = now(); hostHiddenAt = hiddenAt = 0; hostPaused = pauseShown = false;
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
      mates.set(m.uid, { uid: m.uid, name: m.name, color: COLORS[i], pl: p, connected: true, q: [], flushT: 0, xpMul: 1, tx: 0, rx: 0, evTx: 0, evRx: 0, heard: now(), hiddenAt: 0 });
    });
    // Independiente del render: también durante cartas y pestañas en segundo plano.
    netTimer = setInterval(tick, 250);
  }

  function end() {
    clearInterval(netTimer); netTimer = 0;
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
      queueClient(['bye']);
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
    // Con un vínculo se manda la órbita si la hay (es lo único que los demás no ven por los 'c').
    const g = local.activeGroup();
    const m = g.find(x => x.kind === 'orbit') || g[0];
    return [r1(local.x), r1(local.y), r2(local.moveAngle), local.walking ? 1 : 0, r1(local.hp), r1(local.maxHp),
            local.dead ? 1 : 0, m ? m.id : '', m ? m.lvl : 1, r1(local.magnet), r2(local.aim), r2(local.xpMul),
            r2(local.reviveT || 0)];
  }

  function readState(a) {
    return { x: a[0], y: a[1], ang: a[2], walk: a[3], hp: a[4], maxHp: a[5], dead: a[6], mv: a[7], ml: a[8],
             mag: a[9], aim: a[10], xpMul: a[11], rev: a[12] };
  }

  // ---------------- envío ----------------

  function queueClient(ev) { outEv.push([++evTx, world, ev]); }
  function queueMate(m, ev) { m.q.push([++m.evTx, world, ev]); }

  // Los eventos se conservan hasta recibir acuse. Un estado viejo puede contener
  // un evento pendiente: se procesa una sola vez, sin rebobinar la posición.
  function events(list, cursor, apply) {
    for (const [id, epoch, ev] of list || []) {
      if (id <= cursor) continue;
      if (id !== cursor + 1) break;
      apply(ev, epoch); cursor = id;
    }
    return cursor;
  }

  /** Anfitrión: evento para todos los invitados (menos `except`). */
  function emit(ev, except) {
    if (!host) return;
    for (const m of mates.values()) if (m.connected && m.uid !== except) queueMate(m, ev);
  }

  /** Anfitrión: evento sólo para los que están cerca (números de daño). */
  function emitNear(ev, x, y, except) {
    for (const m of mates.values()) {
      if (!m.connected || m.uid === except) continue;
      if (G.U.dist2(m.pl.x, m.pl.y, x, y) > 700 * 700) continue;
      if (m.q.length > 400) continue;
      queueMate(m, ev);
    }
  }

  function enemyList(near) {
    const out = [];
    const r2n = NEAR * NEAR;
    for (const e of G.EnemyMgr.all()) {
      if (e.dead || G.U.dist2(e.x, e.y, near.x, near.y) > r2n) continue;
      const a = ANIMS.indexOf(e.anim.cur);
      out.push([e.id, r1(e.x), r1(e.y), Math.ceil(e.hp), a < 0 ? 0 : a, e.anim.dir,
                (e.burn > 0 ? 1 : 0) | (e.poison > 0 ? 2 : 0) | (e.shield > 0 ? 4 : 0),
                e.dex, e.boss ? 1 : 0, e.shiny ? 1 : 0, Math.ceil(e.maxHp), r2(e.dmg), e.behavior]);
    }
    return out;
  }

  function hostFrame(m) {
    const st = api.team();
    const p = { [me]: myState() };
    for (const o of mates.values()) {
      if (o.connected && o.uid !== m.uid && o.state) p[o.uid] = o.state;
    }
    const ev = m.q.slice();
    return { k: 'f', session, seq: ++m.tx, world, ack: m.evRx, hidden: hidden(), paused: paused(), t: r2(st.time), lv: st.level, xp: r2(st.xp), xn: st.xpNext, ki: st.kills, bo: st.bosses, co: st.coins, tk: [st.t1, st.t10],
             p, e: enemyList(m.pl), ev };
  }

  function flushAll() { for (const m of mates.values()) if (m.connected) G.Net.send(m.uid, hostFrame(m)); }

  function flushClient(force) {
    if (!force && flushT > now()) return;
    G.Net.toHost({ k: 'f', session, seq: ++tx, world, ack: evRx, hidden: hidden(), p: myState(), ev: outEv.slice() });
    flushT = now() + rateFor(hostUid) * 1000;
  }

  function paused() {
    if (!active) return false;
    if (hidden()) return true;
    if (!host) return hostPaused || now() - lastHost > SILENT;
    for (const m of mates.values()) if (m.connected && (m.hiddenAt || now() - m.heard > SILENT)) return true;
    return false;
  }

  function lost(text) {
    const cb = api.lost;
    if (!host) { queueClient(['bye']); flushClient(true); }
    else { emit(['ov', Object.assign(api.summary ? api.summary() : {}, { why: 'host' })]); flushAll(); }
    end(); if (cb) cb(text);
  }

  /** Reloj real: la cadencia y la tolerancia no dependen de FPS ni cámara lenta. */
  function tick() {
    if (!active) return;
    const t = now();
    if (hidden()) { if (!hiddenAt) hiddenAt = t || 0.001; } else hiddenAt = 0;
    if (host) {
      if (hiddenAt && t - hiddenAt > GRACE) { lost('El anfitrión ha estado ausente demasiado tiempo.'); return; }
      for (const m of mates.values()) {
        if (!m.connected) continue;
        if (t - m.heard > GRACE || (m.hiddenAt && t - m.hiddenAt > GRACE)) {
          G.Net.send(m.uid, { k: 'left', session });
          mateGone(m.uid);
          if (G.Social.removeRoomMember) G.Social.removeRoomMember(m.uid);
        }
      }
      for (const m of mates.values()) {
        if (!m.connected || m.flushT > t) continue;
        m.flushT = t + rateFor(m.uid) * 1000;
        G.Net.send(m.uid, hostFrame(m));
      }
    } else {
      if (t - lastHost > GRACE || (hostHiddenAt && t - hostHiddenAt > GRACE)) {
        lost('No se pudo recuperar la conexión con el anfitrión.'); return;
      }
      flushClient(false);
    }
    const hold = paused();
    if (hold !== pauseShown) {
      pauseShown = hold;
      if (api.connection) api.connection(hold ? 'Partida pausada: esperando a tus compañeros…' : 'Conexión recuperada.');
    }
  }

  // ---------------- recepción ----------------

  G.Net.on((from, msg) => {
    if (!msg) return;
    if (msg.k === 'start') {
      if (msg.protocol === 2 && G.Social.room && from === G.Social.room.host && G.Flow.startCoop) G.Flow.startCoop(msg);
      return;
    }
    if (!active || msg.session !== session) return;
    if (msg.k === 'left' && !host && from === hostUid) { lost('Has dejado la partida tras perder la conexión.'); return; }
    if (msg.k !== 'f' || !Number.isSafeInteger(msg.seq) || msg.seq <= 0) return;
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
    if (host) emit(['gone', u], u);
    G.Projectiles.clearOrbs(m.pl);
    G.Spawner.say(m.name + ' ha dejado la partida', 2.6);
    if (waiting.has(u)) picked(u);
    if (api.mateLeft) api.mateLeft(m);
  }

  // --- en el anfitrión ---

  function onClientFrame(from, msg) {
    const m = mates.get(from);
    if (!m || !m.connected) return;
    if (msg.seq > m.rx) {
      m.heard = now(); m.rx = msg.seq;
      if (msg.hidden) { if (!m.hiddenAt) m.hiddenAt = now() || 0.001; } else m.hiddenAt = 0;
      if (msg.world === world && msg.p) { m.state = msg.p; m.pl.net = readState(msg.p); m.xpMul = m.pl.net.xpMul || 1; }
    }
    if (Number.isSafeInteger(msg.ack)) m.q = m.q.filter(e => e[0] > Math.min(msg.ack, m.evTx));
    m.evRx = events(msg.ev, m.evRx, (ev, epoch) => {
      if (epoch !== world && !['lp', 'bye'].includes(ev[0])) return;
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
        case 'lp': if (ev[1] === round) picked(from); break;
        case 're': G.Rift.enterRequest(); break;
        case 'bye': mateGone(from); break;
      }
    });
  }

  // --- en el invitado ---

  function onHostFrame(msg) {
    if (msg.seq > rx) lastHost = now();
    if (Number.isSafeInteger(msg.ack)) outEv = outEv.filter(e => e[0] > Math.min(msg.ack, evTx));
    evRx = events(msg.ev, evRx, (ev, epoch) => {
      if (ev[0] === 'arena' || ev[0] === 'arend') {
        if (epoch <= world) return;
        world = epoch; G.Rift.onEvent(ev);
      } else if (epoch === world || ['lu', 'lw', 'lr', 'ov', 'sh', 'heal', 'item', 'gone'].includes(ev[0])) applyHostEvent(ev);
    });
    if (!active || msg.seq <= rx) return;
    rx = msg.seq;
    hostPaused = !!msg.paused;
    if (msg.hidden) { if (!hostHiddenAt) hostHiddenAt = now() || 0.001; } else hostHiddenAt = 0;
    if (msg.world !== world) return;
    api.syncTeam({ time: msg.t, level: msg.lv, xp: msg.xp, xpNext: msg.xn, kills: msg.ki, bosses: msg.bo, coins: msg.co,
                   t1: (msg.tk || [])[0], t10: (msg.tk || [])[1] });
    for (const u in msg.p || {}) {
      const m = mates.get(u);
      if (m) m.pl.net = readState(msg.p[u]);
    }
    const receivedAt = now();
    for (const a of msg.e || []) {
      let e = G.EnemyMgr.get(a[0]);
      if (!e && a.length >= 13) e = G.EnemyMgr.addRemote({ id: a[0], dex: a[7], x: a[1], y: a[2], boss: !!a[8], shiny: !!a[9], hp: a[10], dmg: a[11], beh: a[12] });
      if (!e || !e.remote || e.dead) continue;
      const n = e.net;
      const dts = (receivedAt - (n.last || receivedAt)) / 1000;
      if (dts > 0.02 && dts < 1) {
        n.vx = G.U.clamp((a[1] - n.x) / dts, -600, 600);
        n.vy = G.U.clamp((a[2] - n.y) / dts, -600, 600);
      } else { n.vx = 0; n.vy = 0; }
      n.x = a[1]; n.y = a[2]; n.age = 0; n.last = receivedAt;
      e.hp = Math.min(e.maxHp, a[3]);
      n.anim = a[4]; n.dir = a[5]; n.st = a[6];
    }
  }

  function applyHostEvent(ev) {
    switch (ev[0]) {
      case 'ne':
        G.EnemyMgr.addRemote({ id: ev[1], dex: ev[2], x: ev[3], y: ev[4], boss: !!ev[5], shiny: !!ev[6], hp: ev[7], dmg: ev[8], beh: ev[9] });
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
      case 'gone': mateGone(ev[1]); break;
      case 'lu': round = ev[2]; api.levelStart(ev[1]); break;
      case 'lw': api.waiting(ev[1]); break;
      case 'lr': api.resume(); break;
      case 'sh': api.shiny(ev[1]); break;
      case 'ov': { const cb = api.over; const d = ev[1]; end(); cb(d); break; }
      case 'rift': case 'riftx': case 'arena': case 'aw': case 'al': G.Rift.onEvent(ev); break;
      case 'wx': G.Weather.onEvent(ev); break;
      case 'ev': G.Events.onNet(ev); break;
      case 'hz': G.Hazards.add(ev[1], true); break;
      case 'fxr': G.FX.ring(ev[1], ev[2], 8, ev[3], ev[4], 0.5, 3); break;
    }
  }

  // ---------------- ganchos que llaman los módulos del juego ----------------

  /** Tu ataque: los demás lo repiten como fantasma. */
  function cast(pl, m) {
    if (!active || pl !== local) return;
    if (host) emit(['c', me, m.id, m.lvl, r2(pl.aim), m.evolved ? 1 : 0]);
    else queueClient(['c', m.id, m.lvl, r2(pl.aim), m.evolved ? 1 : 0]);
  }

  // invitado
  function hit(e, d, color, dx, dy, knock) { queueClient(['h', e.id, d, color, r1(dx), r1(dy), knock || 0]); }
  function status(e, kind, val) { queueClient(['s', e.id, kind, val]); }

  // anfitrión
  function hurtShown(e, d, color) { emitNear(['hn', e.id, d, color], e.x, e.y, hitFrom); }
  function enemyAdded(e) {
    emit(['ne', e.id, e.dex, r1(e.x), r1(e.y), e.boss ? 1 : 0, e.shiny ? 1 : 0, Math.ceil(e.maxHp), r2(e.dmg), e.behavior]);
  }
  function enemyGone(e, died) { emit([died ? 'ed' : 'eg', e.id]); }
  function enemyShot(p, type) { emit(['es', r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), r2(p.dmg), p.r, p.life, type]); }
  function pickupAdded(o) { emit(['pk', o.id, o.kind, r1(o.x), r1(o.y), o.value]); }
  function pickupGone(id) { emit(['pc', id]); }
  function say(text, secs) { emit(['say', text, secs]); }

  function propBroken(p) {
    if (host) emit(['pb', p.tx, p.ty]);
    else queueClient(['pb', p.tx, p.ty]);
  }

  /** Anfitrión: alguien ha cogido un objeto. Devuelve true si es para ti. */
  function collected(p, who) {
    emit(['pc', p.id]);
    if (p.kind === 'magnet') emit(['mag']);
    if (p.kind === 'bomb') emit(['bomb', r1(who.x), r1(who.y)]);
    if ((p.kind === 'heal' || p.kind === 'item') && who !== local) {
      const m = mates.get(who.uid);
      if (m) queueMate(m, p.kind === 'heal' ? ['heal', 0.3] : ['item', p.value]);
    }
  }

  function shinyCaught(e) { emit(['sh', e.dex]); }

  // ---------------- subida de nivel compartida ----------------

  function levelStart(level) {
    waiting = new Set([me]);
    for (const m of mates.values()) if (m.connected) waiting.add(m.uid);
    emit(['lu', level, ++round]);
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
    else { queueClient(['lp', round]); flushClient(true); }
  }

  /** Anfitrión: se acabó para todos. */
  function over(data) {
    emit(['ov', data]);
    flushAll();
    end();
  }

  return {
    ANIMS, COLORS, begin, end, leave, tick, players, puppets, xpFactor, scaleRate, scaleHp,
    advanceWorld() { if (host) world++; },
    get paused() { return paused(); },
    cast, hit, status, hurtShown, enemyAdded, enemyGone, enemyShot, pickupAdded, pickupGone, say,
    propBroken, collected, shinyCaught, levelStart, localPicked, over,
    /** Anfitrión: evento para todos. Invitado: evento para el anfitrión. */
    broadcast(ev) { emit(ev); },
    toHost(ev) { if (active && !host) { queueClient(ev); flushClient(true); } },
    mate(u) { return mates.get(u); },
    get mates() { return [...mates.values()]; },
    get members() { return members; },
    get active() { return active; },
    get isHost() { return active && host; },
    get local() { return local; }
  };
})();
