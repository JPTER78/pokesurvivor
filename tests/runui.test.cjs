// Cartas de nivel y de vínculo con el dedo (run-ui.js): el click que el navegador
// manda detrás de un toque no puede elegir la carta nueva que quede debajo.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function fakeEl(id) {
  const ls = {};
  const el = {
    id, ls, dataset: {}, children: [], textContent: '', innerHTML: '', onclick: null,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener(t, fn) { (ls[t] = ls[t] || []).push(fn); },
    appendChild(c) { el.children.push(c); },
    setAttribute() {}, querySelectorAll: () => [], querySelector: () => null, style: {}
  };
  Object.defineProperty(el, 'innerHTML', { get: () => '', set: v => { if (v === '') el.children.length = 0; } });
  return el;
}

function runUI() {
  let now = 10000;
  const els = {}, $ = id => (els[id] = els[id] || fakeEl(id));
  const G = {
    UI: { $, show() {}, hide() {}, isOpen: () => true, spriteCanvas: () => fakeEl() }, Audio: { sfx() {} }, T: s => s,
    U: { TYPE_COLOR: { electric: '#fc0', fire: '#f40', water: '#39f' } }, Icons: { html: () => '' },
    Game: { player: { rerolls: 0, rerollBonus: 5 } }, LevelUp: { offer: () => [{ title: 'B0' }, { title: 'B1' }, { title: 'B2' }] }
  };
  const document = { createElement: () => fakeEl(), querySelectorAll: () => [] };
  const performance = { now: () => now };
  new Function('G', 'document', 'performance', 'setTimeout', 'clearTimeout', source('js/ui/run-ui.js'))(G, document, performance, () => 0, () => {});
  const finger = (el, pointerId = 7) => {
    el.ls.pointerdown.forEach(f => f({ pointerType: 'touch', pointerId }));
    now += 80;
    el.ls.pointerup.forEach(f => f({ pointerType: 'touch', pointerId }));
  };
  return { G, $, finger, wait: ms => { now += ms; } };
}

test('changing the cards with a finger: the click that follows does not pick the new card under it', () => {
  const r = runUI(), picked = [];
  r.G.RunUI.showLevelUp(5, [{ title: 'A0' }, { title: 'A1' }, { title: 'A2' }], c => picked.push(c.title));
  r.wait(1000);                                         // (pasa el rato en que no se pueden elegir)
  r.finger(r.$('lvl-reroll'));                          // «Cambiar opciones»
  const cards = r.$('cards').children;
  assert.equal(cards.length, 3);
  r.wait(30); cards[2].onclick();                       // el click del navegador cae en la carta nueva de debajo
  assert.deepEqual(picked, [], 'nothing is picked by itself');
  r.finger(cards[1]);                                   // y la que tocas de verdad sí
  assert.deepEqual(picked, ['B1']);
});

test('bond with a finger: the second step picks the move you touch, not the one that slid under your finger', () => {
  const r = runUI(), got = [];
  const mv = (id, type) => ({ id, name: id, type, lvl: 3, desc: '' });
  const loose = [mv('ember', 'fire'), mv('bubble', 'water'), mv('spark', 'electric')];
  r.G.RunUI.showBond({ mode: 'pair', loose, group: [] }, ms => got.push(ms.map(m => m.id)));
  r.wait(1000);
  r.finger(r.$('bond-cards').children[0]);              // 1.er paso: Ascuas
  const step2 = r.$('bond-cards').children;
  assert.equal(step2.length, 2);
  r.wait(30); step2[0].onclick();                       // el click de detrás, sobre Burbuja (que ha subido)
  assert.deepEqual(got, [], 'the second move is not chosen by itself');
  r.finger(step2[1]);
  assert.deepEqual(got, [['ember', 'spark']]);
});

test('mouse and keyboard keep working as before (a plain click picks at once)', () => {
  const r = runUI(), picked = [];
  r.G.RunUI.showLevelUp(5, [{ title: 'A0' }, { title: 'A1' }, { title: 'A2' }], c => picked.push(c.title));
  r.wait(1000);
  r.$('cards').children[0].onclick();
  assert.deepEqual(picked, ['A0']);
});

test('DNA Splicers displays two guarded choices and claims only the selected form once', () => {
  for (const index of [0, 1]) {
    const r = runUI(), picked = [];
    const forms = ['black', 'white'].map((v, i) => ({ id: 'kyurem-' + v, name: v, category: 'fusion',
      stone: 'dna_splicers', stoneName: 'Punta ADN', sprite: { key: '646-' + v }, stats: { pa: i ? 1 : 2, sa: i ? 2 : 1 } }));
    r.G.RunUI.showMegaStone(forms[0], id => picked.push(id), forms);
    const cards = r.$('mega-cards').children;
    assert.equal(cards.length, 2); cards[index].onclick(); assert.deepEqual(picked, []);
    r.wait(1000); r.finger(cards[index]); r.wait(1000); cards[1 - index].onclick();
    assert.deepEqual(picked, [forms[index].id]);
  }
});
