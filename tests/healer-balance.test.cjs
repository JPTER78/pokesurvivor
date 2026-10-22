"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { source, scenario } = require("./helpers/healer-harness.cjs");

const enemySource = source();

function expectClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `Se esperaban ${expected} PV, se obtuvieron ${actual}`);
}

test("Un curandero conserva su curación habitual del 7 %", () => {
  const run = scenario(enemySource, { hp: 1000, power: 1 });
  run.cast(1);
  expectClose(run.victims[0].hp, 70);
});

test("Varios curanderos comparten el límite del 12 % por objetivo", () => {
  for (const healerCount of [2, 3, 5]) {
    const run = scenario(enemySource, { hp: 1000 });
    run.cast(healerCount);
    expectClose(run.victims[0].hp, 120);
    assert.equal(run.effects.bursts, 2);
  }
});

test("La ventana de curación se reinicia tras 3,5 segundos de juego", () => {
  const run = scenario(enemySource, { hp: 1000 });
  run.cast(3);
  run.clock.time = 3.49;
  run.cast(3);
  expectClose(run.victims[0].hp, 120);

  run.clock.time = 3.5;
  run.cast(3);
  expectClose(run.victims[0].hp, 240);
});

test("Recibir daño no reinicia anticipadamente el límite de curación", () => {
  const run = scenario(enemySource, { hp: 1000 });
  run.cast(3);
  run.victims[0].hp = 60;
  run.clock.time = 1;
  run.cast(3);
  expectClose(run.victims[0].hp, 60);
});

test("Los objetivos con la vida completa, derrotados o casi curados se gestionan correctamente", () => {
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

test("La curación de los jefes mantiene su límite basado en el daño recibido", () => {
  const run = scenario(enemySource, { boss: true, hp: 2000, rd: 120 });
  run.cast(3);
  expectClose(run.victims[0].hp, 24);
});

test("Reiniciar el reloj de partida inicia una ventana de curación nueva", () => {
  const run = scenario(enemySource, { hp: 1000 });
  run.clock.time = 60;
  run.cast(3);
  run.clock.time = 0;
  run.cast(3);
  expectClose(run.victims[0].hp, 240);
});
