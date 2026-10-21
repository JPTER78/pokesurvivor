"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { source, scenario } = require("./helpers/healer-harness.cjs");
const js = source();
const near = (a, b) =>
  assert.ok(Math.abs(a - b) < 1e-6, `expected ${b}, got ${a}`);
test("A single healer restores the normal 7% of maximum HP", () => {
  const s = scenario(js, { hp: 1000, power: 1 });
  s.cast(1);
  near(s.victims[0].hp, 70);
});
test("Multiple healers share a 12% healing limit per target", () => {
  for (const n of [2, 3, 5]) {
    const s = scenario(js, { hp: 1000 });
    s.cast(n);
    near(s.victims[0].hp, 120);
    assert.equal(s.effects.bursts, 2);
  }
});
test("The healing limit resets after 3.5 seconds of game time", () => {
  const s = scenario(js, { hp: 1000 });
  s.cast(3);
  s.clock.time = 3.49;
  s.cast(3);
  near(s.victims[0].hp, 120);
  s.clock.time = 3.5;
  s.cast(3);
  near(s.victims[0].hp, 240);
});
test("Taking damage does not reset the healing limit early", () => {
  const s = scenario(js, { hp: 1000 });
  s.cast(3);
  s.victims[0].hp = 60;
  s.clock.time = 1;
  s.cast(3);
  near(s.victims[0].hp, 60);
});
test("Full-health, defeated and nearly full targets receive only valid healing", () => {
  const a = { x: 0, y: 0, hp: 1000, maxHp: 1000, dead: false, bodyH: 16 },
    b = { x: 0, y: 0, hp: 0, maxHp: 1000, dead: true, bodyH: 16 },
    c = { x: 0, y: 0, hp: 995, maxHp: 1000, dead: false, bodyH: 16 };
  const s = scenario(js, { targets: [a, b, c] });
  s.cast(3);
  near(a.hp, 1000);
  near(b.hp, 0);
  near(c.hp, 1000);
  near(c.supportHealUsed, 5);
  c.hp = 800;
  s.cast(3);
  near(c.hp, 915);
});
test("Boss healing keeps its existing damage-per-second limit", () => {
  const s = scenario(js, { boss: true, hp: 2000, rd: 120 });
  s.cast(3);
  near(s.victims[0].hp, 24);
});
test("Resetting the game clock starts a new healing window", () => {
  const s = scenario(js, { hp: 1000 });
  s.clock.time = 60;
  s.cast(3);
  s.clock.time = 0;
  s.cast(3);
  near(s.victims[0].hp, 240);
});
