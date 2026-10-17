/* ============ evo.test.js — pruebas de la evolución en la run ============
 * Sin dependencias ni navegador: se cargan los .js del juego con un G de
 * mentira y se comprueban las reglas (js/systems/evo.js), la carta que sale
 * en la subida de nivel (js/systems/levelup.js), el cambio de forma
 * (js/entities/player.js) y la animación (js/ui/run-ui.js, con un DOM de
 * mentira y relojes a mano).
 *
 *     node tools/evo.test.js
 *
 * Los datos de evolución los genera tools/fetch_evolutions.py (js/data/evolutions.js).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.dirname(__dirname);
const G = {};

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); ok++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FALLO ' + name + '\n        ' + e.message); }
}
function eq(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error((msg ? msg + ': ' : '') + ja + ' !== ' + jb);
}
function is(a, msg) { if (!a) throw new Error(msg || 'era falso'); }

function load(f) { new Function('G', fs.readFileSync(path.join(ROOT, f), 'utf8'))(G); }

// --- piezas de mentira (sólo lo que usan los módulos que probamos) ---
G.U = { clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), pickN: (a, n) => a.slice(0, n), TYPE_COLOR: {}, TYPE_NAME: {} };
G.Sprites = {
  Animator: class { constructor(dex, dir, shiny) { this.dex = dex; this.dir = dir; this.shiny = shiny; } },
  hasShiny: dex => dex !== 6,                    // Charizard (6) sin shiny: para probar la caída
  bodyRadius: dex => 10 + (dex % 7),
  bodyHeight: dex => 20 + (dex % 9),
  preload: () => {}
};
let owns = () => true;
G.DB = { owns: d => owns(d) };
G.Moves = { BY_ID: {}, poolFor: () => [], evoInfo: () => null, nextUpText: () => '' };

load('js/data/pokedex.js');       // G.DEX, G.DEX_BY
load('js/data/evolutions.js');    // G.EVO
load('js/systems/evo.js');        // G.Evo
load('js/systems/levelup.js');    // G.LevelUp
load('js/entities/player.js');    // G.Player

const E = G.Evo, DEX = G.DEX_BY;
// Un jugador de mentira: lo mínimo que miran las reglas y las cartas.
const fake = (dex, level, extra) => Object.assign({
  dex, mon: DEX[dex], level, moves: [], slots: [], maxMoves: 4, statsTaken: {}, banned: new Set()
}, extra || {});

console.log('\n=== datos (js/data/evolutions.js) ===');

t('hay evoluciones y todas apuntan a Pokémon que existen', () => {
  const keys = Object.keys(G.EVO);
  is(keys.length > 400, 'esperaba más de 400 especies con evolución, hay ' + keys.length);
  for (const k of keys) {
    for (const e of G.EVO[k]) {
      is(DEX[e.to], 'G.EVO[' + k + '] apunta a ' + e.to + ', que no está en la Pokédex');
      is(DEX[+k], 'G.EVO tiene la clave ' + k + ', que no está en la Pokédex');
      is(e.how, 'G.EVO[' + k + '] no dice cómo evoluciona');
    }
  }
});

t('las cadenas conocidas están bien', () => {
  eq(E.next(1).to, 2, 'Bulbasaur → Ivysaur');
  eq(E.next(2).to, 3, 'Ivysaur → Venusaur');
  eq(E.next(4).to, 5, 'Charmander → Charmeleon');
  eq(E.next(5).to, 6, 'Charmeleon → Charizard');
  eq(E.next(10).to, 11, 'Caterpie → Metapod');
  eq(E.next(129).to, 130, 'Magikarp → Gyarados');
  eq(E.next(636).to, 637, 'Larvesta → Volcarona');
});

t('los finales de cadena no evolucionan', () => {
  eq(E.next(3), null, 'Venusaur');
  eq(E.next(6), null, 'Charizard');
  eq(E.next(130), null, 'Gyarados');
  eq(E.next(99999), null, 'un dex que no existe');
});

t('las ramificadas no se ofrecen (decisión del dueño)', () => {
  eq(E.next(133), null, 'Eevee (8 ramas)');
  eq(E.next(412), null, 'Burmy (2 ramas)');
  eq(E.next(61), null, 'Poliwhirl (2 ramas)');
  for (const k of Object.keys(G.EVO)) {
    if (G.EVO[k].length > 1) eq(E.next(+k), null, 'la ramificada ' + k + ' no debe ofrecerse');
  }
});

console.log('\n=== niveles ===');

t('el nivel es el canónico de los juegos, tal cual', () => {
  eq(E.levelFor({ how: 'level', lvl: 7 }), 7, 'Caterpie');
  eq(E.levelFor({ how: 'level', lvl: 16 }), 16, 'Charmander');
  eq(E.levelFor({ how: 'level', lvl: 32 }), 32, 'Ivysaur');
  eq(E.levelFor({ how: 'level', lvl: 36 }), 36, 'Charmeleon');
  eq(E.levelFor({ how: 'level', lvl: 59 }), 59, 'Larvesta');
  eq(E.levelFor({ how: 'level', lvl: 64 }), 64, 'Haxorus');
  eq(E.next(1).lvl, 16, 'y es lo que pide la evolución (Bulbasaur → Ivysaur al 16)');
});

t('las que no son por nivel usan la reserva', () => {
  eq(E.levelFor({ how: 'use-item', lvl: null }), E.RESERVA, 'piedra');
  eq(E.levelFor({ how: 'trade', lvl: null }), E.RESERVA, 'intercambio');
  eq(E.levelFor({ how: 'level', lvl: null }), E.RESERVA, 'nivel por amistad (sin número)');
  eq(E.next(25).lvl, E.RESERVA, 'Pikachu → Raichu (piedra trueno)');
});

t('ningún nivel de evolución se sale de lo razonable (1..100, entero)', () => {
  let n = 0, min = 999, max = 0;
  for (const k of Object.keys(G.EVO)) {
    const e = E.next(+k);
    if (!e) continue;
    n++;
    is(e.lvl >= 1 && e.lvl <= 100, k + ' pide nivel ' + e.lvl);
    is(Number.isInteger(e.lvl), k + ' pide nivel no entero ' + e.lvl);
    if (e.how === 'level') { min = Math.min(min, e.lvl); max = Math.max(max, e.lvl); }
  }
  is(n > 400, 'esperaba más de 400 evoluciones ofrecibles, hay ' + n);
  eq([min, max], [7, 64], 'los niveles canónicos van del 7 (Caterpie) al 64 (Haxorus)');
});

console.log('\n=== cuándo se ofrece (G.Evo.info) ===');

t('sin el nivel todavía no hay nada', () => {
  const v = E.info(fake(4, 7), () => true);
  eq(v.to, 5, 'ya sabemos a cuál iría');
  eq(v.levelDone, false, 'todavía no toca');
  eq(v.ready, false, 'no hay carta');
  eq(v.locked, false, 'ni aviso');
});

t('con el nivel y la forma desbloqueada, sale la carta', () => {
  const v = E.info(fake(4, 16), () => true);
  eq(v.ready, true, 'carta lista');
  eq(v.locked, false, 'sin aviso de bloqueo');
  eq([v.fromName, v.name], ['Charmander', 'Charmeleon']);
  eq(E.info(fake(4, 15), () => true).ready, false, 'justo antes (nivel 15) todavía no');
  eq(E.info(fake(4, 30), () => true).ready, true, 'y sigue saliendo más arriba');
});

t('con el nivel pero sin desbloquear, sólo aviso', () => {
  const v = E.info(fake(4, 16), d => d !== 5);
  eq(v.ready, false, 'no hay carta');
  eq(v.locked, true, 'sí hay aviso');
  eq(v.name, 'Charmeleon');
  owns = d => d !== 5;                    // G.LevelUp.note usa G.DB.owns
  eq(G.LevelUp.note(fake(4, 16)), 'Charmander puede evolucionar, pero te falta desbloquear a Charmeleon.');
  owns = () => true;
});

t('sin evolución no hay carta ni aviso', () => {
  eq(E.info(fake(6, 40), () => true), null, 'Charizard');
  eq(E.info(fake(133, 40), () => true), null, 'Eevee (ramificada)');
  eq(E.info(null, () => true), null, 'sin jugador');
  eq(G.LevelUp.note(fake(6, 40)), '', 'sin aviso');
  eq(G.LevelUp.note(fake(4, 15)), '', 'sin nivel, sin aviso');
});

t('la carta sale forzada en la oferta (y lleva su sprite)', () => {
  const pl = fake(4, 16);
  const cards = G.LevelUp.offer(pl);
  eq(cards.length, 3);
  const c = cards.find(x => x.type === 'pevo');
  is(c, 'la carta de evolución tiene que salir siempre');
  eq(c.dex, 5, 'y llevar el dex de la forma nueva, para pintar el sprite');
  eq(c.title, 'Charmander → Charmeleon');
  is(!c.apply, 'la carta no aplica nada: el juego abre la animación antes de cambiar');
});

t('sin la forma desbloqueada no hay carta, pero sí aviso en la pantalla', () => {
  const pl = fake(4, 16);
  owns = d => d !== 5;
  is(!G.LevelUp.offer(pl).some(x => x.type === 'pevo'), 'no debe salir la carta');
  is(G.LevelUp.note(pl).indexOf('Charmeleon') > 0, 'y debe explicar a quién le falta');
  owns = () => true;
});

console.log('\n=== el cambio de forma (Player.evolveTo) ===');

t('cambia forma, vida, stats y sprite', () => {
  const pl = new G.Player(DEX[4], {}, true);
  const antes = { hp: pl.maxHp, spd: pl.baseSpd, atk: pl.baseAtk };
  is(pl.evolveTo(DEX[5]), 'debe evolucionar');
  eq(pl.dex, 5, 'dex');
  eq(pl.mon.name, 'Charmeleon', 'especie');
  eq(pl.anim.dex, 5, 'el sprite es el nuevo');
  eq(pl.r, G.Sprites.bodyRadius(5), 'el radio de golpes, también');
  eq(pl.bodyH, G.Sprites.bodyHeight(5), 'y la altura');
  eq(pl.baseSpd, DEX[5].spd, 'velocidad base');
  eq(pl.baseAtk, DEX[5].atk, 'ataque base');
  eq(pl.maxHp, DEX[5].hp, 'vida máxima de la forma nueva');
  is(pl.maxHp > antes.hp, 'normalmente evolucionar da más vida (' + antes.hp + ' → ' + pl.maxHp + ')');
  is(pl.hp === pl.maxHp, 'y al evolucionar se estrena al máximo');
});

t('mantiene lo ganado en la run: nivel, movimientos y cartas', () => {
  const pl = new G.Player(DEX[4], {}, false);
  pl.level = 17;
  pl.moves = [{ id: 'ascuas', lvl: 3, kind: 'attack' }];
  pl.slots = [[pl.moves[0]]];
  pl.atkMul = 1.5;
  pl.maxHp += 60; pl.hp = 20;            // cartas de Vigor (y está tocado)
  pl.evolveTo(DEX[5]);
  eq(pl.level, 17, 'el nivel no se toca');
  eq(pl.moves.length, 1, 'los movimientos siguen');
  eq(pl.slots[0][0].id, 'ascuas', 'y los huecos');
  eq(pl.maxHp, DEX[5].hp + 60, 'las cartas de vida siguen contando');
  eq(pl.hp, 20 + (DEX[5].hp - DEX[4].hp), 'y la vida sube lo mismo que suba la máxima (sin curar de más)');
  eq(pl.atkMul, 1.5, 'las mejoras de daño siguen');
});

t('la vida nunca se queda en 0 al evolucionar', () => {
  const pl = new G.Player(DEX[4], {}, false);
  pl.hp = 1;
  pl.evolveTo(DEX[5]);
  is(pl.hp >= 1, 'sigue vivo');
});

t('el shiny se pierde si la forma nueva no tiene sprite shiny', () => {
  const pl = new G.Player(DEX[144], {}, false);      // cualquiera shiny
  pl.shiny = true;
  is(pl.evolveTo(DEX[6]), 'evoluciona a Charizard (sin shiny en las pruebas)');
  eq(pl.shiny, false, 'se cae a la forma normal');
  eq(pl.anim.shiny, false, 'y el sprite también');
});

t('no hace nada si es la misma forma', () => {
  const pl = new G.Player(DEX[4], {}, false);
  eq(pl.evolveTo(DEX[4]), false);
  eq(pl.dex, 4);
  eq(pl.evolveTo(null), false);
  eq(pl.dex, 4);
});

// ---------------- la animación (js/ui/run-ui.js) ----------------
// El resto de pruebas no toca el DOM; aquí se monta uno mínimo y relojes a
// mano. Esta parte existe porque una vez la animación se cerraba sin cambiar
// la forma: salía todo, pero el Pokémon se quedaba igual.

console.log('\n=== la animación (G.RunUI.showEvolve) ===');

const dom = {};
function el(id) {
  const e = {
    id, textContent: '', children: [], style: {}, dataset: {}, onclick: null, _cls: new Set(),
    appendChild: c => { e.children.push(c); return c; },
    querySelector: () => null, querySelectorAll: () => []
  };
  e._html = '';
  Object.defineProperty(e, 'innerHTML', {
    get: () => e._html,
    set: v => { e._html = v; if (v === '') e.children = []; }
  });
  e.classList = {
    add: (...c) => c.forEach(x => e._cls.add(x)),
    remove: (...c) => c.forEach(x => e._cls.delete(x)),
    contains: c => e._cls.has(c),
    toggle: (c, on) => {
      const v = on === undefined ? !e._cls.has(c) : !!on;
      if (v) e._cls.add(c); else e._cls.delete(c);
      return v;
    }
  };
  return e;
}
const elem = id => (dom[id] || (dom[id] = el(id)));
global.document = { getElementById: elem, createElement: () => el('canvas') };

let sprites = [];
G.UI = {
  $: elem,
  show: id => elem(id).classList.remove('hidden'),
  hide: id => elem(id).classList.add('hidden'),
  sprite: (cv, dex) => sprites.push(dex),
  spriteCanvas: () => el('cv')
};
G.Audio = { sfx: () => {} };
load('js/ui/run-ui.js');                          // G.RunUI

// Relojes de mentira: se apuntan y los dispara la prueba cuando toca.
let tid = 0;
const timers = new Map();
global.setTimeout = (fn, ms) => { const id = ++tid; timers.set(id, { fn, ms }); return id; };
global.clearTimeout = id => timers.delete(id);
const relojes = () => { const v = [...timers.values()]; timers.clear(); v.forEach(x => x.fn()); };
const esperando = () => [...timers.values()].map(x => x.ms);

const R = G.RunUI;
const mon = () => ({ dex: 4, shiny: false, mon: DEX[4] });      // Charmander de verdad (stats incluidos)

t('al terminar la animación sí se cambia la forma (el callback no se pierde)', () => {
  let cambiado = 0;
  sprites = [];
  R.showEvolve(mon(), 5, () => cambiado++);
  eq(cambiado, 0, 'nada más abrir, todavía no cambia');
  eq(esperando(), [1600], 'primero el temblor (1,6 s)');
  eq(dom['evo-title'].textContent, '¿Qué? ¡Charmander está evolucionando!');
  eq(sprites, [4], 'con la forma vieja');
  R.finishEvolve();
  eq(cambiado, 0, 'en la fase del temblor no se puede terminar');
  relojes();                                      // sale la forma nueva
  eq(dom['evo-title'].textContent, '¡Charmeleon ha evolucionado!');
  eq(sprites, [4, 5], 'y luego la nueva');
  is(!dom['btn-evo'].classList.contains('hidden'), 'ya está el botón de continuar');
  is(dom['evo-gain'].innerHTML.includes('Vida <b>' + DEX[4].hp + ' → ' + DEX[5].hp + '</b>'),
     'y dice lo que gana: ' + dom['evo-gain'].innerHTML);
  R.finishEvolve();                               // Continuar
  eq(cambiado, 1, 'y ahora sí: el juego cambia la forma');
  is(dom['scr-evolve'].classList.contains('hidden'), 'la pantalla se cierra');
  eq(esperando(), [], 'y no queda ningún reloj suelto');
});

t('si no la tocas, a los 5 s se cierra sola y también cambia', () => {
  let cambiado = 0;
  R.showEvolve(mon(), 5, () => cambiado++);
  relojes();                                      // fase 1
  eq(cambiado, 0, 'la forma nueva no cambia nada por sí sola');
  eq(esperando(), [5000], 'queda el reloj de los 5 s');
  relojes();                                      // se cierra sola
  eq(cambiado, 1, 'el reloj también llama al juego');
  is(dom['scr-evolve'].classList.contains('hidden'), 'pantalla cerrada');
});

console.log('\n' + (fail ? 'FALLOS: ' + fail + ' · ' : '') + ok + ' ok · ' + fail + ' fallos\n');
if (fail) process.exitCode = 1;
