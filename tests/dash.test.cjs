/* Ataques de embestida (Ataque Rápido, Golpe Aéreo...): mientras te mueves no
 * se lanzan solos hacia el enemigo; esperan a que pares. Los demás movimientos
 * del vínculo siguen a su ritmo. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = f => fs.readFileSync(path.join(root, f), 'utf8');

// Lo que no es util ni combat: funciones que no hacen nada (devuelven []).
const noop = () => new Proxy(function () { return []; }, { get: (t, k) => (k === Symbol.iterator ? [][Symbol.iterator] : noop()) });
globalThis.window = globalThis;
globalThis.G = new Proxy({ Sprites: { PX: 2 }, Coop: { active: false } }, {
  get: (t, k) => (k in t ? t[k] : (t[k] = noop()))
});
for (const f of ['js/core/util.js', 'js/systems/combat.js']) (0, eval)(source(f));
const { Combat } = globalThis.G;

const move = (id, kind, extra) => Object.assign({ id, kind, type: 'normal', cd: 1, t: 0, radius: 120, speed: 300, life: 1 }, extra);
function player(group, walking) {
  const cast = [];
  return { cast, pl: {
    x: 0, y: 0, r: 10, aim: 0, cdMul: 1, walking, target: { x: 40, y: 0 },
    activeGroup: () => group, cast: m => cast.push(m.id), atkFor: () => 1
  } };
}

test('moviéndote, la embestida no se lanza aunque haya enemigo a tiro', () => {
  const dash = move('quick-attack', 'dash');
  const { pl, cast } = player([dash], true);
  Combat.tick(1 / 60, pl, 0);
  assert.deepEqual(cast, []);
  assert.ok(dash.t > 0 && dash.t <= 0.05, 'vuelve a mirar enseguida: ' + dash.t);
});

test('parado, la embestida se lanza', () => {
  const dash = move('quick-attack', 'dash');
  const { pl, cast } = player([dash], false);
  Combat.tick(1 / 60, pl, 0);
  assert.deepEqual(cast, ['quick-attack']);
});

test('en un vínculo, los demás movimientos atacan aunque te muevas', () => {
  const dash = move('quick-attack', 'dash'), ember = move('ember', 'projectile', { type: 'fire' });
  const { pl, cast } = player([dash, ember], true);
  Combat.tick(1 / 60, pl, 0);
  assert.deepEqual(cast, ['ember']);
});
