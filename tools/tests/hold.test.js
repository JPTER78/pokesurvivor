/* ============ hold.test.js — G.Hold (lógica pura de la pausa del equipo) ============ */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { source } = require('./harness');

const ctx = { G: {} };
vm.createContext(ctx);
vm.runInContext(source('js/systems/hold.js'), ctx);
const { Hold } = ctx.G;
const ORDER = ['H', 'A', 'B'];
const plain = x => JSON.parse(JSON.stringify(x));

test('state(): prioridad fija', () => {
  const st = s => Hold.state(Object.assign({ over: false, cards: false, menu: false, team: false, away: false, paused: false }, s));
  assert.equal(st({}), 'playing');
  assert.equal(st({ paused: true }), 'paused');
  assert.equal(st({ team: true, paused: true }), 'held');
  assert.equal(st({ away: true }), 'held');
  assert.equal(st({ menu: true, team: true, away: true }), 'choice');
  assert.equal(st({ cards: true, menu: true, team: true }), 'levelup');
  assert.equal(st({ over: true, cards: true }), 'over');
});

test('team(): barrera de cartas numerada', () => {
  const t = Hold.team();
  assert.equal(t.busy, false);
  assert.equal(t.pack(ORDER), null, 'sin pausa no se manda nada');
  const s1 = t.startLevel(['H', 'A']);
  assert.equal(s1, 1);
  assert.deepEqual(plain(t.pack(ORDER)), [1, 0b011, 0]);
  assert.equal(t.picked('A', 99), false, 'un lp de otra barrera no vale');
  assert.equal(t.picked('A', s1), true);
  assert.equal(t.picked('A', s1), false, 'repetido');
  assert.equal(t.picked('H'), true, 'sin número (versión vieja) vale para la de ahora');
  assert.equal(t.leveling, false);
  assert.equal(t.busy, false);
  assert.equal(t.startLevel(['H']), 2);
});

test('team(): menús propios y salidas', () => {
  const t = Hold.team();
  assert.equal(t.own('A', true), true);
  assert.equal(t.own('A', true), false, 'idempotente');
  assert.equal(t.own('B', true), true);
  assert.deepEqual(plain(t.pack(ORDER)), [0, 0, 0b110]);
  assert.deepEqual(plain(t.everyone()).sort(), ['A', 'B']);
  assert.equal(t.own('A', false), true);
  assert.equal(t.busy, true, 'B sigue eligiendo');
  t.startLevel(['H', 'B']);
  assert.equal(t.drop('B'), true, 'se va: deja de contar en todo');
  assert.deepEqual(plain(t.waiting()), ['H']);
  assert.deepEqual(plain(t.choosing()), []);
  assert.equal(t.drop('B'), false);
});

test('unmask(): bits según el orden de members', () => {
  assert.deepEqual(plain(Hold.unmask(0b101, ORDER)), ['H', 'B']);
  assert.deepEqual(plain(Hold.unmask(0, ORDER)), []);
});
