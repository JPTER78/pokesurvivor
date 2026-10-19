// Reproducible synthetic payload benchmark, not a live traffic/cost estimate.
const fs = require('node:fs'), path = require('node:path');
const { performance } = require('node:perf_hooks');
const { frame, client } = require('../tests/net-fixtures.cjs');
const G = {}; new Function('G', fs.readFileSync(path.join(__dirname, '../js/net/codec.js'), 'utf8'))(G);
const C = G.NetCodec, results = [];
for (const [name, f] of [['client', client()], ...[0, 30, 100, 300, 600].map(n => [`host-${n}`, frame(n)])]) {
  const json = JSON.stringify(f), b = C.encode(f), jsonBytes = Buffer.byteLength(json);
  for (let i = 0; i < 100; i++) { C.decode(C.encode(f)); }
  const start = performance.now();
  for (let i = 0; i < 1000; i++) { C.size(JSON.stringify(f)); C.decode(C.encode(f)); }
  const ms = (performance.now() - start) / 1000;
  const jsonStart = performance.now();
  for (let i = 0; i < 1000; i++) { JSON.parse(JSON.stringify(f)); }
  const jsonMs = (performance.now() - jsonStart) / 1000;
  const bytes = Math.min(b.byteLength, jsonBytes);
  results.push({ fixture: name, jsonBytes, wirePayloadBytes: bytes,
    reduction: `${(100 * (1 - bytes / jsonBytes)).toFixed(1)}%`,
    encodeSelectDecodeMs: +ms.toFixed(3), jsonEncodeDecodeMs: +jsonMs.toFixed(3),
    payloadKiBPerSecondAt15Hz: +(bytes * 15 / 1024).toFixed(2) });
}
console.table(results);
