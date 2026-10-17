/* ============ dex-query.test.js — pruebas de js/ui/dex-query.js ============
 * El módulo es puro (no usa DOM ni G.DB), así que se puede probar con Node:
 *
 *   node tools/dex-query.test.js
 *
 * Sale con código 0 si todo pasa, 1 si algo falla.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- carga del módulo tal cual está en el repo (sin tocar el archivo) ----
const file = path.join(__dirname, '..', 'js', 'ui', 'dex-query.js');
const sandbox = { G: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: 'dex-query.js' });
const Q = sandbox.G.DexQuery;
if (!Q) { console.error('No se cargó G.DexQuery'); process.exit(1); }

// ---- datos falsos ----
const DEX = [
  { dex: 1,   name: 'Bulbasaur',  types: ['grass', 'poison'],  rarity: 1, gen: 1 },
  { dex: 4,   name: 'Charmander', types: ['fire'],             rarity: 1, gen: 1 },
  { dex: 6,   name: 'Charizard',  types: ['fire', 'flying'],   rarity: 4, gen: 1 },
  { dex: 133, name: 'Eevee',      types: ['normal'],           rarity: 3, gen: 1 },
  { dex: 150, name: 'Mewtwo',     types: ['psychic'],          rarity: 5, gen: 1, leg: true },
  { dex: 25,  name: 'Pikachu',    types: ['electric'],         rarity: 3, gen: 1 },
  { dex: 152, name: 'Chikorita',  types: ['grass'],            rarity: 1, gen: 2 },
  { dex: 157, name: 'Typhlosion', types: ['fire'],             rarity: 4, gen: 2 }
];
const OWNED = { 1: { at: 100 }, 6: { at: 300 }, 25: { at: 200 } };
const SHINY = { 6: {}, 25: {} };
const FAV = { 6: {} };
const USED = { 6: 5, 25: 3, 1: 1 };
const SRC = {
  has: d => !!OWNED[d],
  shiny: d => !!SHINY[d],
  fav: d => !!FAV[d],
  used: d => USED[d] || 0,
  at: d => (OWNED[d] && OWNED[d].at) || 0
};
const dexNums = list => list.map(p => p.dex);

// ---- mini framework ----
let fails = 0, total = 0;
function eq(name, got, want) {
  total++;
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { console.log('  ok   ' + name); }
  else { fails++; console.log('  FAIL ' + name + '\n       esperado: ' + b + '\n       obtenido: ' + a); }
}

console.log('G.DexQuery · filtros');
eq('sin criterios devuelve todo ordenado por número', dexNums(Q.run(DEX, {}, SRC)), [1, 4, 6, 25, 133, 150, 152, 157]);
eq('gen 2 sólo esa generación', dexNums(Q.run(DEX, { gen: 2 }, SRC)), [152, 157]);
eq('gen "all" es todas', dexNums(Q.run(DEX, { gen: 'all' }, SRC)), [1, 4, 6, 25, 133, 150, 152, 157]);
eq('status own', dexNums(Q.run(DEX, { status: 'own' }, SRC)), [1, 6, 25]);
eq('status miss', dexNums(Q.run(DEX, { status: 'miss' }, SRC)), [4, 133, 150, 152, 157]);
eq('sólo shiny', dexNums(Q.run(DEX, { shiny: true }, SRC)), [6, 25]);
eq('sólo favoritos', dexNums(Q.run(DEX, { fav: true }, SRC)), [6]);
eq('rareza (array)', dexNums(Q.run(DEX, { rarity: [4] }, SRC)), [6, 157]);
eq('rareza (Set)', dexNums(Q.run(DEX, { rarity: new Set([1, 3]) }, SRC)), [1, 4, 25, 133, 152]);
eq('tipo (Set)', dexNums(Q.run(DEX, { types: new Set(['fire']) }, SRC)), [4, 6, 157]);
eq('tipo (array)', dexNums(Q.run(DEX, { types: ['grass'] }, SRC)), [1, 152]);
eq('buscar "char"', dexNums(Q.run(DEX, { q: 'char' }, SRC)), [4, 6]);
eq('buscar insensible a mayúsculas', dexNums(Q.run(DEX, { q: 'CHAR' }, SRC)), [4, 6]);
eq('buscar sin resultados', dexNums(Q.run(DEX, { q: 'zzz' }, SRC)), []);
eq('combinar gen + status + texto', dexNums(Q.run(DEX, { gen: 1, status: 'own', q: 'char' }, SRC)), [6]);
eq('combinar tipo + shiny', dexNums(Q.run(DEX, { types: ['fire'], shiny: true }, SRC)), [6]);

console.log('G.DexQuery · orden');
eq('orden por nombre (es)', Q.run(DEX, { sort: 'name' }, SRC).map(p => p.name),
  ['Bulbasaur', 'Charizard', 'Charmander', 'Chikorita', 'Eevee', 'Mewtwo', 'Pikachu', 'Typhlosion']);
eq('orden por rareza (desc)', dexNums(Q.run(DEX, { sort: 'rarity' }, SRC)), [150, 6, 157, 25, 133, 1, 4, 152]);
eq('orden por reciente (owned.at desc)', dexNums(Q.run(DEX, { sort: 'recent' }, SRC)), [6, 25, 1, 4, 133, 150, 152, 157]);
eq('orden por más usados', dexNums(Q.run(DEX, { sort: 'used' }, SRC)), [6, 25, 1, 4, 133, 150, 152, 157]);
eq('orden desconocido cae en número', dexNums(Q.run(DEX, { sort: 'nope' }, SRC)), [1, 4, 6, 25, 133, 150, 152, 157]);

console.log('G.DexQuery · robustez');
eq('sin fuente: status own no da nada', dexNums(Q.run(DEX, { status: 'own' }, null)), []);
eq('sin fuente: sort used no rompe', dexNums(Q.run(DEX, { sort: 'used' }, null)), [1, 4, 6, 25, 133, 150, 152, 157]);
eq('sin fuente: sin criterios devuelve todo', dexNums(Q.run(DEX, null, null)).length, 8);
eq('lista nula no rompe', Q.run(null, {}, SRC).length, 0);
const before = DEX.map(p => p.dex);
Q.run(DEX, { status: 'own', sort: 'rarity' }, SRC);
eq('no muta la lista de entrada', DEX.map(p => p.dex), before);
eq('devuelve un array nuevo', Q.run(DEX, {}, SRC) === DEX, false);

console.log('\n' + (fails ? 'FALLOS: ' + fails + '/' + total : 'Todo correcto (' + total + ' comprobaciones)'));
process.exit(fails ? 1 : 0);
