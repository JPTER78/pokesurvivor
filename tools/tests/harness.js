/* ============ harness.js — banco de pruebas del cooperativo (sin navegador) ============
 *
 * Carga los scripts REALES (systems/hold.js, net/coop.js, game.js) en un
 * contexto `vm` por "ordenador", con un G de mentira: lo que no importa para
 * la pausa es un Proxy que acepta cualquier cosa (`any`), y lo que sí importa
 * (pantallas, cartas, menús, jugador, objetos, red) son falsos pequeños que
 * imitan al de verdad. En especial G.UI.show() oculta las demás pantallas,
 * como ui.js: de ahí venía el fallo del 12-10-2026.
 *
 * Los ordenadores se hablan por un G.Net en memoria con latencia, desorden
 * (jitter) y pérdida configurables, y el bucle real (game.js frame) se avanza
 * a mano con un reloj compartido.
 *
 * Uso: node --test "tools/tests/*.test.js"
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const NEW_FILES = ['js/systems/hold.js', 'js/net/coop.js', 'js/game.js'];
// Lo último publicado antes del arreglo (para probar mezclas de versiones).
const OLD_REV = 'a53d4e9';
const OLD_FILES = ['js/net/coop.js@' + OLD_REV, 'js/game.js@' + OLD_REV];

/** Cualquier cosa: se puede llamar, construir, leer y escribir; vale 0 al operar. */
const any = new Proxy(function () {}, {
  get(t, k) {
    if (k === Symbol.toPrimitive) return () => 0;
    if (k === Symbol.iterator) return function* () {};
    if (k === 'then') return undefined;
    return any;
  },
  apply() { return any; },
  construct() { return any; },
  set() { return true; }
});

const cache = new Map();
function source(f) {
  if (cache.has(f)) return cache.get(f);
  const [file, rev] = f.split('@');
  const txt = rev
    ? execFileSync('git', ['show', rev + ':' + file], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    : fs.readFileSync(path.join(ROOT, file), 'utf8');
  cache.set(f, txt);
  return txt;
}

/** ¿Está la versión vieja en git? (si no, las pruebas de mezcla se saltan) */
function hasOld() { try { OLD_FILES.forEach(source); return true; } catch (e) { return false; } }

// Las pantallas, sacadas de ui.js para que el falso no se quede atrás.
const SCREENS = (() => {
  const m = source('js/ui/ui.js').match(/const SCREENS = (\[[\s\S]*?\]);/);
  return vm.runInNewContext(m[1]);
})();

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- red en memoria ----------------

function makeBus(clock, opts) {
  const rnd = rng(opts.seed || 1);
  const q = [];
  let n = 0;
  const bus = {
    opts,                       // { latency (ms), jitter (ms), drop (0..1) } — se pueden cambiar en marcha
    machines: new Map(),
    cut: new Set(),             // 'a>b': no llega nada de a a b
    filter: null,               // (from, to, msg) => false para tirar ese mensaje
    bytes: {},                  // 'a>b' -> bytes enviados
    sent: [],                   // registro de mensajes (from, to, msg) para inspeccionar
    send(from, to, msg) {
      const key = from + '>' + to;
      const data = JSON.stringify(msg);
      bus.bytes[key] = (bus.bytes[key] || 0) + data.length;
      bus.sent.push({ from, to, msg: JSON.parse(data), at: clock.now });
      if (bus.cut.has(key)) return;
      if (bus.filter && bus.filter(from, to, msg) === false) return;
      if (opts.drop && rnd() < opts.drop) return;
      q.push({ t: clock.now + (opts.latency || 0) + rnd() * (opts.jitter || 0), n: n++, from, to, data });
    },
    deliver() {
      q.sort((a, b) => a.t - b.t || a.n - b.n);
      while (q.length && q[0].t <= clock.now) {
        const e = q.shift();
        const m = bus.machines.get(e.to);
        if (m && m.alive) m.recv(e.from, JSON.parse(e.data));
      }
    }
  };
  return bus;
}

// ---------------- falsos del juego ----------------

class FakePlayer {
  constructor(mon, perks, shiny) {
    Object.assign(this, {
      mon, dex: mon.dex, shiny: !!shiny, x: 0, y: 0, hp: 100, maxHp: 100, dead: false, item: null, bonds: 0,
      level: 1, xp: 0, xpNext: 10, kills: 0, bosses: 0, coins: 0, t1: 0, t10: 0, xpMul: 1, coinMul: 1, magnet: 78,
      moveAngle: 0, aim: 0, walking: false, reviveT: 0, moves: [], bind: {}, bodyH: 20, active: 0,
      slots: [['m1'], ['m2']], banned: new Set(), anim: { update() {} }, fusions: 0, cardsTaken: 0
    });
  }
  static get REVIVE_TIME() { return 5; }
  addMove() {} hasMove() { return false; } setActive(i) { this.active = i; } cycle() {}
  activeGroup() { return []; } update() {} netUpdate() {} draw() {} heal() {}
  revive() { this.dead = false; }
  equip(id) { this.item = id; }
  gainXp(v) { if (v <= 0) return 0; this.level++; return 1; }
  bondOptions() {
    const loose = this.slots.filter(s => s.length === 1).map(s => s[0]);
    return loose.length >= 2 ? { mode: 'pair', group: null, loose } : null;
  }
  fuse(moves) { this.fusions++; this.bonds = Math.max(0, this.bonds - 1); return moves; }
}

function fakeEl(id) {
  const cls = new Set();
  return {
    id, style: {}, textContent: '', innerHTML: '', clientWidth: 1280, clientHeight: 720, width: 0, height: 0, onclick: null,
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c),
      toggle: (c, on) => { on = on === undefined ? !cls.has(c) : !!on; if (on) cls.add(c); else cls.delete(c); return on; }
    },
    getContext: () => any, appendChild() {}, querySelectorAll: () => [], querySelector: () => null,
    addEventListener() {}, removeEventListener() {}, setAttribute() {}
  };
}

