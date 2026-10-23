// Lo que guarda sw.js en el aparato y lo que pide al servidor, con el de antes y el de ahora.
//   node tools/bench_sw.cjs [ref de git del sw.js de antes, por defecto origin/main]
// Simulación: las versiones reales de js/app.min.js (tamaños sacados de git), 3 cargas
// de la página con cada una y la pestaña abierta 8 h al día mirando version.json cada 5 min.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.join(__dirname, '..'), ORIGIN = 'https://pokesurvivor.com';
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
const ref = process.argv[2] || 'origin/main';

const versions = git('log', '--format=%H', '--', 'js/app.min.js').trim().split('\n').reverse()
  .map((h, i) => ({ v: 'v' + i, size: +git('cat-file', '-s', h + ':js/app.min.js') }));
const days = Math.max(1, Math.round((Date.parse(git('log', '-1', '--format=%cI', '--', 'js/app.min.js').trim()) -
  Date.parse(git('log', '--reverse', '--format=%cI', '--', 'js/app.min.js').trim().split('\n')[0])) / 864e5));
const POLLS = days * 8 * 12;

function run(src) {
  const stores = new Map(), handlers = {};
  let requests = 0, appRequests = 0;
  class Cache {
    constructor() { this.m = new Map(); }
    async match(r) { return this.m.get(typeof r === 'string' ? r : r.url); }
    async put(r, res) { this.m.set(typeof r === 'string' ? r : r.url, res); }
    async keys() { return [...this.m.keys()].map(url => ({ url })); }
    async delete(r) { return this.m.delete(r.url); }
    async addAll() {}
  }
  const caches = {
    async open(n) { if (!stores.has(n)) stores.set(n, new Cache()); return stores.get(n); },
    async keys() { return [...stores.keys()]; }, async delete(n) { return stores.delete(n); },
    async match(r) { for (const c of stores.values()) { const h = await c.match(r); if (h) return h; } }
  };
  const res = size => ({ ok: true, size, clone() { return res(size); } });
  const sizeOf = url => (url.includes('app.min.js') ? versions.find(x => url.endsWith('?v=' + x.v)).size : url.includes('version.json') ? 70 : 30000);
  const fetch = async req => { requests++; if (req.url.includes('app.min.js')) appRequests++; return res(sizeOf(req.url)); };
  new Function('self', 'caches', 'fetch', 'location', 'URL', src)(
    { addEventListener: (t, fn) => { handlers[t] = fn; }, skipWaiting() {}, clients: { claim: async () => {} } }, caches, fetch, { origin: ORIGIN }, URL);
  const get = async (p, cache = 'default') => {
    const req = { url: ORIGIN + p, method: 'GET', cache, mode: 'cors' };
    let out = null;
    handlers.fetch({ request: req, respondWith: r => { out = r; } });
    if (out) await out; else await fetch(req);             // sin respondWith: el navegador va a la red
    await new Promise(s => setImmediate(s));
  };
  return (async () => {
    for (const { v } of versions) for (let i = 0; i < 3; i++) { await get('/index.html'); await get('/js/app.min.js?v=' + v); }
    for (let i = 0; i < POLLS; i++) await get('/version.json?t=' + i, 'no-store');
    let entries = 0, bytes = 0;
    for (const c of stores.values()) for (const r of c.m.values()) { entries++; bytes += r.size; }
    return { entries, MB: +(bytes / 1048576).toFixed(1), requests, appRequests };
  })();
}

(async () => {
  const before = await run(git('show', ref + ':sw.js')), after = await run(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'));
  console.log(`${versions.length} versiones de app.min.js en ${days} días · ${POLLS} consultas de version.json`);
  console.table({ antes: before, ahora: after });
})();
