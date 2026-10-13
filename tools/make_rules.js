/* Escribe en firestore.rules la lista de logros y sus premios (entre las
 * marcas "<logros>" y "</logros>"), para que el servidor sepa cuántos tickets
 * y monedas puede dar cada logro nuevo y no acepte logros inventados.
 *   node tools/make_rules.js        (lo llama también tools/export_data.js)
 * Lee tools/cache/gamedata.json. Si las reglas cambian, hay que desplegarlas:
 *   firebase deploy --only firestore
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const RULES = path.join(ROOT, 'firestore.rules');

// Datos de juego que usa el resumen de partida del ranking (smValid en las
// reglas): stats base de cada Pokémon, máximos de mejoras y cartas, y el daño
// máximo por segundo medido con tools/calibrate_dps.js (tools/anticheat_calib.json).
function summaryBlock(data) {
  const calibFile = path.join(__dirname, 'anticheat_calib.json');
  if (!fs.existsSync(calibFile)) throw new Error('falta tools/anticheat_calib.json (node tools/calibrate_dps.js)');
  const calib = JSON.parse(fs.readFileSync(calibFile, 'utf8'));
  const top = Math.max(...data.dex.map(m => m.dex));
  const hp = new Array(top + 1).fill(0), atk = new Array(top + 1).fill(0);
  for (const m of data.dex) { hp[m.dex] = Math.round(m.hp); atk[m.dex] = Math.round(m.atk * 100); }
  if (Math.max(...hp) > 999 || Math.max(...atk) > 999) throw new Error('stat fuera de 3 cifras');
  // Una tabla de 1.000 números no cabe en el tope de 1.000 expresiones de las reglas;
  // sí como texto (3 cifras por Pokémon) y cortando.
  const enc = a => a.map(v => String(v).padStart(3, '0')).join('');
  const ids = data.upgrades.map(u => u.id), cards = data.cards.filter(c => c.mods);
  // Las reglas tienen un tope de 1.000 expresiones por petición: sólo se comprueban a fondo las
  // mejoras y cartas que entran en las cotas (vida, ataque, recarga, crítico); del resto sólo
  // que el id exista. Un valor raro en las demás no cambia ninguna cota.
  const chk = (m, k, max) => `${m}.get('${k}', 0) >= 0 && ${m}.get('${k}', 0) <= ${max}`;
  const UP_USED = ['hp', 'atk', 'cd', 'crit'], CS_USED = ['hp', 'atk', 'cd'];
  const kCard = c => c.mods.hp != null || !c.max;     // sin tope propio: como mucho una por nivel
  const lines = [
    '    // <resumen> (generado por tools/make_rules.js, no editar a mano)',
    `    // ${data.dex.length} Pokémon (hasta el ${top}); 3 cifras cada uno: vida y ataque x100`,
    `    function hpOf(px) { return int('${enc(hp)}'[px * 3:px * 3 + 3]); }`,
    `    function atkOf(px) { return int('${enc(atk)}'[px * 3:px * 3 + 3]); }`,
    `    function upOk(u) { return u.keys().hasOnly([${ids.map(i => `'${i}'`).join(', ')}])`,
    ...data.upgrades.filter(u => UP_USED.includes(u.id)).map(u => `        && ${chk('u', u.id, u.max)}`).map((l, i, a) => i === a.length - 1 ? l + ';' : l),
    '    }',
    `    function csOk(c, lv) { return c.keys().hasOnly([${cards.map(c => `'${c.id}'`).join(', ')}])`,
    ...cards.filter(c => CS_USED.includes(c.id)).map(c => `        && ${chk('c', c.id, kCard(c) ? 'lv' : c.max)}`),
    `        && ${cards.filter(c => CS_USED.includes(c.id)).map(c => `c.get('${c.id}', 0)`).join(' + ')} <= lv;`,
    '    }',
    `    // daño máximo a un enemigo en 1 s por punto de ataque (medido x ${calib.margin} de margen) y mayor subida de ataque de los movimientos de apoyo`,
    `    function pkUnit() { return ${+(calib.pkUnit * calib.margin).toFixed(1)}; }`,
    `    function atkBuff() { return ${calib.atkBuff}; }`,
    '    // </resumen>'
  ];
  return lines.join('\n');
}

function run() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'cache', 'gamedata.json'), 'utf8'));
  const L = data.achievements;
  const ids = L.map(a => a.id);
  if (!ids.every(id => /^[A-Za-z0-9_-]+$/.test(id))) throw new Error('id de logro raro');
  // Premio de los logros de un mapa ach, en tiradas (x1 = 1, x10 = 10, 300 monedas = 1).
  // Todo logro da hasta 1 ticket x1 sin más (va aparte, por número de logros); aquí lo que pase de eso.
  const val = r => Math.max(0, (r.t1 || 0) - 1) + 10 * (r.t10 || 0) + (r.coins || 0) / 300;
  // Agrupados por premio: por cada grupo, cuántos logros suyos son nuevos (una
  // operación de conjuntos; uno a uno se pasaba del tope de 1.000 operaciones).
  const groups = {};
  for (const a of L) { const v = +val(a.reward).toFixed(3); if (v > 0) (groups[v] = groups[v] || []).push(a.id); }
  const terms = Object.entries(groups).map(([v, list]) => `${v} * achNew().intersection([${list.map(i => `'${i}'`).join(', ')}].toSet()).size()`);
  const block = [
    '    // <logros> (generado por tools/make_rules.js, no editar a mano)',
    "    function achNew() { return request.resource.data.save.get('ach', {}).diff(resource.data.save.get('ach', {})).addedKeys(); }",
    `    function achV() { return ${terms.join('\n        + ')}; }`,
    '    // </logros>'
  ].join('\n');
  const src = fs.readFileSync(RULES, 'utf8');
  const re = /    \/\/ <logros>[\s\S]*?\/\/ <\/logros>/;
  if (!re.test(src)) throw new Error('faltan las marcas <logros> en firestore.rules');
  const nl = src.includes('\r\n') ? '\r\n' : '\n';       // los mismos saltos de línea que el archivo
  let out = src.replace(re, block.replace(/\n/g, nl));
  out = out.replace(/    \/\/ <resumen>[\s\S]*?\/\/ <\/resumen>/, summaryBlock(data).replace(/\n/g, nl));
  if (out !== src) {
    fs.writeFileSync(RULES, out);
    console.log('firestore.rules: lista de logros actualizada (' + ids.length + '). Despliega: firebase deploy --only firestore');
  }
}

if (require.main === module) run();
module.exports = run;
