/* ============ score.js — la música del tráiler (compuesta para él) ============
 * La mete record.mjs en la página. director.js llama a __score(ctx) al
 * empezar a grabar y aquí se programa TODA la música de una vez sobre el
 * mismo contexto de sonido que los efectos (el OfflineAudioContext de shim.js).
 *
 * 164 ppm, La menor. Cada compás n empieza en 0,1 + n·(4 tiempos), igual que
 * los cortes del tráiler (B(n) en director.js), así los golpes caen en los cortes:
 *
 *   0-3    intro: colchón oscuro, impactos en los rótulos, subida y golpe en el logo
 *   3-8    tienda y Mochila: tema alegre (Do mayor) con pizzicato y campanitas
 *   8-11   naturalezas: entra la melodía
 *   11-13  MT: parón (sólo colchón y bombo), redoble que sube
 *   13-15  Mewtwo: vuelve el ritmo, subida
 *   15-16  "38": golpes en seco
 *   16-24  los 8 ataques: estribillo, un golpe en cada corte
 *   24-26  físico / especial: golpes 3+3+2
 *   26-28  cartas: parón con filtro
 *   28-30  mando e idiomas: arpegio que sube y redoble
 *   30-32  cooperativo y segundo ataque inicial: arpegio y redoble
 *   32-34  966 Pokémon: estribillo final
 *   34-38  logo: golpe, acordes largos y final que se apaga
 */
