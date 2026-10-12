/* ============ coop-pause.test.js — la partida se para mientras alguien elige ============
 *
 * Escenarios con el game.js y el coop.js reales (ver harness.js): solitario,
 * grupo, carreras entre cartas / objeto / vínculo, desconexiones, anfitrión
 * que se va de la pestaña, Esc en grupo, mensajes perdidos o desordenados,
 * tráfico durante la pausa y vuelta de la grieta.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { coopGame, soloGame } = require('./harness');

/** ¿Nadie avanza en `sec` segundos? (el reloj de la partida no se mueve) */
function frozenFor(g, sec) {
  const t = g.all.map(m => m.time);
  g.world.run(sec);
  return g.all.every((m, i) => !m.alive || Math.abs(m.time - t[i]) < 1e-9);
}

/** ¿El reloj de `m` avanza? */
function advances(world, m, sec = 0.5) {
  const t = m.time;
  world.run(sec);
  return m.time > t + sec * 0.5;
}

/** Elige lo que salga (cartas, objeto nuevo, vínculo) hasta que todos jueguen 2 s seguidos. */
function settle(g, sec = 15) {
  let calm = 0;
  return g.world.until(() => {
    for (const m of g.all) {
      if (!m.alive) continue;
      m.pickCard(0); m.chooseItem(1); m.pickBond();
    }
    calm = g.all.every(m => !m.alive || m.state === 'playing') ? calm + 1 : 0;
    return calm > 60;
  }, sec);
}

const noErrors = g => assert.deepEqual(g.world.errors(), []);

// ---------------- solitario ----------------

test('solitario: cartas, objeto, vínculo y Esc paran el juego y lo reanudan', () => {
  const { world, m } = soloGame();
  const g = { world, all: [m] };
  assert.ok(advances(world, m));

  m.give('xpBig', 5);
  world.run(0.1);
  assert.equal(m.state, 'levelup');
  assert.ok(frozenFor(g, 1));
  assert.ok(m.pickCard(0));
  assert.equal(m.state, 'playing');
  assert.equal(m.pl.cardsTaken, 1);

  // El primer objeto se pone solo, sin parar.
  m.give('item', 'a');
  world.run(0.1);
  assert.equal(m.pl.item, 'a');
  assert.equal(m.state, 'playing');

  m.give('item', 'b');
  world.run(0.1);
  assert.equal(m.state, 'choice');
  assert.ok(m.isOpen('scr-item'));
  assert.ok(frozenFor(g, 1));
  assert.ok(m.chooseItem(1));
  assert.equal(m.pl.item, 'b');
  assert.equal(m.state, 'playing');

  m.pl.bonds = 1;
  world.run(0.1);
  assert.equal(m.state, 'choice');
  assert.ok(m.isOpen('scr-bond'));
  assert.ok(frozenFor(g, 1));
  assert.ok(m.pickBond());
  assert.equal(m.pl.fusions, 1);
  assert.equal(m.state, 'playing');

  m.key('escape');
  world.run(0.1);
  assert.equal(m.state, 'paused');
  assert.ok(frozenFor(g, 1));
  m.key('escape');
  world.run(0.1);
  assert.equal(m.state, 'playing');
  assert.ok(advances(world, m));

  // El botón "Continuar" de la pausa también.
  m.key('escape');
  world.run(0.1);
  m.run.onResume();
  assert.equal(m.state, 'playing');
  assert.ok(!m.isOpen('scr-pause'));
  assert.deepEqual(m.flags, [], 'el juego normal no marca la partida');
  noErrors(g);
});

// ---------------- grupo: lo básico ----------------

