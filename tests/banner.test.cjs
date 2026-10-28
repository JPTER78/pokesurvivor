// Avisos de shiny (CdV 13): ningún aviso normal los pisa; el normal espera a que
// acabe el del shiny y sale después. En cooperativo, el anfitrión manda la marca.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(isHost = false) {
  const sent = [];
  const G = { Coop: { active: isHost, isHost, say: (...a) => sent.push(a) } };
  const ctx = vm.createContext({ G });
  const f = 'js/systems/spawner.js';
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
  return { S: G.Spawner, sent };
}

test('un aviso normal no pisa el de un shiny: sale cuando éste acaba', () => {
  const { S } = load();
  S.say('¡Un Happiny shiny anda cerca!', 4.5, false, true);
  S.say('¡Marea de Pokémon!', 2.2);
  const b = S.banner();
  assert.equal(b.text, '¡Un Happiny shiny anda cerca!');
  assert.equal(b.shiny, true);
  S.tickBanner(4.6);
  assert.equal(S.banner().text, '¡Marea de Pokémon!');
  assert.equal(S.banner().shiny, false);
  S.tickBanner(2.3);
  assert.equal(S.banner(), null);
});

test('sin shiny en pantalla, los avisos se sustituyen como siempre; otro shiny sí lo sustituye', () => {
  const { S } = load();
  S.say('A'); S.say('B');
  assert.equal(S.banner().text, 'B');
  S.say('¡Un Pichu shiny anda cerca!', 4.5, false, true);
  S.say('¡Has conseguido a Pichu shiny!', 4.5, false, true);
  assert.equal(S.banner().text, '¡Has conseguido a Pichu shiny!');
});

test('el anfitrión manda a los compañeros si el aviso es de shiny', () => {
  const { S, sent } = load(true);
  S.say('normal', 2);
  S.say('shiny', 4.5, false, true);
  S.say('local', 2, true);
  assert.equal(JSON.stringify(sent), JSON.stringify([['normal', 2, false], ['shiny', 4.5, true]]));
});
