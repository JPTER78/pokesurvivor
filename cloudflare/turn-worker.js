/* ============ turn-worker.js — claves TURN para el cooperativo ============
 *
 * Cloudflare Worker (gratis) que da credenciales temporales del TURN de
 * Cloudflare Realtime a los jugadores. Sin TURN, las partidas en grupo que no
 * consiguen conexión directa (datos móviles, algunos routers) se retransmitían
 * por la Realtime Database de Firebase, a 1 $ el GB. Con TURN van por
 * Cloudflare: 1.000 GB gratis al mes y luego 0,05 $ el GB.
 *
 * Sólo se dan credenciales a jugadores con cuenta del juego: el juego manda su
 * token de Firebase y aquí se comprueba (firma de Google, proyecto y caducidad).
 * Así nadie de fuera puede gastar el cupo.
 *
 * Variables del Worker (Settings -> Variables and Secrets, tipo "Secret"):
 *   TURN_KEY_ID         el "Turn Token ID" de Cloudflare Realtime -> TURN
 *   TURN_KEY_API_TOKEN  el "API Token" de esa misma clave
 * Dominio: turn.pokesurvivor.com (Settings -> Domains & Routes -> Custom domain).
 * Ver docs/TURN.md.
 *
 * /online — contador aproximado de gente jugando (sin coste: plan gratis de
 * Workers). Cada pestaña avisa al abrir y cada 20 min con un id de sesión; un
 * Durable Object ("Online") recuerda quién ha avisado en los últimos 25 min y
 * devuelve cuántos son. Si se pasa del cupo gratis del día, simplemente falla
 * y el juego no enseña el número. Se despliega con wrangler (wrangler.toml).
 * QUITADO DEL JUEGO el 11-10-2026: se llevaba la mitad de las 100.000 llamadas
 * diarias del plan gratis. La ruta sigue sólo para pestañas que sigan abiertas.
 *
 * /mau — tope de cuentas del mes. Firebase (Identity Platform) da 50.000
 * usuarios con cuenta activos al mes gratis y después cobra ~0,0055 $ por cada
 * uno. El juego avisa aquí (con su token) la primera vez que entra cada cuenta
 * en el mes; al llegar a LIMIT, GET /mau dice open:false y el juego quita
 * "Crear cuenta" hasta el mes siguiente (los invitados no cuentan nunca).
 * /mau/new — lo llama el "portero" de Firebase (functions/index.js) ANTES de
 * crear cualquier cuenta, venga del juego o no: apunta la cuenta y dice si se
 * puede crear. Protegido con la clave MAU_SECRET (secreto del Worker y de la
 * función), así nadie más puede tocar el contador.
 */
const PROJECT = 'pokesurvivor-jpter';
const ORIGINS = ['https://pokesurvivor.com', 'https://www.pokesurvivor.com', 'http://127.0.0.1:8765', 'http://localhost:8765'];
const TTL = 4 * 3600;                         // segundos que valen las credenciales
const JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let keys = null, keysAt = 0;                  // claves públicas de Google (caché)

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',          // el navegador no repite la consulta OPTIONS (cada una cuenta)
    'Vary': 'Origin'
  };
}

const b64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));