for (const who of ['anfitrión', 'invitado']) {
  test(`grupo: el ${who} elige objeto -> paran todos`, () => {
    const g = coopGame();
    const X = who === 'anfitrión' ? g.host : g.guests[0];
    const Y = who === 'anfitrión' ? g.guests[0] : g.host;
    X.pl.item = 'a';
    g.host.give('item', 'b', X.uid);
    g.world.run(0.5);
    assert.equal(X.state, 'choice');
    assert.ok(X.isOpen('scr-item'));
    assert.equal(Y.state, 'held');
    assert.match(Y.banner, /Pausa: .* está eligiendo/);
    assert.ok(frozenFor(g, 1.5));
    assert.ok(X.chooseItem(1));
    g.world.run(0.5);
    assert.equal(X.pl.item, 'b');
    assert.equal(X.state, 'playing');
    assert.equal(Y.state, 'playing');
    assert.equal(Y.banner, '', 'se quita el aviso');
    assert.ok(advances(g.world, g.host));
    noErrors(g);
  });

  test(`grupo: el ${who} elige vínculo -> paran todos`, () => {
    const g = coopGame();
    const X = who === 'anfitrión' ? g.host : g.guests[0];
    const Y = who === 'anfitrión' ? g.guests[0] : g.host;
    X.G.Game.debugBond();
    g.world.run(0.5);
    assert.equal(X.state, 'choice');
    assert.ok(X.isOpen('scr-bond'));
    assert.equal(Y.state, 'held');
    assert.ok(frozenFor(g, 1.5));
    assert.ok(X.pickBond());
    g.world.run(0.5);
    assert.equal(X.pl.fusions, 1);
    assert.equal(X.state, 'playing');
    assert.equal(Y.state, 'playing');
    assert.ok(X.flags.includes('debug'), 'la ayuda de consola marca la partida');
    noErrors(g);
  });
}

test('grupo: la subida de nivel sigue esperando a que elijan todos', () => {
  const g = coopGame();
  const [H, A] = g.all;
  H.G.Game.debugLevelUp();
  g.world.run(0.5);
  assert.equal(H.state, 'levelup');
  assert.equal(A.state, 'levelup');
  assert.ok(H.pickCard(0));
  g.world.run(0.5);
  assert.equal(H.state, 'levelup', 'el anfitrión espera con su carta a la vista');
  assert.ok(frozenFor(g, 1));
  assert.ok(A.pickCard(0));
  g.world.run(0.5);
  assert.equal(H.state, 'playing');
  assert.equal(A.state, 'playing');
  noErrors(g);
});

// ---------------- el fallo de verdad: objeto y subida de nivel a la vez ----------------

test('grupo: el invitado coge objeto y XP en el mismo fotograma (jefe, cofre grande)', () => {
  const g = coopGame();
  const [H, A] = g.all;
  A.pl.item = 'a';
  H.give('item', 'b', 'A');
  H.give('xpBig', 5, 'A');
  g.world.run(0.5);
  assert.equal(H.state, 'levelup');
  assert.equal(A.state, 'levelup');
  assert.ok(A.isOpen('scr-levelup'), 'las cartas no desaparecen');
  assert.ok(H.pickCard(0));
  assert.ok(A.pickCard(0));
  g.world.run(0.5);
  // Antes: el menú del objeto se perdía, la partida seguía y la pausa del
  // invitado se quedaba puesta para siempre.
  assert.equal(A.state, 'choice');
  assert.ok(A.isOpen('scr-item'), 'el menú del objeto vuelve a salir');
  assert.equal(H.state, 'held');
  assert.ok(frozenFor(g, 1.5));
  assert.ok(A.chooseItem(1));
  g.world.run(0.5);
  assert.equal(A.pl.item, 'b');
  assert.equal(H.state, 'playing');
  assert.equal(A.state, 'playing');
  // Y la siguiente elección del anfitrión ya no lo deja parado para siempre.
  H.pl.item = 'a';
  H.give('item', 'c');
  g.world.run(0.5);
  assert.ok(H.chooseItem(1));
  g.world.run(0.5);
  assert.equal(H.state, 'playing');
  assert.equal(A.state, 'playing');
  noErrors(g);
});

// ---------------- llega un objeto o un vínculo con las cartas abiertas ----------------