/**
 * Un ordenador con el juego cargado.
 * @param world  makeWorld()
 * @param o      { uid, name, files }
 */
function makeMachine(world, o) {
  const uid = o.uid;
  const errors = [];
  const els = new Map();
  const el = id => { if (!els.has(id)) els.set(id, fakeEl(id)); return els.get(id); };
  const docListeners = {};
  const document = {
    hidden: false, body: fakeEl('body'), getElementById: el, createElement: () => fakeEl(),
    querySelectorAll: () => [], addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); }
  };
  let raf = null;
  const keys = new Set();

  // --- pantallas (como ui.js: show() oculta las demás) ---
  const open = new Set();
  const UI = {
    $: el, show(id) { for (const s of SCREENS) if (s !== id) open.delete(s); open.add(id); },
    hide(id) { open.delete(id); }, hideAll() { open.clear(); }, isOpen: id => open.has(id),
    chrome() {}, toast() {}, tick() {}, soundControls() {}
  };

  // --- cartas, menús y pausa (como run-ui.js, pero se "pulsa" desde la prueba) ---
  const RunUI = {
    lvl: null, item: null, bond: null, waitingNames: [],
    showLevelUp(level, list, cb, coop = false) { RunUI.lvl = { level, list, cb, coop, done: false }; UI.show('scr-levelup'); },
    /** Toca una carta (sólo si se ven). */
    pick(i = 0) {
      const l = RunUI.lvl;
      if (!l || l.done || !UI.isOpen('scr-levelup')) return false;
      l.done = true;
      if (!l.coop) UI.hide('scr-levelup');
      l.cb(l.list[i]);
      return true;
    },
    reroll() {}, setWaiting(n) { RunUI.waitingNames = n; },
    closeLevelUp() { if (RunUI.lvl) RunUI.lvl.done = true; UI.hide('scr-levelup'); },
    showItemChoice(cur, next, cb) { RunUI.item = { cur, next, cb }; UI.show('scr-item'); },
    /** Toca "quedarme" (0) o "cambiar" (1), sólo si se ve. */
    chooseItem(i) {
      const it = RunUI.item;
      if (!it || !UI.isOpen('scr-item')) return false;
      UI.hide('scr-item');
      it.cb(i ? it.next : it.cur);
      return true;
    },
    showBond(opt, cb) { RunUI.bond = { opt, cb }; UI.show('scr-bond'); },
    pickBond() {
      const b = RunUI.bond;
      if (!b || !UI.isOpen('scr-bond')) return false;
      RunUI.bond = null;
      UI.hide('scr-bond');
      b.cb(b.opt.loose.slice(0, 2));
      return true;
    },
    bondBack() {}, showPause() { UI.show('scr-pause'); },
    wirePause(onResume, onQuit) { RunUI.onResume = onResume; RunUI.onQuit = onQuit; },
    showOver(r) { RunUI.over = r; UI.show('scr-over'); }
  };

  let announce = '', announceT = 0;
  const Spawner = {
    say(text, secs = 2.6) { announce = text; announceT = secs; },
    banner: () => (announceT > 0 ? { text: announce, t: announceT } : null),
    update() {}, tickBanner() {}, reset() {}
  };

  // Objetos que el anfitrión "recoge" en el siguiente fotograma.
  const pending = [];
  let pid = 0;
  const Pickups = {
    update(dt, players, cb) {
      for (const g of pending.splice(0)) {
        const who = g.uid === uid ? base.Game.player : base.Coop.mate(g.uid).pl;
        cb({ kind: g.kind, value: g.value, id: ++pid }, who);
      }
    },
    clear() {}, draw() {}, addRemote() {}, removeId() {}, pullAll() {}, count: 0
  };

  const netHandlers = [], peerHandlers = [];
  const Net = {
    uid, on: fn => netHandlers.push(fn), onPeer: fn => peerHandlers.push(fn), off() {},
    send: (to, msg) => world.bus.send(uid, to, msg),
    toHost: msg => world.bus.send(uid, world.hostUid, msg),
    slow: () => world.relay, viaTurn: () => world.turn, mode: () => 'direct'
  };

  const flags = [];
  const base = {
    LIFT: 18,
    U: {
      dist2: (a, b, c, d) => (c - a) ** 2 + (d - b) ** 2, clamp: (a, lo, hi) => Math.min(hi, Math.max(lo, a)),
      pick: a => a[0], rand: (a, b) => (a + b) / 2
    },
    UI, RunUI, Spawner, Pickups, Net,
    Rift: { inArena: false, arena: null, update() {}, reset() {}, drawable: () => null, onEvent() {}, enterRequest() {}, timeLeft: 0 },
    EnemyMgr: {
      all: () => [], update() {}, rebuildGrid() {}, bossAlive: () => false, get: () => null, clear() {},
      drawables: () => [], addRemote() {}, removeRemote() {}, clearRemote() {}
    },
    Settings: { get: () => false, sample() {}, fx: 1 },
    Guard: { flags, flag(f) { flags.push(f); }, start() {}, end: () => true, tick() {} },
    Input: { tap: k => keys.has(k), endFrame() { keys.clear(); } },
    SettingsUI: { isOpen: false },
    DB: {
      save: { partner: 25, partnerShiny: false, coins: 0, tickets: { t1: 0, t10: 0 },
              stats: { runs: 0, bestTime: 0, totalKills: 0, bestLevel: 0, coinsEarned: 0, shinies: 0 } },
      upgradesOf: () => ({}), commit() {}, ownsShiny: () => false, owns: () => true, grant() {}, grantShiny: () => false
    },
    Upgrades: { perks: () => ({ startMoves: 1, bans: 0 }) },
    DEX_BY: { 25: { dex: 25, name: 'Pikachu', types: ['electric'] }, 4: { dex: 4, name: 'Charmander', types: ['fire'] },
              7: { dex: 7, name: 'Squirtle', types: ['water'] }, 1: { dex: 1, name: 'Bulbasaur', types: ['grass'] } },
    Player: FakePlayer,
    LevelUp: { offer: () => [0, 1, 2].map(i => ({ i, apply(p) { p.cardsTaken++; } })) },
    Items: { BY: { a: { name: 'A' }, b: { name: 'B' }, c: { name: 'C' } }, roll: ex => ['a', 'b', 'c'].find(x => x !== ex) },
    Social: { me: { name: o.name }, setPlaying() {}, publishProfile() {}, room: null }
  };
  const G = new Proxy(base, {
    get: (t, k) => (k in t ? t[k] : any),
    set: (t, k, v) => { t[k] = v; return true; }
  });

  const ctx = {
    G, document, performance: { now: () => world.clock.now },
    requestAnimationFrame: fn => { raf = fn; }, addEventListener() {}, removeEventListener() {},
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, setTimeout: () => 0, clearTimeout() {},
    console: { log() {}, info() {}, warn() {}, error: (...a) => errors.push(a.map(x => (x && x.stack) || String(x)).join(' ')) }
  };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of o.files || NEW_FILES) vm.runInContext(source(f), ctx, { filename: f });
  base.Game.init();

  const m = {
    uid, name: o.name, G: base, ui: UI, run: RunUI, errors, flags, alive: true, frozen: false,
    get state() { return base.Game.state; },
    get pl() { return base.Game.player; },
    get time() { return base.Game.st.time; },
    get banner() { const b = Spawner.banner(); return b ? b.text : ''; },
    isOpen: id => UI.isOpen(id),
    recv(from, msg) {
      for (const fn of netHandlers) { try { fn(from, msg); } catch (e) { errors.push('[Net] ' + (e.stack || e)); } }
    },
    /** net.js avisa de que se ha perdido a `u` ('closed', o 'failed' sin conexión directa ni TURN). */
    peerClosed(u, mode = 'closed') { for (const fn of peerHandlers) fn(u, mode); },
    start(cfg) { base.Game.startRun(cfg || null); },
    frame() { if (raf) raf(world.clock.now); },
    key(k) { keys.add(k); },
    /** Anfitrión (o solitario): `toUid` recoge un objeto en el siguiente fotograma. */
    give(kind, value, toUid = uid) { pending.push({ kind, value, uid: toUid }); },
    /** Cambia de pestaña (deja de dibujar fotogramas, pero recibe mensajes). */
    hide() { document.hidden = true; (docListeners.visibilitychange || []).forEach(fn => fn()); m.frozen = true; },
    show() { document.hidden = false; (docListeners.visibilitychange || []).forEach(fn => fn()); m.frozen = false; },
    pickCard: i => RunUI.pick(i),
    chooseItem: i => RunUI.chooseItem(i),
    pickBond: () => RunUI.pickBond()
  };
  return m;
}

