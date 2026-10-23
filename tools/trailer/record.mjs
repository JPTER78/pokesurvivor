/* ============ record.mjs — graba el tráiler fotograma a fotograma ============
 *   python -m http.server 8765 --bind 127.0.0.1     (en la carpeta del juego)
 *   node tools/trailer/record.mjs [--director director.js] [--from s] [--to s] [--every n] [--out carpeta] [--small]
 *
 * Abre dev.html en un Chrome sin ventana con shim.js (reloj virtual) y
 * director.js (las escenas), avanza 1/60 s cada vez y guarda cada
 * fotograma en PNG; al acabar, el sonido en audio.wav. Luego:
 *   node tools/trailer/encode.mjs carpeta salida.mp4
 * --every 10 --small  hace una prueba rápida (un fotograma de cada 10, a 640x360).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const FPS = 60;
const FROM = +arg('from', 0), TO = arg('to', null), EVERY = +arg('every', 1);
const SMALL = process.argv.includes('--small');
const DIRECTOR = arg('director', 'director.js');      // el guion (director-sentencia.js: el del 23-10-2026)
const OUT = path.resolve(arg('out', path.join(os.tmpdir(), 'ps-trailer')));
const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^f\d+\.png$/.test(f)) fs.unlinkSync(path.join(OUT, f));

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,720',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  'about:blank'], { stdio: 'ignore' });

let ws, seq = 0;
const waiting = new Map();
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => waiting.set(id, { res, rej, method }));
}
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(expr.slice(0, 60) + ': ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch (e) { /* aún no */ }
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', m => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) {
      const w = waiting.get(d.id); waiting.delete(d.id);
      d.error ? w.rej(new Error(w.method + ': ' + d.error.message)) : w.res(d.result);
    } else if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) {
      console.log('  [página]', d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300));
    } else if (d.method === 'Runtime.exceptionThrown') {
      console.log('  [página] excepción:', d.params.exceptionDetails.exception?.description?.slice(0, 400));
    }
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: SMALL ? 0.5 : 1.5, mobile: false });
  const src = f => fs.readFileSync(path.join(DIR, f), 'utf8');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: src('shim.js') });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: src(DIRECTOR) });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: src('score.js') });
  await send('Page.navigate', { url: 'http://ps.localhost:8765/dev.html?trailer' });

  // Preparación (no se graba): el reloj virtual va corriendo mientras carga.
  console.log('preparando...');
  const t0 = Date.now();
  let reloaded = false;
  for (;;) {
    await sleep(8);
    let st;
    try { st = await ev(`(async () => { if (!window.__advance) return 'carga'; await __advance(1000 / ${FPS}); return window.__director ? __director.status() : 'carga'; })()`); }
    catch (e) { st = 'carga'; }
    if (st === 'listo') break;
    if (typeof st === 'string' && st.startsWith('error')) throw new Error(st);
    if (Date.now() - t0 > 240000) throw new Error('la preparación tarda demasiado: ' + st);
    // Si algún script no llegó a cargar (pasa a veces con el servidor de Python), se recarga.
    if (st === 'carga' && Date.now() - t0 > 30000 && !reloaded) { reloaded = true; console.log('  recargando la página...'); await send('Page.reload', { ignoreCache: true }); }
  }
  const DUR = await ev('__director.duration');
  const END = TO == null ? DUR : Math.min(DUR, +TO);
  console.log(`listo en ${((Date.now() - t0) / 1000).toFixed(1)} s · tráiler de ${DUR.toFixed(1)} s · grabando ${FROM}–${END} s`);
  await ev(`__enableAudio(${DUR + 1})`);
  await ev('__director.begin()');

  const N = Math.round(END * FPS);
  const tStart = Date.now();
  for (let i = 0; i < N; i++) {
    const t = i / FPS, f0 = Date.now();
    const cam = await ev(`(async () => { await __director.tick(${t}); await __advance(${1000 / FPS}); await __waitImages(); return __director.draw(${t}); })()`);
    if (Date.now() - f0 > 1500) console.log(`  fotograma ${i} (${t.toFixed(2)} s) tardó ${Date.now() - f0} ms`);
    if (t + 1e-6 < FROM || i % EVERY) continue;
    // Con cámara: se recorta esa parte y se amplía a pantalla completa.
    const cw = cam && Math.round(cam.w / 16) * 16;
    const clip = cam ? { x: Math.round(cam.x), y: Math.round(cam.y), width: cw, height: cw * 9 / 16, scale: 1280 / cw } : undefined;
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, optimizeForSpeed: true, ...(clip ? { clip } : {}) });
    fs.writeFileSync(path.join(OUT, `f${String(i).padStart(5, '0')}.png`), Buffer.from(shot.data, 'base64'));
    if (i % 60 === 0) {
      const el = (Date.now() - tStart) / 1000, eta = el / (i + 1) * (N - i - 1);
      console.log(`  ${t.toFixed(1)} s · ${el.toFixed(0)} s pasados · quedan ~${eta.toFixed(0)} s`);
    }
  }
  // Sonido.
  if (FROM === 0 && END >= DUR - 0.01) {
    console.log('sonido...');
    const info = await ev('__audioDone()');
    if (info) {
      const SIZE = 4 << 20, parts = [];
      for (let i = 0; i * SIZE < info.len; i++) parts.push(await ev(`__wavChunk(${i}, ${SIZE})`));
      fs.writeFileSync(path.join(OUT, 'audio.wav'), Buffer.from(parts.join(''), 'base64'));
      console.log(`  audio.wav (pico ${info.peak.toFixed(2)})`);
    }
  }
  console.log('hecho:', OUT);
} catch (e) {
  console.error('FALLO:', e.message);
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch (e) { /* nada */ }
  chrome.kill();
  await sleep(500);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* nada */ }
}