for (const who of ['anfitrión', 'invitado']) {
  for (const kind of ['objeto', 'vínculo']) {
    for (const when of ['antes', 'después']) {
      test(`grupo: al ${who} le llega un ${kind} con las cartas abiertas, ${when} de elegir la suya`, () => {
        const g = coopGame();
        const X = who === 'anfitrión' ? g.host : g.guests[0];
        const Y = who === 'anfitrión' ? g.guests[0] : g.host;
        X.pl.item = 'a';
        g.host.G.Game.debugLevelUp();
        g.world.run(0.5);
        assert.equal(X.state, 'levelup');
        if (when === 'después') assert.ok(X.pickCard(0));
        if (kind === 'objeto') X.G.Game.debugItem('b'); else X.G.Game.debugBond();
        g.world.run(0.3);
        assert.equal(X.state, 'levelup');
        assert.ok(X.isOpen('scr-levelup'), 'el menú no tapa las cartas');
        assert.ok(!X.isOpen('scr-item') && !X.isOpen('scr-bond'));
        if (when === 'antes') assert.ok(X.pickCard(0), 'las cartas se pueden tocar');
        assert.ok(Y.pickCard(0));
        g.world.run(0.5);
        assert.equal(X.state, 'choice', 'al cerrar las cartas sale su menú');
        assert.ok(X.isOpen(kind === 'objeto' ? 'scr-item' : 'scr-bond'));
        assert.equal(Y.state, 'held');
        assert.ok(frozenFor(g, 1));
        if (kind === 'objeto') assert.ok(X.chooseItem(1)); else assert.ok(X.pickBond());
        g.world.run(0.5);
        assert.equal(X.state, 'playing');
        assert.equal(Y.state, 'playing');
        if (kind === 'objeto') assert.equal(X.pl.item, 'b'); else assert.equal(X.pl.fusions, 1);
        noErrors(g);
      });
    }
  }
}

// ---------------- llega 'lu' con un menú abierto ----------------

for (const kind of ['objeto', 'vínculo']) {
  test(`grupo: llegan las cartas mientras el invitado está en el menú de ${kind}`, () => {
    // Latencia alta: el anfitrión abre las cartas antes de enterarse del menú.
    const g = coopGame({ latency: 150 });
    const [H, A] = g.all;
    A.pl.item = 'a';
    if (kind === 'objeto') H.give('item', 'b', 'A'); else A.G.Game.debugBond();
    assert.ok(g.world.until(() => A.isOpen(kind === 'objeto' ? 'scr-item' : 'scr-bond'), 2));
    assert.equal(H.state, 'playing', 'el anfitrión todavía no lo sabe');
    H.G.Game.debugLevelUp();
    g.world.run(0.6);
    assert.equal(A.state, 'levelup');
    assert.equal(H.state, 'levelup');
    assert.ok(H.pickCard(0));
    assert.ok(A.pickCard(0));
    g.world.run(0.8);
    assert.equal(A.state, 'choice', 'el menú tapado vuelve');
    assert.equal(H.state, 'held');
    assert.ok(frozenFor(g, 1));
    if (kind === 'objeto') assert.ok(A.chooseItem(1)); else assert.ok(A.pickBond());
    g.world.run(0.8);
    assert.equal(A.state, 'playing');
    assert.equal(H.state, 'playing');
    noErrors(g);
  });
}

// ---------------- varios a la vez ----------------

test('grupo: dos eligiendo a la vez -> sólo se sigue cuando terminan los dos', () => {
  const g = coopGame();
  const [H, A] = g.all;
  H.pl.item = 'a'; A.pl.item = 'a';
  H.give('item', 'b');
  H.give('item', 'c', 'A');
  g.world.run(0.5);
  assert.equal(H.state, 'choice');
  assert.equal(A.state, 'choice');
  assert.ok(H.chooseItem(1));
  g.world.run(0.5);
  assert.equal(H.state, 'held', 'falta el invitado');
  assert.match(H.banner, /Ana está eligiendo/);
  assert.ok(frozenFor(g, 1));
  assert.ok(A.chooseItem(1));
  g.world.run(0.5);
  assert.equal(H.state, 'playing');
  assert.equal(A.state, 'playing');

  // Igual con dos vínculos.
  H.G.Game.debugBond(); A.G.Game.debugBond();
  g.world.run(0.5);
  assert.equal(H.state, 'choice');
  assert.equal(A.state, 'choice');
  assert.ok(A.pickBond());
  g.world.run(0.5);
  assert.equal(A.state, 'held');
  assert.ok(H.pickBond());
  g.world.run(0.5);
  assert.equal(H.state, 'playing');
  assert.equal(A.state, 'playing');
  noErrors(g);
});

