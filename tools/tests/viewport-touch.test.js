// No dependencies: node --test tools/tests/*.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../..');
const plain = v => JSON.parse(JSON.stringify(v));
function target() {
  const events = {};
  return { addEventListener(k, fn) { (events[k] ||= []).push(fn); }, emit(k, e = {}) { (events[k] || []).forEach(fn => fn(e)); } };
}
function setup() {
  const win = target(), doc = target(), canvas = target(), root = { style: {}, appendChild() {} };
  const frames = new Map(), timers = new Map();
  let seq = 0, writes = 0, changes = 0, observer;
  const safe = { paddingTop: '0', paddingRight: '0', paddingBottom: '0', paddingLeft: '0' };
  let rect = null, bw = 300, bh = 150;
  Object.defineProperties(canvas, {
    width: { get: () => bw, set: v => { bw = v; writes++; } },
    height: { get: () => bh, set: v => { bh = v; writes++; } }
  });
  canvas.getBoundingClientRect = () => rect || { width: +parseFloat(root.style.width), height: +parseFloat(root.style.height), left: +parseFloat(root.style.left), top: +parseFloat(root.style.top) };
  canvas.setPointerCapture = () => {};
  Object.assign(doc, { hidden: false, documentElement: { clientWidth: 999, clientHeight: 999 },
    getElementById: () => root, createElement: () => ({ style: {} }), body: { classList: { add() {} } } });
  Object.assign(win, { innerWidth: 800, innerHeight: 400, devicePixelRatio: 3,
    visualViewport: Object.assign(target(), { width: 800, height: 400, scale: 1, offsetLeft: 0, offsetTop: 0 }) });
  const settings = { stick: 1, stickMode: 'float', pad: null };
  const G = { Settings: { touch: true, get: k => settings[k] }, Game: { state: 'playing' } };
  const sandbox = { G, window: win, document: doc, console, performance: { now: () => 1000 }, getComputedStyle: () => safe,
    addEventListener: win.addEventListener.bind(win),
    requestAnimationFrame: fn => { const id = ++seq; frames.set(id, fn); return id; },
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    ResizeObserver: class { constructor(fn) { observer = fn; } observe() {} } };
  vm.createContext(sandbox);
  const load = f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  for (const f of ['js/core/viewport.js', 'js/core/control-layout.js', 'js/core/touch.js', 'js/core/camera.js']) load(f);
  G.Viewport.init(canvas, m => { changes++; G.Camera.resize(m.width, m.height, m.dpr); });
  G.Touch.init(canvas);
  return { G, win, doc, canvas, safe, settings, root, load, sandbox, frames, timers,
    setRect: r => { rect = r; }, get writes() { return writes; }, get changes() { return changes; },
    observe: () => observer(), frame() { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); },
    delay(ms) { for (const [id, t] of [...timers]) if (t.ms === ms) { timers.delete(id); t.fn(); } this.frame(); } };
}

for (const [name, rect] of [
  ['same size', { left: 0, top: 0, width: 800, height: 400 }],
  ['horizontal scale', { left: 0, top: 0, width: 1600, height: 400 }],
  ['vertical scale', { left: 0, top: 0, width: 800, height: 200 }],
  ['offset and both scales', { left: 41, top: -12, width: 1200, height: 600 }]
]) test('input mapping: ' + name, () => {
  const { G } = setup();
  const p = G.Viewport.clientToLocal(rect.left + rect.width * 0.3, rect.top + rect.height * 0.7, rect, 800, 400);
  assert.deepEqual(plain(p), { x: 240, y: 280 });
});

test('DPR affects backing pixels only, with exact scales even for fractional CSS sizes', () => {
  const { G } = setup(), m = G.Viewport.resolution(801.25, 390.5, 3);
  assert.equal(m.dpr, 1.5);
  assert.equal(m.bw, 1202); assert.equal(m.bh, 586);
  assert.equal(m.scaleX * m.width, m.bw); assert.equal(m.scaleY * m.height, m.bh);
  assert.deepEqual(plain(G.Viewport.clientToLocal(400, 200, { left: 0, top: 0, width: 800, height: 400 }, 800, 400)), { x: 400, y: 200 });
});

