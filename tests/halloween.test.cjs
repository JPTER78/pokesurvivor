// Fechas del evento de Halloween: del 30-10 al 2-11 (hora de España). El 2-11 se
// añadió el 27-10-2026; el 3-11 a las 00:00 vuelve todo a la normalidad.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  const G = {};
  const ctx = vm.createContext({ G, Intl, Date, performance, setInterval: () => 0, URLSearchParams, console });
  const f = 'js/systems/halloween.js';
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
  return G.Halloween;
}

test('isOn: del 30-10 al 2-11 en hora de España', () => {
  const H = load();
  // (En España, octubre y noviembre de 2026: UTC+1 desde el 25-10.)
  assert.equal(H.isOn(new Date('2026-10-29T22:59:00Z')), false);   // 29-10, 23:59
  assert.equal(H.isOn(new Date('2026-10-29T23:00:00Z')), true);    // 30-10, 00:00
  assert.equal(H.isOn(new Date('2026-11-01T12:00:00Z')), true);
  assert.equal(H.isOn(new Date('2026-11-02T22:59:00Z')), true);    // 2-11, 23:59
  assert.equal(H.isOn(new Date('2026-11-02T23:00:00Z')), false);   // 3-11, 00:00
  assert.equal(H.isOn(new Date('2027-11-02T12:00:00Z')), true);    // cualquier año
});

test('countdown: cuánto falta y cuánto queda, con el 2-11 incluido', () => {
  const H = load();
  const end = Date.parse('2026-11-02T23:00:00Z');
  const during = Date.parse('2026-11-02T20:00:00Z');
  assert.deepEqual({ ...H.countdown(during) }, { on: true, ms: end - during });
  const before = Date.parse('2026-10-27T18:00:00Z');
  assert.deepEqual({ ...H.countdown(before) }, { on: false, ms: Date.parse('2026-10-29T23:00:00Z') - before });
  assert.equal(H.countdown(end), null);
});