/**
 * @param o  { latency, jitter, drop, seed, turn }
 */
function makeWorld(o = {}) {
  const clock = { now: 1000 };
  const world = {
    clock, turn: o.turn !== undefined ? o.turn : true, relay: false, hostUid: null, machines: [],
    bus: null,
    add(m) { world.machines.push(m); world.bus.machines.set(m.uid, m); return m; },
    step(dt = 1 / 30) {
      clock.now += dt * 1000;
      world.bus.deliver();
      for (const m of world.machines) if (m.alive && !m.frozen) m.frame();
    },
    run(sec) { const n = Math.round(sec * 30); for (let i = 0; i < n; i++) world.step(); },
    /** Avanza hasta que se cumpla `pred` (o se acabe el tiempo). */
    until(pred, sec = 10) {
      const n = Math.round(sec * 30);
      for (let i = 0; i < n; i++) { if (pred()) return true; world.step(); }
      return pred();
    },
    /** Se corta la conexión con `u` (se cierra la pestaña): los demás reciben 'closed'. */
    disconnect(u, mode = 'closed') {
      const gone = world.machines.find(m => m.uid === u);
      gone.alive = false;
      for (const m of world.machines) if (m.alive) m.peerClosed(u, mode);
    },
    errors() { return world.machines.flatMap(m => m.errors.map(e => m.uid + ': ' + e)); }
  };
  world.bus = makeBus(clock, { latency: o.latency !== undefined ? o.latency : 40, jitter: o.jitter || 0, drop: o.drop || 0, seed: o.seed });
  return world;
}

