/* ============ audio.js — sintetizador, secuenciador y efectos de sonido ============
 * Todo el sonido se genera en el momento con Web Audio: no hay ficheros.
 *
 *   G.Audio.music('village')   cambia de tema con fundido (ver data/music.js)
 *   G.Audio.sfx('coin')        efecto de sonido (con límite de repetición)
 *   G.Audio.setVolume('music' | 'sfx', 0..1) · toggleMute()
 *
 * Los navegadores no dejan sonar nada hasta el primer clic o tecla, así que
 * el contexto se crea entonces y arranca la música que estuviera pedida.
 * El volumen se guarda en localStorage (es del navegador, no de la cuenta).
 */
G.Audio = (() => {
  const KEY = 'ps.audio';
  let ctx = null, master, outNode, musicBus, sfxBus, reverb, wet;
  let settings = { music: 0.55, sfx: 0.7, muted: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* nada */ }
  let noiseBuf = null;

  function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* nada */ } }

  // ---------------- arranque ----------------

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -14; master.ratio.value = 4;
    const out = outNode = ctx.createGain(); out.gain.value = 0.9;
    master.connect(out).connect(ctx.destination);

    musicBus = ctx.createGain(); sfxBus = ctx.createGain();
    musicBus.connect(master); sfxBus.connect(master);

    // Reverb: respuesta al impulso generada (ruido que se apaga en 1,8 s).
    reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    reverb.buffer = ir;
    wet = ctx.createGain(); wet.gain.value = 0.3;
    reverb.connect(wet).connect(musicBus);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    applyVolumes();
    return true;
  }

  function unlock() {
    if (!init()) return;
    // 'suspended' o 'interrupted' (iPhone al volver de otra app): se reanuda.
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (wanted && !current) startSong(wanted);
  }
  // En móvil, tocar la pantalla (pointerdown) no cuenta como gesto para el
  // sonido: sí levantar el dedo (pointerup / touchend). Se escuchan todos.
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) addEventListener(ev, unlock, { capture: true });

  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicBus.gain.setTargetAtTime(settings.muted ? 0 : settings.music * 0.7, t, 0.05);
    // Los efectos se generan bajitos: ×2,4 los pone a la par de la música (medido).
    sfxBus.gain.setTargetAtTime(settings.muted ? 0 : settings.sfx * 2.4, t, 0.05);
  }

  function setVolume(which, v) { settings[which] = G.U.clamp(v, 0, 1); save(); applyVolumes(); }
  function toggleMute() { settings.muted = !settings.muted; save(); applyVolumes(); return settings.muted; }

  // ---------------- piezas básicas ----------------

  const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);

  function osc(type, f, t, end, dest) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t);
    o.connect(dest); o.start(t); o.stop(end + 0.05);
    return o;
  }

  function gainEnv(dest, t, a, peak, dur, rel, sus = 0.7) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, Math.max(0.02, dur * 0.4));
    g.gain.setTargetAtTime(0.0001, t + dur, rel / 3);
    g.connect(dest);
    return g;
  }

  function noise(t, dur, dest) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    return s;
  }

  function filt(type, f, q, dest) {
    const b = ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q;
    b.connect(dest);
    return b;
  }

  function send(node, amount) {
    const s = ctx.createGain(); s.gain.value = amount;
    node.connect(s).connect(reverb);
  }

  // ---------------- instrumentos ----------------

  const INST = {
    flute(t, f, d, v, bus) {
      const lp = filt('lowpass', 3600, 0.5, bus);
      const g = gainEnv(lp, t, 0.045, 0.2 * v, d, 0.14, 0.82);
      send(g, 0.35);
      const o1 = osc('triangle', f, t, t + d + 0.3, g);
      const g2 = ctx.createGain(); g2.gain.value = 0.18; g2.connect(g);
      const o2 = osc('sine', f * 2, t, t + d + 0.3, g2);
      // Vibrato que entra poco a poco, como un flautista.
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.3;
      const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.35, d));
      lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
      lfo.start(t); lfo.stop(t + d + 0.35);
      // Soplo al atacar la nota.
      const bp = filt('bandpass', f * 2.2, 2, g);
      const ng = ctx.createGain(); ng.gain.setValueAtTime(0.25, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      ng.connect(bp); noise(t, 0.09, ng);
    },
    bell(t, f, d, v, bus) {
      const g = ctx.createGain(); g.connect(bus); send(g, 0.3);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.22 * v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0008, t + Math.min(d, 0.45) + 0.45);
      osc('sine', f, t, t + 1, g);
      const g2 = ctx.createGain(); g2.connect(g);
      g2.gain.setValueAtTime(0.35, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc('sine', f * 4, t, t + 0.12, g2);
    },
    pluck(t, f, d, v, bus) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.8), t + 0.22);
      const g = ctx.createGain(); g.connect(bus); send(g, 0.2);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.11 * v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0008, t + Math.min(d, 0.35) + 0.25);
      lp.connect(g);
      osc('sawtooth', f, t, t + 0.7, lp);
    },
    bass(t, f, d, v, bus) {
      const lp = filt('lowpass', 900, 0.7, bus);
      const g = gainEnv(lp, t, 0.008, 0.34 * v, d * 0.9, 0.08, 0.65);
      osc('triangle', f, t, t + d + 0.2, g);
      const g2 = ctx.createGain(); g2.gain.value = 0.25; g2.connect(g);
      osc('square', f, t, t + d + 0.2, g2);
    },
    pad(t, f, d, v, bus) {
      const lp = filt('lowpass', 1100, 0.6, bus);
      const g = gainEnv(lp, t, 0.35, 0.05 * v, d, 0.7, 0.9);
      send(g, 0.5);
      osc('sawtooth', f * 1.004, t, t + d + 1, g);
      osc('sawtooth', f * 0.996, t, t + d + 1, g);
    },
    lead(t, f, d, v, bus) {
      const lp = filt('lowpass', 2600, 1, bus);
      const g = gainEnv(lp, t, 0.01, 0.075 * v, d, 0.08, 0.75);
      send(g, 0.2);
      const o1 = osc('square', f, t, t + d + 0.2, g);
      const o2 = osc('square', f * 1.006, t, t + d + 0.2, g);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 6;
      const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.008, t + 0.2);
      lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
      lfo.start(t); lfo.stop(t + d + 0.25);
    },
    kick(t, v, bus) {
      const g = ctx.createGain(); g.connect(bus);
      g.gain.setValueAtTime(0.55 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      const o = osc('sine', 150, t, t + 0.25, g);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    },
    snare(t, v, bus) {
      const hp = filt('highpass', 1300, 0.7, bus);
      const g = ctx.createGain(); g.connect(hp); send(g, 0.15);
      g.gain.setValueAtTime(0.22 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      noise(t, 0.15, g);
      const g2 = ctx.createGain(); g2.connect(bus);
      g2.gain.setValueAtTime(0.12 * v, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc('triangle', 190, t, t + 0.1, g2);
    },
    hat(t, v, bus) {
      const hp = filt('highpass', 7500, 0.7, bus);
      const g = ctx.createGain(); g.connect(hp);
      g.gain.setValueAtTime(0.08 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      noise(t, 0.05, g);
    },
    shaker(t, v, bus) {
      const bp = filt('bandpass', 5200, 1.2, bus);
      const g = ctx.createGain(); g.connect(bp);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07 * v, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      noise(t, 0.08, g);
    }
  };

  // ---------------- secuenciador ----------------

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midiOf(name) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
    if (!m) return null;
    return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }

  /** Acorde "F", "Dm", "C/E", "F#m"... -> { root (0-11), minor, bass (0-11) } */
  function parseChord(c) {
    const m = /^([A-G])(#|b)?(m?)(?:\/([A-G])(#|b)?)?$/.exec(c);
    const pc = (l, a) => (NOTE[l] + (a === '#' ? 1 : a === 'b' ? -1 : 0) + 12) % 12;
    const root = pc(m[1], m[2]);
    return { root, minor: m[3] === 'm', bass: m[4] ? pc(m[4], m[5]) : root };
  }

  /**
   * Compila una canción de data/music.js a una lista de eventos por paso
   * (semicorchea). Melodías: "A4:4 C5:2 -:2" (nota:duración en semicorcheas).
   * Bajo y arpegios salen de los acordes con patrones de 16 caracteres.
   */
  function compile(song) {
    const bars = song.bars || song.chords.length;
    const steps = bars * 16;
    const ev = Array.from({ length: steps }, () => []);

    for (const tr of song.melody || []) {
      tr.bars.forEach((bar, bi) => {
        let s = 0;
        for (const tok of bar.trim().split(/\s+/)) {
          const [n, len] = tok.split(':');
          const L = +len || 1;
          if (n !== '-') {
            const midi = midiOf(n) + (tr.shift || 0);
            ev[(bi * 16 + s) % steps].push({ inst: tr.inst, f: midiFreq(midi), len: L, v: tr.vel || 1 });
          }
          s += L;
        }
      });
    }

    const chords = song.chords.map(parseChord);
    const chordTone = (ch, i, base) => {
      const third = ch.minor ? 3 : 4;
      const iv = [0, third, 7, 12, 12 + third, 19][i] || 0;
      return base + ch.root + iv;
    };
    for (let b = 0; b < bars; b++) {
      const ch = chords[b % chords.length];
      for (const tr of song.parts || []) {
        const pat = tr.pattern;
        const base = 12 * (tr.octave + 1);
        for (let s = 0; s < 16; s++) {
          const c = pat[s];
          if (!c || c === '.' || c === '-') continue;
          let len = 1;
          while (s + len < 16 && pat[s + len] === '-') len++;
          let midi;
          if (c === 'R') midi = base + (tr.useBass ? ch.bass : ch.root);
          else if (c === 'F') midi = base + ch.root + 7;
          else if (c === 'O') midi = base + ch.root + 12;
          else if (c === 'T') midi = base + ch.root + (ch.minor ? 3 : 4);
          else if (c === 'C') {           // acorde entero (pad)
            for (let i = 0; i < 3; i++) ev[b * 16 + s].push({ inst: tr.inst, f: midiFreq(chordTone(ch, i, base)), len, v: tr.vel || 1 });
            continue;
          } else midi = chordTone(ch, +c, base);
          ev[b * 16 + s].push({ inst: tr.inst, f: midiFreq(midi), len, v: tr.vel || 1 });
        }
      }
      for (const [inst, pat] of Object.entries(song.drums || {})) {
        for (let s = 0; s < 16; s++) {
          const c = pat[s];
          if (c && c !== '.') ev[b * 16 + s].push({ inst, drum: true, v: c === 'X' ? 1 : c === 'x' ? 0.75 : 0.45 });
        }
      }
    }
    return { steps, ev, bpm: song.bpm, swing: song.swing || 0 };
  }

  let wanted = null, current = null;
  const compiled = {};

  function startSong(name) {
    if (!ctx || !G.MUSIC[name]) return;
    const song = compiled[name] || (compiled[name] = compile(G.MUSIC[name]));
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.8);
    bus.connect(musicBus);
    current = { name, song, bus, step: 0, next: ctx.currentTime + 0.1 };
  }

  function stopCurrent() {
    if (!current) return;
    const b = current.bus;
    b.gain.cancelScheduledValues(ctx.currentTime);
    b.gain.setValueAtTime(b.gain.value, ctx.currentTime);
    b.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    setTimeout(() => b.disconnect(), 900);
    current = null;
  }

  /** Cambia de tema (con fundido). null = silencio. */
  function music(name) {
    if (wanted === name) return;
    wanted = name;
    if (!ctx) return;                    // arrancará al primer clic
    stopCurrent();
    if (name) startSong(name);
  }

  // Planificador: programa con 150 ms de antelación.
  setInterval(() => {
    if (!ctx || !current || ctx.state !== 'running') return;
    const c = current, sd = 60 / c.song.bpm / 4;
    while (c.next < ctx.currentTime + 0.15) {
      const i = c.step % c.song.steps;
      // Swing: retrasa las corcheas a contratiempo.
      const t = c.next + (i % 4 === 2 ? c.song.swing * sd : 0);
      for (const e of c.song.ev[i]) {
        if (e.drum) INST[e.inst](t, e.v, c.bus);
        else INST[e.inst](t, e.f, e.len * sd, e.v, c.bus);
      }
      c.next += sd;
      c.step++;
    }
  }, 25);

  // ---------------- efectos de sonido ----------------

  const last = {};
  let xpCombo = 0, xpT = 0, voices = 0;

  const SHOT_PITCH = {
    fire: 520, water: 700, electric: 1100, psychic: 800, grass: 640, ice: 900, poison: 400,
    ghost: 350, dragon: 300, fairy: 1200, normal: 600, fighting: 450, rock: 260, ground: 240,
    steel: 750, bug: 980, dark: 330, flying: 820
  };

  function tone(type, f0, f1, dur, vol, at = 0, bus = sfxBus) {
    const t = ctx.currentTime + at;
    const g = ctx.createGain(); g.connect(bus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    const o = osc(type, f0, t, t + dur, g);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  }

  function hiss(dur, vol, type, f0, f1, at = 0, q = 1) {
    const t = ctx.currentTime + at;
    const b = ctx.createBiquadFilter(); b.type = type; b.Q.value = q;
    b.frequency.setValueAtTime(f0, t);
    if (f1) b.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); b.connect(g); g.connect(sfxBus);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    noise(t, dur, b);
  }

  function arp(type, freqs, gap, dur, vol) { freqs.forEach((f, i) => tone(type, f, f, dur, vol, i * gap)); }

  const SFX = {
    hover:   () => tone('square', 1400, 1400, 0.025, 0.025),
    click:   () => { tone('square', 660, 990, 0.05, 0.06); },
    back:    () => tone('square', 880, 520, 0.07, 0.05),
    confirm: () => arp('triangle', [784, 988, 1319], 0.05, 0.12, 0.09),
    select:  () => tone('square', 990, 1180, 0.04, 0.045),
    error:   () => arp('square', [330, 262], 0.08, 0.09, 0.05),
    shot(o) {
      const f = SHOT_PITCH[o.type] || 600;
      if (o.kind === 'melee') hiss(0.12, 0.13, 'bandpass', 600, 2800, 0, 1.4);
      else if (o.kind === 'beam') { tone('sawtooth', f * 0.6, f * 0.35, 0.3, 0.05); hiss(0.25, 0.04, 'bandpass', f * 2, f, 0, 3); }
      else if (o.kind === 'nova') { hiss(0.2, 0.1, 'lowpass', 2400, 300); tone('sine', 140, 60, 0.16, 0.12); }
      else if (o.kind === 'aura') { tone('sine', f * 0.5, f * 0.55, 0.25, 0.04); tone('sine', f * 0.75, f * 0.8, 0.25, 0.03); }
      else if (o.kind === 'buff') arp('sine', [f, f * 1.25, f * 1.5], 0.05, 0.12, 0.05);
      else if (o.kind === 'orbit') tone('triangle', f, f * 1.5, 0.15, 0.04);
      else { tone('triangle', f * 1.5, f * 0.5, 0.09, 0.05); if (o.type === 'fire' || o.type === 'electric') hiss(0.06, 0.03, 'highpass', 3000); }
    },
    hit:     () => tone('triangle', 230, 90, 0.045, 0.045),
    faint:   () => tone('sine', 720, 240, 0.08, 0.04),
    bossDown() { hiss(0.7, 0.18, 'lowpass', 1500, 100); arp('triangle', [262, 330, 392, 523], 0.09, 0.4, 0.08); },
    xp() {
      const now = ctx.currentTime;
      xpCombo = now - xpT < 0.45 ? Math.min(xpCombo + 1, 24) : 0; xpT = now;
      tone('sine', 880 * Math.pow(2, xpCombo / 12), 0, 0.06, 0.035);
    },
    coin:    () => { tone('square', 1320, 1320, 0.05, 0.035); tone('square', 1760, 1760, 0.14, 0.035, 0.05); },
    heal:    () => arp('triangle', [523, 659, 784, 1047], 0.06, 0.18, 0.06),
    levelup: () => { arp('square', [523, 659, 784, 1047], 0.07, 0.14, 0.05); arp('triangle', [1047, 1319, 1568], 0.07, 0.3, 0.05); },
    hurt:    () => { tone('square', 150, 70, 0.14, 0.06); hiss(0.1, 0.06, 'lowpass', 900); },
    boss:    () => { [82, 123, 165].forEach(f => tone('sawtooth', f, f * 0.98, 1.3, 0.05)); INST.kick(ctx.currentTime, 1, sfxBus); },
    surge:   () => hiss(0.7, 0.12, 'lowpass', 500, 120),
    shiny:   () => [2093, 2637, 3136, 2349, 3520, 4186].forEach((f, i) => INST.bell(ctx.currentTime + i * 0.07, f, 0.3, 0.8, sfxBus)),
    shinyGet() { SFX.shiny(); arp('square', [784, 988, 1175, 1568], 0.1, 0.35, 0.05); },
    break:   () => { hiss(0.16, 0.12, 'lowpass', 1100, 200); tone('triangle', 140, 60, 0.12, 0.08); },
    chest:   () => { SFX.break(); arp('square', [1047, 1319, 1568, 2093], 0.06, 0.12, 0.04); },
    grass:   () => hiss(0.06, 0.03, 'highpass', 2600),
    ball:    () => { tone('triangle', 220, 70, 0.12, 0.12); hiss(0.08, 0.06, 'lowpass', 800); },
    shake:   () => tone('square', 420, 380, 0.04, 0.05),
    burst(o) {
      hiss(0.5, 0.14, 'bandpass', 400, 4000, 0, 0.8);
      const r = (o && o.rarity) || 1;
      const chord = [[523, 659, 784], [587, 740, 880], [659, 831, 988], [698, 880, 1047], [784, 988, 1175, 1568]][r - 1];
      chord.forEach(f => tone('triangle', f, f, 0.6 + r * 0.15, 0.04));
    },
    reveal(o) { INST.bell(ctx.currentTime, [523, 659, 784, 988, 1319][((o && o.rarity) || 1) - 1], 0.3, 0.8, sfxBus); },
    rift:    () => { [196, 233, 277, 330].forEach((f, i) => INST.pad(ctx.currentTime + i * 0.08, f, 1.4, 1.2, sfxBus)); hiss(0.9, 0.08, 'bandpass', 900, 300); },
    legend:  () => { arp('square', [523, 659, 784, 1047, 1319, 1568], 0.08, 0.3, 0.05); SFX.shiny(); },
    gameover: () => arp('triangle', [523, 440, 349, 262], 0.2, 0.35, 0.08),
    biome:   () => [392, 494, 587, 784].forEach(f => INST.pad(ctx.currentTime, f, 1.2, 1.4, sfxBus)),
    pause:   () => arp('square', [784, 523], 0.06, 0.07, 0.04),
    buy:     () => { SFX.coin(); arp('triangle', [659, 784, 1047], 0.05, 0.12, 0.06); }
  };

  // Separación mínima entre repeticiones del mismo efecto (ms).
  const MIN_GAP = { hit: 45, faint: 60, xp: 35, coin: 50, grass: 70, shot: 70, hover: 40, break: 60 };

  function sfx(name, opts) {
    if (!ctx || settings.muted || settings.sfx <= 0 || ctx.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    const now = performance.now();
    const key = name === 'shot' && opts ? 'shot' + opts.kind : name;
    if (now - (last[key] || 0) < (MIN_GAP[name] || 0)) return;
    if (voices > 24) return;                    // tope de voces simultáneas
    last[key] = now;
    voices++; setTimeout(() => voices--, 150);
    try { fn(opts); } catch (e) { /* un efecto nunca debe romper el juego */ }
  }

  /** Para pruebas: mide pico y RMS de la salida durante `ms` milisegundos. */
  function debugMeter(ms = 2000) {
    if (!ctx) return Promise.resolve(null);
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    master.connect(an);
    const buf = new Float32Array(an.fftSize);
    let peak = 0, sum = 0, n = 0;
    return new Promise(res => {
      const t0 = performance.now();
      const id = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        for (const v of buf) { const a = Math.abs(v); if (a > peak) peak = a; sum += v * v; n++; }
        if (performance.now() - t0 > ms) {
          clearInterval(id); master.disconnect(an);
          res({ peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4) });
        }
      }, 40);
    });
  }

  /** Para grabar vídeos: la salida final como MediaStream (MediaRecorder). */
  /**
   * Para grabar vídeos: el sonido del juego como MediaStream.
   * @param solo  sólo a la grabación (deja de sonar por los altavoces)
   */
  function debugStream(solo = false) {
    if (!ctx) return null;
    const d = ctx.createMediaStreamDestination();
    outNode.connect(d);
    if (solo) { try { outNode.disconnect(ctx.destination); } catch (e) { /* ya estaba */ } }
    return d.stream;
  }

  return {
    music, sfx, setVolume, toggleMute, unlock, debugMeter, debugStream,
    get settings() { return settings; },
    get running() { return !!ctx && ctx.state === 'running'; },
    get track() { return current && current.name; }
  };
})();
