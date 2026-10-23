#!/usr/bin/env node
// Compara la curación y el coste de CPU; no mide los FPS reales del juego.
'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const {
  source,
  scenario,
  FILE,
} = require('../tests/helpers/healer-harness.cjs');

const CPU_SAMPLES = 5;

function showHelp() {
  process.stdout.write(
    'Uso: node tools/bench-healers.cjs [--baseline=origin/main] [--iterations=20000]\n' +
      'Compara la curación original y la modificada en los mismos escenarios.\n'
  );
}

function parseArguments(argv) {
  const options = { baseline: 'origin/main', iterations: 20_000 };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
    const match = /^--(baseline|iterations)=(.+)$/.exec(arg);
    if (!match)
      throw new Error(`Argumento desconocido: ${arg}. Consulta --help.`);
    const [, key, value] = match;
    options[key] = key === 'iterations' ? Number(value) : value;
  }
  if (
    !Number.isSafeInteger(options.iterations) ||
    options.iterations < 100 ||
    options.iterations > 1_000_000
  ) {
    throw new Error(
      'Las iteraciones deben ser un entero entre 100 y 1.000.000.'
    );
  }
  return options;
}

function loadBaseline(ref) {
  try {
    return execFileSync('git', ['show', `${ref}:${FILE}`], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      maxBuffer: 4_000_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error(
      `No se encontró la base «${ref}». Ejecuta git fetch origin y usa --baseline=origin/main.`
    );
  }
}

function healedHp(js, healerCount, attackMultiplier) {
  const run = scenario(js, { power: attackMultiplier });
  run.cast(healerCount);
  return run.victims[0].hp;
}

function nsPerCast(js, healerCount, iterations) {
  const run = scenario(js);
  function measure(count) {
    const startedAt = performance.now();
    for (let index = 0; index < count; index++) {
      run.clock.time = index * 3.51;
      run.victims[0].hp = 0;
      run.cast(healerCount);
    }
    return (
      ((performance.now() - startedAt) * 1_000_000) / (count * healerCount)
    );
  }
  measure(Math.min(iterations, 4000)); // Calentamiento del motor de JavaScript.
  const samples = Array.from({ length: CPU_SAMPLES }, () =>
    measure(iterations)
  );
  return samples.sort((a, b) => a - b)[Math.floor(CPU_SAMPLES / 2)];
}

function formatTable(headings, rows) {
  const widths = headings.map((heading, column) =>
    Math.max(heading.length, ...rows.map((row) => String(row[column]).length))
  );
  const formatRow = (row) =>
    row.map((cell, index) => String(cell).padEnd(widths[index])).join('  |  ');

  return [
    formatRow(headings),
    widths.map((width) => '-'.repeat(width)).join('--+--'),
    ...rows.map(formatRow),
  ].join('\n');
}

function main() {
  const { baseline, iterations } = parseArguments(process.argv.slice(2));
  const before = loadBaseline(baseline);
  const after = source();
  const reduction = (original, updated) =>
    ((1 - updated / original) * 100).toFixed(1) + '%';
  const cpuChange = (original, updated) => {
    const change = (updated / original - 1) * 100;
    return (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
  };

  const report = [
    'CURACIÓN DE ENEMIGOS: ANTES Y DESPUÉS',
    `Base: ${baseline} | Iteraciones: ${iterations.toLocaleString('es-ES')} | Muestras de CPU: ${CPU_SAMPLES} (mediana)`,
    'Escenario: objetivo con 0 / 2.000 PV; ventana de curación de 3,5 segundos.',
    '',
  ];

  const healingRows = [];
  const cpuRows = [];
  for (const healerCount of [1, 2, 3]) {
    for (const attackMultiplier of [1, 1.4, 3]) {
      const originalHp = healedHp(before, healerCount, attackMultiplier);
      const updatedHp = healedHp(after, healerCount, attackMultiplier);
      healingRows.push([
        healerCount,
        `${attackMultiplier.toFixed(1)}x`,
        originalHp.toFixed(1),
        updatedHp.toFixed(1),
        reduction(originalHp, updatedHp),
      ]);
    }
    const originalCost = nsPerCast(before, healerCount, iterations);
    const updatedCost = nsPerCast(after, healerCount, iterations);
    cpuRows.push([
      healerCount,
      originalCost.toFixed(0),
      updatedCost.toFixed(0),
      cpuChange(originalCost, updatedCost),
    ]);
  }

  report.push(
    'CURACIÓN POR VENTANA (PV recuperados)',
    formatTable(
      ['Curanderos', 'Ataque', 'Antes (PV)', 'Después (PV)', 'Reducción'],
      healingRows
    ),
    '',
    'COSTE POR CURACIÓN (nanosegundos; menor es más rápido)',
    formatTable(
      ['Curanderos', 'Antes (ns)', 'Después (ns)', 'Cambio CPU'],
      cpuRows
    ),
    '',
    'Aviso: este microbenchmark no mide FPS, supervivencia ni partidas multijugador.',
    'Los resultados de CPU pueden variar entre ejecuciones y equipos.'
  );
  process.stdout.write(`${report.join('\n')}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
}