test('visual viewport wins over stale layout sizes; fallback and pinch zoom preserve layout', () => {
  const { G, win, doc } = setup();
  win.visualViewport.width = 700;
  assert.equal(G.Viewport.area(win, doc.documentElement).width, 700);
  win.visualViewport.scale = 2;
  assert.equal(G.Viewport.area(win, doc.documentElement).width, 800);
  win.visualViewport = null; win.innerWidth = 0;
  assert.equal(G.Viewport.area(win, doc.documentElement).width, 999);
});

test('resize is idempotent; observer has no feedback loop or backing-store writes', () => {
  const t = setup(), writes = t.writes, changes = t.changes;
  assert.equal(t.G.Viewport.resize(), false);
  t.frame(); t.observe();
  assert.equal(t.frames.size, 0);
  assert.equal(t.writes, writes); assert.equal(t.changes, changes);
  t.setRect({ left: 0, top: 0, width: 790, height: 380 });
  t.observe(); assert.equal(t.writes, writes);
  t.frame(); assert.equal(t.G.Viewport.size.width, 790);
  t.observe(); assert.equal(t.frames.size, 0);
});

test('portrait -> landscape -> second late size after orientationchange', () => {
  const t = setup(), vv = t.win.visualViewport;
  Object.assign(vv, { width: 390, height: 844 });
  t.win.emit('resize'); t.frame(); assert.equal(t.G.Viewport.size.height, 844);
  Object.assign(vv, { width: 844, height: 390 });
  t.win.emit('orientationchange'); t.win.emit('resize'); t.frame();
  assert.equal(t.G.Viewport.size.width, 844);
  // WebKit settles again without another window resize.
  vv.height = 360; t.delay(120);
  assert.equal(t.G.Viewport.size.height, 360);
  vv.height = 370; t.delay(400);
  assert.equal(t.G.Viewport.size.height, 370);
  assert.equal(t.canvas.height, 555);
  assert.ok(Math.abs(t.G.Camera.w / t.G.Camera.h - 844 / 370) < 1e-12);
});

test('pageshow, return from background and visualViewport resize/scroll refresh geometry and safe area', () => {
  const t = setup(), vv = t.win.visualViewport;
  for (const [target, event] of [[t.win, 'pageshow'], [t.doc, 'visibilitychange'], [vv, 'resize'], [vv, 'scroll']]) {
    vv.height -= 10; vv.offsetTop += 2; t.safe.paddingRight = String(vv.offsetTop);
    target.emit(event); t.frame();
    assert.equal(t.G.Viewport.size.height, vv.height);
    assert.equal(t.G.Viewport.size.top, vv.offsetTop);
    assert.equal(t.G.Touch.safeArea().right, vv.offsetTop);
  }
});

test('full landscape safe area applies to default and custom controls without cropping world', () => {
  const t = setup();
  Object.assign(t.safe, { paddingLeft: '59', paddingRight: '59', paddingBottom: '34', paddingTop: '8' });
  t.G.Viewport.resize();
  const sa = t.G.Touch.safeArea(), L = t.G.ControlLayout;
  for (const p of [null, [0, 0], [1, 1]]) {
    for (const b of [L.bar(800, 400, sa, p), L.pause(800, 400, sa, p)]) {
      assert.ok(b.x >= sa.left && b.y >= sa.top);
      assert.ok(b.x + b.width <= 800 - sa.right && b.y + b.height <= 400 - sa.bottom);
    }
    const s = L.stick(800, 400, sa, p || [0.14, 0.72], 56);
    assert.ok(s.x - 56 >= sa.left && s.x + 56 <= 800 - sa.right);
    assert.ok(s.y - 56 >= sa.top && s.y + 56 <= 400 - sa.bottom);
  }
  assert.equal(t.G.Viewport.size.width, 800); assert.equal(t.canvas.width, 1200);
});

function input(t, type, x, y, id = 1) {
  const r = t.canvas.getBoundingClientRect(), s = t.G.Viewport.size;
  const e = { clientX: r.left + x * r.width / s.width, clientY: r.top + y * r.height / s.height, identifier: id };
  t.canvas.emit(type, { cancelable: true, preventDefault() {}, changedTouches: [e],
    ...e, pointerId: id, pointerType: 'mouse' });
}

