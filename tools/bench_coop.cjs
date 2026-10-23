// Bytes que manda el anfitrión a cada invitado: formato de antes (f.e) contra
// el compacto (f.e2, js/net/rows.js). Simulación reproducible, no tráfico real.
//   node tools/bench_coop.cjs
const fs = require('node:fs'), path = require('node:path');
const { performance } = require('node:perf_hooks');
const { frame } = require('../tests/net-fixtures.cjs');
const load = file => { const G = {}; new Function('G', fs.readFileSync(path.join(__dirname, '..', file), 'utf8'))(G); return G; };
const C = load('js/net/codec.js').NetCodec, R = load('js/net/rows.js').NetRows;

const HZ = 15, SECS = 15, TURN_CAP = 3 * 1024 * 1024;     // tope global del TURN (infra/coturn)
const wire = f => { const b = C.encode(f), j = Buffer.byteLength(JSON.stringify(f)); return Math.min(b ? b.byteLength : j, j); };

/*
 * Escenarios:
 *   juntos   todos los enemigos a la vista (lo peor para el compacto: nada lejos)
 *   grupo    jugadores separados: parte de los enemigos queda lejos del invitado
 * hit: probabilidad por envío de que un enemigo cambie de vida (golpes).
 */
function sim(n, spread, hit, seed = 11) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const list = Array.from({ length: n }, (_, i) => {
    const a = rnd() * Math.PI * 2, d = 60 + rnd() * spread;
    return [2000 + i * 7, Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d), 300 + Math.floor(rnd() * 3000), 1, Math.floor(rnd() * 8), 0];
  });
  const base = frame(0);
  // Estados con el uid largo (antes) o con el número de jugador (cv 2).
  const pOld = base.p, pNew = { 0: base.p[Object.keys(base.p)[0]], 2: base.p[Object.keys(base.p)[1]] };
  const memo = R.memo(), view = { x: 0, y: 0 };
  let old = 0, now = 0, tOld = 0, tNew = 0;
  for (let f = 0; f < HZ * SECS; f++) {
    for (const r of list) {
      const d = Math.hypot(r[1], r[2]) || 1, sp = 3 + (r[0] % 5);
      r[1] = Math.round(r[1] - (r[1] / d) * sp) + 0; r[2] = Math.round(r[2] - (r[2] / d) * sp) + 0;
      if (d < 60) { const a = rnd() * Math.PI * 2; r[1] = Math.round(Math.cos(a) * spread); r[2] = Math.round(Math.sin(a) * spread); }
      const x = rnd();
      if (x < hit) r[3] = Math.max(1, r[3] - 1 - Math.floor(rnd() * 60));
      else if (x < hit + 0.03) r[4] = Math.floor(rnd() * 7);
      else if (x < hit + 0.045) r[5] = Math.floor(rnd() * 8);
      else if (x < hit + 0.05) r[6] = rnd() < 0.5 ? 0 : 1 + Math.floor(rnd() * 15);
    }
    const rows = list.map(r => r.slice());
    let t = performance.now();
    const fo = Object.assign({}, base, { p: pOld, e: rows });
    old += wire(fo); C.decode(C.encode(fo));
    tOld += performance.now() - t;
    t = performance.now();
    const fn = Object.assign({}, base, { p: pNew, e2: R.encode(rows, view, memo) }); delete fn.e;
    now += wire(fn); R.decode(C.decode(C.encode(fn)).e2, () => {});
    tNew += performance.now() - t;
  }
  const frames = HZ * SECS;
  return { old: old / frames, now: now / frames, tOld: tOld / frames, tNew: tNew / frames };
}

const out = [];
for (const [name, spread, hit] of [['juntos, calma', 560, 0.05], ['juntos, combate', 560, 0.25], ['grupo separado', 940, 0.10]]) {
  for (const n of [30, 100, 300, 600]) {
    const r = sim(n, spread, hit);
    const kOld = r.old * HZ / 1024, kNow = r.now * HZ / 1024;
    out.push({
      escenario: name, enemigos: n,
      'bytes/envío antes': Math.round(r.old), 'bytes/envío ahora': Math.round(r.now),
      'ahorro': (100 * (1 - r.now / r.old)).toFixed(1) + '%',
      'KiB/s antes': +kOld.toFixed(1), 'KiB/s ahora': +kNow.toFixed(1),
      'invitados TURN antes': Math.floor(TURN_CAP / (kOld * 1024)), 'invitados TURN ahora': Math.floor(TURN_CAP / (kNow * 1024)),
      'ms/envío antes': +r.tOld.toFixed(3), 'ms/envío ahora': +r.tNew.toFixed(3)
    });
  }
}
console.table(out);
