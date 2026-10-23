'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { source, scenario } = require('./helpers/healer-harness.cjs');

const enemySource = source();

function expectClose(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 1e-6,
    `Se esperaban ${expected} PV, se obtuvieron ${actual}`
  );
}

test('Un curandero conserva su curación habitual del 7 %', () => {
  const run = scenario(enemySource, { hp: 1000, power: 1 });
  run.cast(1);
  expectClose(run.victims[0].hp, 70);
});

test('Varios curanderos comparten el límite del 12 % por objetivo', () => {
  for (const healerCount of [2, 3, 5]) {
    const run = scenario(enemySource, { hp: 1000 });
    run.cast(healerCount);
    expectClose(run.victims[0].hp, 120);
    assert.equal(run.effects.bursts, 2);
  }
});

test('La ventana de curación se reinicia tras 3,5 segundos de juego', () => {
  const run = scenario(enemySource, { hp: 1000 });
  run.cast(3);
  run.clock.time = 3.49;
  run.cast(3);
  expectClose(run.victims[0].hp, 120);

  run.clock.time = 3.5;
  run.cast(3);
  expectClose(run.victims[0].hp, 240);
});

test('Recibir daño no reinicia anticipadamente el límite de curación', () => {
  const run = scenario(enemySource, { hp: 1000 });
  run.cast(3);
  run.victims[0].hp = 60;
  run.clock.time = 1;
  run.cast(3);
  expectClose(run.victims[0].hp, 60);
});

test('Los objetivos con la vida completa, derrotados o casi curados se gestionan correctamente', () => {
  const full = { x: 0, y: 0, hp: 1000, maxHp: 1000, dead: false, bodyH: 16 };
  const dead = { x: 0, y: 0, hp: 0, maxHp: 1000, dead: true, bodyH: 16 };
  const injured = { x: 0, y: 0, hp: 995, maxHp: 1000, dead: false, bodyH: 16 };
  const run = scenario(enemySource, { targets: [full, dead, injured] });

  run.cast(3);
  expectClose(full.hp, 1000);
  expectClose(dead.hp, 0);
  expectClose(injured.hp, 1000);
  expectClose(injured.supportHealUsed, 5);

  injured.hp = 800;
  run.cast(3);
  expectClose(injured.hp, 915);
});

test('La curación de los jefes mantiene su límite basado en el daño recibido', () => {
  const run = scenario(enemySource, { boss: true, hp: 2000, rd: 120 });
  run.cast(3);
  expectClose(run.victims[0].hp, 24);
});

test('Reiniciar el reloj de partida inicia una ventana de curación nueva', () => {
  const run = scenario(enemySource, { hp: 1000 });
  run.clock.time = 60;
  run.cast(3);
  run.clock.time = 0;
  run.cast(3);
  expectClose(run.victims[0].hp, 240);
});

test('Cada objetivo dispone de su propio presupuesto de curación', () => {
  const targets = [1000, 2000].map((maxHp) => ({
    x: 0,
    y: 0,
    bodyH: 16,
    hp: 10,
    maxHp,
    dead: false,
  }));
  const run = scenario(enemySource, { targets });
  run.cast(5);
  expectClose(targets[0].hp, 130);
  expectClose(targets[1].hp, 250);
});

test('Curaciones desfasadas no adelantan ni prolongan la ventana', () => {
  const run = scenario(enemySource, { hp: 1000, power: 1 });
  run.clock.time = 10;
  run.cast();
  run.clock.time = 12;
  run.cast();
  expectClose(run.victims[0].hp, 120);
  run.clock.time = 13.49;
  run.cast();
  expectClose(run.victims[0].hp, 120);
  run.clock.time = 13.5;
  run.cast();
  expectClose(run.victims[0].hp, 190);
});

test('Una pausa conserva el presupuesto y no repite efectos de curación', () => {
  const run = scenario(enemySource, { hp: 1000, visible: true });
  run.cast(3);
  const bursts = run.effects.bursts;
  const sounds = run.effects.sounds;
  run.cast(100);
  expectClose(run.victims[0].hp, 120);
  assert.equal(run.effects.bursts, bursts);
  assert.equal(run.effects.sounds, sounds);
});

test('El límite también se aplica a un curandero con ataque muy alto', () => {
  const run = scenario(enemySource, { hp: 1000, power: 1000 });
  run.cast();
  expectClose(run.victims[0].hp, 120);
});

test('Un jefe sin daño reciente no recibe curación ni efectos de impacto', () => {
  const run = scenario(enemySource, { boss: true, rd: 0, visible: true });
  run.cast(3);
  expectClose(run.victims[0].hp, 0);
  assert.equal(run.effects.bursts, 0);
  assert.equal(run.effects.sounds, 0);
});

test('El anfitrión conserva el aviso visual de área y los enemigos no se sobrecuran', () => {
  const run = scenario(enemySource, { host: true, boss: true, visible: true });
  run.victims[0].hp = 1999;
  run.cast();
  expectClose(run.victims[0].hp, 2000);
  assert.equal(run.effects.rings, 1);
  assert.equal(run.effects.broadcasts.length, 1);
  assert.equal(run.effects.broadcasts[0][0], 'fxr');
  assert.equal(run.effects.sounds, 1);
});