/** ¿Es un token de Firebase válido de este proyecto? Devuelve el uid o null. */
async function verify(token) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;
  let head, body;
  try { head = JSON.parse(new TextDecoder().decode(b64url(parts[0]))); body = JSON.parse(new TextDecoder().decode(b64url(parts[1]))); }
  catch (e) { return null; }
  const now = Math.floor(Date.now() / 1000);
  if (head.alg !== 'RS256' || body.aud !== PROJECT || body.iss !== 'https://securetoken.google.com/' + PROJECT) return null;
  if (!body.sub || body.exp < now || body.iat > now + 300) return null;
  if (!keys || Date.now() - keysAt > 3600e3) {
    const r = await fetch(JWKS);
    keys = (await r.json()).keys; keysAt = Date.now();
  }
  const jwk = keys.find(k => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  return ok ? body.sub : null;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const h = cors(origin);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    // Ajuste manual (con la clave): el contador del mes no puede ser menor que N
    // (p. ej. las cuentas que entraron antes de que existiera el contador).
    if (new URL(req.url).pathname === '/mau/seed') {
      if (!env.MAU_SECRET || req.headers.get('X-PS-Secret') !== env.MAU_SECRET) return new Response('{"error":"no autorizado"}', { status: 401 });
      const n = parseInt(new URL(req.url).searchParams.get('n') || '0', 10);
      const r = await env.MAU.get(env.MAU.idFromName(monthKey())).fetch('https://mau/?seed=' + (n > 0 ? n : 0));
      return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    // Sin tope (LIMIT = 0): no se cuenta nada ni se despierta al Durable Object.
    if (LIMIT <= 0 && new URL(req.url).pathname.startsWith('/mau') && new URL(req.url).pathname !== '/mau/seed')
      return new Response('{"open":true,"v":3}', { headers: { ...h, 'content-type': 'application/json', 'cache-control': 'no-store' } });
    if (new URL(req.url).pathname === '/mau/new') {
      if (!env.MAU_SECRET || req.headers.get('X-PS-Secret') !== env.MAU_SECRET) return new Response('{"error":"no autorizado"}', { status: 401 });
      const uid = new URL(req.url).searchParams.get('uid') || '';
      if (!/^[A-Za-z0-9]{10,128}$/.test(uid)) return new Response('{"error":"uid"}', { status: 400 });
      const r = await env.MAU.get(env.MAU.idFromName(monthKey())).fetch('https://mau/?new=1&uid=' + encodeURIComponent(uid));
      return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    if (new URL(req.url).pathname === '/mau') {
      const stub = env.MAU.get(env.MAU.idFromName(monthKey()));
      let uid = '';
      if (req.method === 'POST') {
        // El token va en el cuerpo (text/plain, sin OPTIONS previo) o, en juegos antiguos, en Authorization.
        const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '') || (await req.text()).trim().slice(0, 4096);
        uid = await verify(tok);
        if (!uid) return new Response(JSON.stringify({ error: 'no autorizado' }), { status: 401, headers: { ...h, 'content-type': 'application/json' } });
      }
      const r = await stub.fetch('https://mau/?uid=' + encodeURIComponent(uid));
      return new Response(r.body, { status: r.status, headers: { ...h, 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
    // El contador "jugando ahora" ya no está en el juego: las pestañas antiguas
    // reciben un 404 al momento, sin tocar el Durable Object.
    if (new URL(req.url).pathname === '/online') return new Response('{}', { status: 404, headers: h });
    if (new URL(req.url).pathname === '/online-old') {
      // ?s=1: el recuento por muestreo (1 de cada 10 pestañas avisa); sin él, el antiguo.
      const r = await env.ONLINE.get(env.ONLINE.idFromName(new URL(req.url).searchParams.get('s') ? 'sample' : 'global')).fetch(req);
      return new Response(r.body, { status: r.status, headers: { ...h, 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
    const uid = await verify((req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
    if (!uid) return new Response(JSON.stringify({ error: 'no autorizado' }), { status: 401, headers: { ...h, 'content-type': 'application/json' } });
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.TURN_KEY_API_TOKEN, 'content-type': 'application/json' },
      body: JSON.stringify({ ttl: TTL })
    });
    if (!r.ok) return new Response(JSON.stringify({ error: 'turn ' + r.status }), { status: 502, headers: { ...h, 'content-type': 'application/json' } });
    const data = await r.json();
    return new Response(JSON.stringify({ iceServers: data.iceServers, ttl: TTL }), {
      headers: { ...h, 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  }
};

// ---------------- contador de gente en línea ----------------

const WINDOW = 25 * 60 * 1000;               // cuenta a quien ha avisado en los últimos 25 min
const PER_IP = 6;                            // como mucho 6 pestañas por conexión (contra trampas)

export class Online {
  // sid -> { t, ip }. Se guarda en el almacenamiento del Durable Object como
  // mucho una vez por minuto: si Cloudflare lo reinicia, no vuelve a cero.
  constructor(ctx) {
    this.ctx = ctx; this.seen = new Map(); this.prunedAt = 0; this.savedAt = 0;
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('seen');
      if (saved) this.seen = new Map(saved);
    });
  }

  async fetch(req) {
    const url = new URL(req.url);
    const sid = (url.searchParams.get('sid') || '').slice(0, 40);
    const ip = req.headers.get('CF-Connecting-IP') || '';
    const now = Date.now();
    if (now - this.prunedAt > 60e3) {
      for (const [k, v] of this.seen) if (now - v.t > WINDOW) this.seen.delete(k);
      this.prunedAt = now;
    }
    if (/^[a-z0-9]{8,40}$/i.test(sid) && (this.seen.has(sid) || this.countIp(ip) < PER_IP)) this.seen.set(sid, { t: now, ip });
    if (now - this.savedAt > 60e3) { this.savedAt = now; await this.ctx.storage.put('seen', [...this.seen]); }
    return new Response(JSON.stringify({ n: this.seen.size }));
  }

  countIp(ip) { let n = 0; for (const v of this.seen.values()) if (v.ip === ip) n++; return n; }
}

// ---------------- tope de cuentas del mes ----------------

// Tope de cuentas del mes. 0 = sin tope (desde el 11-10-2026: se aceptan todas;
// pasadas las 50.000 gratis Firebase cobra ~0,0055 $ por cuenta). Para volver a
// ponerlo: un número (p. ej. 48000) y `npx wrangler deploy`. Se sigue contando igual.
const LIMIT = 0;
const full = n => LIMIT > 0 && n >= LIMIT;

/** Mes de facturación de Google (hora del Pacífico, aproximada). */
function monthKey() { return new Date(Date.now() - 8 * 3600e3).toISOString().slice(0, 7); }

export class Mau {
  constructor(ctx) { this.ctx = ctx; }

  async fetch(req) {
    const q = new URL(req.url).searchParams;
    const uid = q.get('uid') || '';
    let n = (await this.ctx.storage.get('n')) || 0;
    const seed = parseInt(q.get('seed') || '0', 10);
    if (seed > n) { n = seed; await this.ctx.storage.put('n', n); }
    const known = uid && (await this.ctx.storage.get('u:' + uid));
    // Cuenta NUEVA con el tope alcanzado: no se apunta y se dice que no.
    if (q.get('new') && !known && full(n)) return new Response(JSON.stringify({ n, limit: LIMIT, open: false }));
    if (uid && !known) {
      n++;
      await this.ctx.storage.put({ ['u:' + uid]: 1, n });
    }
    return new Response(JSON.stringify({ n, limit: LIMIT, open: !full(n), v: 3 }));
  }
}
