'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  enemy,
  melee,
  ranged,
  scenario,
} = require('./helpers/melee-harness.cjs');

test('El borde del radio de impacto incluye el radio físico del enemigo', () => {
  const e = enemy(52, 0, 12),
    s = scenario([e], [melee(40)]);
  assert.equal(s.pl.target, e);
  s.attack();
  assert.equal(e.hp, 90);
});
test('Un enemigo fuera del radio combinado no recibe daño', () => {
  const e = enemy(52.01, 0, 12),
    m = melee(40),
    s = scenario([e], [m]);
  s.attack();
  assert.equal(s.casts.length, 0);
  assert.equal(m.t, 0.05);
});
test('Los enemigos grandes se pueden golpear aunque su centro quede fuera del alcance', () => {
  const e = enemy(85, 0, 30),
    s = scenario([e], [melee(60)]);
  s.attack();
  assert.equal(e.hp, 90);
});
test('El margen de apuntado no consume recargas contra jefes fuera del impacto', () => {
  const e = enemy(80, 0, 10, true),
    m = melee(55),
    s = scenario([e], [m]);
  s.attack();
  assert.equal(s.casts.length, 0);
  assert.equal(m.t, 0.05);
});
test('Selecciona el enemigo alcanzable más cercano independientemente del orden', () => {
  const far = enemy(60, 0),
    near = enemy(20, 0),
    s = scenario([far, near], [melee(70)]);
  assert.equal(s.pl.target, near);
});
test('El arco cuerpo a cuerpo golpea a varios enemigos en su interior', () => {
  const a = enemy(50, 0),
    b = enemy(45, 20),
    c = enemy(-40, 0);
  const s = scenario([a, b, c], [melee(75, Math.PI / 2)], { manual: 0 });
  s.attack();
  assert.equal(a.hp, 90);
  assert.equal(b.hp, 90);
  assert.equal(c.hp, 100);
});
test('El apuntado manual mantiene dirección y excluye objetivos situados detrás', () => {
  const a = enemy(-20, 0),
    b = enemy(30, 0),
    s = scenario([a, b], [melee(60, Math.PI / 2)], { manual: 0 });
  s.attack();
  assert.equal(a.hp, 100);
  assert.equal(b.hp, 90);
  assert.equal(s.slashes[0], 0);
});
test('Los límites angulares del arco son inclusivos', () => {
  const a = enemy(40, 40),
    b = enemy(40, -40),
    s = scenario([a, b], [melee(80, Math.PI / 2)], { manual: 0 });
  s.attack();
  assert.equal(a.hp, 90);
  assert.equal(b.hp, 90);
});
test('Un enemigo que entra en alcance antes del golpe puede recibirlo', () => {
  const a = enemy(140, 0),
    boss = enemy(210, 0, 10, true),
    s = scenario([boss, a], [melee(60)]);
  a.x = 45;
  s.attack();
  assert.equal(s.casts[0].target, a);
  assert.equal(a.hp, 90);
});
test('Un enemigo que sale del alcance no consume la recarga', () => {
  const e = enemy(25, 0),
    m = melee(60),
    s = scenario([e], [m]);
  e.x = 200;
  s.attack();
  assert.equal(s.casts.length, 0);
  assert.equal(m.t, 0.05);
});
test('Un enemigo derrotado entre apuntado y golpe se descarta', () => {
  const a = enemy(20, 0),
    b = enemy(40, 0),
    s = scenario([a, b], [melee(60)]);
  a.dead = true;
  s.attack();
  assert.equal(s.casts[0].target, b);
});
test('Sin enemigos, el ataque cuerpo a cuerpo espera', () => {
  const m = melee(),
    s = scenario([], [m]);
  s.attack();
  assert.equal(s.casts.length, 0);
  assert.equal(m.t, 0.05);
});
test('Se siguen golpeando objetos destructibles aunque no haya enemigos', () => {
  const p = { x: 20, y: 0, r: 5, hits: 0 },
    s = scenario([], [melee()], { prop: p, props: [p] });
  s.attack();
  assert.equal(p.hits, 1);
});
test('Un jugador derrotado no realiza ataques', () => {
  const m = melee(),
    s = scenario([enemy(20, 0)], [m]);
  s.pl.dead = true;
  s.attack();
  assert.equal(s.casts.length, 0);
  assert.equal(m.t, 0);
});
test('Los ataques fusionados comprueban alcances independientes', () => {
  const e = enemy(0, 70),
    s = scenario([e], [melee(20), melee(90)]);
  s.attack();
  assert.equal(s.casts.length, 1);
  assert.equal(s.casts[0].m.radius, 90);
  assert.equal(e.hp, 90);
});
test('Una fusión cuerpo a cuerpo y distancia conserva ambas direcciones', () => {
  const boss = enemy(220, 0, 10, true),
    e = enemy(0, 50),
    s = scenario([boss, e], [ranged(), melee(70)]);
  s.attack();
  assert.equal(s.casts.length, 2);
  assert.equal(s.casts[0].target, boss);
  assert.equal(s.casts[1].target, e);
  assert.equal(s.pl.target, boss);
  assert.equal(s.pl.aim, 0);
});
test('En cooperativo se envía el ángulo de cada movimiento fusionado', () => {
  const boss = enemy(220, 0, 10, true),
    e = enemy(0, 50),
    s = scenario([boss, e], [ranged(), melee(70)], { coop: true });
  s.attack();
  assert.equal(s.network.length, 2);
  assert.equal(s.network[0].aim, 0);
  assert.ok(Math.abs(s.network[1].aim - Math.PI / 2) < 1e-8);
});
test('Una excepción de red restaura el objetivo y el ángulo originales', () => {
  const boss = enemy(220, 0, 10, true),
    e = enemy(0, 50),
    s = scenario([boss, e], [ranged(), melee(70)], { coop: true });
  let n = 0;
  s.G.Coop.cast = () => {
    if (++n === 2) throw Error('network');
  };
  assert.throws(() => s.attack(), /network/);
  assert.equal(s.pl.target, boss);
  assert.equal(s.pl.aim, 0);
});
test('El apuntado permanece estable con una multitud de enemigos', () => {
  const crowded = Array.from({ length: 64 }, (_, i) => enemy(1000 + i, 0));
  const e = enemy(30, 0),
    m = melee(60),
    s = scenario([...crowded, e], [m]);
  e.hp = 2000;
  for (let i = 0; i < 100; i++) {
    m.t = 0;
    s.attack();
  }
  assert.equal(s.casts.length, 100);
});

