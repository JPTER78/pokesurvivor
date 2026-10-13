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
  const out = src.replace(re, block.replace(/\n/g, nl));
  if (out !== src) {
    fs.writeFileSync(RULES, out);
    console.log('firestore.rules: lista de logros actualizada (' + ids.length + '). Despliega: firebase deploy --only firestore');
  }
}

if (require.main === module) run();
module.exports = run;
