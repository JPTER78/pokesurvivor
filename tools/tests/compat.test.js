/* ============ compat.test.js — versiones mezcladas y control del banco de pruebas ============
 *
 * Tras publicar, durante unos minutos puede haber anfitrión e invitado con
 * versiones distintas. La versión vieja es la última publicada antes del
 * arreglo (OLD_REV en harness.js, sacada de git).
 *
 * La prueba de control comprueba que el banco SÍ reproduce el fallo con el
 * código viejo en los dos lados: si no, que lo demás pase no demostraría nada.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { coopGame, hasOld, NEW_FILES, OLD_FILES, OLD_REV } = require('./harness');

const skip = hasOld() ? false : `no está la versión ${OLD_REV} en git`;
const noErrors = g => assert.deepEqual(g.world.errors(), []);

function settle(g, sec = 15) {
  let calm = 0;
  return g.world.until(() => {
    for (const m of g.all) { m.pickCard(0); m.chooseItem(1); m.pickBond(); }
    calm = g.all.every(m => m.state === 'playing') ? calm + 1 : 0;
    return calm > 60;
  }, sec);
}

test(`control: con la versión vieja (${OLD_REV}) en los dos lados el fallo se reproduce`, { skip }, () => {
  const g = coopGame({ files: { H: OLD_FILES, A: OLD_FILES } });
  const [H, A] = g.all;
  A.pl.item = 'a';
  H.give('item', 'b', 'A');
  H.give('xpBig', 5, 'A');
  g.world.run(0.5);
  H.pickCard(0); A.pickCard(0);
  g.world.run(1);
  assert.ok(!A.isOpen('scr-item'), 'las cartas taparon el menú del objeto y se perdió');
  assert.equal(A.pl.item, 'a');
  assert.equal(H.state, 'playing', 'el anfitrión sigue jugando...');
  assert.match(H.banner, /Pausa: Ana está eligiendo/, '...con el aviso de pausa puesto');
  // La siguiente vez que el anfitrión elige algo, se queda parado para siempre.
  H.pl.item = 'a';
  H.give('item', 'c');
  g.world.run(0.5);
  assert.ok(H.chooseItem(1));
  g.world.run(5);
  assert.equal(H.state, 'held', 'parado para siempre');
  assert.equal(A.state, 'held');
});

test('mezcla: anfitrión nuevo, invitado viejo -> objeto y XP a la vez no cuelga la partida', { skip }, () => {
  const g = coopGame({ files: { H: NEW_FILES, A: OLD_FILES } });
  const [H, A] = g.all;
  A.pl.item = 'a';
  H.give('item', 'b', 'A');
  H.give('xpBig', 5, 'A');
  g.world.run(0.5);
  assert.ok(settle(g), H.state + ' / ' + A.state);
  // Y una elección normal del invitado viejo para al anfitrión hasta que termina.
  A.pl.item = 'a';
  H.give('item', 'c', 'A');
  g.world.run(0.5);
  assert.equal(A.state, 'choice');
  assert.equal(H.state, 'held');
  assert.ok(A.chooseItem(1));
  g.world.run(0.5);
  assert.equal(H.state, 'playing');
  assert.equal(A.state, 'playing');
  noErrors(g);
});

test('mezcla: anfitrión nuevo, invitado viejo -> vínculo del invitado para a todos', { skip }, () => {
  const g = coopGame({ files: { H: NEW_FILES, A: OLD_FILES } });
  const [H, A] = g.all;
  A.pl.bonds = 1;
  A.G.Game.offerBond();
  g.world.run(0.5);
  assert.equal(A.state, 'choice');
  assert.equal(H.state, 'held');
  assert.ok(A.pickBond());
  assert.ok(settle(g));
  noErrors(g);
});

test('mezcla: anfitrión viejo, invitado nuevo -> objeto del invitado y del anfitrión', { skip }, () => {
  const g = coopGame({ files: { H: OLD_FILES, A: NEW_FILES } });
  const [H, A] = g.all;
  A.pl.item = 'a';
  H.give('item', 'b', 'A');
  g.world.run(0.5);
  assert.equal(A.state, 'choice');
  assert.equal(H.state, 'held');
  assert.ok(A.chooseItem(1));
  assert.ok(settle(g));
  assert.equal(A.pl.item, 'b');

  H.pl.item = 'a';
  H.give('item', 'b');
  g.world.run(0.5);
  assert.equal(H.state, 'choice');
  assert.equal(A.state, 'held');
  assert.ok(H.chooseItem(1));
  assert.ok(settle(g));
  noErrors(g);
});

test('mezcla: anfitrión viejo, invitado nuevo -> objeto y XP a la vez no cuelga ni pierde el objeto', { skip }, () => {
  const g = coopGame({ files: { H: OLD_FILES, A: NEW_FILES } });
  const [H, A] = g.all;
  A.pl.item = 'a';
  H.give('item', 'b', 'A');
  H.give('xpBig', 5, 'A');
  g.world.run(0.5);
  assert.ok(settle(g), H.state + ' / ' + A.state);
  assert.equal(A.pl.item, 'b', 'el invitado nuevo no pierde el menú');
  noErrors(g);
});

test('mezcla: anfitrión viejo, invitado nuevo -> llegan las cartas con el menú abierto', { skip }, () => {
  const g = coopGame({ latency: 150, files: { H: OLD_FILES, A: NEW_FILES } });
  const [H, A] = g.all;
  A.pl.item = 'a';
  H.give('item', 'b', 'A');
  assert.ok(g.world.until(() => A.isOpen('scr-item'), 2));
  H.G.Game.debugLevelUp();
  g.world.run(0.6);
  assert.ok(settle(g), H.state + ' / ' + A.state);
  assert.equal(A.pl.item, 'b');
  noErrors(g);
});
