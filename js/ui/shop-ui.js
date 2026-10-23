/* ============ shop-ui.js — Tienda Kecleon y Mochila ============
 * (20-10-2026, del PR #236 de TheAdro7, adaptado.)
 *   Tienda   Menta, Cápsulas y las 8 MT del día (data/shop.js); arriba, el puesto
 *            de los dos Kecleon (Scene)
 *   Mochila  desde el menú principal (openBag)
 * Lo de la Mochila se usa desde la ficha de cada Pokémon en la colección.
 */
G.ShopUI = (() => {
  const $ = G.UI.$;
  const KECLEON = 352;

  // =====================================================================
  //   El puesto, en pixel art (como en Mundo Misterioso), en un lienzo:
  //   paisaje (cielo, nubes, colinas con árboles, camino y hojas que caen),
  //   toldo de rayas, postes, pared de tablas, estanterías con género,
  //   farolillos, mostrador con su paño y, delante, la persiana de tablas.
  //   Se dibuja a 1/P de resolución (lo/fr) y se amplía sin suavizar; los
  //   Kecleon van entre las dos capas (detrás del mostrador).
  //
  //   Entrada (se salta con un toque; sin ella con "Menos sacudidas"):
  //     la persiana tiembla dos veces y se enrolla soltando polvo, el género
  //     aparece en las estanterías, se encienden los farolillos, los Kecleon
  //     salen de su camuflaje (Cambio Color) ondulando, giran sobre sí mismos,
  //     saltan con confeti, cae el cartel balanceándose y el morado saluda.
  //   Después: pasean, se miran, saltan, giran, a veces se camuflan un
  //   momento; si pasas por algo, el más cercano lo señala; al comprar, el
  //   objeto sale de la estantería y vuela a la Mochila (y lo reponen).
  // =====================================================================
  const Scene = (() => {
    const P = 3;                                  // píxeles de pantalla por píxel del dibujo
    const PURPLE = [70, 175, 288];                // el hermano: lo verde del sprite, a morado
    const GRAV = 380, WALK = 55, KS = 168;        // gravedad y paso (píxeles del dibujo), lienzo de cada Kecleon
    let cv = null, ctx = null, back = null, bg = null, front = null, fg = null, kc = null, kcx = null;
    let raf = 0, last = 0, W = 0, H = 0, LW = 0, LH = 0, T = 0, seed = 1;
    let L = {}, ks = [], parts = [], clouds = [], trees = [], pebbles = [], slots = [], timers = [];
    let intro = false, shutter = 0, shutterV = 0, shake = 0, lit = [false, false], shown = 0;
    const calm = () => !!G.Settings.get('calm');
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const SHELF = ['mint', 'berry', 'tm', 'capsule', 'ball', 'capsuleh', 'tm', 'mint', 'berry', 'capsule', 'tm', 'ball', 'mint', 'capsuleh'];

    // ---------------- tamaño y escenario ----------------

    function layout() {
      const groundY = LH - 9, SW = Math.min(LW - 8, 178), x0 = Math.floor((LW - SW) / 2);
      // (Con sitio, el toldo baja y queda cielo arriba: ahí va la barra de monedas.)
      L = { groundY, SW, x0, x1: x0 + SW, roofY: LH >= 90 ? 16 : 4, roofH: 15 };
      L.openTop = L.roofY + L.roofH + 3;
      L.counterTop = groundY - 17;
      L.feet = L.counterTop + 1;
      const sx0 = x0 + Math.round(SW * 0.27), sx1 = L.x1 - Math.round(SW * 0.27);
      L.shelves = [L.openTop + 15, L.openTop + 30].filter(y => y < L.counterTop - 1);
      L.sx0 = sx0; L.sx1 = sx1;
      slots = [];
      const n = Math.max(1, Math.floor((sx1 - sx0 - 2) / 14));
      L.shelves.forEach((y, r) => {
        for (let i = 0; i < n; i++) slots.push({ x: sx0 + 2 + i * 14 + Math.floor((sx1 - sx0 - 2 - n * 14) / 2), y: y - 12, icon: SHELF[(i + r * 5) % SHELF.length], pop: -1, gone: 0 });
      });
      // Paisaje fijo (con semilla): árboles del fondo, piedrecitas del camino y nubes.
      seed = 4242; trees = []; pebbles = []; clouds = [];
      for (let x = -6; x < LW + 6; x += 7 + Math.floor(rnd() * 6)) trees.push({ x, r: 4 + Math.floor(rnd() * 3), h: Math.floor(rnd() * 4) });
      for (let i = 0; i < LW / 5; i++) pebbles.push({ x: Math.floor(rnd() * LW), y: groundY + 2 + Math.floor(rnd() * 6) });
      for (let i = 0; i < 4; i++) clouds.push({ x: rnd() * LW, y: 2 + Math.floor(rnd() * 12), w: 10 + Math.floor(rnd() * 10), v: 1.5 + rnd() * 2 });
    }

    function resize() {
      const r = cv.getBoundingClientRect();
      if (!r.width) return false;
      const w = Math.round(r.width), h = Math.round(r.height);
      if (w === W && h === H) return true;
      const oldLW = LW;
      W = w; H = h; cv.width = W; cv.height = H;
      LW = Math.ceil(W / P); LH = Math.ceil(H / P);
      for (const c of [back, front]) { c.width = LW; c.height = LH; }
      layout();
      if (oldLW) for (const k of ks) k.x = k.x / oldLW * LW;
      return true;
    }

    // ---------------- los Kecleon ----------------

    function mk(purple) {
      const a = new G.Sprites.Animator(KECLEON, P / G.Sprites.PX, false);
      return { a, purple, x: 0, hop: 0, vy: 0, tx: null, then: null, think: 1 + Math.random() * 2, cam: 1, camTo: 1, spin: 0 };
    }
    const zone = k => (k.purple ? [L.x1 - L.SW * 0.3, L.x1 - 10] : [L.x0 + 10, L.x0 + L.SW * 0.3]);
    const home = k => (k.purple ? L.x1 - L.SW * 0.13 : L.x0 + L.SW * 0.13);
    const other = k => ks[k.purple ? 0 : 1];
    /** Mira hacia x (2 derecha, 6 izquierda) o al frente, un poco hacia el otro. */
    function face(k, x) { k.a.dir = x == null ? (k.purple ? 7 : 1) : x > k.x ? 2 : 6; }
    function walkTo(k, x, then) {
      const [a, b] = zone(k);
      k.tx = G.U.clamp(x, a, b); k.then = then || null;
      k.a.loop('Walk', 1.3); face(k, k.tx);
    }
    function hop(k, v) { if (k.hop === 0) k.vy = -v; }
    function spin(k, s = 0.5) { k.spin = s; }

    // ---------------- partículas (en píxeles del dibujo) ----------------

    function confetti(x, y, n) {
      if (calm()) return;
      const cols = ['#ffd23f', '#ff5f6d', '#5fe08a', '#4fb4ff', '#ff8ad8', '#fff4b0'];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 40 + Math.random() * 70;
        parts.push({ k: 'conf', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 1.4 + Math.random() * 0.8, c: G.U.pick(cols), w: Math.random() < 0.5 ? 2 : 1 });
      }
    }
    function dust(x0, x1, y) {
      if (calm()) return;
      for (let x = x0; x < x1; x += 7) parts.push({ k: 'dust', x: x + Math.random() * 3, y, vx: (Math.random() - 0.5) * 12, vy: -4 - Math.random() * 8, t: 0, life: 0.7 + Math.random() * 0.5, r: 1 + Math.random() * 2 });
    }
    function sparkle(x, y, n = 6) {
      if (calm()) return;
      for (let i = 0; i < n; i++) parts.push({ k: 'spark', x: x + (Math.random() - 0.5) * 22, y: y - Math.random() * 26, t: -Math.random() * 0.3, life: 0.5 + Math.random() * 0.3 });
    }
    function leaf() {
      parts.push({ k: 'leaf', x: Math.random() * LW, y: -3, vx: 4 + Math.random() * 6, vy: 6 + Math.random() * 5, t: 0, life: 12, ph: Math.random() * 6, c: G.U.pick(['#7fd06a', '#f0c64a', '#e08a3a']) });
    }

    // ---------------- arranque, salto de la entrada, parada ----------------

    function start(withIntro) {
      cv = $('shop-scene'); ctx = cv.getContext('2d');
      if (!back) {
        back = document.createElement('canvas'); bg = back.getContext('2d');
        front = document.createElement('canvas'); fg = front.getContext('2d');
        kc = document.createElement('canvas'); kc.width = kc.height = KS; kcx = kc.getContext('2d');
      }
      W = 0;
      timers.forEach(clearTimeout); timers = [];
      parts = []; ks = [mk(false), mk(true)];
      if (!resize()) { requestAnimationFrame(() => start(withIntro)); return; }
      for (const k of ks) { k.x = home(k); k.a.loop('Idle'); face(k); }
      intro = withIntro;
      if (!withIntro) { finish(); }
      else {
        // Todo cerrado.
        shutter = 1; shutterV = 0; shake = 0; lit = [false, false]; shown = 0;
        for (const k of ks) { k.cam = 0; k.camTo = 0; }
        at(250, () => G.Audio.sfx('descend'));
        at(850, () => { shake = 1; G.Audio.sfx('shake'); });
        at(1200, () => { shake = 1; G.Audio.sfx('shake'); });
        at(1550, () => { shutterV = -1.6; G.Audio.sfx('chest'); });
        at(2150, () => {
          // El género, uno a uno.
          slots.forEach((s, i) => at(i * 55, () => { shown = i + 1; s.pop = T; if (i % 3 === 0) G.Audio.sfx('coin'); }));
        });
        at(2450, () => { lit[0] = true; G.Audio.sfx('select'); });
        at(2620, () => { lit[1] = true; G.Audio.sfx('select'); });
        at(2750, () => { ks[0].camTo = 1; sparkle(ks[0].x, L.feet - 6); G.Audio.sfx('shiny'); });
        at(3000, () => { ks[1].camTo = 1; sparkle(ks[1].x, L.feet - 6); });
        at(3550, () => { for (const k of ks) spin(k, 0.5); G.Audio.sfx('reveal', { rarity: 4 }); });
        at(4050, () => {
          for (const k of ks) { hop(k, 95); k.a.play('Attack'); }
          confetti(LW / 2, L.openTop + 6, 70);
          G.Audio.sfx('levelup');
          const sg = $('shop-sign'); sg.classList.remove('shown'); sg.classList.add('show');
        });
        at(4700, () => { $('shop-sign').classList.add('lit'); intro = false; greet(); });
      }
      // El primer fotograma ya, para que no se vea la caja vacía ni un instante.
      cancelAnimationFrame(raf);
      last = performance.now();
      frame(last);
    }

    /** Todo ya montado (sin entrada, o al saltarla). */
    function finish() {
      timers.forEach(clearTimeout); timers = [];
      intro = false; shutter = 0; shutterV = 0; shake = 0; lit = [true, true];
      shown = slots.length; slots.forEach(s => { s.pop = -1; });
      for (const k of ks) { k.cam = k.camTo = 1; k.spin = 0; k.x = home(k); k.tx = null; k.then = null; k.a.loop('Idle'); face(k); }
      const sg = $('shop-sign'); sg.classList.remove('show'); sg.classList.add('shown', 'lit');
      greet();
    }
    function greet() { say(G.U.pick(['¡Bienvenido a la Tienda Kecleon!', '¡Hola! Echa un vistazo, ¿eh?'])); }

    function stop() { cancelAnimationFrame(raf); raf = 0; timers.forEach(clearTimeout); timers = []; }

    // ---------------- lo que hacen solos ----------------

    function think(k) {
      const r = Math.random(), [a, b] = zone(k);
      if (r < 0.34) walkTo(k, a + Math.random() * (b - a), () => face(k));
      else if (r < 0.5) hop(k, 70);
      else if (r < 0.64) face(k, other(k).x);                 // se miran
      else if (r < 0.74) { spin(k, 0.6); }                     // una vuelta
      else if (r < 0.84) { k.camTo = 0.2; at(1300, () => { k.camTo = 1; sparkle(k.x, L.feet - 6, 4); }); }   // ¡camuflaje!
      else { face(k); k.a.play('Attack'); }                    // saluda
      if (k.purple && Math.random() < 0.18) say(G.U.pick(['¡Hola! Echa un vistazo, ¿eh?', '¡Bienvenido a la Tienda Kecleon!']));
      k.think = 1.6 + Math.random() * 2.8;
    }

    /** Alguien señala lo que miras (x en px de la pantalla). */
    function point(screenX) {
      if (!cv || intro) return;
      const r = cv.getBoundingClientRect(), x = (screenX - r.left) / P;
      const k = x > LW / 2 ? ks[1] : ks[0];
      k.think = 3.5; k.camTo = 1;
      walkTo(k, x, () => { face(k); k.a.play('Attack'); });
    }

    /**
     * ¡Compra! Saltan los dos y el objeto sale de la estantería (luego lo
     * reponen). → dónde está ese objeto en la pantalla (para que vuele de ahí).
     */
    function cheer(icon) {
      for (const k of ks) { hop(k, 85); spin(k, 0.45); k.a.play('Attack'); k.think = 2.2; k.camTo = 1; }
      const list = slots.filter(s => s.icon === icon && !s.gone);
      const s = list.length ? G.U.pick(list) : G.U.pick(slots);
      if (!s || !cv) return null;
      s.gone = 1;
      at(1400, () => { s.gone = 0; s.pop = T; sparkle(s.x + 6, s.y + 10, 3); });
      confetti(s.x + 6, s.y + 4, 24);
      const r = cv.getBoundingClientRect();
      return { x: r.left + (s.x + 6) * P, y: r.top + (s.y + 6) * P };
    }

    // ---------------- bucle ----------------

    function frame(now) {
      raf = 0;
      if (!G.UI.isOpen('scr-shop') || !cv) return;
      const dt = Math.min(0.2, (now - last) / 1000); last = now; T += dt;   // (con el aparato lento, a saltos pero a su ritmo)
      resize();
      if (shutterV) { shutter = G.U.clamp(shutter + shutterV * dt, 0, 1); if (shutter === 0 && shutterV < 0) { shutterV = 0; dust(L.x0 + 3, L.x1 - 4, L.openTop + 1); } }
      if (shutterV < 0 && !calm()) for (let i = 0; i < 2; i++) parts.push({ k: 'dust', x: L.x0 + 4 + Math.random() * (L.SW - 8), y: L.openTop + (L.counterTop - L.openTop) * shutter, vx: (Math.random() - 0.5) * 10, vy: -3 - Math.random() * 6, t: 0, life: 0.5 + Math.random() * 0.4, r: 1 });
      shake = Math.max(0, shake - dt * 3);
      for (const c of clouds) { c.x += c.v * dt; if (c.x > LW + 4) c.x = -c.w - 4; }
      if (!calm() && Math.random() < dt * 0.6) leaf();
      for (const k of ks) {
        k.a.update(dt);
        k.cam += (k.camTo - k.cam) * Math.min(1, dt * 4);
        if (k.spin > 0) {
          k.spin -= dt;
          k.a.dir = Math.floor(T * 18) % 8;
          if (k.spin <= 0) { k.spin = 0; face(k); }
        }
        if (k.tx != null) {
          const d = k.tx - k.x, step = WALK * dt;
          if (Math.abs(d) <= step) { k.x = k.tx; k.tx = null; k.a.loop('Idle'); const t = k.then; k.then = null; if (t) t(); }
          else k.x += Math.sign(d) * step;
        } else if (!intro && k.spin === 0 && (k.think -= dt) <= 0) think(k);
        if (k.vy || k.hop) {
          k.vy += GRAV * dt; k.hop -= k.vy * dt;
          if (k.hop <= 0) { k.hop = 0; k.vy = 0; }
        }
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt; if (p.t >= p.life) { parts.splice(i, 1); continue; }
        if (p.t < 0) continue;
        if (p.k === 'conf') { p.vy += 90 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; }
        else if (p.k === 'dust') { p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 3; }
        else if (p.k === 'leaf') { p.x += (p.vx + Math.sin(T * 2 + p.ph) * 8) * dt; p.y += p.vy * dt; if (p.y > L.groundY + 3) p.life = 0; }
      }
      drawBack(); drawFront();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(back, 0, 0, LW * P, LH * P);
      for (const k of ks) drawKecleon(k);
      ctx.drawImage(front, 0, 0, LW * P, LH * P);
      drawGlow();
      drawParts();
      placeBubble();
      raf = requestAnimationFrame(frame);
    }

    // ---------------- dibujo: fondo ----------------

    const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
    function disc(g, cx, cy, r, c) {
      g.fillStyle = c;
      for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
    }

    function drawBack() {
      const g = bg, { groundY } = L;
      g.clearRect(0, 0, LW, LH);
      // Cielo (degradado en franjas) y sol.
      const top = [111, 184, 240], bot = [191, 230, 255];
      for (let y = 0; y < groundY - 8; y++) {
        const t = y / (groundY - 8);
        R(g, 0, y, LW, 1, `rgb(${top.map((v, i) => Math.round(v + (bot[i] - v) * t)).join(',')})`);
      }
      disc(g, Math.round(LW * 0.86), 10, 5, '#fff4b0'); disc(g, Math.round(LW * 0.86), 10, 4, '#ffe066');
      // Nubes.
      for (const c of clouds) {
        const x = Math.round(c.x), y = c.y;
        R(g, x + 2, y, c.w - 4, 1, '#ffffff'); R(g, x, y + 1, c.w, 3, '#ffffff'); R(g, x + 1, y + 4, c.w - 2, 1, '#dcefff');
        R(g, x + Math.round(c.w * 0.3), y - 1, Math.round(c.w * 0.35), 1, '#ffffff');
      }
      // Colinas lejanas y árboles.
      const hillY = groundY - 14;
      for (let x = 0; x < LW; x++) { const h = Math.round(4 + Math.sin(x * 0.07) * 3 + Math.sin(x * 0.19 + 1) * 1.5); R(g, x, hillY - h, 1, groundY - hillY + h, '#6fae76'); }
      for (const t of trees) {
        const cy = hillY + 3 - t.h;
        R(g, t.x - 1, cy, 2, 8, '#5a3a24');
        disc(g, t.x, cy - 2, t.r, '#2f7a45'); disc(g, t.x - 1, cy - 3, t.r - 2, '#3f9a55'); R(g, t.x - 2, cy - t.r - 1, 2, 1, '#6fc47a');
      }
      // Hierba y camino.
      R(g, 0, groundY - 2, LW, 2, '#4f9a4a');
      R(g, 0, groundY, LW, LH - groundY, '#c9a46a');
      R(g, 0, groundY, LW, 1, '#8f6a3a');
      for (const p of pebbles) R(g, p.x, p.y, 1, 1, '#9e7a48');
      for (let x = 3; x < LW; x += 9) R(g, x, groundY - 3, 1, 1, '#7fd06a');
      // Sombra del puesto en el suelo.
      g.globalAlpha = 0.25; R(g, L.x0 - 2, groundY, L.SW + 4, 3, '#000'); g.globalAlpha = 1;
      // Pared de tablas del puesto.
      const wx0 = L.x0 + 3, wx1 = L.x1 - 3, wy0 = L.openTop - 1;
      R(g, wx0, wy0, wx1 - wx0, L.counterTop - wy0 + 2, '#4a2e1c');
      for (let y = wy0 + 3; y < L.counterTop; y += 4) {
        R(g, wx0, y, wx1 - wx0, 1, '#3a2214');
        for (let x = wx0 + ((y / 4) % 2 ? 6 : 12); x < wx1; x += 17) R(g, x, y - 3, 1, 3, '#3a2214');
      }
      // Cortinilla roja arriba.
      R(g, wx0, wy0, wx1 - wx0, 2, '#b8283a');
      for (let x = wx0; x < wx1; x += 4) R(g, x + 1, wy0 + 2, 2, 1, '#b8283a');
      // Estanterías y género.
      for (const y of L.shelves) {
        R(g, L.sx0, y, L.sx1 - L.sx0, 2, '#9a6538'); R(g, L.sx0, y, L.sx1 - L.sx0, 1, '#c88a52'); R(g, L.sx0, y + 2, L.sx1 - L.sx0, 1, '#2a1a10');
        R(g, L.sx0 + 2, y + 2, 1, 3, '#7a4c22'); R(g, L.sx1 - 3, y + 2, 1, 3, '#7a4c22');
      }
      slots.forEach((s, i) => {
        if (i >= shown || s.gone) return;
        // Al aparecer: cae y bota un poco.
        let dy = 0;
        if (s.pop >= 0) { const t = T - s.pop; dy = t < 0.35 ? -Math.round((1 - t / 0.35) * 8 * Math.abs(Math.cos(t * 9))) : 0; if (t > 0.6) s.pop = -1; }
        G.Icons.draw(g, s.icon, s.x, s.y + dy, 12);
      });
    }

    // ---------------- dibujo: delante de los Kecleon ----------------

    function drawFront() {
      const g = fg, { x0, x1, roofY, roofH, groundY, counterTop } = L;
      g.clearRect(0, 0, LW, LH);
      // Postes.
      for (const px of [x0, x1 - 3]) { R(g, px, roofY + roofH, 3, groundY - roofY - roofH, '#7a4c22'); R(g, px, roofY + roofH, 1, groundY - roofY - roofH, '#a8733f'); }
      // Persiana de tablas (cerrada al empezar; tiembla y se enrolla).
      if (shutter > 0) {
        const sx0 = x0 + 3, sx1 = x1 - 3, top = L.openTop - 1, hgt = Math.round((counterTop - top + 1) * shutter);
        const jx = shake ? Math.round(Math.sin(T * 60) * shake * 1.5) : 0;
        for (let y = 0; y < hgt; y += 3) {
          R(g, sx0 + jx, top + y, sx1 - sx0, 3, (y / 3) % 2 ? '#b07a4a' : '#9a6538');
          R(g, sx0 + jx, top + y + 2, sx1 - sx0, 1, '#5a3412');
        }
        R(g, sx0 + jx, top + hgt - 1, sx1 - sx0, 1, '#3a1f08');
        if (shutter < 1) { R(g, sx0, top - 1, sx1 - sx0, 3, '#7a4c22'); R(g, sx0, top - 1, sx1 - sx0, 1, '#c88a52'); }
      }
      // Mostrador.
      R(g, x0 - 2, counterTop, L.SW + 4, groundY - counterTop, '#b07a4a');
      for (let x = x0 + 4; x < x1; x += 8) R(g, x, counterTop + 3, 1, groundY - counterTop - 3, '#8a5528');
      R(g, x0 - 2, counterTop, L.SW + 4, 2, '#e0a868'); R(g, x0 - 2, counterTop + 2, L.SW + 4, 1, '#5a3412');
      R(g, x0 - 2, groundY - 1, L.SW + 4, 1, '#5a3412');
      // (Delante, en el centro, cuelga el cartel: .shop-sign, lo coloca placeBubble.)
      for (const cx of [x0 + 6, x1 - 18]) G.Icons.draw(g, 'coin', cx, counterTop + 4, 12);
      // Toldo de rayas con el borde ondulado.
      const rx0 = x0 - 4, rx1 = x1 + 4;
      for (let x = rx0; x < rx1; x++) {
        const green = Math.floor((x - rx0) / 8) % 2 === 0;
        R(g, x, roofY, 1, roofH, green ? '#3fae5c' : '#f0f6e8');
        R(g, x, roofY + roofH - 3, 1, 3, green ? '#2d8f4a' : '#cfdcc4');
      }
      R(g, rx0, roofY, rx1 - rx0, 2, '#2d7f43'); R(g, rx0, roofY + 2, rx1 - rx0, 1, '#5fd07a');
      for (let x = rx0; x < rx1; x += 8) {
        const green = Math.floor((x - rx0) / 8) % 2 === 0;
        disc(g, x + 4, roofY + roofH, 3, green ? '#2d8f4a' : '#cfdcc4');
        R(g, x + 1, roofY + roofH, 7, 1, green ? '#2d8f4a' : '#cfdcc4');
      }
      // Farolillos (se mecen; encendidos, brillan: drawGlow).
      lanterns().forEach(({ x, y }, i) => {
        R(g, Math.round(x), y - 4, 1, 4, '#3a1f08');
        const c = lit[i] ? '#ff7a3d' : '#8a4a32', b = lit[i] ? '#ffd23f' : '#5a2a1a';
        R(g, Math.round(x) - 2, y, 5, 7, c); R(g, Math.round(x) - 2, y + 2, 5, 1, b); R(g, Math.round(x) - 2, y + 4, 5, 1, b);
        R(g, Math.round(x) - 1, y - 1, 3, 1, '#3a1f08'); R(g, Math.round(x) - 1, y + 7, 3, 1, '#3a1f08');
      });
    }

    function lanterns() {
      const y = L.roofY + L.roofH + 5;
      return [L.x0 + 8, L.x1 - 9].map((x, i) => ({ x: x + Math.sin(T * 1.7 + i * 2) * 1.2, y }));
    }

    function drawGlow() {
      lanterns().forEach(({ x, y }, i) => {
        if (!lit[i]) return;
        const cx = x * P, cy = (y + 3) * P, r = 34 + Math.sin(T * 6 + i) * 3;
        const gr = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
        gr.addColorStop(0, 'rgba(255,200,90,.45)'); gr.addColorStop(1, 'rgba(255,200,90,0)');
        ctx.fillStyle = gr; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      });
    }

    // ---------------- dibujo: Kecleon (con camuflaje y el morado) ----------------

    function drawKecleon(k) {
      const x = Math.round(k.x * P), y = Math.round((L.feet - k.hop) * P);
      // Sombra en el suelo del puesto (se encoge al saltar).
      const sk = Math.max(0.4, 1 - k.hop / 30);
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(x, L.feet * P, 30 * sk, 8 * sk, 0, 0, 6.2832); ctx.fill();
      if (k.cam < 0.02) return;
      kcx.setTransform(1, 0, 0, 1, 0, 0);
      kcx.clearRect(0, 0, KS, KS);
      kcx.imageSmoothingEnabled = false;
      k.a.draw(kcx, KS / 2, KS - 12);
      if (k.purple) G.UI.hueSwap(kcx, kc, PURPLE);
      const ox = x - KS / 2, oy = y - KS + 12;
      if (k.cam > 0.98) { ctx.drawImage(kc, ox, oy); return; }
      // Camuflado: casi transparente y ondulando, en franjas.
      const amp = (1 - k.cam) * 7;
      ctx.globalAlpha = 0.12 + k.cam * 0.88;
      for (let r = 0; r < KS; r += 3) ctx.drawImage(kc, 0, r, KS, 3, ox + Math.round(Math.sin(r * 0.22 + T * 14) * amp), oy + r, KS, 3);
      ctx.globalAlpha = 1;
    }

    // ---------------- dibujo: partículas y bocadillo ----------------

    function drawParts() {
      for (const p of parts) {
        if (p.t < 0) continue;
        const a = 1 - p.t / p.life, x = Math.round(p.x) * P, y = Math.round(p.y) * P;
        if (p.k === 'conf') { ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = p.c; ctx.fillRect(x, y, p.w * P, (Math.sin(p.t * 12) > 0 ? 1 : 2) * P); }
        else if (p.k === 'dust') { ctx.globalAlpha = a * 0.6; ctx.fillStyle = '#d8c4a8'; const s = Math.round(p.r) * P; ctx.fillRect(x - s / 2, y - s / 2, s, s); }
        else if (p.k === 'leaf') { ctx.globalAlpha = 1; ctx.fillStyle = p.c; ctx.fillRect(x, y, 2 * P, P); }
        else if (p.k === 'spark') { ctx.globalAlpha = 1; G.Icons.twinkle(ctx, x, y, p.t / p.life, P); }
      }
      ctx.globalAlpha = 1;
    }

    function placeBubble() {
      $('shop-sign').style.top = (L.counterTop + 4) * P + 'px';
      const b = $('shop-bubble'), pk = ks[1];
      if (!b || !pk) return;
      const bw = b.offsetWidth, left = Math.max(6, Math.min(W - bw - 6, pk.x * P - bw - 30));
      b.style.left = left + 'px';
      b.style.top = Math.max(4, (L.feet - 32 - pk.hop) * P) + 'px';
    }

    return { start, stop, skip: finish, point, cheer, get intro() { return intro; } };
  })();

  // ---------------- abrir ----------------

  function open() {
    G.UI.show('scr-shop', true);
    const sg = $('shop-sign');
    sg.classList.remove('lit', 'show', 'shown');
    $('shop-bubble').classList.add('hide');
    render();
    const st = $('shop-stall'), withIntro = !G.Settings.get('calm');
    st.classList.remove('opening');
    if (withIntro) { void st.offsetWidth; st.classList.add('opening'); setTimeout(() => st.classList.remove('opening'), 4800); }
    // (Si el lienzo aún no tiene tamaño, start lo vuelve a intentar al siguiente fotograma.)
    Scene.start(withIntro);
    st.onclick = () => {
      if (!Scene.intro) return;
      st.classList.remove('opening');
      Scene.skip();
    };
  }

  /** Mochila desde el menú principal. */
  function openBag() {
    G.UI.show('scr-bag', true);
    const box = $('bag-body');
    box.innerHTML = bagHtml();
    const go = box.querySelector('[data-go-dex]');
    if (go) go.onclick = () => G.MenuUI.openDex();
    const shop = box.querySelector('[data-go-shop]');
    if (shop) shop.onclick = () => open();
  }

  /** Lo que dice el Kecleon morado en el bocadillo (se va solo a los 6 s). */
  let sayT = 0;
  function say(text) {
    const b = $('shop-bubble');
    b.textContent = G.T(text);
    b.classList.remove('hide', 'pop');
    void b.offsetWidth;
    b.classList.add('pop');
    clearTimeout(sayT);
    sayT = setTimeout(() => b.classList.add('hide'), 6000);
  }

  /** El objeto comprado sale de la estantería (from) y vuela hasta su fila de la lista
   *  (key, donde pone cuántos tienes), que bota al recibirlo. */
  function flyToBag(iconHtml, from, key) {
    const target = $('shop-body').querySelector(`[data-buy="${key}"]`)?.closest('.upg-item').querySelector('.ic');
    if (!target) return;
    const to = target.getBoundingClientRect();
    if (!from) { const r = $('shop-stall').getBoundingClientRect(); from = { x: r.left + r.width / 2, y: r.bottom - 50 }; }
    const el = document.createElement('div');
    el.className = 'shop-fly';
    el.innerHTML = iconHtml;
    document.body.appendChild(el);
    const x0 = from.x - 16, y0 = from.y - 16, x1 = to.left + to.width / 2 - 16, y1 = to.top + to.height / 2 - 16;
    const mid = { x: (x0 + x1) / 2, y: Math.min(y0, y1) - 70 };
    const anim = el.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(.5)`, opacity: 0 },
      { transform: `translate(${x0}px, ${y0 - 30}px) scale(1.3) rotate(-10deg)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${mid.x}px, ${mid.y}px) scale(1.2) rotate(8deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${x1}px, ${y1}px) scale(.7) rotate(0)`, opacity: 1 }
    ], { duration: 950, easing: 'cubic-bezier(.3,.6,.4,1)' });
    anim.onfinish = () => {
      el.remove();
      target.classList.remove('bump'); void target.offsetWidth; target.classList.add('bump');
    };
  }

  const coin = n => `<span class="coin"></span> ${n.toLocaleString(G.I18n.locale)}`;
  const moveName = id => G.T(G.Moves.BY_ID[id].name, 'move');

  /** Fila de la lista: icono, nombre, texto y botón. */
  function row(icon, title, desc, right) {
    return `<div class="panel upg-item"><div class="ic">${icon}</div>
      <div><b>${title}</b><div class="sub" style="font-size:13px">${desc}</div></div>
      <div class="upg-btns">${right}</div></div>`;
  }

  // Qué hay en la estantería de cada cosa que se compra (para que salga de ahí).
  const SHELF_ICON = { mint: 'mint', cap: 'capsule', caph: 'capsuleh' };

  function render() {
    const box = $('shop-body');
    box.innerHTML = buyHtml();
    box.querySelectorAll('[data-buy]').forEach(b => {
      b.onclick = () => {
        const key = b.dataset.buy, r = G.Shop.buy(key);
        if (!r.ok) { if (r.error) G.UI.toast(r.error); G.Audio.sfx('error'); return; }
        G.Audio.sfx('buy');
        G.UI.refreshCoins();
        const icon = b.closest('.upg-item').querySelector('.ic').innerHTML;
        const from = Scene.cheer(key.startsWith('tm:') ? 'tm' : SHELF_ICON[key]);
        say(G.U.pick(['¡Muchas gracias!', '¡Gracias, vuelve pronto!']));
        render();
        flyToBag(icon, from, key);
      };
    });
    // Pasar por algo de la tienda: el Kecleon más cercano va a señalarlo.
    box.querySelectorAll('.upg-item').forEach(it => {
      it.addEventListener('pointerenter', () => { const r = it.getBoundingClientRect(); Scene.point(r.left + r.width / 2); });
    });
  }

  function buyHtml() {
    const s = G.DB.save, partner = s.partner, mine = n => (n ? ` <small class="gold">· ${G.I18n.f('tienes {x}', n)}</small>` : '');
    const buyBtn = (key, price) => `<button class="btn small gold" data-buy="${key}" data-sfx="none" ${s.coins < price ? 'disabled' : ''}>${coin(price)}</button>`;
    let h = `<h3 style="margin:10px 0 6px">${G.T('Objetos')}</h3><div class="upg">`;
    for (const id of G.Shop.ORDER) {
      const it = G.Shop.ITEMS[id];
      h += row(G.Icons.html(it.icon, 32), G.T(it.name) + mine(G.Shop.count(id)), G.T(it.desc), buyBtn(id, it.price));
    }
    h += `</div><h3 style="margin:14px 0 6px">${G.T('MT de hoy')}</h3>
      <p class="sub" style="margin:0 0 8px">${G.T('Cada día hay otras 8. Una MT enseña su ataque a un Pokémon que lo aprenda en los juegos, para siempre (se gasta al usarla).')}</p><div class="upg">`;
    for (const id of G.Shop.dailyTms()) {
      const m = G.Moves.BY_ID[id];
      const fits = partner && G.Mons.canLearn(partner, id);
      const cat = G.Stats.NAME[m.cat || (m.stat === 'patk' ? 'physical' : m.stat === 'satk' ? 'special' : '')];
      const tag = `<span class="tag-chip" style="background:${G.U.TYPE_COLOR[m.type]}">${G.U.TYPE_NAME[m.type]}</span>${cat ? `<span class="tag-chip cat">${cat}</span>` : ''}`;
      const note = fits ? `<span class="gold">${G.I18n.f('{x} la puede aprender', G.DEX_BY[partner].name)}</span>`
        : partner && G.Mons.taught(partner).includes(id) ? G.I18n.f('{x} ya la sabe', G.DEX_BY[partner].name) : G.T(m.desc);
      h += row(G.Icons.html('move:' + id, 32), `${G.T('MT')} ${moveName(id)} ${tag}${mine(G.Shop.tmCount(id))}`, note, buyBtn('tm:' + id, G.Shop.tmPrice(id)));
    }
    return h + '</div>';
  }

  function bagHtml() {
    const s = G.DB.save;
    const items = G.Shop.ORDER.filter(id => G.Shop.count(id) > 0);
    const tms = Object.keys(s.tms || {}).filter(id => G.Moves.BY_ID[id] && s.tms[id] > 0).sort((a, b) => moveName(a).localeCompare(moveName(b)));
    if (!items.length && !tms.length) {
      return `<p class="sub center" style="margin:24px 0">${G.T('Tu Mochila está vacía.')}<br><br>
            <button class="btn gold" data-go-shop>${G.Icons.html('shop', 16)} ${G.T('Ir a la Tienda Kecleon')}</button></p>` + irisHtml();
    }
    let h = `<p class="sub" style="margin:10px 0">${G.T('Para usarlo, abre la colección, elige un Pokémon y pulsa Menta, Cápsula o Enseñar MT en su ficha.')}
      <button class="btn small" data-go-dex>${G.Icons.html('book', 14)} ${G.T('Ir a la colección')}</button></p><div class="upg">`;
    for (const id of items) {
      const it = G.Shop.ITEMS[id];
      h += row(G.Icons.html(it.icon, 32), G.T(it.name), G.T(it.desc), `<b class="gold">×${G.Shop.count(id)}</b>`);
    }
    for (const id of tms) {
      // Cuántos de tus Pokémon la pueden aprender.
      const n = Object.keys(s.owned).filter(d => G.DEX_BY[d] && G.Mons.canLearn(+d, id)).length;
      h += row(G.Icons.html('move:' + id, 32), `${G.T('MT')} ${moveName(id)}`,
        n ? G.I18n.f('La pueden aprender {x} de tus Pokémon', n) : G.T('Ninguno de tus Pokémon la puede aprender'), `<b class="gold">×${s.tms[id]}</b>`);
    }
    return h + '</div>' + irisHtml();
  }

  /** Amuletos Iris: los 9, los que tienes y cuánto te falta para los demás. */
  function irisHtml() {
    const s = G.DB.save;
    let h = `<h3 style="margin:14px 0 6px">${G.T('Amuletos Iris')}</h3>
      <p class="sub" style="margin:0 0 8px">${G.T('Completa la Pokédex de una región (legendarios incluidos) y te dan su Amuleto Iris: en su banner, los shiny salen el doble (del 1 % al 2 %).')}</p><div class="upg">`;
    for (const b of G.Gacha.BANNERS) {
      const d = G.Gacha.dexOf(s, b.gen), on = d.have >= d.total, name = G.T(b.name);
      h += row(G.Icons.html('iris', 32, on ? '' : 'off'), G.I18n.f('Amuleto Iris de {x}', name),
        on ? G.I18n.f('Shiny al 2 % en el banner de {x}', name) : G.I18n.f('Completa la Pokédex de {x}', name),
        on ? `<b class="gold">${G.Icons.html('shiny', 14)} 2 %</b>` : `<b class="sub">${d.have} / ${d.total}</b>`);
    }
    return h + '</div>';
  }

  return { open, openBag, render };
})();