const NAMES = { H: 'Host', A: 'Ana', B: 'Bea', C: 'Cris' };

/**
 * Partida en grupo ya empezada.
 * @param o  makeWorld() + { players: ['H','A',...], files: { H: [...], A: [...] } }
 */
function coopGame(o = {}) {
  const players = o.players || ['H', 'A'];
  const world = makeWorld(o);
  world.hostUid = players[0];
  const cfg = { seed: 7, host: players[0],
                members: players.map((u, i) => ({ uid: u, name: NAMES[u], dex: [25, 4, 7, 1][i], shiny: false })) };
  const ms = players.map(u => world.add(makeMachine(world, { uid: u, name: NAMES[u], files: (o.files || {})[u] })));
  ms.forEach(m => m.start(cfg));
  world.run(0.5);
  return { world, host: ms[0], guests: ms.slice(1), all: ms, by: Object.fromEntries(ms.map(m => [m.uid, m])) };
}

function soloGame() {
  const world = makeWorld();
  const m = world.add(makeMachine(world, { uid: 'S', name: 'Solo' }));
  m.start(null);
  world.run(0.2);
  return { world, m };
}

module.exports = { makeWorld, makeMachine, coopGame, soloGame, hasOld, NEW_FILES, OLD_FILES, OLD_REV, any, source };
