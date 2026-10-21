#!/usr/bin/env node
// Deterministic simulation and CPU microbenchmark, not a measure of in-game FPS.
"use strict";

const { execFileSync } = require("node:child_process");
const { performance } = require("node:perf_hooks");
const { source, scenario, FILE } = require("../tests/helpers/healer-harness.cjs");

function usage() {
  console.log("Usage: node tools/bench-healers.cjs [--baseline=origin/main] [--iterations=20000]");
  console.log("Compares original and modified healing using the same deterministic scenarios.");
}
function argumentsFrom(argv) {
  const options = { baseline: "main", iterations: 20000 };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    const match = /^--(baseline|iterations)=(.+)$/.exec(arg);
    if (!match) throw new Error(`Unknown argument: ${arg}. Run --help for usage.`);
    options[match[1]] = match[1] === "iterations" ? Number(match[2]) : match[2];
  }
  if (!Number.isSafeInteger(options.iterations) || options.iterations < 100 || options.iterations > 1_000_000) {
    throw new Error("Iterations must be a whole number between 100 and 1,000,000.");
  }
  return options;
}

function loadBaseline(ref) {
  try {
    return execFileSync("git", ["show", `${ref}:${FILE}`], {
      encoding: "utf8",
      maxBuffer: 4_000_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    console.error(`Cannot read baseline "${ref}". Run "git fetch origin" and use --baseline=origin/main.`);
    process.exit(1);
  }
}
function healedHp(js, healerCount, attackMultiplier) {
  const run = scenario(js, { power: attackMultiplier });
  run.cast(healerCount);
  return run.victims[0].hp;
}
function nsPerCast(js, healerCount, iterations) {
  const run = scenario(js);
  const measure = count => {
    const start = performance.now();
    for (let i = 0; i < count; i++) {
      run.clock.time = i * 3.51;
      run.victims[0].hp = 0;
      run.cast(healerCount);
    }
    return (performance.now() - start) * 1_000_000 / (count * healerCount);
  };
  measure(Math.min(iterations, 4000));
  return Array.from({ length: 5 }, () => measure(iterations)).sort((a, b) => a - b)[2];
}
function table(headings, rows) {
  const widths = headings.map((heading, column) =>
    Math.max(heading.length, ...rows.map(row => String(row[column]).length)));
  const display = row => row.map((cell, i) => String(cell).padEnd(widths[i])).join("  |  ");
  console.log(display(headings));
  console.log(widths.map(width => "-".repeat(width)).join("--+--"));
  for (const row of rows) console.log(display(row));
}
const { baseline, iterations } = argumentsFrom(process.argv.slice(2));
const before = loadBaseline(baseline), after = source();
const reduction = (oldValue, newValue) => ((1 - newValue / oldValue) * 100).toFixed(1) + "%";
const cpuChange = (oldValue, newValue) => {
  const change = (newValue / oldValue - 1) * 100;
  return (change >= 0 ? "+" : "") + change.toFixed(1) + "%";
};
console.log("HEALER BALANCE: BEFORE / AFTER");
console.log(`Baseline: ${baseline} | Test iterations: ${iterations.toLocaleString("en-US")} | CPU samples: 5 (median)`);
console.log("Scenario: target starts at 0 / 2,000 HP; healing is measured over one 3.5-second window.");
console.log("");
console.log("HEALING PER WINDOW (HP recovered; lower means less stacked healing)");
const healingRows = [];
const cpuRows = [];
for (const count of [1, 2, 3]) {
  for (const multiplier of [1, 1.4, 3]) {
    const oldHp = healedHp(before, count, multiplier);
    const newHp = healedHp(after, count, multiplier);
    healingRows.push([count, multiplier.toFixed(1) + "x", oldHp.toFixed(1), newHp.toFixed(1), reduction(oldHp, newHp)]);
  }
  const oldCost = nsPerCast(before, count, iterations);
  const newCost = nsPerCast(after, count, iterations);
  cpuRows.push([count, oldCost.toFixed(0), newCost.toFixed(0), cpuChange(oldCost, newCost)]);
}
table(["Healers", "Player ATK", "Before (HP)", "After (HP)", "Healing reduction"], healingRows);
console.log("");
console.log("CPU COST PER HEALER CAST (nanoseconds; smaller is faster)");
table(["Healers", "Before (ns)", "After (ns)", "CPU time change"], cpuRows);
console.log("");
console.log("Note: This is a CPU microbenchmark, not an FPS, gameplay or multiplayer test.");
console.log("Timing differences of a few hundred nanoseconds may vary across runs and devices.");
