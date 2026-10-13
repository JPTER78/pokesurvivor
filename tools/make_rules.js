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

// ============================================================================
// Lo que hay que decidir al DESPLEGAR (ver DEPLOY.md). Todo lo demás sale de los datos del juego.
// ============================================================================

/** Día previsto para desplegar estas reglas (AAAA-MM-DD). Sólo sirve para calcular la fecha de abajo. */
const DEPLOY_PREVISTO = '2026-10-20';

/**
 * Fecha (UTC, AAAA-MM-DD) desde la que una marca del ranking SIN resumen de partida ni
 * grabación se rechaza. Hasta entonces se aceptan, para las pestañas que aún no se han
 * actualizado (el juego se actualiza solo en minutos; esto es un colchón).
 * Por defecto: 7 días después de DEPLOY_PREVISTO. Para otra fecha, sin tocar este archivo:
 *   SM_OBLIGATORIO=2026-11-03 node tools/export_data.js
 */
const SM_OBLIGATORIO = process.env.SM_OBLIGATORIO || addDays(DEPLOY_PREVISTO, 7);

/** Cartas de stat de más que dejan pasar las reglas sobre el nivel (el juego deja nivel + 1: Player.takeStat). */
const CARD_SLACK = 2;

// Cotas que NO salen de los datos (viven dentro del código de combate). Si cambian allí, cambian aquí.
const CRIT_MUL = 1.5;      // multiplicador del golpe crítico (CRIT_MUL en js/systems/combat.js)
const TYPE_MAX = 3.6;      // ventaja de tipo máxima 2,4 (MAX en js/data/types.js) por clima 1,5 (js/systems/weather.js)
const FUSION = 4;          // movimientos que se lanzan a la vez (Player.BOND_MAX)
const ENEMIES = 100;       // enemigos distintos a los que se puede pegar en un segundo (tope en pantalla 64 + los que caen)

/**
 * Huella de lo que hay detrás del daño MEDIDO: movimientos y tipos. La calibración
 * (tools/anticheat_calib.json) sólo vale mientras no cambien. (Mejoras, cartas, objetos y
 * altares no cuentan: sus efectos se leen de los datos cada vez que se generan las reglas.)
 */