test('Las hitboxes muy grandes pueden superar el margen tradicional del centro', () => {
  const target = enemy(110, 0, 55),
    s = scenario([target], [melee(60)]);
  assert.equal(s.pl.target, target);
  s.attack();
  assert.equal(s.casts.length, 1);
  assert.equal(target.hp, 90);
});
test('Se recalcula el ángulo si el enemigo se mueve detrás antes del golpe', () => {
  const target = enemy(30, 0),
    s = scenario([target], [melee(70)]);
  target.x = -40;
  s.attack();
  assert.equal(s.casts.length, 1);
  assert.ok(Math.abs(Math.abs(s.casts[0].aim) - Math.PI) < 1e-8);
  assert.equal(target.hp, 90);
  assert.equal(s.pl.aim, 0);
});

test('Al acercarse a un enemigo se recupera el ataque al entrar en alcance', () => {
  const target = enemy(130, 0);
  const move = melee(55);
  const options = { axis: [1, 0] };
  const s = scenario([target], [move], options);

  s.attack();
  assert.equal(s.casts.length, 0);
  for (let frame = 0; frame < 30 && !s.casts.length; frame++) {
    s.update(0.05);
    s.attack(0.05);
  }

  assert.ok(s.pl.x > 0);
  assert.equal(s.casts.length, 1);
  assert.equal(s.casts[0].target, target);
  assert.equal(target.hp, 90);
});

