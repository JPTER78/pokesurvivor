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

t('no se salta etapas: cada forma pide la siguiente, y la final no pide nada', () => {
  // La etapa con la que empiezas manda: da igual si es la primera o la segunda.
  eq(E.next(1).to, 2, 'Bulbasaur → Ivysaur');
  eq(E.next(2).to, 3, 'Ivysaur → Venusaur');
  eq(E.next(3), null, 'Venusaur ya no evoluciona');
  eq(E.next(4).to, 5, 'Charmander → Charmeleon');
  eq(E.next(5).to, 6, 'Charmeleon → Charizard');
  eq(E.next(6), null, 'Charizard ya no evoluciona');
});

t('la línea evolutiva entera, para el panel de dev', () => {
  eq(E.line(4), [4, 5, 6], 'Charmander');
  eq(E.line(5), [4, 5, 6], 'da igual por qué etapa entres');
  eq(E.line(6), [4, 5, 6], 'Charizard');
  eq(E.line(1), [1, 2, 3], 'Bulbasaur');
  eq(E.line(129), [129, 130], 'Magikarp → Gyarados (de dos etapas)');
  eq(E.line(25), [172, 25, 26], 'Pichu → Pikachu → Raichu (la de por piedra también)');
  eq(E.line(133), null, 'Eevee ramifica: no hay línea');
  eq(E.line(99999), null, 'un dex que no existe');
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

t('empezando con Charmeleon: al 36 va a Charizard (si lo tienes)', () => {
  eq(E.info(fake(5, 35), () => true).ready, false, 'al 35 todavía no toca');
  const v = E.info(fake(5, 36), () => true);
  eq(v.ready, true, 'al 36 sí');
  eq([v.fromName, v.name], ['Charmeleon', 'Charizard']);
  const l = E.info(fake(5, 36), d => d !== 6);
  eq(l.ready, false, 'sin Charizard desbloqueado, bloqueada');
  eq(l.locked, true, 'y con aviso');
});

t('no se puede saltar una etapa aunque tengas la última', () => {
  const soloCharizard = d => d === 6;
  const v = E.info(fake(4, 40), soloCharizard);
  eq(v.ready, false, 'Charmander no puede saltar directo a Charizard');
  eq(v.locked, true, 'sale el aviso de que falta alguien');
  eq(v.to, 5, 'y falta Charmeleon, la siguiente de la línea');
  eq(v.name, 'Charmeleon');
  // En otra línea de tres etapas, igual: Bulbasaur → Ivysaur → Venusaur.
  const b = E.info(fake(1, 40), d => d === 3);
  eq(b.ready, false, 'Bulbasaur tampoco salta a Venusaur');
  eq(b.name, 'Ivysaur');
  // Y con la segunda desbloqueada pero no la tercera, la segunda no pasa.
  const i = E.info(fake(2, 40), d => d !== 3);
  eq(i.ready, false, 'Ivysaur necesita Venusaur');
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
    id, textContent: '', value: '', children: [], style: {}, dataset: {}, onclick: null, _cls: new Set(),
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

// ---------------- panel de estadísticas base (js/ui/hud.js) ----------------

console.log('\n=== panel de estadísticas base (G.HUD) ===');

load('js/ui/hud.js');                              // G.HUD

t('el panel enseña los valores base de la forma, no los de la run', () => {
  const H = G.HUD;
  eq(H.baseStats(DEX[4]), { hp: DEX[4].hp, atk: DEX[4].atk, spd: DEX[4].spd }, 'Charmander: los de la Pokédex');
  // Un jugador cargado de cartas y mejoras: el panel no mira nada de eso.
  const pl = fake(4, 30, { maxHp: 999, hp: 500, atk: 9, spd: 999 });
  eq(H.baseStats(pl.mon), { hp: DEX[4].hp, atk: DEX[4].atk, spd: DEX[4].spd }, 'con la partida mejorada, igual');
  eq(H.baseStats(null), null, 'sin Pokémon no hay panel');
});

t('cada etapa de la línea tiene sus propios valores (y se ven al empezar con ella)', () => {
  const H = G.HUD;
  const v = [4, 5, 6].map(d => H.baseStats(DEX[d]));
  eq(v[0], { hp: DEX[4].hp, atk: DEX[4].atk, spd: DEX[4].spd }, 'Charmander');
  eq(v[1], { hp: DEX[5].hp, atk: DEX[5].atk, spd: DEX[5].spd }, 'Charmeleon (empezando con él)');
  eq(v[2], { hp: DEX[6].hp, atk: DEX[6].atk, spd: DEX[6].spd }, 'Charizard (empezando con él)');
  is(v[1].hp > v[0].hp && v[2].hp > v[1].hp, 'en la línea sube la vida: ' + v.map(x => x.hp).join(' → '));
  is(v[1].atk > v[0].atk && v[2].atk > v[1].atk, 'y el ataque: ' + v.map(x => x.atk).join(' → '));
});

t('la caja va abajo a la derecha y no se sale de la pantalla', () => {
  const b = G.HUD.statsBox(1280, 720);
  is(b.x > 1280 / 2 && b.y > 720 / 2, 'esquina inferior derecha: ' + JSON.stringify(b));
  is(b.x + b.w <= 1280 && b.y + b.h <= 720, 'dentro de la pantalla');
  const chico = G.HUD.statsBox(320, 480);
  is(chico.x >= 6 && chico.y >= 64 && chico.x + chico.w <= 320 && chico.y + chico.h <= 480,
     'y en una pantalla pequeña también: ' + JSON.stringify(chico));
});

t('si la barra de movimientos está ahí, el panel se aparta', () => {
  const tapa = { x: 600, y: 620, w: 680, h: 100 };           // barra pegada al borde derecho
  const b = G.HUD.statsBox(1280, 720, tapa);
  const choca = b.x < tapa.x + tapa.w && tapa.x < b.x + b.w && b.y < tapa.y + tapa.h && tapa.y < b.y + b.h;
  is(!choca, 'no puede tapar la barra: ' + JSON.stringify(b));
  is(b.y + b.h <= 720 && b.x + b.w <= 1280, 'y sigue dentro: ' + JSON.stringify(b));
  // En un móvil la barra va centrada al pie: se sube por encima.
  const movil = G.HUD.statsBox(375, 667, { x: 66, y: 590, w: 243, h: 72 }, { right: 0, bottom: 20 });
  is(movil.y + movil.h <= 590, 'en móvil se sube por encima de la barra: ' + JSON.stringify(movil));
});

// ---------------- barra de dev (js/ui/dev-ui.js) ----------------
// Es una herramienta (sólo con ?dev), pero también tiene sus reglas: buscar por
// número o nombre, dar o quitar un Pokémon y pintar la línea entera.

console.log('\n=== barra de dev (G.DevUI) ===');

global.location = { search: '?dev' };
global.setInterval = () => 0;                      // que no deje el proceso vivo
G.DB.grant = d => { G.DB.save.owned[d] = { at: 1, from: 'dev' }; };
G.DB.commit = () => true;
G.DB.save = { owned: {}, shiny: {}, partner: 0, partnerShiny: false };
G.Game = { state: 'playing', player: { dex: 4, level: 1 } };  // jugando con Charmander
let subidas = 0;                                   // veces que se ha mandado subir de nivel
G.Game.debugLevelUp = () => { subidas++; G.Game.player.level++; };
load('js/ui/dev-ui.js');                           // G.DevUI

t('busca un Pokémon por número o por nombre', () => {
  const D = G.DevUI;
  eq(D.find('4'), 4, 'por número');
  eq(D.find('006'), 6, 'con ceros delante');
  eq(D.find('charmander'), 4, 'por nombre entero');
  eq(D.find('char'), 4, 'por el principio del nombre');
  eq(D.find('meleon'), 5, 'también si está dentro');
  eq(D.find('  pika '), 25, 'y quitando espacios de los lados');
  eq(D.find(''), 0, 'sin escribir nada, nada');
  eq(D.find('zzz'), 0, 'lo que no existe, nada');
  eq(D.find('99999'), 0, 'un número que no es de nadie, nada');
});

t('dar y quitar un Pokémon (el shiny se va con él)', () => {
  const D = G.DevUI;
  eq(D.owns(4), false, 'de salida no lo tienes');
  is(D.toggle(4), 'se da');
  eq(D.owns(4), true, 'ahora sí');
  eq(G.DB.save.owned[4].from, 'dev', 'y queda claro que fue la herramienta de dev');
  G.DB.save.shiny[4] = { at: 2, from: 'wild' };
  is(D.toggle(4), 'se quita');
  eq(D.owns(4), false, 'ya no');
  eq(G.DB.save.shiny[4], undefined, 'y el shiny no se queda huérfano');
  eq(D.toggle(99999), false, 'un dex que no existe no se toca');
});

t('pinta la línea entera y el estado de cada etapa', () => {
  const D = G.DevUI;
  D.toggle(4);                                     // Charmander sí, el resto no
  dom['dev-q'].value = '4';
  D.paint();
  const chips = dom['dev-line'].children;
  eq(chips.length, 3, 'la línea de Charmander son tres');
  eq(chips[0].textContent, 'Charmander ✓');
  eq(chips[1].textContent, 'Charmeleon ✗');
  eq(chips[2].textContent, 'Charizard ✗');
  eq(dom['dev-toggle'].textContent, 'Quitar', 'el botón dice qué hará');
  eq(dom['dev-who'].textContent, 'Charmander');
  chips[1].onclick();                              // dar Charmeleon desde su chip
  eq(D.owns(5), true, 'el chip también da/quita');
  eq(dom['dev-line'].children[1].textContent, 'Charmeleon ✓', 'y se repinta');
});

t('si lo que escribes no existe, no le toca el turno a nadie', () => {
  const D = G.DevUI;
  const antes = JSON.stringify(G.DB.save.owned);
  dom['dev-q'].value = 'zzz';
  D.paint();
  eq(dom['dev-who'].textContent, '—', 'no hay Pokémon que mirar');
  eq(dom['dev-line'].children.length, 0, 'ni línea que dar');
  eq(dom['dev-toggle'].disabled, true, 'y el botón queda apagado');
  dom['dev-toggle'].onclick();                     // por si acaso, se pulsa
  eq(JSON.stringify(G.DB.save.owned), antes, 'no se le da ni se le quita nada a nadie');
  eq(D.owns(5), true, 'y por medio no se ha tocado a Charmeleon');
  dom['dev-q'].value = '';
  D.paint();
  eq(dom['dev-toggle'].disabled, false, 'al borrar la búsqueda vuelve a estar vivo');
  eq(dom['dev-who'].textContent, 'Charmander', 'y se vuelve a mirar al que juegas');
});

t('el botón de subir de nivel, y que no valga fuera de la partida', () => {
  const D = G.DevUI;
  const antes = subidas;
  is(D.subir(1), 'dentro de la partida sí');
  eq(subidas - antes, 1, 'un nivel por clic');
  is(D.subir(5), 'y de cinco en cinco');
  eq(subidas - antes, 6, 'seis en total');
  eq(G.Game.player.level, 7, 'el nivel ha subido con ellos');

  G.Game.state = 'ui';
  eq(D.subir(1), false, 'en el menú no vale');
  G.Game.state = 'over';
  eq(D.subir(1), false, 'y con la partida terminada tampoco');
  eq(subidas - antes, 6, 'no se ha subido nada de más');

  G.Game.state = 'ui';
  dom['dev-q'].value = '';
  D.paint();
  eq(dom['dev-level'].disabled, true, 'el botón queda apagado en el menú');
  eq(dom['dev-level5'].disabled, true, 'los dos');
  G.Game.state = 'playing';
  D.paint();
  eq(dom['dev-level'].disabled, false, 'y encendido en cuanto juegas');
  is(dom['dev-level'].title.includes('nivel 7'), 'y dice por qué nivel vas: ' + dom['dev-level'].title);
});

t('al arrancar, la barra mira al que juegas (no a lo último buscado)', () => {
  dom['dev-q'].value = 'bulba';                    // el navegador recuerda lo escrito
  G.DevUI.init();
  eq(dom['dev-q'].value, '', 'se borra la búsqueda de la sesión anterior');
  eq(dom['dev-who'].textContent, 'Charmander', 'y se mira al Pokémon de la partida');
});

console.log('\n' + (fail ? 'FALLOS: ' + fail + ' · ' : '') + ok + ' ok · ' + fail + ' fallos\n');
if (fail) process.exitCode = 1;