window.__score = ctx => {
  const BPM = 164, BEAT = 60 / BPM, BAR = BEAT * 4, S = BEAT / 4, T0 = 0.1;
  const at = (bar, step = 0) => T0 + bar * BAR + step * S;
  let seed = 4242;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = n => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); return NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12; };

  // ---------------- mezcla ----------------
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.18;
  const master = ctx.createGain(); master.gain.value = 0.5;
  master.connect(comp).connect(ctx.destination);

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }

  const rev = ctx.createConvolver();
  { const len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) { const g = 1 - i / len; d[i] = (rnd() * 2 - 1) * g * g * g; } }
    rev.buffer = ir; }
  const revIn = ctx.createGain(); revIn.gain.value = 1;
  const revOut = ctx.createGain(); revOut.gain.value = 0.32;
  revIn.connect(rev).connect(revOut).connect(master);

  const dly = ctx.createDelay(1); dly.delayTime.value = S * 3;
  const fb = ctx.createGain(); fb.gain.value = 0.3;
  const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
  const dlyOut = ctx.createGain(); dlyOut.gain.value = 0.35;
  dly.connect(dlp).connect(fb).connect(dly); dlp.connect(dlyOut).connect(master);

  /** Salida de una voz: directo + reverb (+ eco). */
  function out(node, { dry = 1, wet = 0.15, echo = 0 } = {}) {
    const g = ctx.createGain(); g.gain.value = dry; node.connect(g).connect(master);
    if (wet) { const r = ctx.createGain(); r.gain.value = wet; node.connect(r).connect(revIn); }
    if (echo) { const e = ctx.createGain(); e.gain.value = echo; node.connect(e).connect(dly); }
  }
  function env(g, t, a, peak, d, sus, rel, end) {
    a = Math.min(a, Math.max(0.002, (end - t) * 0.5));
    d = Math.min(d, Math.max(0.002, end - t - a));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sus), end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + rel);
  }
  function osc(type, f, t, end, det = 0) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
    o.start(t); o.stop(end + 0.05); return o;
  }
  function nsrc(t, end) {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    s.start(t, rnd() * 1.5); s.stop(end + 0.05); return s;
  }
  function filt(type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }

  // ---------------- instrumentos ----------------
  function kick(t, v = 1) {
    const o = osc('sine', 150, t, t + 0.45), g = ctx.createGain();
    o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1.1 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g); out(g, { wet: 0 });
    const n = nsrc(t, t + 0.02), hp = filt('highpass', 3000), ng = ctx.createGain();
    ng.gain.setValueAtTime(0.25 * v, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
    n.connect(hp).connect(ng); out(ng, { wet: 0 });
  }
  function snare(t, v = 1) {
    const n = nsrc(t, t + 0.25), bp = filt('bandpass', 1900, 0.6), g = ctx.createGain();
    g.gain.setValueAtTime(0.7 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    n.connect(bp).connect(g); out(g, { wet: 0.22 });
    const o = osc('triangle', 195, t, t + 0.12), og = ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    og.gain.setValueAtTime(0.5 * v, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(og); out(og, { wet: 0.1 });
  }
  function hat(t, v = 1, open = false) {
    const d = open ? 0.28 : 0.045, n = nsrc(t, t + d), hp = filt('highpass', 7800), g = ctx.createGain();
    g.gain.setValueAtTime(0.32 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    n.connect(hp).connect(g); out(g, { wet: 0.05 });
  }
  function crash(t, v = 1, len = 1.9) {
    const n = nsrc(t, t + len), hp = filt('highpass', 4200), g = ctx.createGain();
    g.gain.setValueAtTime(0.42 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(hp).connect(g); out(g, { wet: 0.3 });
  }
  function tom(t, m, v = 1) {
    const o = osc('sine', mtof(m), t, t + 0.35), g = ctx.createGain();
    o.frequency.setValueAtTime(mtof(m) * 1.6, t); o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.06);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.8 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.33);
    o.connect(g); out(g, { wet: 0.2 });
  }
  /** Golpe de cine: sub que cae, ruido grave y platillo. */
  function boom(t, v = 1) {
    const o = osc('sine', 70, t, t + 1.8), g = ctx.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.4);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1.0 * v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    o.connect(g); out(g, { wet: 0.25 });
    const n = nsrc(t, t + 0.9), lp = filt('lowpass', 500), ng = ctx.createGain();
    ng.gain.setValueAtTime(0.8 * v, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    n.connect(lp).connect(ng); out(ng, { wet: 0.4 });
    crash(t, v * 0.9, 2.4);
    kick(t, v);
  }
  /** Subida: ruido con filtro que abre y un diente de sierra que sube. */
  function riser(t0, t1, v = 1) {
    const n = nsrc(t0, t1), bp = filt('bandpass', 400, 1.6), g = ctx.createGain();
    bp.frequency.setValueAtTime(350, t0); bp.frequency.exponentialRampToValueAtTime(7000, t1);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.55 * v, t1 - 0.01); g.gain.linearRampToValueAtTime(0.0001, t1 + 0.02);
    n.connect(bp).connect(g); out(g, { wet: 0.3 });
    const o = osc('sawtooth', 110, t0, t1), lp = filt('lowpass', 1800), og = ctx.createGain();
    o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(880, t1);
    og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(0.12 * v, t1 - 0.01); og.gain.linearRampToValueAtTime(0.0001, t1 + 0.02);
    o.connect(lp).connect(og); out(og, { wet: 0.3 });
  }
  /** Barrido hacia abajo (para los cortes). */
  function swoosh(t, v = 1) {
    const n = nsrc(t, t + 0.4), bp = filt('bandpass', 5000, 1.2), g = ctx.createGain();
    bp.frequency.setValueAtTime(6000, t); bp.frequency.exponentialRampToValueAtTime(500, t + 0.35);
    g.gain.setValueAtTime(0.35 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    n.connect(bp).connect(g); out(g, { wet: 0.2 });
  }
  function bass(t, m, dur, v = 1) {
    const end = t + dur, o = osc('sawtooth', mtof(m), t, end + 0.1), s = osc('square', mtof(m - 12), t, end + 0.1);
    const lp = filt('lowpass', 900, 2), g = ctx.createGain(), sg = ctx.createGain(); sg.gain.value = 0.5;
    lp.frequency.setValueAtTime(1500, t); lp.frequency.exponentialRampToValueAtTime(420, t + 0.12);
    env(g, t, 0.004, 0.42 * v, 0.1, 0.65, 0.06, end);
    o.connect(lp); s.connect(sg).connect(lp); lp.connect(g); out(g, { wet: 0 });
  }
  function pluck(t, m, v = 1) {
    const o = osc('square', mtof(m), t, t + 0.4), o2 = osc('triangle', mtof(m + 12), t, t + 0.4);
    const lp = filt('lowpass', 3000), g = ctx.createGain();
    lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.14 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(lp); o2.connect(lp); lp.connect(g); out(g, { wet: 0.2, echo: 0.25 });
  }
  function bell(t, m, v = 1) {
    const o = osc('sine', mtof(m), t, t + 1.2), o2 = osc('sine', mtof(m) * 2.76, t, t + 0.5), g = ctx.createGain(), g2 = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    g2.gain.setValueAtTime(0.07 * v, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); o2.connect(g2); out(g, { wet: 0.35, echo: 0.3 }); out(g2, { wet: 0.3 });
  }
  function pad(t, notes, dur, v = 1, cutoff = 1600) {
    const end = t + dur, lp = filt('lowpass', cutoff, 0.5), g = ctx.createGain();
    env(g, t, Math.min(0.5, dur * 0.3), 0.07 * v, 0.3, 0.85, 0.6, end);
    for (const m of notes) for (const d of [-9, 9]) osc('sawtooth', mtof(m), t, end + 0.7, d).connect(lp);
    lp.connect(g); out(g, { wet: 0.5 });
  }
  function stab(t, notes, v = 1, len = 0.22) {
    const lp = filt('lowpass', 4200, 1), g = ctx.createGain();
    lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(900, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    for (const m of notes) for (const d of [-12, 0, 12]) osc('sawtooth', mtof(m), t, t + len, d).connect(lp);
    lp.connect(g); out(g, { wet: 0.35, echo: 0.15 });
  }
  function lead(t, m, dur, v = 1) {
    const end = t + dur, o = osc('square', mtof(m), t, end + 0.2), o2 = osc('sawtooth', mtof(m), t, end + 0.2, 7);
    const lfo = osc('sine', 5.5, t, end + 0.2), lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(8, t + 0.25);
    lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
    const lp = filt('lowpass', 3400, 0.8), g = ctx.createGain(), mix = ctx.createGain(); mix.gain.value = 0.5;
    env(g, t, 0.01, 0.13 * v, 0.12, 0.75, 0.12, end);
    o.connect(lp); o2.connect(mix).connect(lp); lp.connect(g); out(g, { wet: 0.25, echo: 0.3 });
  }

  // ---------------- ayudas de escritura ----------------
  const CH = {
    Am: [57, 60, 64], F: [53, 57, 60], C: [48, 52, 55], G: [55, 59, 62], Dm: [50, 53, 57], E: [52, 56, 59], Em: [52, 55, 59]
  };
  const ROOT = { Am: 33, F: 29, C: 36, G: 31, Dm: 38, E: 28, Em: 28 };
  /** Melodía "E5:3 A5:3 -:2 ..." (en semicorcheas) desde el compás `bar`. */
  function melody(bar, str, ins = lead, v = 1, oct = 0) {
    let step = 0;
    for (const tok of str.trim().split(/\s+/)) {
      const [n, l] = tok.split(':'); const len = +l;
      if (n !== '-') ins === lead ? lead(at(bar, step), midi(n) + oct, len * S * 0.92, v) : ins(at(bar, step), midi(n) + oct, v);
      step += len;
    }
  }
  /** Batería de un compás: 16 pasos por instrumento ('X' fuerte, 'x' medio, 'o' suave, 'O' charles abierto). */
  function drums(bar, p) {
    const vel = ch => (ch === 'X' ? 1 : ch === 'x' ? 0.7 : ch === 'o' ? 0.4 : ch === 'O' ? 0.8 : 0);
    for (let i = 0; i < 16; i++) {
      if (p.k && vel(p.k[i])) kick(at(bar, i), vel(p.k[i]));
      if (p.s && vel(p.s[i])) snare(at(bar, i), vel(p.s[i]));
      if (p.h && vel(p.h[i])) hat(at(bar, i), vel(p.h[i]), p.h[i] === 'O');
    }
  }
  /** Bajo de un compás con patrón ('R' raíz, 'O' octava, 'F' quinta, '.' nada). */
  function bassBar(bar, chord, p, v = 1) {
    const r = ROOT[chord];
    for (let i = 0; i < 16; i++) {
      const ch = p[i];
      if (ch === '.' || ch === '-') continue;
      let len = 1; while (p[i + len] === '-') len++;
      const m = ch === 'O' ? r + 12 : ch === 'F' ? r + 7 : r;
      bass(at(bar, i), m, len * S * 0.9, v);
    }
  }
  function arp(bar, chord, pattern = [0, 1, 2, 3, 2, 1, 0, 1], every = 2, v = 1, oct = 12) {
    const n = [...CH[chord], CH[chord][0] + 12];
    for (let i = 0; i < 16 / every; i++) pluck(at(bar, i * every), n[pattern[i % pattern.length]] + oct, v);
  }

  const FULL = { k: 'X...X...X...X...', s: '....X.......X...', h: 'o.O.o.O.o.O.o.O.' };
  const FULL2 = { k: 'X...X...X...X.x.', s: '....X.......X..x', h: 'oxOxoxOxoxOxoxOx' };
  const BOUNCE = { k: 'X.....x.X.......', s: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' };

  // ================= 0-3 intro =================
  pad(at(0), [45, 52, 57, 60], BAR * 1.0, 0.8, 900);
  pad(at(1), [41, 48, 53, 57], BAR * 1.0, 0.9, 1100);
  boom(at(1), 0.55);
  stab(at(1.5), [57, 60, 64], 0.9); snare(at(1.5), 0.8); kick(at(1.5), 0.9);
  stab(at(1.75), [55, 59, 62], 0.7);
  riser(at(1.5), at(2), 0.9);
  boom(at(2), 1);
  stab(at(2), [57, 60, 64, 69], 1.2, 0.5);
  pad(at(2), [45, 52, 57, 60, 64], BAR, 1, 2200);
  for (let i = 0; i < 8; i++) bass(at(2, i * 2), 33, S * 1.6, 0.8);
  arp(2, 'Am', [0, 1, 2, 3, 2, 1, 2, 3], 2, 0.8, 12);
  riser(at(2, 8), at(2, 12), 0.6);

  // ================= 3-8 tienda y Mochila (Do mayor, alegre) =================
  const SHOP = ['C', 'Am', 'F', 'G', 'C'];
  SHOP.forEach((ch, i) => {
    const b = 3 + i;
    drums(b, i === 0 ? { k: 'X.......X.......', h: '..o...o...o...o.' } : BOUNCE);
    bassBar(b, ch, i === 0 ? 'R.......R.......' : 'R..O..R.R..F..O.', 0.9);
    arp(b, ch, [0, 2, 1, 3, 2, 1, 3, 2], 2, 0.75, 12);
    pad(at(b), CH[ch].map(m => m + 12), BAR * 0.98, 0.45, 1400);
  });
  crash(at(3), 0.6);
  melody(4, 'E6:2 G6:2 A6:2 G6:4 E6:2 C6:2 D6:2', bell, 0.9);
  melody(5, 'C6:2 E6:2 F6:2 A6:4 G6:2 F6:2 E6:2', bell, 0.9);
  melody(6, 'D6:2 B5:2 G5:2 D6:4 B5:2 D6:2 G6:2', bell, 0.9);
  melody(7, 'E6:4 G6:4 C7:8', bell, 1);
  tom(at(7, 12), 50, 0.8); tom(at(7, 13), 47, 0.8); tom(at(7, 14), 43, 0.9); tom(at(7, 15), 40, 1);

  // ================= 8-11 naturalezas: entra el tema =================
  const NAT = ['Am', 'F', 'C'];
  NAT.forEach((ch, i) => {
    const b = 8 + i;
    drums(b, FULL);
    bassBar(b, ch, 'R.RO.RR.R.RO.RF.', 1);
    pad(at(b), CH[ch], BAR * 0.98, 0.8, 1800);
    arp(b, ch, [0, 1, 2, 1], 2, 0.45, 24);
  });
  crash(at(8), 0.8);
  melody(8, 'E5:3 A5:3 G5:2 E5:4 C5:2 D5:2', lead, 1);
  melody(9, 'C5:3 F5:3 E5:2 C5:4 A4:2 C5:2', lead, 1);
  melody(10, 'G5:3 E5:3 C5:2 G5:4 A5:2 G5:2', lead, 1);
  riser(at(10, 8), at(11), 0.8);

  // ================= 11-13 MT: parón =================
  boom(at(11), 0.8);
  pad(at(11), [50, 57, 62, 65], BAR, 1, 1000);
  pad(at(12), [52, 56, 59, 64], BAR, 1, 1300);
  kick(at(11, 8), 0.6); kick(at(12), 0.7); kick(at(12, 8), 0.7);
  bell(at(11, 4), 81, 0.6); bell(at(11, 10), 76, 0.5);
  for (let i = 8; i < 16; i++) snare(at(12, i), 0.25 + (i - 8) * 0.07);
  for (let i = 0; i < 8; i++) snare(at(12, 12 + i * 0.5), 0.5 + i * 0.06);
  riser(at(12), at(13), 1);

  // ================= 13-15 Mewtwo =================
  [['Am', 13], ['F', 14]].forEach(([ch, b]) => {
    drums(b, FULL2);
    bassBar(b, ch, 'RORORORORORORORO', 0.85);
    pad(at(b), CH[ch], BAR * 0.98, 0.9, 2000);
  });
  crash(at(13), 1);
  melody(13, 'E5:3 A5:3 G5:2 E5:4 C6:2 B5:2', lead, 1);
  melody(14, 'A5:3 F5:3 A5:2 C6:4 B5:2 A5:2', lead, 1);
  riser(at(14, 8), at(15), 1);
  tom(at(14, 12), 52, 0.8); tom(at(14, 13), 48, 0.8); tom(at(14, 14), 45, 0.9); tom(at(14, 15), 41, 1);

  // ================= 15-16 "38": golpes en seco =================
  boom(at(15), 1.1);
  stab(at(15), [57, 64, 69, 72], 1.3, 0.4);
  stab(at(15, 6), [57, 64, 69, 72], 1.1, 0.25); kick(at(15, 6), 1);
  stab(at(15, 12), [55, 62, 67, 71], 1.1, 0.25); kick(at(15, 12), 1);
  riser(at(15, 12), at(16), 0.9);
  for (let i = 12; i < 16; i++) snare(at(15, i), 0.5 + (i - 12) * 0.12);

  // ================= 16-24 los 8 ataques: estribillo =================
  const CHORUS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'];
  const THEME = [
    'E5:3 A5:3 G5:2 E5:4 C5:2 D5:2', 'C5:3 F5:3 E5:2 C5:4 A4:2 C5:2',
    'G5:3 E5:3 C5:2 G5:4 A5:2 G5:2', 'D5:6 B4:2 G4:4 B4:2 D5:2',
    'E5:3 A5:3 G5:2 E5:4 C6:2 B5:2', 'A5:3 F5:3 A5:2 C6:4 B5:2 A5:2',
    'B5:3 G5:3 D5:2 G5:4 A5:2 B5:2', 'G#5:6 E5:2 B4:4 E5:2 G#5:2'
  ];
  CHORUS.forEach((ch, i) => {
    const b = 16 + i;
    drums(b, i % 4 === 3 ? { k: 'X...X...X...X.X.', s: '....X.......X.xx', h: 'oxOxoxOxoxOxoxOx' } : FULL2);
    bassBar(b, ch, '.O.O.O.O.O.O.O.O', 0.9);
    bass(at(b), ROOT[ch], S * 1.8, 1);
    pad(at(b), CH[ch], BAR * 0.98, 1, 2400);
    melody(b, THEME[i], lead, 1.05);
    melody(b, THEME[i], lead, 0.35, -12);
    swoosh(at(b), 0.8);
    if (i === 0 || i === 4) crash(at(b), 1); else hat(at(b), 1, true);
  });

  // ================= 24-26 físico / especial: 3+3+2 =================
  [['F', 24, [53, 57, 60, 65]], ['G', 25, [55, 59, 62, 67]]].forEach(([ch, b, st]) => {
    crash(at(b), 0.8);
    for (const s of [0, 3, 6, 8, 11, 14]) { stab(at(b, s), st, 1.1); kick(at(b, s), 0.9); }
    drums(b, { s: '....X.......X...', h: 'oooooooooooooooo' });
    bassBar(b, ch, 'R..R..R.R..R..R.', 1);
  });
  riser(at(25, 8), at(26), 0.7);

  // ================= 26-28 cartas: parón con filtro =================
  boom(at(26), 0.7);
  pad(at(26), [45, 52, 57, 60, 64], BAR, 1, 900);
  pad(at(27), [41, 48, 53, 57, 60], BAR, 1, 1200);
  arp(26, 'Am', [0, 1, 2, 3], 2, 0.5, 12);
  arp(27, 'F', [0, 1, 2, 3], 2, 0.6, 12);
  for (const b of [26, 27]) { kick(at(b), 0.7); kick(at(b, 8), 0.6); snare(at(b, 12), 0.5); }
  riser(at(27, 4), at(28), 0.9);

  // ================= 28-30 mando e idiomas =================
  crash(at(28), 0.9);
  drums(28, FULL);
  bassBar(28, 'C', 'R.RO.RR.R.RO.RF.', 1);
  for (let i = 0; i < 8; i++) stab(at(28, i * 2), [60, 64, 67], i % 2 ? 0.6 : 0.9, 0.12);
  melody(28, 'C6:2 E6:2 G6:2 C7:2 G6:2 E6:2 G6:2 C7:2', bell, 0.7);
  drums(29, { k: 'X...X...X...X...', h: 'xxxxxxxxxxxxxxxx' });
  bassBar(29, 'G', 'RORORORORORORORO', 0.9);
  const UP = [55, 59, 62, 67, 71, 74, 79];                    // un tono por idioma
  UP.forEach((m, k) => bell(at(29) + k * (BAR - 0.08) / 7, m + 12, 0.8));
  for (let i = 8; i < 16; i++) snare(at(29, i), 0.35 + (i - 8) * 0.08);
  riser(at(29), at(30), 1);

  // ================= 30-32 cooperativo y segundo ataque (21-10-2026) =================
  crash(at(30), 0.8);
  drums(30, FULL);
  bassBar(30, 'Am', 'R.RO.RR.R.RO.RF.', 1);
  for (let i = 0; i < 8; i++) stab(at(30, i * 2), [57, 60, 64], i % 2 ? 0.55 : 0.85, 0.12);
  melody(30, 'A5:2 C6:2 E6:2 A6:2 E6:2 C6:2 E6:4', bell, 0.7);
  crash(at(31), 0.7);
  drums(31, { k: 'X...X...X...X...', h: 'xxxxxxxxxxxxxxxx' });
  bassBar(31, 'F', 'RORORORORORORORO', 0.9);
  melody(31, 'F5:2 A5:2 C6:2 F6:6 -:4', bell, 0.75);
  for (let i = 8; i < 16; i++) snare(at(31, i), 0.35 + (i - 8) * 0.08);
  riser(at(31), at(32), 1);

  // ================= 32-34 966 Pokémon: estribillo final =================
  [['Am', 32, THEME[4]], ['F', 33, THEME[5]]].forEach(([ch, b, mel]) => {
    drums(b, FULL2);
    bassBar(b, ch, '.O.O.O.O.O.O.O.O', 0.9);
    bass(at(b), ROOT[ch], S * 1.8, 1);
    pad(at(b), CH[ch].map(m => m + 12), BAR * 0.98, 1, 2600);
    melody(b, mel, lead, 1.1, 12);
    melody(b, mel, lead, 0.5);
  });
  boom(at(32), 0.9);
  tom(at(33, 12), 52, 0.9); tom(at(33, 13), 48, 0.9); tom(at(33, 14), 45, 1); tom(at(33, 15), 41, 1);
  riser(at(33, 8), at(34), 1);

  // ================= 34-38 logo y final =================
  boom(at(34), 1.2);
  stab(at(34), [57, 64, 69, 72, 76], 1.3, 0.6);
  pad(at(34), [45, 52, 57, 60, 64, 71], BAR * 2, 1.1, 2600);
  bass(at(34), 33, BAR * 1.9, 0.9);
  arp(34, 'Am', [0, 1, 2, 3, 2, 3, 1, 2], 2, 0.6, 24);
  kick(at(34, 8), 0.7); stab(at(34, 8), [60, 64, 69], 0.8);
  arp(35, 'F', [0, 1, 2, 3, 2, 3, 1, 2], 2, 0.6, 24);
  kick(at(35), 0.8); stab(at(35), [57, 60, 65], 0.9);
  kick(at(35, 8), 0.9); stab(at(35, 8), [55, 60, 64, 67], 1);  crash(at(35, 8), 0.6);
  pad(at(36), [41, 48, 53, 57, 60, 64], BAR, 1, 2200);
  bass(at(36), 29, BAR * 0.95, 0.8);
  melody(36, 'A5:4 G5:4 E5:4 G5:4', bell, 0.8);
  // acorde final (La mayor, de La menor a luz) que se apaga con el vídeo
  boom(at(37), 0.8);
  pad(at(37), [45, 52, 57, 61, 64, 69], BAR * 1.2, 1.2, 2800);
  bass(at(37), 33, BAR * 1.1, 0.8);
  bell(at(37), 81, 0.9); bell(at(37, 4), 76, 0.6); bell(at(37, 8), 73, 0.5);
};
