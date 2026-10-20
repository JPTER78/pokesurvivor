/* Biomas de la run: los colores de las grietas que salen en el mapa (desde el
 * minuto 12) traen su clima y su nombre sin "Grieta ·". */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = f => fs.readFileSync(path.join(root, f), 'utf8');

// Tal cual, fuera de node:vm (cada archivo de tests va en su propio proceso).
globalThis.window = globalThis;
globalThis.G = { Sprites: { PX: 2 } };
for (const f of ['js/core/util.js', 'js/world/tiles.js', 'js/systems/weather.js']) (0, eval)(source(f));
const { Tiles, Weather } = globalThis.G;
const arena = type => Tiles.ARENA + Tiles.ARENA_TYPES.indexOf(type);
const top = w => Object.entries(w).sort((a, b) => b[1] - a[1])[0][0];

test('en el mapa, los colores de las grietas se llaman como su sitio (sin "Grieta ·")', () => {
  const water = Tiles.BIOMES[arena('water')];
  assert.equal(water.place, 'Gruta Marina');
  assert.match(water.name, /^Grieta · /);                    // dentro de la grieta, como siempre
  for (const b of Tiles.BIOMES) assert.doesNotMatch(b.place || b.name, /Grieta/);
});

test('cada bioma trae su clima: los tres de siempre igual, los de las grietas el de su tipo', () => {
  assert.deepEqual(Weather.weightsFor(0), { rain: 3, fog: 2, sun: 1.5, snow: 0.5, sand: 0.5 });
  assert.deepEqual(Weather.weightsFor(2), { sun: 3, sand: 3, fog: 1 });
  for (const [type, kind] of [['fire', 'sun'], ['water', 'rain'], ['ice', 'snow'], ['ground', 'sand'], ['rock', 'sand'], ['ghost', 'fog']]) {
    assert.equal(top(Weather.weightsFor(arena(type))), kind, type);
  }
  // Nada de nieve en el volcán ni sol en el glaciar (antes iban por bioma % 3).
  assert.ok(!Weather.weightsFor(arena('fire')).snow, 'nieve en el volcán');
  assert.ok(!Weather.weightsFor(arena('ice')).sun, 'sol en el glaciar');
  // Los que no tienen clima propio, uno tranquilo y sin los que hacen daño.
  const calm = Weather.weightsFor(arena('normal'));
  assert.ok(!calm.snow && !calm.sand, JSON.stringify(calm));
});

test('la run tiene su orden: la Gruta Marina sale como el archipiélago (la grieta de agua, igual)', () => {
  const water = arena('water');
  assert.equal(Tiles.RUN.length, Tiles.BIOMES.length - 1);    // todos menos el archipiélago, que va en su sitio
  const isles = Tiles.BIOMES[Tiles.RUN[water]];
  assert.equal(isles.place, 'Archipiélago');
  assert.equal(isles.layout, 'islands');
  assert.equal(isles.prop, 'tree');                           // árboles, no cristales
  assert.ok(!Tiles.RUN.includes(water), 'la Gruta Marina ya no sale en el mapa');
  Tiles.RUN.forEach((b, i) => { if (i !== water) assert.equal(b, i); });
  assert.equal(Tiles.runBiome(water + Tiles.RUN.length), Tiles.RUN[water]);   // da la vuelta
  assert.equal(Tiles.BIOMES[water].prop, 'crystal');          // la grieta de agua no cambia
  assert.equal(top(Weather.weightsFor(Tiles.RUN[water])), 'rain');
});