test('Al alejarse se dejan de lanzar ataques y la recarga no se bloquea', () => {
  const target = enemy(35, 0);
  const move = melee(55);
  const options = { axis: [1, 0] };
  const s = scenario([target], [move], options);

  s.attack();
  assert.equal(s.casts.length, 1);
  options.axis = [-1, 0];
  for (let frame = 0; frame < 50; frame++) {
    s.update(0.05);
    s.attack(0.05);
  }
  const attacksOutsideRange = s.casts.length;
  for (let frame = 0; frame < 12; frame++) {
    s.update(0.05);
    s.attack(0.05);
  }

  assert.equal(s.casts.length, attacksOutsideRange);
  assert.equal(target.hp, 90);
  assert.ok(move.t <= 0.05);
});

test('Un enemigo que pasa detrás recibe el golpe en la nueva dirección', () => {
  const target = enemy(35, 0);
  const s = scenario([target], [melee(65, Math.PI / 3)]);
  target.x = -35;

  s.attack();
  assert.equal(s.casts.length, 1);
  assert.ok(Math.abs(Math.abs(s.casts[0].aim) - Math.PI) < 1e-8);
  assert.equal(target.hp, 90);
});

test('El apuntado adquiere un objetivo nuevo si el anterior se aleja', () => {
  const oldTarget = enemy(25, 0);
  const incoming = enemy(160, 0);
  const s = scenario([oldTarget, incoming], [melee(55)]);
  oldTarget.x = 160;
  incoming.x = 30;

  s.attack();
  assert.equal(s.casts.length, 1);
  assert.equal(s.casts[0].target, incoming);
  assert.equal(incoming.hp, 90);
  assert.equal(oldTarget.hp, 100);
});

test('El movimiento bloqueado por una pared no aumenta artificialmente el alcance', () => {
  const target = enemy(88, 0);
  const move = melee(55);
  const options = {
    axis: [1, 0],
    collide: (pl) => {
      pl.x = Math.min(pl.x, 20);
    },
  };
  const s = scenario([target], [move], options);

  for (let frame = 0; frame < 20; frame++) {
    s.update(0.05);
    s.attack(0.05);
  }
  assert.ok(s.pl.x <= 20);
  assert.equal(s.casts.length, 0);
  assert.equal(target.hp, 100);
});

test('Sin objetivos, el apuntado automático sigue la dirección de movimiento', () => {
  const s = scenario([], [melee(60)], { axis: [0, -1] });
  s.update(0.1);

  assert.ok(Math.abs(s.pl.aim + Math.PI / 2) < 1e-8);
  s.attack();
  assert.equal(s.casts.length, 0);
});

test('La inmovilización impide caminar pero permite atacar', () => {
  const target = enemy(25, 0);
  const s = scenario([target], [melee(60)], { axis: [1, 0] });
  s.pl.frozen = true;
  const x = s.pl.x;

  s.update(0.2);
  s.attack();

  assert.equal(s.pl.x, x);
  assert.equal(s.casts.length, 1);
  assert.equal(target.hp, 90);
});

test('Al alternar ataque cuerpo a cuerpo y distancia se conservan las prioridades', () => {
  const nearby = enemy(30, 0);
  const boss = enemy(210, 0, 10, true);
  const closeMove = melee(60);
  const projectile = ranged();
  const s = scenario([boss, nearby], [closeMove]);
  s.pl.slots.push([projectile]);

  s.attack();
  assert.equal(s.casts[0].target, nearby);

  s.pl.setActive(1);
  s.update(0);
  s.attack();
  assert.equal(s.casts[1].target, boss);
  assert.equal(s.shots.length, 1);

  s.pl.setActive(0);
  closeMove.t = 0;
  s.update(0);
  s.attack();
  assert.equal(s.casts[2].target, nearby);
});

