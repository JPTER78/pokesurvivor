// Joystick táctil (touch.js): flotante (la base sigue al dedo) y anclado (se queda donde tocaste).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function touch(stickMode) {
  const ls = {}, on = (t, fn) => { (ls[t] = ls[t] || []).push(fn); };
  const cv = { clientWidth: 800, clientHeight: 400, addEventListener: on, setPointerCapture() {} };
  const settings = { stick: 1, stickMode, aimManual: false, pad: null };
  const G = { Settings: { touch: true, get: k => settings[k] }, Game: { state: 'playing' } };
  const document = { body: { classList: { add() {} } }, addEventListener() {} };
  new Function('G', 'document', 'addEventListener', source('js/core/touch.js'))(G, document, () => {});
  G.Touch.init(cv);
  const ev = (x, y) => ({ pointerType: 'touch', pointerId: 1, clientX: x, clientY: y, preventDefault() {} });
  return {
    T: G.Touch,
    down: (x, y) => ls.pointerdown.forEach(f => f(ev(x, y))),
    move: (x, y) => ls.pointermove.forEach(f => f(ev(x, y))),
    up: (x, y) => ls.pointerup.forEach(f => f(ev(x, y)))
  };
}

test('anchored joystick: the base stays where you touched, even if the finger goes past the edge', () => {
  const t = touch('anchor');
  t.down(100, 300);
  t.move(400, 300);                       // muy lejos a la derecha
  t.move(300, 300);                       // vuelve un poco: sigue a la derecha de donde tocó
  const [x, y] = t.T.vector();
  assert.ok(x > 0.99 && Math.abs(y) < 0.01, 'still right at full speed: the centre stayed at 100');
  t.move(40, 300);                        // a la izquierda de donde tocó: izquierda
  assert.ok(t.T.vector()[0] < -0.99);
  t.up(40, 300);
  assert.equal(t.T.vector(), null);
  t.down(500, 200); t.move(520, 200);     // otro toque: joystick nuevo ahí
  assert.ok(t.T.vector()[0] > 0);
});

test('floating joystick (the default) still follows the finger past the edge', () => {
  const t = touch('float');
  t.down(100, 300);
  t.move(400, 300);                       // la base se ha ido detrás (a 56 px del dedo)
  t.move(330, 300);                       // a la izquierda de la base (344): ya va a la izquierda
  assert.ok(t.T.vector()[0] < 0);
});