test('HUD draw and hit testing share geometry: mouse, finger, all attacks and pause', () => {
  const t = setup(), G = t.G, noop = () => {};
  t.setRect({ left: 31, top: 17, width: 1600, height: 200 });
  G.U = { clamp: (v, a, b) => Math.max(a, Math.min(b, v)), TYPE_COLOR: { water: '#00f' }, mmss: () => '0:00' };
  Object.assign(G, { Icons: { draw: noop }, World: { biomeName: () => 'forest' }, Weather: {}, EnemyMgr: { all: () => [], shinies: () => [] },
    Coop: { active: false }, Rift: {}, Events: { drawHud: noop }, Spawner: { banner: () => null }, Audio: { sfx: noop } });
  let pauses = 0; G.Game.togglePause = () => pauses++;
  const m = { id: 'water', type: 'water', def: { maxLvl: 5 }, lvl: 1, t: 0, cd: 1, name: 'Water' };
  const pl = { mon: { name: 'Test' }, xp: 0, xpNext: 20, hp: 100, maxHp: 100, buffs: {}, level: 1,
    slots: [[m], [m], [m], [m]], maxMoves: 4, active: 0, cdMul: 1, setActive(i) { this.active = i; } };
  const ctx = new Proxy({}, { get: (o, k) => o[k] || (k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop) });
  t.load('js/ui/hud.js');
  const b = G.ControlLayout.bar(800, 400, G.Touch.safeArea(), null);
  for (const type of ['pointerdown', 'touchstart']) {
    for (let i = 0; i < 4; i++) {
      G.HUD.draw(ctx, 800, 400, pl, { time: 20 });
      input(t, type, b.attackX + i * 63 + 27, b.y + 27);
      assert.equal(pl.active, i);
    }
    const p = G.ControlLayout.pause(800, 400, G.Touch.safeArea(), null);
    input(t, type, p.x + 20, p.y + 20);
  }
  assert.equal(pauses, 2); assert.equal(G.Touch.stick, null);
});

test('floating joystick follows transformed finger; another finger presses once and cannot release it', () => {
  const t = setup(); t.setRect({ left: 20, top: 50, width: 1600, height: 200 });
  let pressed = 0; t.G.Touch.addButton(600, 300, 54, 54, () => pressed++);
  input(t, 'touchstart', 100, 100, 7);
  assert.equal(t.G.Touch.stick.ox, 100); assert.equal(t.G.Touch.stick.oy, 100);
  input(t, 'touchmove', 120, 130, 7);
  assert.equal(t.G.Touch.stick.x, 120); assert.equal(t.G.Touch.stick.y, 130);
  input(t, 'touchstart', 627, 327, 8);
  t.canvas.emit('pointerdown', { pointerId: 8, pointerType: 'touch' });
  assert.equal(pressed, 1);
  input(t, 'touchend', 627, 327, 8); assert.ok(t.G.Touch.stick);
  input(t, 'touchmove', 300, 130, 7);
  assert.ok(Math.abs(Math.hypot(t.G.Touch.stick.x - t.G.Touch.stick.ox, t.G.Touch.stick.y - t.G.Touch.stick.oy) - 56) < 1e-9);
  input(t, 'touchcancel', 300, 130, 7); assert.equal(t.G.Touch.vector(), null);
});

test('fixed joystick uses same safe center for drawing and input; background cancels it', () => {
  const t = setup(); t.settings.stickMode = 'fixed';
  t.settings.pad = { stick: [0, 1] }; t.safe.paddingLeft = '59'; t.safe.paddingBottom = '34'; t.G.Viewport.resize();
  const b = t.G.Touch.stickBase(); input(t, 'touchstart', b.x, b.y);
  assert.equal(t.G.Touch.stick.ox, b.x); assert.equal(t.G.Touch.stick.oy, b.y);
  input(t, 'touchmove', b.x + 20, b.y - 10);
  assert.equal(t.G.Touch.stick.ox, b.x); assert.equal(t.G.Touch.stick.x, b.x + 20);
  t.doc.hidden = true; t.doc.emit('visibilitychange'); assert.equal(t.G.Touch.stick, null);
});

test('zero-sized hidden canvas cannot generate invalid input coordinates', () => {
  const { G } = setup();
  assert.equal(G.Viewport.clientToLocal(5, 5, { left: 0, top: 0, width: 0, height: 0 }, 800, 400), null);
});