test('grupo: dos objetos en el mismo fotograma -> se eligen uno detrás de otro', () => {
  const g = coopGame();
  const [H, A] = g.all;
  A.pl.item = 'a';
  H.give('item', 'b', 'A');
  H.give('item', 'c', 'A');
  g.world.run(0.5);
  assert.equal(A.run.item.next, 'b');
  assert.ok(A.chooseItem(1));
  g.world.run(0.1);
  assert.equal(A.state, 'choice', 'sale el segundo');
  assert.equal(A.run.item.next, 'c');
  assert.equal(H.state, 'held');
  assert.ok(A.chooseItem(0));
  g.world.run(0.5);
  assert.equal(A.pl.item, 'b');
  assert.equal(H.state, 'playing');
  assert.equal(A.state, 'playing');
  noErrors(g);
});

test('grupo: objeto con el vínculo abierto -> espera su turno', () => {
  const g = coopGame();
  const [, A] = g.all;
  A.pl.item = 'a';
  A.G.Game.debugBond();
  g.world.run(0.3);
  A.G.Game.debugItem('b');
  g.world.run(0.2);
  assert.ok(A.isOpen('scr-bond'), 'el objeto no tapa el vínculo');
  assert.ok(A.pickBond());
  g.world.run(0.1);
  assert.ok(A.isOpen('scr-item'));
  assert.ok(A.chooseItem(1));
  assert.ok(settle(g));
  assert.equal(A.pl.item, 'b');
  noErrors(g);
});

// ---------------- desconexiones ----------------

for (const mode of ['closed', 'failed']) {
  test(`grupo: un compañero se va (${mode}) mientras elige -> los demás siguen`, () => {
    const g = coopGame({ players: ['H', 'A', 'B'] });
    const [H, A, B] = g.all;
    A.pl.item = 'a';
    H.give('item', 'b', 'A');
    g.world.run(0.5);
    assert.equal(H.state, 'held');
    assert.equal(B.state, 'held');
    g.world.disconnect('A', mode);
    g.world.run(0.5);
    assert.equal(H.state, 'playing');
    assert.equal(B.state, 'playing');
    assert.ok(advances(g.world, H));
    noErrors(g);
  });
}

test('grupo: un compañero se va sin haber elegido carta -> los demás siguen', () => {
  const g = coopGame({ players: ['H', 'A', 'B'] });
  const [H, , B] = g.all;
  H.G.Game.debugLevelUp();
  g.world.run(0.5);
  assert.ok(H.pickCard(0));
  assert.ok(B.pickCard(0));
  g.world.run(0.5);
  assert.equal(H.state, 'levelup');
  g.world.disconnect('A');
  g.world.run(0.5);
  assert.equal(H.state, 'playing');
  assert.equal(B.state, 'playing');
  noErrors(g);
});

// ---------------- el anfitrión se va o deja de responder ----------------

test('grupo: el anfitrión cambia de pestaña mientras el invitado elige, y vuelve', () => {
  const g = coopGame();
  const [H, A] = g.all;
  A.pl.item = 'a';
  H.give('item', 'b', 'A');
  g.world.run(0.5);
  assert.equal(A.state, 'choice');
  H.hide();
  g.world.run(0.5);
  assert.ok(A.chooseItem(1));
  g.world.run(1);
  // Antes, al elegir con el anfitrión fuera, el invitado se ponía a jugar solo.
  assert.equal(A.state, 'held');
  assert.match(A.banner, /anfitrión/);
  H.show();
  g.world.run(0.8);
  assert.equal(H.state, 'playing');
  assert.equal(A.state, 'playing');
  assert.equal(A.banner, '');
  noErrors(g);
});

test('grupo: el anfitrión se va con todo en marcha y el invitado elige estando él fuera', () => {
  const g = coopGame();
  const [H, A] = g.all;
  H.hide();
  g.world.run(0.5);
  assert.equal(A.state, 'held');
  A.pl.item = 'a';
  A.G.Game.debugItem('b');
  g.world.run(0.3);
  assert.equal(A.state, 'choice');
  H.show();
  g.world.run(0.8);
  assert.equal(H.state, 'held', 'vuelve y espera a que el invitado elija');
  assert.ok(A.chooseItem(1));
  g.world.run(0.8);
  assert.equal(H.state, 'playing');
  assert.equal(A.state, 'playing');
  noErrors(g);
});

