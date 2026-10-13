/* Decodifica una grabación de partida (js/core/replay.js) para mirarla o para
 * el verificador de la fase 2 (docs/anticheat.md).
 *
 *   node tools/replay_decode.js grabacion.json     (el documento replays/{uid}, o { h, log })
 *   require('./replay_decode').decode(log) -> [{ t, code, name, a, b }]   (t en segundos de partida)
 */
const NAMES = { 1: 'axis', 2: 'card', 3: 'reroll', 4: 'item', 5: 'bond', 6: 'slot', 7: 'check', 8: 'quit' };

function decode(log) {
  const bytes = Buffer.from(log.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const out = [];
  let i = 0, t = 0;
  const varint = () => {
    let v = 0, m = 1, b;
    do { b = bytes[i++]; v += (b & 127) * m; m *= 128; } while (b & 128 && i < bytes.length);
    return v;
  };
  const unzig = v => (v % 2 ? -(v + 1) / 2 : v / 2);
  while (i < bytes.length) {
    t += varint();
    const code = bytes[i++];
    const a = unzig(varint()), b = unzig(varint());
    out.push({ t: t / 1000, code, name: NAMES[code] || '?', a, b });
  }
  return out;
}

module.exports = { decode, NAMES };

if (require.main === module) {
  const doc = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
  const ev = decode(doc.log);
  console.log('cabecera:', doc.h);
  const count = {};
  for (const e of ev) count[e.name] = (count[e.name] || 0) + 1;
  console.log(ev.length, 'eventos', count);
  for (const e of ev.slice(0, 40)) console.log(e.t.toFixed(3), e.name, e.a, e.b);
}
