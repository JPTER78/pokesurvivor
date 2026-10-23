'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const script = path.resolve(__dirname, '../tools/bench-healers.cjs');
function run(args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
    timeout: 30_000,
  });
}

test('El benchmark muestra ayuda sin depender del directorio actual', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--baseline=origin\/main/);
  assert.equal(result.stderr, '');
});

test('El benchmark rechaza argumentos inválidos con mensajes sin stack traces', () => {
  for (const arg of [
    '--iterations=99',
    '--iterations=1000001',
    '--iterations=1.5',
    '--iterations=NaN',
    '--unknown=true',
  ]) {
    const result = run([arg]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^Error: /);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
    assert.equal(result.stdout, '');
  }
});

test('Una referencia inexistente devuelve una indicación de recuperación', () => {
  const result = run(['--baseline=refs/heads/missing-healer-test-reference']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /git fetch origin/);
});

test('El benchmark carga la base del repositorio desde otro directorio', () => {
  const result = run(['--baseline=HEAD', '--iterations=100']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CURACIÓN POR VENTANA/);
  assert.match(result.stdout, /COSTE POR CURACIÓN/);
  assert.doesNotMatch(result.stdout, /NaN|Infinity/);
});