test('grupo: el anfitrión deja de responder (sin cambiar de pestaña) y vuelve', () => {
  const g = coopGame();
  const [H, A] = g.all;
  H.frozen = true;                     // el juego del anfitrión se congela
  g.world.run(3);
  assert.equal(A.state, 'held');
  assert.match(A.banner, /anfitrión/);
  H.frozen = false;
  g.world.run(1);
  assert.equal(A.state, 'playing');
  noErrors(g);
});

// ---------------- Esc en grupo ----------------

test('grupo: la pausa con Esc no para el juego (y se puede abrir esperando a otro)', () => {
  const g = coopGame();
  const [H, A] = g.all;
  H.key('escape');
  g.world.run(0.1);
  assert.ok(H.isOpen('scr-pause'));
  assert.equal(H.state, 'playing');
  assert.ok(advances(g.world, H));
  assert.ok(advances(g.world, A));
  H.key('escape');
  g.world.run(0.1);
  assert.ok(!H.isOpen('scr-pause'));

  H.pl.item = 'a';
  H.give('item', 'b');
  g.world.run(0.5);
  assert.equal(A.state, 'held');
  A.key('escape');
  g.world.run(0.1);
  assert.ok(A.isOpen('scr-pause'), 'se puede abrir para salir de la partida');
  assert.equal(A.state, 'held');
  assert.ok(H.chooseItem(1));
  g.world.run(0.5);
  assert.equal(A.state, 'playing', 'la pausa de grupo sigue sin parar nada');
  assert.ok(A.isOpen('scr-pause'));
  A.run.onResume();
  assert.ok(!A.isOpen('scr-pause'));
  assert.equal(A.state, 'playing');
  noErrors(g);
});

// ---------------- mensajes perdidos o desordenados ----------------

/** Tira el primer mensaje de `from` a `to` que cumpla `pred`. */
function dropOnce(g, from, to, pred) {
  let done = false;
  g.world.bus.filter = (f, t, msg) => {
    if (done || f !== from || t !== to || !pred(msg)) return true;
    done = true;
    return false;
  };
  return () => done;
}
const hasEv = (msg, k) => (msg.ev || []).some(e => e[0] === k);

test('perdidos: se pierde "lu" -> al invitado le salen las cartas igual', () => {
  const g = coopGame();
  const [H, A] = g.all;
  const dropped = dropOnce(g, 'H', 'A', m => hasEv(m, 'lu'));
  H.G.Game.debugLevelUp();
  g.world.run(0.8);
  assert.ok(dropped());
  assert.equal(A.state, 'levelup');
  assert.ok(settle(g));
  noErrors(g);
});

test('perdidos: se pierde "lp" -> se repite y la barrera se cierra', () => {
  const g = coopGame();
  const [H, A] = g.all;
  const dropped = dropOnce(g, 'A', 'H', m => hasEv(m, 'lp'));
  H.G.Game.debugLevelUp();
  g.world.run(0.5);
  assert.ok(H.pickCard(0));
  assert.ok(A.pickCard(0));
  g.world.run(2.5);
  assert.ok(dropped());
  assert.equal(H.state, 'playing');
  assert.equal(A.state, 'playing');
  noErrors(g);
});

test('perdidos: se pierde "lr" -> el invitado cierra las cartas igual', () => {
  const g = coopGame();
  const [H, A] = g.all;
  const dropped = dropOnce(g, 'H', 'A', m => hasEv(m, 'lr'));
  H.G.Game.debugLevelUp();
  g.world.run(0.5);
  assert.ok(A.pickCard(0));
  assert.ok(H.pickCard(0));
  g.world.run(1);
  assert.ok(dropped());
  assert.equal(A.state, 'playing');
  noErrors(g);
});