test('Volver al apuntado automático no conserva ángulos anteriores', () => {
  const target = enemy(40, 0);
  const options = { manual: Math.PI / 2 };
  const s = scenario([target], [melee(60, Math.PI / 3)], options);

  s.attack();
  assert.equal(s.casts.length, 1);
  assert.equal(target.hp, 100);

  options.manual = null;
  s.pl.activeMove().t = 0;
  s.update(0);
  s.attack();

  assert.equal(s.casts.length, 2);
  assert.ok(Math.abs(s.casts[1].aim) < 1e-8);
  assert.equal(target.hp, 90);
});

test('Tras revivir se pueden volver a ejecutar ataques', () => {
  const target = enemy(30, 0);
  const s = scenario([target], [melee(65)]);

  s.pl.dead = true;
  s.attack();
  assert.equal(s.casts.length, 0);

  s.pl.dead = false;
  s.update(0);
  s.attack();
  assert.equal(s.casts.length, 1);
  assert.equal(target.hp, 90);
});

test('Al entrar un enemigo en alcance se recuperan los ataques en los siguientes frames', () => {
  const incoming = enemy(160, 0);
  const move = melee(55);
  const s = scenario([incoming], [move]);

  for (let frame = 0; frame < 12; frame++) s.attack();
  assert.equal(s.casts.length, 0);
  incoming.x = 40;
  for (let frame = 0; frame < 8; frame++) s.attack();

  assert.equal(s.casts.length, 1);
  assert.equal(incoming.hp, 90);
});

test('La alternancia repetida de objetivos válidos e inválidos no bloquea ataques', () => {
  const target = enemy(140, 0);
  const move = melee(55);
  const s = scenario([target], [move]);

  target.hp = 1000;
  for (let frame = 0; frame < 40; frame++) {
    target.x = frame % 2 === 0 ? 35 : 140;
    move.t = 0;
    s.update(0);
    s.attack();
  }
  assert.equal(s.casts.length, 20);
});

test('Las recargas normales se respetan a lo largo de los fotogramas', () => {
  const target = enemy(30, 0);
  const move = melee(60);
  const s = scenario([target], [move], { axis: [0, 1] });

  for (let frame = 0; frame < 10; frame++) {
    s.update(0.01);
    s.attack(0.01);
  }
  assert.equal(s.casts.length, 1);
  assert.ok(move.t > 0.8);
});

test('Una fusión no vuelve a golpear al enemigo eliminado por su primer movimiento', () => {
  const target = enemy(30, 0);
  target.hp = 10;
  const secondMove = melee(60);
  const run = scenario([target], [melee(60), secondMove]);

  run.attack();

  assert.equal(target.dead, true);
  assert.equal(target.hp, 0);
  assert.equal(run.casts.length, 1);
  assert.equal(secondMove.t, 0.05);
});

test('Una fusión adquiere otro objetivo vivo cuando su primer movimiento elimina al anterior', () => {
  const firstTarget = enemy(30, 0);
  const secondTarget = enemy(-30, 0);
  firstTarget.hp = 10;
  const run = scenario(
    [firstTarget, secondTarget],
    [melee(60, Math.PI / 2), melee(60, Math.PI / 2)]
  );

  run.attack();

  assert.equal(firstTarget.dead, true);
  assert.equal(run.casts.length, 2);
  assert.equal(run.casts[1].target, secondTarget);
  assert.equal(secondTarget.hp, 90);
  assert.equal(run.pl.target, firstTarget);
  assert.equal(run.pl.aim, 0);
});

test('El arco conserva sus bordes al cruzar entre menos pi y pi', () => {
  const upperEdge = enemy(-40, 40);
  const lowerEdge = enemy(-40, -40);
  const outside = enemy(40, 0);
  const run = scenario(
    [upperEdge, lowerEdge, outside],
    [melee(80, Math.PI / 2)],
    { manual: Math.PI }
  );

  run.attack();

  assert.equal(upperEdge.hp, 90);
  assert.equal(lowerEdge.hp, 90);
  assert.equal(outside.hp, 100);
});
