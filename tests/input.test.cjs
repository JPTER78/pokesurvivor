'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/core/input.js'), 'utf8');

function setup(state = 'ui') {
  const handlers = {};
  const G = { Game: { state }, SettingsUI: { isOpen: false } };
  vm.runInNewContext(source, {
    G, addEventListener: (name, fn) => { handlers[name] = fn; },
  });
  function key(code, options = {}, type = 'keydown') {
    const event = { code, target: { tagName: 'BODY' }, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...options };
    handlers[type](event);
    return event;
  }
  return { G, key };
}

test('Tab y Shift+Tab quedan libres en acceso, pausa y selección de mejoras', () => {
  for (const state of ['ui', 'paused', 'levelup', 'over']) {
    for (const shiftKey of [false, true]) {
      const { G, key } = setup(state);
      assert.equal(key('Tab', { shiftKey }).defaultPrevented, false);
      assert.equal(G.Input.tap('tab'), false);
      assert.equal(G.Input.held('tab'), false);
    }
  }
});

test('El teclado funciona antes de inicializar Game y dentro de ajustes', () => {
  const { G, key } = setup('playing');
  G.SettingsUI.isOpen = true;
  assert.equal(key('Tab').defaultPrevented, false);
  delete G.Game;
  assert.equal(key('Tab').defaultPrevented, false);
});

test('Escribir y navegar en campos no activa controles del juego', () => {
  for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' },
    { tagName: 'SELECT' }, { tagName: 'SPAN', isContentEditable: true }]) {
    const { G, key } = setup('playing');
    for (const code of ['Tab', 'ArrowLeft', 'Space', 'KeyW', 'KeyP', 'Enter']) {
      assert.equal(key(code, { target }).defaultPrevented, false);
      assert.equal(G.Input.tap(code.toLowerCase()), false);
      assert.equal(G.Input.held(code.toLowerCase()), false);
    }
  }
});

test('Tab conserva el atajo de combate y se libera al soltar la tecla', () => {
  const { G, key } = setup('playing');
  assert.equal(key('Tab').defaultPrevented, true);
  assert.equal(G.Input.tap('tab'), true);
  assert.equal(G.Input.held('tab'), true);
  G.Input.endFrame();
  key('Tab', { repeat: true });
  assert.equal(G.Input.tap('tab'), false);
  key('Tab', { target: { tagName: 'INPUT' } }, 'keyup');
  assert.equal(G.Input.held('tab'), false);
});

test('Se mantienen los controles de movimiento y la prevención de scroll en combate', () => {
  const { G, key } = setup('playing');
  for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']) {
    assert.equal(key(code).defaultPrevented, true);
    assert.equal(G.Input.held(code.toLowerCase()), true);
  }
});
