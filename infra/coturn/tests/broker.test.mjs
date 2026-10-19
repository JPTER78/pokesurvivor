import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { credentials, createHandler } from '../broker/core.mjs';

const config = { turnHost: 'turn.test.net', origins: ['https://pokesurvivor.com'],
  allowedUids: ['player'], allowAllAuthenticated: false, credentialTtl: 3600, tls: false };
const secret = 'a'.repeat(64), now = () => 1800000000123;
function service(options = {}) {
  return createHandler({ config, secret, now,
    verifyToken: async token => {
      if (token !== 'valid') throw Error('invalid or expired JWT');
      return { uid: 'player', firebase: { sign_in_provider: 'password' } };
    }, ...options });
}
async function request(handler, changes = {}) {
  const req = { method: 'POST', url: '/v1/ice', socket: { remoteAddress: '127.0.0.1' }, resume() {},
    headers: { origin: config.origins[0], authorization: 'Bearer valid', 'x-real-ip': '1.2.3.4' }, ...changes };
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; },
    writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); },
    end(s) { this.body = s ? JSON.parse(s) : null; } };
  await handler(req, res); return res;
}
test('REST HMAC credentials are scoped to uid, expire, and never contain the shared secret', () => {
  const data = credentials(config, secret, 'player', now()), ice = data.iceServers[0];
  assert.match(ice.username, /^\d+:player$/);
  assert.ok(data.expiresAt > now() / 1000 + 3300 && data.expiresAt <= now() / 1000 + 3600);
  assert.equal(ice.credential, createHmac('sha1', secret).update(ice.username).digest('base64'));
  assert.ok(!JSON.stringify(data).includes(secret));
  assert.equal(ice.urls.length, 2);
  assert.equal(credentials({ ...config, tls: true }, secret, 'player', now()).iceServers[0].urls[2],
    'turns:turn.test.net:5349?transport=tcp');
});
test('authorized pilot user gets no-store credentials and an exact CORS origin', async () => {
  const r = await request(service()); assert.equal(r.status, 200);
  assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.equal(r.headers['Access-Control-Allow-Origin'], config.origins[0]);
});
test('missing/invalid tokens and non-allowed origins cannot issue credentials', async () => {
  for (const headers of [{ origin: config.origins[0] },
    { origin: config.origins[0], authorization: 'Bearer invalid' },
    { origin: 'https://evil.test', authorization: 'Bearer valid' }]) {
    const r = await request(service(), { headers }); assert.ok([401, 403].includes(r.status));
    assert.equal(r.body.iceServers, undefined);
  }
});
test('pilot allowlist is fail-closed, including valid but unlisted Firebase users', async () => {
  assert.equal((await request(service({ config: { ...config, allowedUids: [] } }))).status, 403);
  const anonymous = service({ config: { ...config, allowAllAuthenticated: true },
    verifyToken: async () => ({ uid: 'player', firebase: { sign_in_provider: 'anonymous' } }) });
  assert.equal((await request(anonymous)).status, 403);
});
test('per-user rate limit resets; preflight never invokes Firebase verification', async () => {
  let time = now(), verified = 0;
  const h = service({ now: () => time, verifyToken: async () => { verified++; return { uid: 'player' }; } });
  assert.equal((await request(h, { method: 'OPTIONS' })).status, 204); assert.equal(verified, 0);
  for (let i = 0; i < 6; i++) assert.equal((await request(h)).status, 200);
  assert.equal((await request(h)).status, 429);
  time += 60000; assert.equal((await request(h)).status, 200);
});
test('IP rate limit blocks token-verification floods before verification', async () => {
  let verified = 0;
  const h = service({ verifyToken: async () => { verified++; throw Error('bad token'); } });
  for (let i = 0; i < 30; i++) assert.equal((await request(h)).status, 401);
  assert.equal((await request(h)).status, 429); assert.equal(verified, 30);
});
test('request bodies, query credentials, unsafe uids and wrong methods fail', async () => {
  assert.equal((await request(service(), { headers: { origin: config.origins[0], 'content-length': '12' } })).status, 400);
  assert.equal((await request(service(), { url: '/v1/ice?token=valid' })).status, 404);
  assert.equal((await request(service(), { method: 'GET' })).status, 405);
  assert.equal((await request(service({ verifyToken: async () => ({ uid: 'bad:uid' }) }))).status, 401);
});
test('health checks disclose no credentials and do not call Firebase', async () => {
  const h = service({ verifyToken: () => { throw Error('must not run'); } });
  const r = await request(h, { method: 'GET', url: '/healthz', headers: {} });
  assert.deepEqual(r.body, { ok: true }); assert.equal(r.status, 200);
});
