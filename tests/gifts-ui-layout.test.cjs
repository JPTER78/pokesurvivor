'use strict';
// Regression de Android: el modal de regalos debe recibir los toques y
// dejar usar el teclado en horizontal, sin quedar detrás del menú.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'dev.html'), 'utf8');
const giftsUI = fs.readFileSync(path.join(root, 'js/ui/gifts-ui.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js/ui/ui.js'), 'utf8');

test('El modal supera menú (20), barra (25) y ajustes (60)', () => {
  assert.match(css, /\.scr\s*\{[^}]*z-index:\s*20/s);
  assert.match(css, /\.topbar\s*\{[^}]*z-index:\s*25/s);
  assert.match(css, /#scr-settings\s*\{[^}]*z-index:\s*60/s);
  assert.match(css, /#scr-gifts\s*\{[^}]*z-index:\s*70/s);
  assert.match(giftsUI, /G\.UI\.show\('scr-gifts',\s*true\)/);
  assert.match(ui, /'scr-gifts'/);
});

test('Campo editable, por encima del fondo e incorporado al formulario', () => {
  assert.match(html, /id="scr-gifts" class="scr dim hidden"/);
  assert.match(html, /id="gift-form"/);
  assert.match(html, /<input id="gift-code"[^>]+type="text"/);
  assert.match(html, /id="gift-redeem" type="submit"/);
  assert.match(css, /#scr-gifts #gift-code\s*\{[^}]*user-select:\s*text/s);
  assert.match(css, /#scr-gifts #gift-code\s*\{[^}]*touch-action:\s*manipulation/s);
  assert.doesNotMatch(html, /id="gift-panel"[^>]*max-height:/);
});

test('Landscape reduce padding y permite desplazarse dentro del modal', () => {
  assert.match(css, /@media \(max-height: 520px\)\s*\{[\s\S]*?#scr-gifts\s*\{\s*padding:\s*6px 10px/);
  assert.match(css, /#scr-gifts \.box\.settings\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /#scr-gifts \.box\.settings\s*\{[^}]*max-height:\s*calc\(100dvh - 16px\)/s);
});
