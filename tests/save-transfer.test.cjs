const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(root, 'js/ui/save-transfer.js'), 'utf8');
const EXPORT = fs.readFileSync(path.join(root, 'tools/migration/pokesurvivor-export.user.js'), 'utf8');
function fixture() {
  let picked, reloaded = 0, confirmed = '';
  const data = new Map();
  const save = { v: 3, name: 'CuentaDestino', created: 10, updated: 20, coins: 500,
    owned: { 1: { at: 10 } }, shiny: {}, partner: 1, upgrades: {}, pupg: { 1: {} },
    stats: { runs: 0 }, tickets: { t1: 0, t10: 0 }, ach: {}, pity: {}, challenges: {} };
  const ctx = {
    G: {}, console, Blob, Date, JSON, setTimeout: fn => fn(),
    confirm: msg => { confirmed = msg; return true; }, alert: () => {},
    location: { hostname: 'prueba.pages.dev', reload: () => reloaded++ },
    URL: { createObjectURL: () => 'blob:1', revokeObjectURL: () => {} },
    localStorage: { setItem: (k, v) => data.set(k, v), getItem: k => data.get(k) || null },
    document: { body: { appendChild() {} }, createElement: tag => {
      const el = { files: [], click() { if (tag === 'input') picked = el; }, remove() {} };
      return el;
    } }
  };
  ctx.G.DB = { save, guest: false, mode: 'local', commit: () => true,
    merge: (a, b) => ({ ...a, ...b, owned: { ...a.owned, ...b.owned },
      pupg: { ...a.pupg, ...b.pupg }, stats: { ...a.stats, ...b.stats }, challenges: a.challenges }) };
  ctx.G.UI = { toast() {} }; ctx.G.Game = { state: 'ui' };
  ctx.G.DEX_BY = { 1: true, 25: true };
  vm.runInNewContext(SOURCE, ctx);
  const file = (overrides = {}) => ({ size: 101, text: async () => JSON.stringify({
    format: 'pokesurvivor-save-transfer-v1', sourceSite: 'pokesurvivor.com',
    save: { v: 3, coins: 850, owned: { 25: { at: 11 } },
      pupg: { 25: { hp: 2 } }, shiny: {}, stats: { runs: 9 },
      tickets: { t1: 4, t10: 1 }, ...overrides }
  }) });
  return { ctx, data, save, file, get picked() { return picked; },
    get reloaded() { return reloaded; }, get confirmed() { return confirmed; } };
}
test('Invitado, nube sin sesión y partida en curso bloquean importación', () => {
  const f = fixture(); f.ctx.G.DB.guest = true; f.ctx.G.SaveTransfer.chooseFile(); assert.equal(f.picked, undefined);
  f.ctx.G.DB.guest = false; f.ctx.G.DB.mode = 'cloud'; f.ctx.G.DB.online = false;
  f.ctx.G.SaveTransfer.chooseFile(); assert.equal(f.picked, undefined);
  f.ctx.G.DB.mode = 'local'; f.ctx.G.Game.state = 'playing';
  f.ctx.G.SaveTransfer.chooseFile(); assert.equal(f.picked, undefined);
});
test('Importa con copia de seguridad, conserva nombre y reinicia', async () => {
  const f = fixture(); f.ctx.G.SaveTransfer.chooseFile(); const inp = f.picked;
  inp.files = [f.file()]; await inp.onchange();
  assert.equal(f.save.name, 'CuentaDestino'); assert.equal(f.save.coins, 850);
  assert.ok(f.save.owned[25]); assert.ok(f.save.owned[1]); assert.equal(f.save.pupg[25].hp, 2);
  assert.equal(f.save.stats.runs, 9); assert.equal(f.reloaded, 1);
  assert.ok([...f.data.keys()].some(k => k.startsWith('ps.transfer.backup.')));
  assert.match(f.confirmed, /Firebase/);
});
test('Rechaza formatos rotos y versión incompatible', async () => {
  const f = fixture(); f.ctx.G.SaveTransfer.chooseFile(); const inp = f.picked;
  inp.files = [{ size: 4e6, text: async () => '{}' }]; await inp.onchange();
  inp.files = [f.file({ v: 12 })]; await inp.onchange();
  inp.files = [{ size: 20, text: async () => '{x' }]; await inp.onchange();
  assert.equal(f.save.coins, 500); assert.equal(f.reloaded, 0);
});
test('No transfiere nombre, campos secretos ni Pokémon inexistentes', async () => {
  const f = fixture(); f.ctx.G.SaveTransfer.chooseFile(); const inp = f.picked;
  inp.files = [f.file({ name: 'Intruso', secret: 'secret', owned: { 25: { at: 11 }, 99999: { at: 10 } } })];
  await inp.onchange();
  assert.equal(f.save.name, 'CuentaDestino');
  assert.equal(f.save.secret, undefined); assert.equal(f.save.owned[99999], undefined);
});
test('Exportador no hace peticiones ni escribe progreso', () => {
  const src = EXPORT.replace(/\/\/[^\n]*/g, '');
  assert.match(EXPORT, /pokesurvivor\.com/);
  assert.match(EXPORT, /URL\.createObjectURL/);
  assert.doesNotMatch(src, /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|sendBeacon|\.setItem\s*\(/);
});

test('La importación cloud solo llama a la operación autorizada y no cambia nada ante un rechazo', async () => {
  const f = fixture();
  f.ctx.G.DB.mode = 'cloud'; f.ctx.G.DB.online = true;
  let called = 0;
  f.ctx.G.DB.importExternalSave = async s => { called++; assert.equal(s.coins, 850); throw Error('Sin permiso'); };
  f.ctx.G.SaveTransfer.chooseFile();
  const inp = f.picked; inp.files = [f.file()]; await inp.onchange();
  assert.equal(called, 1);
  assert.equal(f.save.coins, 500); assert.equal(f.reloaded, 0);
  assert.ok([...f.data.keys()].some(k => k.startsWith('ps.transfer.backup.')));
});
test('El importador cloud espera al éxito de la transacción antes de recargar', async () => {
  const f = fixture();
  f.ctx.G.DB.mode = 'cloud'; f.ctx.G.DB.online = true;
  f.ctx.G.DB.importExternalSave = async s => {
    assert.equal(f.reloaded, 0); assert.equal(f.save.coins, 500);
    Object.assign(f.save, s);
  };
  f.ctx.G.SaveTransfer.chooseFile(); const inp = f.picked;
  inp.files = [f.file()]; await inp.onchange();
  assert.equal(f.reloaded, 1); assert.equal(f.save.coins, 850);
});
