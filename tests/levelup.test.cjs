// Cartas de nivel (levelup.js): las de estadística dicen cuántas llevas, como «Tus estadísticas» de la pausa,
// para no tener que salir de la pantalla completa y abrir la pausa para verlo.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function boot() {
  const G = { T: s => s, U: {}, Moves: { evoInfo: () => null } };
  new Function('G', source('js/systems/levelup.js'))(G);
  G.U.pickN = list => list;                      // todas, para ver cada carta
  return G;
}
// Los 4 huecos llenos y sin movimientos que mejorar: sólo salen cartas de estadística.
const player = taken => ({ slots: [1, 2, 3, 4], maxMoves: 4, moves: [], statsTaken: taken });
const cards = (G, p) => G.LevelUp.offer(p, 99);
const tags = (G, taken) => Object.fromEntries(cards(G, player(taken)).map(c => [c.key, c.tag]));

test('stat cards with a cap show how many you have and the cap; the rest, nothing', () => {
  const G = boot();
  const t = tags(G, { atk: 3, rgn: 2, spd: 0 });
  assert.equal(t['stat:atk'], 'Mejora · 3/40');
  assert.equal(t['stat:spd'], 'Mejora · 0/8');
  assert.equal(t['stat:rgn'], 'Mejora', 'no cap: nothing added');
  assert.equal(t['stat:hp'], 'Mejora');
  assert.equal(t['stat:heal'], 'Mejora', 'Sitrus Berry has no cap either');
});

test('the count matches what the pause shows after picking the card', () => {
  const G = boot(), p = player({});
  const p2 = Object.assign(p, { cdMul: 1 });
  const card = () => cards(G, p2).find(c => c.key === 'stat:cd');
  for (let i = 0; i < 4; i++) card().apply(p2);
  assert.equal(p.statsTaken.cd, 4);
  assert.equal(card().tag, 'Mejora · 4/10');
});
