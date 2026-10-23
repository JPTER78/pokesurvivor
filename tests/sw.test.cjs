// sw.js con caché y red de mentira: qué se guarda, qué se borra y qué va a la red.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ORIGIN = 'https://pokesurvivor.com';

function worker() {
  const stores = new Map(), handlers = {}, net = [];
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
    async keys() { return [...stores.keys()]; },
    async delete(n) { return stores.delete(n); },
    async match(r) { for (const c of stores.values()) { const h = await c.match(r); if (h) return h; } }
  };
  const res = body => ({ ok: true, body, clone() { return res(body); } });
  const self = { addEventListener: (t, fn) => { handlers[t] = fn; }, skipWaiting() {}, clients: { claim: async () => {} } };
  const fetch = async req => { net.push(req.url); return res('net:' + req.url); };
  new Function('self', 'caches', 'fetch', 'location', 'URL', fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'))(
    self, caches, fetch, { origin: ORIGIN }, URL);
  async function get(p, init = {}) {
    const req = { url: ORIGIN + p, method: 'GET', cache: init.cache || 'default', mode: init.mode || 'cors' };
    let out = null;
    handlers.fetch({ request: req, respondWith: r => { out = r; } });
    const r = out ? await out : null;
    await new Promise(s => setTimeout(s, 0));               // deja acabar lo que se guarda después
    return r;
  }
  return { stores, net, get, handlers, caches };
}

test('version checks and no-store requests are never stored (one entry per check before)', async () => {
  const w = worker();
  for (let i = 0; i < 5; i++) assert.equal(await w.get('/version.json?t=' + i, { cache: 'no-store' }), null);
  assert.equal(await w.get('/version.json?t=9'), null);
  for (const c of w.stores.values()) assert.equal(c.m.size, 0);
});

test('hashed code is served from the cache, and a new version replaces the old one', async () => {
  const w = worker();
  await w.get('/js/app.min.js?v=aaa');
  const hit = await w.get('/js/app.min.js?v=aaa');
  assert.equal(hit.body, 'net:' + ORIGIN + '/js/app.min.js?v=aaa');
  assert.equal(w.net.filter(u => u.endsWith('?v=aaa')).length, 1, 'second load does not touch the server');
  await w.get('/js/app.min.js?v=bbb');
  const code = w.stores.get('ps-code-v2');
  assert.deepEqual([...code.m.keys()].filter(k => k.includes('app.min.js')), [ORIGIN + '/js/app.min.js?v=bbb']);
});

test('unversioned code is network first; urls with parameters are not stored', async () => {
  const w = worker();
  await w.get('/index.html'); await w.get('/index.html');
  assert.equal(w.net.length, 2);
  await w.get('/index.html?utm=x');
  assert.deepEqual([...w.stores.get('ps-code-v2').m.keys()], [ORIGIN + '/index.html']);
});

test('sprite retries (?r=) reuse the same cached image', async () => {
  const w = worker();
  await w.get('/assets/pokemon/25/Walk.png?r=1');
  await w.get('/assets/pokemon/25/Walk.png');
  assert.equal(w.net.length, 1);
  assert.deepEqual([...w.stores.get('ps-art-v1').m.keys()], [ORIGIN + '/assets/pokemon/25/Walk.png']);
});

test('activating drops the old leaking code cache but keeps the art', async () => {
  const w = worker();
  for (const n of ['ps-code-v1', 'ps-art-v1']) await w.caches.open(n);
  let done = null;
  w.handlers.activate({ waitUntil: p => { done = p; } });
  await done;
  assert.deepEqual([...w.stores.keys()].sort(), ['ps-art-v1']);
});
