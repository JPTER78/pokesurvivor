'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { enemy: createEnemy, melee, ranged, scenario } = require('./helpers/melee-harness.cjs');

// Conserva la signatura compacta de los escenarios básicos.
const enemy = (x, y, boss = false, dead = false) => createEnemy(x, y, 10, boss, dead);
const scene = (enemies, moves, manual = null) => scenario(enemies, moves, { manual });

test('El cuerpo a cuerpo prioriza enemigos alcanzables frente a jefes lejanos',()=>{
  const near=enemy(55,0),boss=enemy(250,0,true),s=scene([boss,near],[melee(90)]);
  assert.equal(s.pl.target,near);s.attack();assert.equal(s.casts.length,1);
  assert.ok(near.hp<100);assert.equal(boss.hp,100);
});
test('No se gasta una recarga completa sin objetivos alcanzables',()=>{
  const s=scene([enemy(250,0,true),enemy(160,0)],[melee(70)]);
  s.attack();assert.equal(s.casts.length,0);assert.equal(s.pl.activeMove().t,.05);
});
test('Los proyectiles mantienen la prioridad de los jefes',()=>{
  const boss=enemy(210,60,true),s=scene([enemy(35,0),boss],[ranged()]);
  assert.equal(s.pl.target,boss);s.attack();assert.equal(s.casts.length,1);
  assert.equal(s.shots.length,1);
});
test('El apuntado manual conserva la dirección seleccionada',()=>{
  const s=scene([enemy(55,0)],[melee(90)],Math.PI/2);
  s.attack();assert.equal(s.casts.length,1);assert.equal(s.slashes[0],Math.PI/2);
});
test('Los vínculos conservan blancos independientes para ataques de distinta clase',()=>{
  const near=enemy(0,60),boss=enemy(220,50,true),s=scene([boss,near],[ranged(),melee(90)]);
  const angle=s.pl.aim;assert.equal(s.pl.target,boss);s.attack();
  assert.equal(s.casts.length,2);assert.equal(s.casts[0].target,boss);
  assert.equal(s.casts[1].target,near);assert.equal(s.casts[0].aim,angle);
  assert.equal(s.casts[1].aim,Math.PI/2);assert.equal(s.pl.target,boss);
  assert.equal(s.pl.aim,angle);assert.ok(near.hp<100);
});
test('Cada movimiento cuerpo a cuerpo fusionado comprueba su propio alcance',()=>{
  const near=enemy(0,60),boss=enemy(230,0,true),s=scene([boss,near],[melee(20),melee(90)]);
  s.attack();assert.equal(s.casts.length,1);assert.equal(s.casts[0].m.radius,90);
  assert.equal(s.casts[0].target,near);assert.equal(s.pl.target,boss);
});
test('El apuntado automático descarta enemigos derrotados',()=>{
  const near=enemy(50,0),s=scene([enemy(10,0,false,true),near],[melee(90)]);
  assert.equal(s.pl.target,near);s.attack();assert.equal(s.casts.length,1);
});