test('perdidos: se pierden "hs" o "he" del invitado -> la siguiente trama lo corrige', () => {
  for (const k of ['hs', 'he']) {
    const g = coopGame();
    const [H, A] = g.all;
    const dropped = dropOnce(g, 'A', 'H', m => hasEv(m, k));
    A.pl.item = 'a';
    H.give('item', 'b', 'A');
    g.world.run(0.8);
    assert.equal(H.state, 'held', k + ': el anfitrión se para igual');
    assert.ok(A.chooseItem(1));
    g.world.run(0.8);
    assert.ok(dropped(), k);
    assert.equal(H.state, 'playing', k);
    assert.equal(A.state, 'playing', k);
    noErrors(g);
  }
});

test('perdidos: se pierde el "hp" que quita la pausa -> el invitado sigue igual', () => {
  const g = coopGame();
  const [H, A] = g.all;
  H.pl.item = 'a';
  H.give('item', 'b');
  g.world.run(0.5);
  assert.equal(A.state, 'held');
  const dropped = dropOnce(g, 'H', 'A', m => hasEv(m, 'hp'));
  assert.ok(H.chooseItem(1));
  g.world.run(1);
  assert.ok(dropped());
  assert.equal(A.state, 'playing');
  noErrors(g);
});

test('desordenados y perdidos al azar: el estado acaba siendo el correcto', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const g = coopGame({ players: ['H', 'A', 'B'], latency: 60, jitter: 250, drop: 0.15, seed });
    const [H, A, B] = g.all;
    for (let round = 0; round < 3; round++) {
      A.pl.item = 'a'; B.pl.item = 'a';
      H.give('item', 'b', 'A');
      H.give('xpBig', 5, 'B');
      H.give('item', 'c', 'B');
      if (round === 1) A.G.Game.debugBond();
      g.world.run(0.3);
      assert.ok(settle(g, 25), `semilla ${seed}, ronda ${round}: ${g.all.map(m => m.uid + '=' + m.state).join(' ')}`);
    }
    assert.ok(advances(g.world, H), `semilla ${seed}: sigue el juego`);
    noErrors(g);
  }
});

// ---------------- tráfico ----------------

test('tráfico: con la partida parada se manda menos que jugando (TURN)', () => {
  const g = coopGame();
  const [H, A] = g.all;
  const bytes = () => g.world.bus.bytes['H>A'] + g.world.bus.bytes['A>H'];
  let b0 = bytes();
  g.world.run(4);
  const playing = bytes() - b0;
  A.pl.item = 'a';
  H.give('item', 'b', 'A');
  g.world.run(0.5);
  assert.equal(H.state, 'held');
  b0 = bytes();
  g.world.run(4);
  const paused = bytes() - b0;
  assert.ok(paused < playing * 0.65, `parada ${paused} B, jugando ${playing} B`);
});

// ---------------- grieta y caídos ----------------

test('grieta: al volver, anfitrión e invitado eligen el vínculo a la vez', () => {
  const g = coopGame();
  const [H, A] = g.all;
  H.pl.bonds = 1;
  H.G.Game.offerBond(false, true);     // el anfitrión sale de la arena antes
  g.world.run(0.4);
  A.pl.bonds = 1;
  A.G.Game.offerBond(false, true);     // el invitado, un poco después
  assert.equal(H.state, 'playing', 'no se para nada más volver');
  assert.ok(g.world.until(() => H.isOpen('scr-bond') && A.isOpen('scr-bond'), 4), 'los dos menús a la vez');
  assert.ok(H.pickBond());
  assert.ok(A.pickBond());
  g.world.run(0.5);
  assert.equal(H.state, 'playing');
  assert.equal(A.state, 'playing');
  noErrors(g);
});

test('caído: con el Pokémon debilitado el vínculo espera y la partida no se para', () => {
  const g = coopGame();
  const [H, A] = g.all;
  A.pl.dead = true;
  A.pl.bonds = 1;
  g.world.run(1);
  assert.equal(H.state, 'playing');
  assert.ok(!A.isOpen('scr-bond'));
  A.pl.dead = false;
  g.world.run(0.5);
  assert.ok(A.isOpen('scr-bond'));
  assert.equal(H.state, 'held');
  assert.ok(A.pickBond());
  assert.ok(settle(g));
  noErrors(g);
});
