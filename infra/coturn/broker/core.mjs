import { createHmac } from 'node:crypto';

export function credentials(config, secret, uid, now = Date.now()) {
  // Same user receives the same username within a five-minute bucket.
  const expiresAt = Math.floor(now / 300000) * 300 + config.credentialTtl;
  const username = `${expiresAt}:${uid}`;
  const credential = createHmac('sha1', secret).update(username).digest('base64');
  const urls = [`turn:${config.turnHost}:3478?transport=udp`, `turn:${config.turnHost}:3478?transport=tcp`];
  if (config.tls) urls.push(`turns:${config.turnHost}:5349?transport=tcp`);
  return { expiresAt, iceServers: [{ urls, username, credential }] };
}

export function createHandler({ config, secret, verifyToken, now = Date.now }) {
  const origins = new Set(config.origins), allowed = new Set(config.allowedUids);
  let window = -1, global = 0, inflight = 0;
  const ips = new Map(), users = new Map();
  function limit(map, key, count) {
    if (!map.has(key) && map.size >= 10000) return false;
    const n = (map.get(key) || 0) + 1; map.set(key, n); return n <= count;
  }
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data));
    };
    if (req.method === 'GET' && req.url === '/healthz') return send(200, { ok: true });
    if (req.url !== '/v1/ice') return send(404, { error: 'not_found' });
    const origin = req.headers.origin;
    if (!origins.has(origin)) return send(403, { error: 'origin_denied' });
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      // The browser may reuse this preflight for 2 h (Chromium's maximum) instead of
      // sending OPTIONS before every credential POST: half the requests per refresh.
      res.setHeader('Access-Control-Max-Age', '7200');
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization');
      res.writeHead(204); return res.end();
    }
    if (req.method !== 'POST') return send(405, { error: 'method_not_allowed' });
    // No request body is needed or accepted. Auth never comes from URL parameters.
    if (req.headers['transfer-encoding'] || Number(req.headers['content-length'] || 0) !== 0) {
      req.resume(); return send(400, { error: 'body_not_allowed' });
    }
    const current = Math.floor(now() / 60000);
    if (current !== window) { window = current; global = 0; ips.clear(); users.clear(); }
    // Listener is loopback-only; Caddy overwrites X-Real-IP with its socket peer.
    const ip = req.headers['x-real-ip'] || req.socket.remoteAddress;
    if (++global > 300 || !limit(ips, ip, 30) || inflight >= 32) {
      res.setHeader('Retry-After', '60'); return send(429, { error: 'rate_limited' });
    }
    const match = /^Bearer ([^\s]{1,8192})$/.exec(req.headers.authorization || '');
    if (!match) return send(401, { error: 'unauthorized' });
    inflight++;
    try {
      const token = await verifyToken(match[1]);
      if (!token || typeof token.uid !== 'string' || !token.uid || token.uid.length > 128 || /[:\s]/u.test(token.uid)) {
        return send(401, { error: 'unauthorized' });
      }
      if (token.firebase?.sign_in_provider === 'anonymous' ||
          (!config.allowAllAuthenticated && !allowed.has(token.uid))) return send(403, { error: 'user_denied' });
      if (!limit(users, token.uid, 6)) { res.setHeader('Retry-After', '60'); return send(429, { error: 'rate_limited' }); }
      return send(200, credentials(config, secret, token.uid, now()));
    } catch (e) {
      return send(401, { error: 'unauthorized' });
    } finally { inflight--; }
  };
}
