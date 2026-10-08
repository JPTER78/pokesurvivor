/* ============ slots.js — tragaperras pixel art del gacha ============
 * Se dibuja entera en un <canvas> a resolución de arte (176×170) y se escala
 * sin suavizado, como el resto del juego.
 *
 *   palanca → giran los 3 rodillos → paran uno a uno en el símbolo de la
 *   rareza que ha salido (Poké, Super, Ultra, Lujo y Master Ball, como en
 *   G.Icons.rarity; la estrella roja es el shiny). Si es Épica, Legendaria o shiny, el
 *   último rodillo se hace esperar y las luces se vuelven locas.
 *   La ×10 son 10 tiradas rápidas; cada premio cae como una bola a la bandeja.
 *
 * Un clic acelera la animación.
 */
G.Slots = (() => {
  const W = 176, H = 170, CELL = 30;
  const SYM = G.Icons.RARITY_BALL;
  const STRIP = ['ball', 'ball2', 'ball', 'ball3', 'ball', 'ball2', 'ballLux', 'ball', 'ball4', 'ball2', 'ball3', 'shiny', 'ball', 'ball2'];
  const REEL_X = [26, 65, 104], REEL_W = 36, REEL_Y = 44, REEL_H = 46, MID = REEL_Y + REEL_H / 2;
  const C = {
    body: '#c8323c', bodyD: '#8e1f2a', bodyL: '#ef6464', trim: '#ffd23f', trimD: '#c08a10',
    dark: '#1b1528', glass: '#0d1230', reel: '#f4efe2', reelD: '#c9c1ad', chrome: '#c9d2de', chromeD: '#7d8899',
    led: '#2a0f14', bulbOn: '#ffe9a0', bulbOff: '#6b4a20'
  };

  let cv = null, ctx = null, st = null, raf = 0, last = 0, fast = false;

  const symOf = r => (r.shiny ? 'shiny' : SYM[r.rarity]);
  const colOf = r => (r.shiny ? '#9ae6ff' : G.Gacha.RARITY_COLOR[r.rarity]);

  function wait(s) {
    return new Promise(res => {
      const end = performance.now() + s * 1000 * (fast ? 0.25 : 1);
      (function chk() { if (performance.now() >= end || !st) res(); else setTimeout(chk, 16); })();
    });
  }

  /** Anima las tiradas. → Promise que se resuelve al terminar. */
  async function play(canvas, results) {
    cv = canvas; ctx = cv.getContext('2d');
    fast = false;
    cv.onclick = () => { fast = true; };
    st = {
      t: 0, lever: 0, reels: REEL_X.map(() => ({ off: Math.random() * 400, spin: false, sym: 'ball', bounce: 0, speed: 0 })),
      ten: results.length === 10, tray: [], led: results.length === 10 ? 'TIRADA ×10' : '¡SUERTE!', ledCol: C.bulbOn, win: null, frenzy: 0, sparks: []
    };
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);

    const ten = results.length === 10;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (ten) st.led = 'TIRADA ' + (i + 1) + '/10';
      // Palanca.
      G.Audio.sfx('ball');
      await tween(v => { st.lever = v; }, 0, 1, ten ? 0.12 : 0.22);
      for (const rl of st.reels) { rl.spin = true; rl.speed = 520; }
      await tween(v => { st.lever = v; }, 1, 0, ten ? 0.1 : 0.2);
      st.win = null;
      await wait(ten ? 0.18 : 0.6);
      const big = r.rarity >= 4 || r.shiny;
      for (let k = 0; k < 3; k++) {
        if (k === 2 && big) {
          // Suspense: el último rodillo frena despacio y las luces parpadean.
          st.frenzy = 1;
          st.led = r.shiny ? '¡¿SHINY?!' : r.rarity === 5 ? '¡¿LEGENDARIO?!' : '¡¿ÉPICO?!';
          st.ledCol = colOf(r);
          await tween(v => { st.reels[2].speed = v; }, 520, 120, ten ? 0.5 : 1.1);
        }
        stopReel(st.reels[k], symOf(r));
        G.Audio.sfx('shake');
        await wait(ten ? 0.08 : 0.32);
      }
      st.frenzy = 0;
      // Premio.
      st.win = { col: colOf(r), t: 0 };
      st.led = (r.shiny ? 'SHINY · ' : '') + G.Gacha.RARITY_NAME[r.rarity].toUpperCase();
      st.ledCol = colOf(r);
      G.Audio.sfx('reveal', { rarity: r.rarity });
      if (r.rarity === 5) G.Audio.sfx('legend');
      if (r.shiny) G.Audio.sfx('shiny');
      if (big) burst(colOf(r), r.rarity === 5 || r.shiny ? 60 : 30);
      st.tray.push({ sym: symOf(r), y: 104, vy: 0, done: false });
      await wait(ten ? (big ? 0.7 : 0.28) : 1.0);
    }
    await wait(0.4);
    stopAll();
  }

  function stopAll() { cancelAnimationFrame(raf); st = null; if (cv) cv.onclick = null; }

  function tween(set, a, b, dur) {
    return new Promise(res => {
      const t0 = performance.now(), d = dur * 1000 * (fast ? 0.25 : 1);
      (function step() {
        const k = Math.min(1, (performance.now() - t0) / d);
        set(a + (b - a) * k);
        if (k < 1 && st) requestAnimationFrame(step); else res();
      })();
    });
  }

  function stopReel(rl, sym) { rl.spin = false; rl.sym = sym; rl.bounce = 1; rl.speed = 0; }

  function burst(col, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832, s = 30 + Math.random() * 70;
      st.sparks.push({ x: W / 2, y: MID, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, t: 0, life: 0.6 + Math.random() * 0.6,
                       col: Math.random() < 0.5 ? col : '#ffffff' });
    }
  }

  // ---------------- dibujo ----------------

  function frame(now) {
    if (!st) return;
    const dt = Math.min(0.05, (now - last) / 1000) * (fast ? 2 : 1);
    last = now;
    st.t += dt;
    let tick = false;
    for (const rl of st.reels) {
      if (rl.spin) { const before = Math.floor(rl.off / CELL); rl.off += rl.speed * dt; if (Math.floor(rl.off / CELL) !== before) tick = true; }
      if (rl.bounce > 0) rl.bounce = Math.max(0, rl.bounce - dt * 5);
    }
    if (tick && Math.random() < 0.5) G.Audio.sfx('hover');
    if (st.win) st.win.t += dt;
    for (const b of st.tray) if (!b.done) { b.vy += 400 * dt; b.y += b.vy * dt; if (b.y >= 132) { b.y = 132; b.vy *= -0.35; if (Math.abs(b.vy) < 20) b.done = true; } }
    for (const p of st.sparks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; }
    st.sparks = st.sparks.filter(p => p.t < p.life);
    draw();
    raf = requestAnimationFrame(frame);
  }

  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    const t = st.t;

    // --- mueble ---
    R(10, 30, 142, 132, C.dark);
    R(11, 31, 140, 130, C.body);
    R(11, 31, 6, 130, C.bodyL); R(145, 31, 6, 130, C.bodyD);
    R(11, 155, 140, 6, C.bodyD);
    R(10, 162, 142, 3, C.dark);

    // --- cartel con bombillas ---
    R(14, 4, 134, 28, C.dark);
    R(15, 5, 132, 26, C.trimD);
    R(18, 8, 126, 20, C.led);
    const winCol = st.win && Math.floor(st.win.t * 8) % 2 === 0 ? st.win.col : null;
    let i = 0;
    for (let x = 16; x < 146; x += 7) { bulb(x, 5, i++, winCol); bulb(x, 29, i++, winCol); }
    for (let y = 12; y < 28; y += 7) { bulb(15, y, i++, winCol); bulb(146, y, i++, winCol); }
    ctx.font = '700 12px Pixelify,"Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.dark; ctx.fillText('POKé SLOTS', W / 2 + 1, 23);
    ctx.fillStyle = C.trim; ctx.fillText('POKé SLOTS', W / 2, 22);

    // --- ventana de rodillos ---
    R(20, 38, 122, 58, C.dark);
    R(21, 39, 120, 56, C.trimD);
    R(23, 41, 116, 52, C.glass);
    st.reels.forEach((rl, k) => drawReel(rl, REEL_X[k]));
    // Línea de premio.
    const lineCol = st.win ? st.win.col : '#ff5f6d';
    R(22, MID - 1, 3, 2, lineCol); R(137, MID - 1, 3, 2, lineCol);
    if (st.win && st.win.t < 1.2 && Math.floor(st.win.t * 10) % 2 === 0) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = st.win.col; ctx.lineWidth = 2;
      ctx.strokeRect(22, 40, 118, 54);
      ctx.globalAlpha = 1;
    }

    // --- marcador ---
    R(36, 100, 90, 16, C.dark);
    R(37, 101, 88, 14, C.led);
    ctx.font = '700 8px Pixelify,"Segoe UI",sans-serif';
    ctx.fillStyle = st.ledCol || C.bulbOn;
    if (!st.frenzy || Math.floor(t * 10) % 2 === 0) ctx.fillText(st.led, 81, 111);
    // Botoncitos decorativos.
    R(132, 102, 8, 6, C.trim); R(132, 108, 8, 2, C.trimD);
    R(22, 102, 8, 6, '#5fe08a'); R(22, 108, 8, 2, '#2f9a52');

    // --- bandeja ---
    R(26, 122, 110, 26, C.dark);
    R(28, 124, 106, 22, '#0a0712');
    R(28, 144, 106, 2, C.chromeD);
    st.tray.forEach((b, j) => {
      const n = st.ten ? 10 : 1;
      const x = n === 1 ? 81 - 12 : 30 + j * 10;
      const size = n === 1 ? 24 : 12;
      G.Icons.draw(ctx, b.sym, x, Math.round(b.y - (n === 1 ? 10 : 0)), size);
    });

    // --- palanca ---
    R(152, 74, 14, 24, C.dark);
    R(153, 75, 12, 22, C.chrome); R(160, 75, 5, 22, C.chromeD);
    const knobY = Math.round(34 + st.lever * 48);
    const top = Math.min(knobY, 82), bot = Math.max(knobY, 82);
    R(157, top, 4, bot - top, C.chromeD); R(157, top, 2, bot - top, C.chrome);
    disc(159, knobY, 6, C.dark); disc(159, knobY, 5, '#ff4d4d'); R(156, knobY - 3, 2, 2, '#ffd0d0');

    // --- chispas del premio ---
    for (const p of st.sparks) R(Math.round(p.x), Math.round(p.y), 2, 2, p.col);
  }

  function bulb(x, y, i, winCol) {
    const on = st.frenzy ? Math.floor(st.t * 14 + i) % 2 === 0 : Math.floor(st.t * 4 + i) % 3 !== 0;
    R(x, y, 3, 3, winCol || (on ? C.bulbOn : C.bulbOff));
  }

  function disc(cx, cy, r, col) {
    ctx.fillStyle = col;
    for (let y = -r; y <= r; y++) {
      const w = Math.round(Math.sqrt(r * r - y * y));
      ctx.fillRect(cx - w, cy + y, w * 2, 1);
    }
  }

  function drawReel(rl, x) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, REEL_Y, REEL_W, REEL_H); ctx.clip();
    R(x, REEL_Y, REEL_W, REEL_H, C.reel);
    if (rl.spin) {
      const base = rl.off % CELL, i0 = Math.floor(rl.off / CELL);
      for (let k = -2; k <= 2; k++) {
        const name = STRIP[((i0 - k) % STRIP.length + STRIP.length) % STRIP.length];
        const y = Math.round(MID - 12 + k * CELL + base);
        ctx.globalAlpha = rl.speed > 300 ? 0.75 : 1;
        G.Icons.draw(ctx, name, x + 6, y, 24);
        if (rl.speed > 300) { ctx.globalAlpha = 0.25; G.Icons.draw(ctx, name, x + 6, y - 6, 24); }
        ctx.globalAlpha = 1;
      }
    } else {
      const by = Math.round(Math.sin(rl.bounce * Math.PI) * 5);
      const n = STRIP.indexOf(rl.sym);
      ctx.globalAlpha = 0.35;
      G.Icons.draw(ctx, STRIP[(n + 3) % STRIP.length], x + 6, MID - 12 - CELL + by, 24);
      G.Icons.draw(ctx, STRIP[(n + 5) % STRIP.length], x + 6, MID - 12 + CELL + by, 24);
      ctx.globalAlpha = 1;
      G.Icons.draw(ctx, rl.sym, x + 6, MID - 12 + by, 24);
    }
    // Sombra curva del rodillo (arriba y abajo más oscuro).
    ctx.globalAlpha = 0.28;
    R(x, REEL_Y, REEL_W, 6, C.reelD); R(x, REEL_Y + REEL_H - 6, REEL_W, 6, C.reelD);
    ctx.globalAlpha = 0.18;
    R(x, REEL_Y, REEL_W, 3, '#000'); R(x, REEL_Y + REEL_H - 3, REEL_W, 3, '#000');
    ctx.globalAlpha = 1;
    ctx.restore();
    R(x - 1, REEL_Y, 1, REEL_H, C.dark); R(x + REEL_W, REEL_Y, 1, REEL_H, C.dark);
  }

  return { play, stop: stopAll };
})();
