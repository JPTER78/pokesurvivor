"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { source, scenario } = require("./helpers/healer-harness.cjs");
const js = source();
const near = (a, b) =>
  assert.ok(Math.abs(a - b) < 1e-6, `expected ${b}, got ${a}`);
test("one healer retains 7% normal healing", () => {
  const s = scenario(js, { hp: 1000, power: 1 });
  s.cast(1);
  near(s.victims[0].hp, 70);
});
test("multiple healers share 12% per-target budget", () => {
  for (const n of [2, 3, 5]) {
    const s = scenario(js, { hp: 1000 });
    s.cast(n);
    near(s.victims[0].hp, 120);
    assert.equal(s.effects.bursts, 2);
  }
});
test("budget advances with simulated play, not paused wall time", () => {
  const s = scenario(js, { hp: 1000 });
  s.cast(3);
  s.clock.time = 3.49;
  s.cast(3);
  near(s.victims[0].hp, 120);
  s.clock.time = 3.5;
  s.cast(3);
  near(s.victims[0].hp, 240);
});
test("damage cannot reset budget in a window", () => {
  const s = scenario(js, { hp: 1000 });
  s.cast(3);
  s.victims[0].hp = 60;
  s.clock.time = 1;
  s.cast(3);
  near(s.victims[0].hp, 60);
});
test("full, dead, and nearly full targets are treated correctly", () => {
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
test("boss DPS-based healing remains unchanged", () => {
  const s = scenario(js, { boss: true, hp: 2000, rd: 120 });
  s.cast(3);
  near(s.victims[0].hp, 24);
});
test("clock reset starts a fresh window", () => {
  const s = scenario(js, { hp: 1000 });
  s.clock.time = 60;
  s.cast(3);
  s.clock.time = 0;
  s.cast(3);
  near(s.victims[0].hp, 240);
});