function fingerprint() {
  const h = require('crypto').createHash('sha1');
  for (const f of ['js/data/moves.js', 'js/data/types.js']) {
    h.update(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n'));      // igual con LF que con CRLF
  }
  return h.digest('hex').slice(0, 12);
}

function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Datos de juego que usa el resumen de partida del ranking (smValid en las
// reglas): stats base de cada Pokémon, máximos de mejoras y cartas, lo que da cada
// objeto y altar, y el daño máximo por segundo medido con tools/calibrate_dps.js
// (tools/anticheat_calib.json).
//
// VIDA MÁXIMA (smHp): exacta = vida base + lo que da cada nivel de Vitalidad + lo que da cada carta
// de Vigor (+ lo que pueda dar un objeto). Todo se lee de los datos: para añadir un OBJETO que dé
// vida basta con ponerle `mods: { hp: N }` en js/data/items.js y volver a generar las reglas
// (node tools/export_data.js); la cota sube sola. (Los de `mods` con función se evalúan con un
// jugador de 200 de vida.)
function summaryBlock(data) {
  const calibFile = path.join(__dirname, 'anticheat_calib.json');
  if (!fs.existsSync(calibFile)) throw new Error('falta tools/anticheat_calib.json (node tools/calibrate_dps.js)');
  const calib = JSON.parse(fs.readFileSync(calibFile, 'utf8'));
  const missing = data.moves.map(m => m.id).filter(id => !calib.moves[id]);
  if (missing.length) throw new Error('movimientos sin calibrar: ' + missing.join(', ') + ' -> node tools/calibrate_dps.js');
  if (calib.fingerprint !== fingerprint()) console.warn('AVISO: han cambiado movimientos, tipos, mejoras o cartas desde la última calibración del daño. Ejecuta: node tools/calibrate_dps.js (ver DEPLOY.md)');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(SM_OBLIGATORIO)) throw new Error('SM_OBLIGATORIO tiene que ser AAAA-MM-DD: ' + SM_OBLIGATORIO);
  const [Y, M, D] = SM_OBLIGATORIO.split('-').map(Number);
  const top = Math.max(...data.dex.map(m => m.dex));
  const hp = new Array(top + 1).fill(0), atk = new Array(top + 1).fill(0);
  for (const m of data.dex) { hp[m.dex] = Math.round(m.hp); atk[m.dex] = Math.round(m.atk * 100); }
  if (Math.max(...hp) > 999 || Math.max(...atk) > 999) throw new Error('stat fuera de 3 cifras');
  // Una tabla de 1.000 números no cabe en el tope de 1.000 expresiones de las reglas;
  // sí como texto (3 cifras por Pokémon) y cortando.
  const enc = a => a.map(v => String(v).padStart(3, '0')).join('');
  const ids = data.upgrades.map(u => u.id), cards = data.cards.filter(c => c.mods);

  // --- lo que da cada fuente (de los datos del juego) ---
  const cardWith = key => {
    const c = cards.find(x => x.mods[key] != null);
    if (!c) throw new Error('ninguna carta de stat da ' + key);
    return c;
  };
  const num = x => +x.toFixed(4);
  const itemMax = (key, from = data.items) => Math.max(1, ...from.map(i => i.mods[key] || 1));
  const itemMin = (key, from = data.items) => Math.min(1, ...from.map(i => i.mods[key] || 1));
  const hpUp = data.perLevel.hp, hpCard = cardWith('hp').mods.hp;
  const hpItem = Math.max(0, ...data.items.map(i => i.mods.hp || 0));
  const atkUp = num(data.perLevel.atkMul - 1), atkCard = cardWith('atkMul').mods.atkMul;
  const atkBoost = num(itemMax('atkMul') * itemMax('atkMul', data.powers));     // objeto x altar
  const cdUp = num(1 - data.perLevel.cdMul), cdCard = cardWith('cdMul').mods.cdMul;
  const cdBoost = num(itemMin('cdMul') * itemMin('cdMul', data.powers));
  const pkUnit = +(calib.pkUnit * calib.margin).toFixed(1);

  // Las reglas tienen un tope de 1.000 expresiones por petición: sólo se comprueban a fondo las
  // mejoras y cartas que entran en las cotas (vida, ataque, recarga, crítico); del resto sólo
  // que el id exista. Un valor raro en las demás no cambia ninguna cota.
  const chk = (m, k, max) => `${m}.get('${k}', 0) >= 0 && ${m}.get('${k}', 0) <= ${max}`;
  const UP_USED = ['hp', 'atk', 'cd', 'crit'], CS_USED = [cardWith('hp').id, cardWith('atkMul').id, cardWith('cdMul').id];
  const hpCardId = cardWith('hp').id, atkCardId = cardWith('atkMul').id, cdCardId = cardWith('cdMul').id;
  const kCard = c => c.mods.hp != null || !c.max;     // sin tope propio: como mucho una por nivel (más el margen)
  const lines = [
    '    // <resumen> (generado por tools/make_rules.js, no editar a mano)',
    `    // ${data.dex.length} Pokémon (hasta el ${top}); 3 cifras cada uno: vida y ataque x100`,
    `    function hpOf(px) { return int('${enc(hp)}'[px * 3:px * 3 + 3]); }`,
    `    function atkOf(px) { return int('${enc(atk)}'[px * 3:px * 3 + 3]); }`,
    `    // desde esta fecha (UTC) una marca sin resumen ni grabación se rechaza (SM_OBLIGATORIO en tools/make_rules.js)`,
    `    function smObligatorio() { return timestamp.date(${Y}, ${M}, ${D}); }`,
    `    function upOk(u) { return u.keys().hasOnly([${ids.map(i => `'${i}'`).join(', ')}])`,
    ...data.upgrades.filter(u => UP_USED.includes(u.id)).map(u => `        && ${chk('u', u.id, u.max)}`).map((l, i, a) => i === a.length - 1 ? l + ';' : l),
    '    }',
    `    // cartas de stat: sus topes, y como mucho una por nivel (+${CARD_SLACK} de margen: el juego deja nivel + 1)`,
    `    function csOk(c, lv) { return c.keys().hasOnly([${cards.map(c => `'${c.id}'`).join(', ')}])`,
    ...cards.filter(c => CS_USED.includes(c.id)).map(c => `        && ${chk('c', c.id, kCard(c) ? `lv + ${CARD_SLACK}` : c.max)}`),
    `        && ${cards.filter(c => CS_USED.includes(c.id)).map(c => `c.get('${c.id}', 0)`).join(' + ')} <= lv + ${CARD_SLACK};`,
    '    }',
    `    // Vida máxima: vida base + ${hpUp} por nivel de Vitalidad + ${hpCard} por carta de ${hpCardId}${hpItem ? ` (+ hasta ${hpItem} de un objeto)` : ''}; exacta (±1)`,
    `    function smHp(s) {`,
    `      let h = hpOf(s.px) + ${hpUp} * s.up.get('hp', 0) + ${hpCard} * s.cs.get('${hpCardId}', 0);`,
    `      return s.mh >= h - 1 && s.mh <= h + 1${hpItem ? ` + ${hpItem}` : ''};`,
    `    }`,
    `    // Daño: lo más que puede pegar a UN enemigo en 1 s ese Pokémon con esas mejoras y cartas`,
    `    // (ataque base, +${num(atkUp * 100)}% por nivel de Fuerza, x${atkCard} por carta, objeto x altar x${atkBoost}, mejor Danza x${calib.atkBoost || calib.atkBuff};`,
    `    // ventaja de tipo y clima x${TYPE_MAX}, crítico x${CRIT_MUL}; ${FUSION} movimientos fusionados; recarga mínima`,
    `    // ${num(cdBoost)} del objeto y el altar) y el total no puede pasar de eso en todos los segundos a ${ENEMIES} enemigos a la vez.`,
    `    function smPower(d, s) {`,
    `      let atk = atkOf(s.px) / 100.0 * (1 + ${atkUp} * s.up.get('atk', 0)) * math.pow(${atkCard}, s.cs.get('${atkCardId}', 0)) * ${atkBoost} * ${calib.atkBuff};`,
    `      let cd = (1 - ${cdUp} * s.up.get('cd', 0)) * math.pow(${cdCard}, s.cs.get('${cdCardId}', 0)) * ${num(cdBoost)};`,
    `      return s.pk <= ${pkUnit} * atk * ${TYPE_MAX} * (s.up.get('crit', 0) > 0 ? ${CRIT_MUL} : 1) * ${FUSION} / cd`,
    `        && s.dd <= s.pk * d.t * ${ENEMIES};`,
    `    }`,
    `    // medido x ${calib.margin} de margen (tools/calibrate_dps.js)`,
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
module.exports.fingerprint = fingerprint;
