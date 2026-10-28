const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
function load(G, file, extra = {}) { new Function('G', ...Object.keys(extra), source(file))(G, ...Object.values(extra)); }
const noop = () => {};

function game(dex = 448, dev = true) {
  const events = [], G = { Dev: { enabled: dev }, T: s => s };
  load(G, 'js/core/util.js', { window: { G } });
  for (const f of ['pokedex', 'sprites-meta', 'sprites-forms', 'forms', 'natures', 'abilities', 'items']) load(G, `js/data/${f}.js`);
  G.DB = { save: { created: 1234, pnat: { [dex]: ['adamant', 1] } } };
  G.Weather = { speedFor: () => 1, current: null, force: noop, clear: noop };
  G.World = { isFree: () => true, setArena: noop, setBiome: noop, biome: 0 };
  G.Judgment = { AT: 1800, active: false };
  G.Sprites = { PX: 2, hasShiny: () => true, playerScale: () => 1, playerRadius: () => 18, bodyHeight: () => 60,
    preload: () => Promise.resolve(), Animator: class { constructor(key, scale, shiny) { this.dex = key; this.dir = 0; this.shiny = shiny; } play() {} } };
  G.Coop = { active: false, isHost: false, scaleHp: n => 1 + (n - 1) * .3, broadcast: ev => events.push(ev) };
  G.FX = { ring: noop, burst: noop, dmgText: noop, px: noop };
  G.Spawner = { say: noop };
  G.Audio = { sfx: noop }; G.Camera = { kick: noop };
  G.Progress = { event: (name, arg) => events.push([name, arg]) };
  G.Projectiles = { clear: noop }; G.Combat = { clearFields: noop }; G.Hazards = { clear: noop };
  G.Pickups = { pullAll: noop };
  G.Tiles = { T: 16, ARENA_THEMES: {}, arenaBiome: () => 1 };
  for (const f of ['js/systems/mons.js', 'js/systems/stats.js', 'js/data/ability-fx.js', 'js/entities/player.js', 'js/systems/forms.js']) load(G, f);
  const p = new G.Player(G.Mons.monFor(dex), { hp: 40, atkMul: 1.4, cdMul: .8 }, true);
  p.setAbility('steadfast');
  G.Game = { player: p, st: { time: 900 }, everyone: () => [p], flash: noop, offerBond: noop };
  const enemies = new Map();
  G.Enemy = class {
    constructor(def, x, y) { Object.assign(this, { def, x, y, id: enemies.size + 1, hp: def.hp, maxHp: def.hp, name: def.name, dead: false }); }
    hurt(d) { this.hp -= d; this.dead = this.hp <= 0; }
    makeShiny() { this.shiny = true; }
  };
  G.EnemyMgr = { bossAlive: () => false, stash: noop, restore: noop, clearRemote: noop,
    all: () => [...enemies.values()], get: id => enemies.get(id), add: e => enemies.set(e.id, e) };
  load(G, 'js/systems/rift.js');
  return { G, p, events, enemies };
}
module.exports = { game, load, source };
