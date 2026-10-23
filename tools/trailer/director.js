/* ============ director.js — las escenas del tráiler (gran actualización, 20-10-2026) ============
 * Lo mete record.mjs en dev.html junto a shim.js. La grabadora llama, en cada
 * fotograma de 1/60 s:  tick(t) (escena: juego, menús...) → el juego dibuja → draw(t) (rótulos).
 *
 * Música: compuesta para el tráiler (score.js, 164 ppm); los cortes caen en los compases: B(n).
 * Las partidas son "limpias": unos pocos enemigos en corro que no caen, para que
 * se vea qué hace cada ataque. Nada que no sea de esta actualización.
 *
 *   0  Apertura: "LA GRAN ACTUALIZACIÓN" y el logo
 *   1  Tienda Kecleon (la animación de verdad), una compra y la Mochila
 *   2  Naturalezas y habilidades (la colección, con el buscador)
 *   3  MT: Mewtwo sí aprende Bola Sombra, Psyduck no aprende Lanzallamas; Mewtwo jugando
 *   4  38 ataques nuevos: 8 formas nuevas de atacar, un compás cada una
 *   5  Físico y especial (Machamp, Alakazam y las cartas de nivel)
 *   6  Mando y 7 idiomas; cooperativo (mirar a un compañero al caer) y segundo ataque inicial
 *   7  966 Pokémon (desfile) y el logo final sobre el desfile
 */
(() => {
  const W = 1280, H = 720, RB = 240 / 164;
  const B = b => 0.1 + b * RB;
  const DUR = B(38) + 0.3;

  let st = 'carga', T = 0, ov = null, c = null, realMusic = null, axisFn = null;
  // Cámara sobre la página (zoom a una parte de la interfaz): { x, y, w } en px
  // de la página (alto = w·9/16). La grabadora recorta ahí la captura y los
  // rótulos se dibujan encima de ese recorte. null = la pantalla entera.
  let cam = null;
  const layers = [];          // rótulos activos: { from, to, draw(t) }
  const layer = (from, to, draw) => layers.push({ from, to, draw });
  const camera = (from, to, fn) => layers.push({ from, to, cam: fn });
  const cues = [];
  function at(time, fn) { cues.push({ time, fn }); cues.sort((a, b) => a.time - b.time); }

  // ---------------- utilidades ----------------
  const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const eo = x => 1 - Math.pow(1 - cl(x), 3);
  const ei = x => Math.pow(cl(x), 3);
  const eio = x => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const eback = x => { x = cl(x); const k = 1.9; return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2); };
  const $ = id => document.getElementById(id);
  const sfx = (n, o) => G.Audio.sfx(n, o);
  const GOLD = ['#fffbd0', '#ffe066', '#ffc22e', '#f08a12'];
  const TYPE = t => (G.U.TYPE_COLOR && G.U.TYPE_COLOR[t]) || '#888';
  const FONT = (size, w = 700) => `${w} ${size}px Pixelify, "Microsoft YaHei", "Segoe UI", sans-serif`;

  function text(s, x, y, size, o = {}) {
    c.save();
    c.font = FONT(size, o.weight || 700);
    c.textAlign = o.align || 'center';
    c.textBaseline = 'middle';
    c.translate(x, y);
    if (o.rot) c.rotate(o.rot);
    if (o.scale != null) c.scale(o.scale, o.scale);
    c.globalAlpha = o.alpha == null ? 1 : cl(o.alpha);
    c.lineJoin = 'round';
    const sw = o.stroke == null ? Math.max(3, size * 0.13) : o.stroke;
    const depth = o.depth == null ? Math.round(size * 0.07) : o.depth;
    if (depth > 0) {
      c.fillStyle = c.strokeStyle = o.deep || '#7a3c00';
      c.lineWidth = sw;
      for (let i = depth; i > 0; i--) { c.strokeText(s, i, i); c.fillText(s, i, i); }
    }
    if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = size * 0.5; }
    if (sw > 0) { c.lineWidth = sw; c.strokeStyle = o.outline || '#1d0e00'; c.strokeText(s, 0, 0); }
    c.shadowBlur = 0;
    if (o.fill) c.fillStyle = o.fill;
    else {
      const g = c.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
      const cols = o.colors || GOLD;
      cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col));
      c.fillStyle = g;
    }
    c.fillText(s, 0, 0);
    c.restore();
  }
  const measure = (s, size, w = 700) => { c.save(); c.font = FONT(size, w); const m = c.measureText(s).width; c.restore(); return m; };

  /** Entrada de golpe: de grande a su tamaño con rebote. */
  const slam = (t, t0, d = 0.22) => (t < t0 ? 0 : t - t0 >= d ? 1 : lerp(2.6, 1, eback((t - t0) / d)));

  function flash(t, t0, dur = 0.35, col = '255,255,255', max = 0.85) {
    if (t < t0 || t > t0 + dur) return;
    c.fillStyle = `rgba(${col},${max * (1 - (t - t0) / dur)})`;
    c.fillRect(0, 0, W, H);
  }

  function rays(cx, cy, t, col, alpha = 0.25, n = 18) {
    c.save();
    c.translate(cx, cy);
    c.rotate(t * 0.35);
    c.globalAlpha = alpha;
    c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, 1600, (i / n) * Math.PI * 2, ((i + 0.5) / n) * Math.PI * 2);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  function speedLines(t, t0, dur = 0.5) {
    const k = (t - t0) / dur;
    if (k < 0 || k > 1) return;
    c.save();
    c.translate(W / 2, H / 2);
    c.strokeStyle = `rgba(255,255,255,${0.55 * (1 - k)})`;
    for (let i = 0; i < 46; i++) {
      const a = i * 2.39996, r0 = 260 + ((i * 97) % 200) + k * 260, r1 = r0 + 160 + ((i * 53) % 220);
      c.lineWidth = 2 + (i % 3) * 2;
      c.beginPath();
      c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      c.stroke();
    }
    c.restore();
  }

  function pokeball(cx, cy, R, rot) {
    c.save();
    c.translate(cx, cy);
    c.rotate(rot);
    c.beginPath(); c.arc(0, 0, R, Math.PI, 0); c.closePath(); c.fillStyle = '#e8352a'; c.fill();
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI); c.closePath(); c.fillStyle = '#f3f3f3'; c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)';
    c.beginPath(); c.arc(-R * 0.3, -R * 0.45, R * 0.35, 0, 7); c.fill();
    c.fillStyle = '#151515';
    c.fillRect(-R, -R * 0.065, 2 * R, R * 0.13);
    c.beginPath(); c.arc(0, 0, R * 0.25, 0, 7); c.fill();
    c.beginPath(); c.arc(0, 0, R * 0.16, 0, 7); c.fillStyle = '#f3f3f3'; c.fill();
    c.lineWidth = R * 0.035; c.strokeStyle = '#151515';
    c.beginPath(); c.arc(0, 0, R * 0.995, 0, 7); c.stroke();
    c.restore();
  }

  /** Cortinilla de Poké Ball: cubre toda la pantalla en t0 + dur/2 (ahí se cambia de escena). */
  function wipe(t0, dur = 0.8) {
    layer(t0, t0 + dur, t => {
      const p = (t - t0) / dur, R = 920;
      pokeball(lerp(-R, W + R, eio(p)), H / 2, R, p * 5.5);
    });
    at(t0 + 0.02, () => sfx('ball'));
  }

  function letterbox(t, k) {
    const h = 44 * eo(k);
    if (h <= 0) return;
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, h);
    c.fillRect(0, H - h, W, h);
  }

  function vignette() {
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.45)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  function rrect(x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /** Pegatina "¡NUEVO!" que late con la música. */
  function badge(t, x, y, label = '¡NUEVO!', col = '#ff3b47', t0 = 0) {
    const s = slam(t, t0, 0.25);
    if (!s) return;
    const beat = RB / 4;
    const ph = (((t - 0.1) % beat) + beat) % beat / beat;
    const k = s * (1 + 0.07 * Math.exp(-ph * 6));
    c.save();
    c.translate(x, y);
    c.rotate(-0.16);
    c.scale(k, k);
    const w = measure(label, 26) + 34;
    c.fillStyle = 'rgba(0,0,0,.4)'; rrect(-w / 2 + 4, -22 + 5, w, 44, 10); c.fill();
    c.fillStyle = col; rrect(-w / 2, -22, w, 44, 10); c.fill();
    c.lineWidth = 3; c.strokeStyle = '#fff'; rrect(-w / 2 + 4, -18, w - 8, 36, 8); c.stroke();
    c.restore();
    text(label, x, y, 26, { rot: -0.16, scale: k, fill: '#fff', depth: 0, stroke: 5, outline: '#5a0008' });
  }

  /**
   * Rótulo de abajo a la izquierda (entra deslizando, sale por la izquierda).
   * o: { title, sub, color, icon, y, isNew, size }
   */
  function lowerThird(t, t0, t1, o) {
    if (t < t0 || t > t1) return;
    const kin = eo((t - t0) / 0.32), kout = ei((t - (t1 - 0.22)) / 0.22);
    const ts = o.size || 46, tw = measure(o.title, ts), sw = o.sub ? measure(o.sub, 22, 400) : 0;
    const iconW = o.icon ? 74 : 0;
    const w = Math.max(tw, sw) + 90 + iconW;
    const y = o.y || H - 190, h = o.sub ? 112 : 78;
    const x = lerp(-w - 60, 0, kin) - kout * (w + 120);
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath(); c.moveTo(0, 8); c.lineTo(w + 8, 8); c.lineTo(w - 30 + 8, h + 8); c.lineTo(0, h + 8); c.fill();
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(26,30,58,.96)'); g.addColorStop(1, 'rgba(12,14,30,.96)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w - 30, h); c.lineTo(0, h); c.fill();
    c.fillStyle = o.color || '#ffd23f';
    c.fillRect(0, 0, 14, h);
    c.beginPath(); c.moveTo(w - 4, 0); c.lineTo(w + 10, 0); c.lineTo(w - 20, h); c.lineTo(w - 34, h); c.fill();
    // brillo que pasa
    const sh = ((t - t0) * 0.9) % 2.2;
    if (sh < 1) {
      c.save();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w - 30, h); c.lineTo(0, h); c.clip();
      const sx = lerp(-200, w + 200, sh);
      const gg = c.createLinearGradient(sx - 80, 0, sx + 80, 0);
      gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,255,255,.18)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gg; c.fillRect(0, 0, w, h);
      c.restore();
    }
    c.restore();
    if (o.icon) {
      c.save();
      c.imageSmoothingEnabled = false;
      G.Icons.draw(c, o.icon, x + 34, y + (h - 52) / 2, 52);
      c.restore();
    }
    const tx = x + 34 + iconW;
    text(o.title, tx, y + (o.sub ? 40 : h / 2), ts, { align: 'left', depth: 3, stroke: 7 });
    if (o.sub) text(o.sub, tx, y + 86, 22, { align: 'left', fill: '#fff', depth: 0, stroke: 4, outline: '#0a0c1c', weight: 400 });
    if (o.isNew) badge(t, x + w - 50, y - 6, '¡NUEVO!', '#ff3b47', t0 + 0.25);
  }

  /** Pixel art de un Pokémon con su Animator (para las escenas montadas). */
  const anims = {};
  function mon(key, dex, scale, shiny = false) {
    return anims[key] || (anims[key] = new G.Sprites.Animator(dex, scale, shiny));
  }
  function drawMon(a, x, y, dt) {
    a.update(dt);
    c.save();
    c.imageSmoothingEnabled = false;
    a.draw(c, x, y);
    c.restore();
  }

  /** Encuadre 16:9 que contiene el rectángulo (con margen), dentro de la pantalla. */
  function frame(r, pad = 24, minW = 520) {
    let w = Math.max(r.width + pad * 2, (r.height + pad * 2) * 16 / 9, minW);
    w = Math.min(W, w);
    const h = w * 9 / 16;
    const x = cl(r.left + r.width / 2 - w / 2, 0, W - w), y = cl(r.top + r.height / 2 - h / 2, 0, H - h);
    return { x, y, w };
  }
  /** De la pantalla entera (k=0) al encuadre del elemento (k=1). */
  function camOn(sel, k, pad, minW) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el || k <= 0) { cam = null; return; }
    const f = frame(el.getBoundingClientRect(), pad, minW);
    cam = k >= 1 ? f : { x: lerp(0, f.x, k), y: lerp(0, f.y, k), w: lerp(W, f.w, k) };
  }

  /** Rectángulo de la página a coordenadas de los rótulos (con la cámara). */
  function view(r) {
    const v = cam || { x: 0, y: 0, w: W }, k = W / v.w;
    return { x: (r.left - v.x) * k, y: (r.top - v.y) * k, w: r.width * k, h: r.height * k };
  }

  // ---------------- control del juego ----------------
  function zoom(f) {
    G.Camera.VIEW_W = 768 / f;
    G.Camera.MIN_VIEW_H = 420 / f;
    G.Camera.resize(W, H, G.Camera.dpr);
  }

  /** Partida nueva ya en marcha: el Pokémon, sus ataques (al máximo y evolucionados) y enemigos alrededor. */
  async function run(dex, moves, o = {}) {
    const s = G.DB.save;
    s.partner = dex;
    s.partnerShiny = !!o.shiny;
    if (o.shiny) G.DB.grantShiny(dex, 'gacha');
    G.Game.debugSpeed(1);
    G.Game.startRun();
    const pl = G.Game.player;
    // Sin daño (hurt vacío) y sin invulnerabilidad: con invuln el sprite parpadea.
    Object.defineProperty(pl, 'invuln', { get: () => 0, set() {}, configurable: true });
    pl.gainXp = () => 0;
    pl.hurt = () => {};
    pl.moves.length = 0;
    pl.slots.length = 0;
    pl.active = 0;
    for (const id of moves) {
      pl.addMove(id);
      const m = pl.moves.find(x => x.id === id);
      while (G.Moves.levelUp(m)) { /* al máximo */ }
      if (o.evolve !== false) G.Moves.evolve(m);
    }
    if (o.fuse) pl.fuse(pl.moves.slice(0, o.fuse));
    pl.active = 0;
    const t = o.time == null ? 150 : o.time;
    G.Game.debugTime(t);
    G.World.setBiome(Math.floor(t / 240), true);
    zoom(o.zoom || 1);
    // Partida limpia: unos pocos enemigos en corro que no caen nunca (sin
    // experiencia ni monedas por el suelo), lentos y sin hacer daño, y no sale nadie más.
    G.Spawner.update = () => {};
    const bag = G.Enemies.bagAt(60).filter(d => d.behavior === 'chase' || d.behavior === 'tank');
    const sc = G.Enemies.scale(60), n = o.foes || 7, R = o.ring || 125;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + 0.35;
      const e = new G.Enemy(bag[i % bag.length], pl.x + Math.cos(a) * R, pl.y + Math.sin(a) * R * 0.8, sc);
      e.maxHp = e.hp = 1e9;
      e.spd *= o.slowK == null ? 0.3 : o.slowK;
      e.dmg = 0;
      G.EnemyMgr.add(e);
    }
    axisFn = o.axis || (() => [0, 0]);
    await __preroll((o.pre == null ? 0.5 : o.pre) * 1000);
    for (const m of pl.moves) m.t = Math.min(m.t, 0.05);     // que se lance nada más empezar el corte
    G.Spawner.say('', 0);
    if (o.after) o.after(pl);
    return pl;
  }

  function toUI() {
    if (G.Game.state !== 'ui') G.Game.toUI();
    G.UI.hideAll();
    G.UI.chrome(false);
    zoom(1);
  }

  /** Escribe en el buscador de la colección letra a letra y abre el primero. */
  function typeSearch(t0, word, step = 0.06) {
    at(t0, () => { const q = $('dex-q'); q.value = ''; });
    for (let i = 1; i <= word.length; i++) {
      at(t0 + i * step, () => {
        const q = $('dex-q');
        q.value = word.slice(0, i);
        q.dispatchEvent(new Event('input', { bubbles: true }));
        sfx('hover');
      });
    }
    at(t0 + word.length * step + 0.3, () => {
      const cell = document.querySelector('#dex-grid .cell:not(.locked)');
      if (cell) { cell.click(); sfx('select'); }
      const ex = document.querySelector('#dex-detail .mon-extra');
      if (ex) ex.scrollIntoView({ block: 'center' });
    });
  }

  // =====================================================================
  //   GUION
  // =====================================================================
  function script() {
    // ---------- 0. Apertura ----------
    at(0, () => {
      toUI();
      $('game').style.filter = 'blur(3px) brightness(.55) saturate(1.2)';
    });
    layer(0, B(2.75) + 0.4, t => {
      c.fillStyle = `rgba(0,0,0,${t < B(2) ? 0.92 : lerp(0.92, 0.35, eo((t - B(2)) / 0.5))})`;
      c.fillRect(0, 0, W, H);
      if (t < B(2)) {
        if (t < B(1)) {
          const a = cl((t - 0.15) / 0.35) * (1 - cl((t - B(1) + 0.15) / 0.15));
          text('UNA ACTUALIZACIÓN ENORME', W / 2, H / 2, 46, { alpha: a, scale: 0.92 + 0.08 * cl((t - 0.15) / 1.2), fill: '#fff', depth: 0, stroke: 0, glow: 'rgba(255,214,90,.5)' });
        } else {
          text('TIENDA · NATURALEZAS · HABILIDADES · MT', W / 2, H / 2 - 74, 38, { scale: slam(t, B(1)), fill: '#fff', depth: 3, deep: '#333' });
          if (t >= B(1.5)) text('38 ATAQUES NUEVOS', W / 2, H / 2 + 12, 84, { scale: slam(t, B(1.5)) });
          if (t >= B(1.75)) text('y mucho más', W / 2, H / 2 + 92, 36, { scale: slam(t, B(1.75)), fill: '#9fe0ff', depth: 2, deep: '#123' });
        }
      } else {
        rays(W / 2, H / 2 - 20, t, 'rgba(255,214,90,1)', 0.12 * eo((t - B(2)) / 0.4));
        speedLines(t, B(2), 0.55);
        text('PokéSurvivor', W / 2, H / 2 - 30, 124, { scale: slam(t, B(2), 0.26), depth: 9, glow: 'rgba(255,200,60,.6)' });
        if (t >= B(2.25)) text('LA GRAN ACTUALIZACIÓN', W / 2, H / 2 + 72, 34, { scale: slam(t, B(2.25)), fill: '#fff', depth: 3, deep: '#7a3c00' });
      }
      flash(t, B(1.5), 0.25, '255,255,255', 0.5);
      flash(t, B(2), 0.4);
    });
    at(B(1), () => sfx('confirm'));
    at(B(1.5), () => sfx('burst'));
    at(B(2), () => sfx('reveal', { rarity: 5 }));
    wipe(B(2.75), 0.84);

    // ---------- 1. Tienda Kecleon ----------
    at(B(3) - 0.05, () => {
      $('game').style.filter = 'brightness(.8)';
      G.ShopUI.open();
    });
    layer(B(3), B(7), t => {
      vignette();
      lowerThird(t, B(4), B(7) - 0.05, { title: 'TIENDA KECLEON', sub: 'Mentas, Cápsulas Habilidad y 8 MT nuevas cada día', color: '#4fd06a', icon: 'shop', isNew: true, y: H - 150 });
    });
    camera(B(3), B(7), t => {
      const k = t < B(5.25) ? 1 : 1 - eio((t - B(5.25)) / (RB * 0.6));
      camOn('#shop-stall', k, 10, 640);
    });
    at(B(6), () => { const b = document.querySelector('[data-buy="mint"]'); if (b) b.click(); });
    at(B(6.5), () => { const b = document.querySelector('[data-buy="cap"]'); if (b) b.click(); });

    // ---------- 1b. Mochila (desde el menú principal) ----------
    at(B(7), () => { toUI(); G.ShopUI.openBag(); });
    camera(B(7), B(8), t => camOn('#scr-bag .box', eio((t - B(7)) / 0.35), 24, 760));
    layer(B(7), B(8), t => {
      flash(t, B(7), 0.22, '255,255,255', 0.6);
      lowerThird(t, B(7) + 0.1, B(8) - 0.04, { title: 'MOCHILA', sub: 'Lo que compras, a mano desde el menú principal', color: '#d89a4a', icon: 'bag', isNew: true, y: H - 150 });
    });

    // ---------- 2. Naturalezas y habilidades ----------
    // Buscador ("lucario"), zoom a su ficha (sprite y stats), la cámara baja
    // hasta la naturaleza y la habilidad, y corte a Gengar.
    at(B(8), () => {
      toUI();
      G.MenuUI.openDex();
    });
    typeSearch(B(8) + 0.05, 'lucario', 0.045);
    const search = w => { const q = $('dex-q'); q.value = w; q.dispatchEvent(new Event('input', { bubbles: true })); };
    at(B(8) + 0.75, () => search(''));                 // la rejilla, otra vez llena de Pokémon
    at(B(10) - 0.4, () => search('gengar'));
    at(B(10) - 0.03, () => { const cell = document.querySelector('#dex-grid .cell:not(.locked)'); if (cell) cell.click(); sfx('select'); });
    at(B(10) + 0.06, () => search(''));
    const dexParts = () => {
      const d = $('dex-detail');
      if (!d) return null;
      const box = d.closest('.box'), cv = d.querySelector('canvas'), st = d.querySelectorAll('.stat'), ex = d.querySelector('.mon-extra');
      if (!box || !cv || !st.length || !ex) return null;
      return { d, box, cv, st0: st[0], st1: st[st.length - 1], ex };
    };
    const union = (...els) => {
      const rs = els.map(e => e.getBoundingClientRect());
      const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top));
      const r = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom));
      return { left: l, top: t, width: r - l, height: b - t };
    };
    camera(B(8), B(11), t => {
      const p = dexParts();
      if (!p || t < B(8) + 0.62) { cam = null; return; }
      const br = p.box.getBoundingClientRect();
      const sA = p.box.scrollTop + (p.cv.getBoundingClientRect().top - br.top - 10);
      const sB = p.box.scrollTop + (p.ex.getBoundingClientRect().bottom - br.bottom + 12);
      let k, pan;
      if (t < B(10)) { k = eio((t - B(8) - 0.62) / 0.5); pan = eio((t - B(9) + 0.1) / 0.6); }
      else { k = 1; pan = 1; }
      p.box.scrollTop = lerp(sA, sB, pan);
      const fA = frame(union(p.cv, p.st1), 16, 560), fB = frame(union(p.st0, p.ex), 16, 560);
      const f = { x: lerp(fA.x, fB.x, pan), y: lerp(fA.y, fB.y, pan), w: lerp(fA.w, fB.w, pan) };
      cam = { x: lerp(0, f.x, k), y: lerp(0, f.y, k), w: lerp(W, f.w, k) };
    });
    layer(B(8), B(11), t => {
      flash(t, B(8), 0.25);
      flash(t, B(10), 0.2, '255,255,255', 0.5);
      const el = document.querySelector('#dex-detail .mon-extra');
      if (el && t > B(9) + 0.4) {
        const r = view(el.getBoundingClientRect()), p = 0.5 + 0.5 * Math.sin(t * 8);
        c.save();
        c.lineWidth = 5 + p * 3;
        c.strokeStyle = `rgba(255,214,70,${0.75 + 0.25 * p})`;
        c.shadowColor = '#ffd23f'; c.shadowBlur = 22;
        rrect(r.x - 10, r.y - 8, r.w + 20, r.h + 16, 12);
        c.stroke();
        c.restore();
      }
      lowerThird(t, B(8) + 0.3, B(11) - 0.05, { title: 'NATURALEZAS Y HABILIDADES', sub: 'Cada Pokémon tiene las suyas: ±10 % a dos stats y efectos en combate', color: '#ff8ad8', icon: 'mint', isNew: true, y: 60, size: 40 });
    });

    // ---------- 3. MT ----------
    wipe(B(10.75), 0.84);
    at(B(11) - 0.05, () => { toUI(); $('game').style.filter = 'blur(4px) brightness(.35)'; });
    layer(B(11), B(13), t => {
      const lt = t - B(11);
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1b1036'); g.addColorStop(1, '#0a0716');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      rays(W * 0.27, H * 0.62, t, '#a46bff', 0.1);
      rays(W * 0.73, H * 0.62, -t, '#4f8fd0', 0.08);
      text('MT', W / 2, 74, 64, { scale: slam(t, B(11)) });
      text('Sólo si lo aprende en los juegos', W / 2, 128, 28, { scale: slam(t, B(11) + 0.12), fill: '#fff', depth: 2, deep: '#333' });
      const dt = 1 / 60;
      const mw = mon('mewtwo', 150, 3.2), ps = mon('psyduck', 54, 3.6);
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.beginPath(); c.ellipse(W * 0.27, H * 0.78, 110, 22, 0, 0, 7); c.fill();
      c.beginPath(); c.ellipse(W * 0.73, H * 0.78, 90, 18, 0, 0, 7); c.fill();
      drawMon(mw, W * 0.27, H * 0.78, dt);
      drawMon(ps, W * 0.73, H * 0.78, dt);
      // disco de MT que cae a cada uno
      const disc = (x, y0, y1, k0, ok) => {
        const k = cl((lt - k0) / 0.45);
        if (k <= 0) return;
        let y = lerp(y0, y1, eo(k)), x2 = x, rot = lt * 9;
        if (ok && k >= 1) return;
        if (!ok && k >= 1) {
          const b = cl((lt - k0 - 0.45) / 0.5);
          if (b >= 1) return;
          y = y1 - Math.sin(b * Math.PI) * 120; x2 = x + b * 160; rot = lt * 14;
        }
        c.save(); c.translate(x2, y); c.rotate(rot); c.imageSmoothingEnabled = false;
        G.Icons.draw(c, 'tm', -36, -36, 72);
        c.restore();
      };
      disc(W * 0.27, -60, H * 0.55, 0.25, true);
      disc(W * 0.73, -60, H * 0.6, 1.2, false);
      if (lt > 0.7) {
        const s = slam(t, B(11) + 0.7);
        c.save(); c.globalAlpha = cl((lt - 0.7) / 0.2) * (1 - cl((lt - 0.95) / 0.5)); c.strokeStyle = '#6dff8a'; c.lineWidth = 10;
        c.beginPath(); c.arc(W * 0.27, H * 0.55, 40 + (lt - 0.7) * 300, 0, 7); c.stroke(); c.restore();
        text('✔', W * 0.27 + 120, H * 0.36, 70, { scale: s, colors: ['#d8ffe0', '#5df07a', '#1ea040'], deep: '#0b4a1c' });
        text('MEWTWO', W * 0.27, H * 0.86, 30, { fill: '#fff', depth: 2, deep: '#333' });
        text('Bola Sombra: ¡la aprende!', W * 0.27, H * 0.93, 24, { scale: s, colors: ['#d8ffe0', '#5df07a'], depth: 2, deep: '#0b4a1c', weight: 400 });
      }
      if (lt > 1.65) {
        const s = slam(t, B(11) + 1.65);
        text('✘', W * 0.73 + 110, H * 0.4, 70, { scale: s, colors: ['#ffd8d8', '#ff5a5a', '#c01818'], deep: '#4a0b0b' });
        text('PSYDUCK', W * 0.73, H * 0.86, 30, { fill: '#fff', depth: 2, deep: '#333' });
        text('Lanzallamas: no la aprende', W * 0.73, H * 0.93, 24, { scale: s, colors: ['#ffd8d8', '#ff7a7a'], depth: 2, deep: '#4a0b0b', weight: 400 });
        if (lt > 1.9) for (let i = 0; i < 3; i++) text('?', W * 0.73 - 40 + i * 40, H * 0.5 - 30 - Math.abs(Math.sin(t * 6 + i)) * 20, 34, { fill: '#9fe0ff', depth: 0, stroke: 5 });
      }
      flash(t, B(11) + 0.7, 0.25, '120,255,150', 0.35);
      flash(t, B(11) + 1.65, 0.25, '255,80,80', 0.3);
    });
    at(B(11) + 0.7, () => { sfx('levelup'); mon('mewtwo', 150, 3.2).play('Charge'); });
    at(B(11) + 1.65, () => { sfx('error'); mon('psyduck', 54, 3.6).play('Hurt'); });

    // Mewtwo jugando con Bola Sombra (partida limpia: pocos enemigos)
    at(B(13), async () => {
      $('game').style.filter = '';
      await run(150, ['shadow-ball'], { time: 330, zoom: 1.35 });
    });
    layer(B(13), B(15), t => {
      flash(t, B(13), 0.3);
      letterbox(t, (t - B(13)) / 0.3);
      lowerThird(t, B(13) + 0.2, B(15) - 0.05, { title: 'Mewtwo · Bola Sombra', sub: 'Lo que aprende con MT, para siempre', color: TYPE('ghost'), icon: 'move:shadow-ball' });
    });

    // ---------- 4. 38 ataques nuevos ----------
    at(B(15), () => sfx('reveal', { rarity: 5 }));
    layer(B(15), B(16), t => {
      const g = c.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 820);
      g.addColorStop(0, '#2a1d4a'); g.addColorStop(1, '#07050f');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      rays(W / 2, H / 2, t, '#ffd23f', 0.1);
      speedLines(t, B(15), 0.6);
      const n = Math.round(38 * eo((t - B(15)) / 0.55));
      text(String(n), W / 2, H / 2 - 50, 190, { scale: slam(t, B(15), 0.2), depth: 12, glow: 'rgba(255,190,40,.6)' });
      text('ATAQUES NUEVOS', W / 2, H / 2 + 92, 62, { scale: slam(t, B(15) + 0.18) });
      text('y todos pulidos', W / 2, H / 2 + 150, 28, { scale: slam(t, B(15) + 0.32), fill: '#9fe0ff', depth: 2, deep: '#123' });
      const types = ['fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy', 'steel', 'ghost', 'rock', 'ground', 'fighting', 'bug', 'poison', 'flying', 'normal'];
      c.save(); c.imageSmoothingEnabled = false;
      types.forEach((ty, i) => {
        const a = i / types.length * Math.PI * 2 + t * 0.6, r = 330 + Math.sin(t * 2 + i) * 14;
        const k = cl((t - B(15) - i * 0.02) / 0.25);
        G.Icons.draw(c, 'type:' + ty, W / 2 + Math.cos(a) * r * 1.35 * k - 22, H / 2 + Math.sin(a) * r * 0.78 * k - 22, 44);
      });
      c.restore();
      flash(t, B(15), 0.3);
    });

    const CUTS = [
      [143, 'hyper-beam', 'Hiperrayo', 'Rayos que se cargan', 'normal', {}],
      [130, 'whirlpool', 'Torbellino', 'Remolinos que atraen a los enemigos', 'water', { ring: 150 }],
      [76, 'magnitude', 'Magnitud', 'Ondas que avanzan por el suelo', 'ground', {}],
      [149, 'outrage', 'Enfado', 'Giros que golpean todo alrededor', 'dragon', { ring: 95 }],
      [25, 'electro-ball', 'Bola Voltio', 'Disparos que rebotan entre ellos', 'electric', {}],
      [381, 'mist-ball', 'Bola Neblina', 'Disparos que persiguen al enemigo', 'psychic', {}],
      [700, 'disarming-voice', 'Voz Cautivadora', 'Ondas que los apartan', 'fairy', { ring: 100 }],
      [135, 'thunder-wave', 'Onda Trueno', 'Ataques que los paralizan', 'electric', {}]
    ];
    CUTS.forEach(([dex, id, name, sub, type, o], i) => {
      const t0 = B(16 + i), t1 = B(17 + i);
      at(t0, async () => { await run(dex, [id], Object.assign({ time: 150, zoom: 1.4 }, o)); });
      layer(t0, t1, t => {
        flash(t, t0, 0.18, '255,255,255', 0.55);
        letterbox(t, 1);
        lowerThird(t, t0 + 0.05, t1 - 0.02, { title: name, sub, color: TYPE(type), icon: 'move:' + id });
        text(`${i + 1}/8`, W - 70, 84, 30, { fill: '#fff', depth: 2, deep: '#333', alpha: 0.85 });
      });
    });

    // ---------- 5. Físico y especial ----------
    at(B(24), async () => { await run(68, ['dynamic-punch'], { time: 250, zoom: 1.4, ring: 100 }); });
    at(B(25), async () => { await run(65, ['psychic'], { time: 150, zoom: 1.4 }); });
    layer(B(24), B(26), t => {
      flash(t, B(24), 0.2, '255,255,255', 0.6);
      flash(t, B(25), 0.2, '255,255,255', 0.6);
      letterbox(t, 1);
      const phys = t < B(25), t0 = phys ? B(24) : B(25);
      text(phys ? 'FÍSICO' : 'ESPECIAL', W / 2, 130, 84, { scale: slam(t, t0), colors: phys ? ['#ffe8d0', '#ffb070', '#ff6a1a', '#c0400a'] : ['#e0f0ff', '#9fd0ff', '#4f8fff', '#2050c0'], deep: phys ? '#5a1800' : '#0a2060' });
      text(phys ? 'Machamp pega con su Ataque' : 'Alakazam pega con su Ataque Especial', W / 2, 196, 28, { scale: slam(t, t0 + 0.12), fill: '#fff', depth: 2, deep: '#222' });
    });
    at(B(26) - 0.12, () => G.Game.debugLevelUp());
    layer(B(26), B(28), t => {
      vignette();
      text('Físico y especial, como en los juegos', W / 2, 62, 40, { scale: slam(t, B(26)) });
      document.querySelectorAll('.tag-chip.cat').forEach(el => {
        const r = view(el.getBoundingClientRect());
        if (!r.w) return;
        const p = 0.5 + 0.5 * Math.sin(t * 10);
        c.save(); c.strokeStyle = `rgba(255,214,70,${0.6 + 0.4 * p})`; c.lineWidth = 3; c.shadowColor = '#ffd23f'; c.shadowBlur = 14;
        rrect(r.x - 5, r.y - 4, r.w + 10, r.h + 8, 6); c.stroke(); c.restore();
      });
    });

    // ---------- 6. Mando e idiomas (fondos propios, sin partida) ----------
    at(B(28), () => { toUI(); $('game').style.filter = 'blur(4px) brightness(.3)'; sfx('confirm'); });
    layer(B(28), B(29), t => {
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#2a1640'); g.addColorStop(1, '#0d0a1e');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      rays(W / 2, H / 2 - 50, t, '#ff8ad8', 0.07);
      flash(t, B(28), 0.2, '255,255,255', 0.5);
      const s = slam(t, B(28));
      c.save();
      c.translate(W / 2, H / 2 - 50);
      c.scale(s, s);
      c.rotate(Math.sin(t * 3) * 0.05);
      c.fillStyle = '#20243c'; rrect(-190, -80, 380, 170, 70); c.fill();
      c.fillStyle = '#2f3556'; rrect(-180, -74, 360, 150, 62); c.fill();
      c.fillStyle = '#151827';
      c.beginPath(); c.arc(-95, -10, 34, 0, 7); c.fill(); c.beginPath(); c.arc(40, 40, 30, 0, 7); c.fill();
      c.fillStyle = '#4a5280';
      c.beginPath(); c.arc(-95 + Math.cos(t * 4) * 8, -10 + Math.sin(t * 4) * 8, 24, 0, 7); c.fill();
      c.beginPath(); c.arc(40, 40, 20, 0, 7); c.fill();
      c.fillStyle = '#151827'; c.fillRect(-52, 22, 16, 48); c.fillRect(-68, 38, 48, 16);
      [['#5df07a', 110, 10], ['#ff5a5a', 140, -20], ['#5aa8ff', 80, -20], ['#ffd23f', 110, -50]].forEach(([col, x, y], i) => {
        const pr = Math.floor(t * 6) % 4 === i;
        c.fillStyle = col; c.beginPath(); c.arc(x, y + (pr ? 3 : 0), 15, 0, 7); c.fill();
      });
      c.restore();
      text('JUEGA CON MANDO', W / 2, H / 2 + 110, 64, { scale: slam(t, B(28) + 0.1) });
      text('Xbox · PlayStation · Switch · USB y Bluetooth', W / 2, H / 2 + 168, 26, { scale: slam(t, B(28) + 0.2), fill: '#fff', depth: 2, deep: '#222', weight: 400 });
    });

    const LANGS = [['¡A jugar!', 'Español'], ["Let's play!", 'English'], ['On joue !', 'Français'], ['Si gioca!', 'Italiano'],
      ['Bora jogar!', 'Português'], ['开始游戏！', '简体中文'], ['開始遊戲！', '繁體中文']];
    const LSTEP = (RB - 0.08) / LANGS.length;
    layer(B(29), B(30), t => {
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#1d1446'); g.addColorStop(1, '#0b2a4a');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      rays(W / 2, H / 2, t, '#7fb8ff', 0.08);
      const i = Math.min(LANGS.length - 1, Math.floor((t - B(29)) / LSTEP)), t0 = B(29) + i * LSTEP;
      text(LANGS[i][0], W / 2, H / 2 - 50, 96, { scale: slam(t, t0, 0.12) });
      text(LANGS[i][1], W / 2, H / 2 + 40, 32, { scale: slam(t, t0 + 0.03, 0.12), fill: '#9fe0ff', depth: 2, deep: '#123' });
      text('7 IDIOMAS', W / 2, H - 130, 56, { scale: slam(t, B(29)), colors: ['#ffffff', '#cfe8ff', '#7fb8ff'], deep: '#123a6a' });
      LANGS.forEach((l, k) => {
        text(l[1], W / 2 + (k - 3) * 160, H - 60, 20, { fill: k <= i ? '#fff' : 'rgba(255,255,255,.3)', depth: 0, stroke: 3, outline: '#0a0c1c', weight: 400 });
      });
    });
    for (let k = 0; k < LANGS.length; k++) at(B(29) + k * LSTEP, () => sfx('select'));

    // ---------- 6b. Cooperativo y segundo ataque inicial (21-10-2026; carteles, sin partida) ----------
    const DOWN = { x: 330, y: 400 }, MATE = { x: 930, y: 400 }, SW = B(30) + RB * 0.45;
    at(B(30), () => { sfx('confirm'); mon('coop-down', 25, 3.4).play('Faint', { hold: true }); });
    at(SW, () => sfx('select'));
    layer(B(30), B(31), t => {
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#0f3a3a'); g.addColorStop(1, '#0a1a2e');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      rays(W / 2, H / 2, t, '#7fffd4', 0.06);
      flash(t, B(30), 0.2, '255,255,255', 0.5);
      text('COOPERATIVO', W / 2, 84, 72, { scale: slam(t, B(30)), colors: ['#ffffff', '#c8fff0', '#5fe0b8'], deep: '#0b3a30' });
      text('Si caes, mira a un compañero mientras te levantan', W / 2, 146, 28, { scale: slam(t, B(30) + 0.1), fill: '#fff', depth: 2, deep: '#123', weight: 400 });
      // Tu Pokémon caído (en gris) y el compañero que sigue luchando
      const k = eio((t - SW) / 0.35);
      c.save(); c.globalAlpha = 0.55; c.filter = 'grayscale(1)';
      drawMon(mon('coop-down', 25, 3.4), DOWN.x, DOWN.y, 1 / 60);
      c.restore();
      if (Math.sin(t * 8) > 0) text('CAÍDO', DOWN.x, DOWN.y + 50, 22, { fill: '#ff6d7a', depth: 0, stroke: 4, outline: '#2a0008' });
      c.save(); c.globalAlpha = 0.25 + 0.5 * k;
      const sg = c.createRadialGradient(MATE.x, MATE.y - 40, 10, MATE.x, MATE.y - 40, 190);
      sg.addColorStop(0, 'rgba(120,200,255,.55)'); sg.addColorStop(1, 'rgba(120,200,255,0)');
      c.fillStyle = sg; c.fillRect(MATE.x - 200, MATE.y - 240, 400, 400);
      c.restore();
      const lu = mon('coop-mate', 448, 3.4); lu.loop('Walk'); lu.dir = 2;
      drawMon(lu, MATE.x, MATE.y, 1 / 60);
      // La cámara: un marco que pasa de tu cuerpo al compañero
      const fx = lerp(DOWN.x, MATE.x, k), fy = DOWN.y - 50, fw = 300, fh = 230;
      c.save(); c.strokeStyle = '#fff'; c.lineWidth = 5; c.globalAlpha = cl((t - B(30) - 0.15) / 0.2);
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x0 = fx + sx * fw / 2, y0 = fy + sy * fh / 2;
        c.beginPath(); c.moveTo(x0, y0 - sy * 34); c.lineTo(x0, y0); c.lineTo(x0 - sx * 34, y0); c.stroke();
      }
      c.restore();
      // El botón, como en el juego
      const label = k > 0.5 ? 'Viendo a Lucario · cambiar' : 'Ver a un compañero';
      c.save(); c.font = FONT(24, 800);
      const bw = c.measureText(label).width + 48, bx = W / 2 - bw / 2, by = H - 120;
      const s = slam(t, k > 0.5 ? SW : B(30) + 0.2, 0.16);
      c.translate(W / 2, by + 24); c.scale(s, s); c.translate(-W / 2, -(by + 24));
      rrect(bx, by, bw, 48, 12); c.fillStyle = 'rgba(10,16,28,.85)'; c.fill();
      c.lineWidth = 3; c.strokeStyle = k > 0.5 ? '#5aa8ff' : 'rgba(244,248,255,.85)'; c.stroke();
      c.fillStyle = '#f4f8ff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, W / 2, by + 25);
      c.restore();
    });

    const SPIN = [['Lanzallamas', 'fire'], ['Rayo', 'electric'], ['Surf', 'water'], ['Psíquico', 'psychic'], ['Terremoto', 'ground'], ['Rayo Hielo', 'ice']];
    const LOCK = B(31) + RB * 0.55;
    at(B(31), () => sfx('confirm'));
    at(LOCK, () => { sfx('levelup'); mon('start2', 448, 3).play('Attack'); });
    layer(B(31), B(32), t => {
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#2a1a4a'); g.addColorStop(1, '#101634');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      rays(W / 2, H / 2 + 40, t, '#c8a0ff', 0.07);
      flash(t, B(31), 0.2, '255,255,255', 0.5);
      text('SEGUNDO ATAQUE INICIAL', W / 2, 84, 64, { scale: slam(t, B(31)) });
      text('Nueva mejora: eliges con qué segundo ataque empiezas', W / 2, 144, 28, { scale: slam(t, B(31) + 0.1), fill: '#fff', depth: 2, deep: '#222', weight: 400 });
      const lu = mon('start2', 448, 3); lu.loop('Idle');
      drawMon(lu, W / 2, 380, 1 / 60);
      const slot = (x, name, type, d, lab) => {
        const s = slam(t, B(31) + d, 0.18);
        c.save(); c.translate(x, 500); c.scale(s, s);
        rrect(-170, -40, 340, 80, 14); c.fillStyle = 'rgba(8,10,24,.85)'; c.fill();
        c.lineWidth = 4; c.strokeStyle = TYPE(type); c.stroke();
        c.fillStyle = TYPE(type); rrect(-160, -30, 14, 60, 6); c.fill();
        c.restore();
        text(name, x + 6 * s, 500, 30, { scale: s, fill: '#fff', depth: 0, stroke: 4, outline: '#05060f' });
        text(lab, x, 562, 18, { scale: s, fill: 'rgba(255,255,255,.7)', depth: 0, stroke: 0, weight: 400 });
      };
      slot(W / 2 - 200, 'Aura Esfera', 'fighting', 0.15, '1.º · el de siempre');
      const locked = t >= LOCK;
      const [nm, ty] = locked ? ['Bola Sombra', 'ghost'] : SPIN[Math.floor((t - B(31)) * 14) % SPIN.length];
      slot(W / 2 + 200, nm, ty, 0.25, locked ? '2.º · lo eliges tú' : '2.º · …');
      flash(t, LOCK, 0.25, '200,160,255', 0.45);
      text('En Mejoras · necesita Repertorio', W / 2, H - 50, 22, { fill: '#ffd23f', depth: 0, stroke: 4, outline: '#1d0e00', weight: 400, alpha: cl((t - LOCK) / 0.2) });
    });

    // ---------- 7. Desfile de Pokémon y final (sin partida de fondo) ----------
    const ROWS = 5, PER = 13;
    function parade(t, t0, dim) {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#2b5a2a'); g.addColorStop(1, '#16331a');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const lt = t - t0;
      for (let r = 0; r < ROWS; r++) {
        const y = 150 + r * 118, dir = r % 2 ? 2 : 6, sp = 70 + (r * 37) % 60;
        c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, y - 6, W, 14);
        for (let k = 0; k < PER; k++) {
          const dex = PARADE[(r * PER + k) % PARADE.length];
          const a = mon('p' + r + '-' + k, dex, 1.6);
          a.loop('Walk'); a.dir = dir;
          const span = W + 220, base = k * span / PER + (dir === 6 ? -1 : 1) * lt * sp;
          const x = ((base % span) + span) % span - 110;
          drawMon(a, x, y, 1 / 60);
        }
      }
      c.fillStyle = `rgba(4,10,6,${dim})`; c.fillRect(0, 0, W, H);
    }
    layer(B(32), B(34), t => {
      parade(t, B(32), 0.45);
      flash(t, B(32), 0.25, '255,255,255', 0.6);
      text('966 POKÉMON', W / 2, H / 2 - 30, 110, { scale: slam(t, B(32) + 0.05), depth: 9, glow: 'rgba(255,200,60,.5)' });
      text('Todos se pueden jugar', W / 2, H / 2 + 60, 34, { scale: slam(t, B(32) + 0.25), fill: '#fff', depth: 3, deep: '#123' });
    });
    at(B(32), () => sfx('reveal', { rarity: 4 }));

    at(B(34), () => sfx('legend'));
    layer(B(34), DUR + 1, t => {
      parade(t, B(32), 0.45 + 0.3 * eo((t - B(34)) / 0.5));
      rays(W / 2, H / 2 - 40, t, 'rgba(255,214,90,1)', 0.12);
      speedLines(t, B(34), 0.6);
      text('PokéSurvivor', W / 2, H / 2 - 70, 132, { scale: slam(t, B(34), 0.26), depth: 10, glow: 'rgba(255,200,60,.6)' });
      if (t >= B(34.5)) text('LA GRAN ACTUALIZACIÓN, YA DISPONIBLE', W / 2, H / 2 + 34, 36, { scale: slam(t, B(34.5)), fill: '#fff', depth: 3, deep: '#7a3c00' });
      if (t >= B(35)) text('Gratis · en el navegador y en el móvil', W / 2, H / 2 + 88, 28, { scale: slam(t, B(35)), fill: '#9fe0ff', depth: 2, deep: '#123', weight: 400 });
      if (t >= B(35.5)) {
        const s = slam(t, B(35.5));
        c.save(); c.translate(W / 2, H / 2 + 168); c.scale(s, s);
        c.fillStyle = '#ffd23f'; rrect(-230, -36, 460, 72, 14); c.fill();
        c.fillStyle = '#1d0e00'; rrect(-224, -30, 448, 60, 10); c.fill();
        c.restore();
        text('pokesurvivor.com', W / 2, H / 2 + 168, 44, { scale: s, depth: 0, stroke: 0 });
      }
      text('Proyecto de fans sin ánimo de lucro. Pokémon © Nintendo / Creatures / GAME FREAK.', W / 2, H - 22, 15,
        { fill: 'rgba(255,255,255,.55)', depth: 0, stroke: 0, weight: 400 });
      flash(t, B(34), 0.45);
      const out = cl((t - (DUR - 0.8)) / 0.8);
      if (out > 0) { c.fillStyle = `rgba(0,0,0,${out})`; c.fillRect(0, 0, W, H); }
    });
    at(B(35.5), () => sfx('coin'));
  }

  // =====================================================================
  window.__director = {
    duration: DUR,
    status() {
      if (st === 'carga' && window.G && G.Flow && G.DB && G.ShopUI && $('tap-start')) {
        st = 'preparando';
        setup().then(() => { st = 'listo'; }).catch(e => { st = 'error ' + (e && e.stack || e); });
      }
      return st;
    },
    begin() {
      $('tap-start').classList.add('hidden');
      // Música propia del tráiler (score.js): el juego no pone la suya.
      G.Audio.music(null);
      G.Audio.unlock();
      realMusic = G.Audio.music.bind(G.Audio);
      G.Audio.music = () => {};
      window.__score(window.__audioCtx);
      G.Input.axis = () => (axisFn && G.Game.state === 'playing' ? axisFn(T) : [0, 0]);
      script();
    },
    async tick(t) {
      T = t;
      while (cues.length && cues[0].time <= t) { const q = cues.shift(); await q.fn(); }
    },
    draw(t) {
      cam = null;
      for (const l of layers) if (l.cam && t >= l.from && t < l.to) { try { l.cam(t); } catch (e) { console.error('[director] cámara', e); } }
      const v = cam || { x: 0, y: 0, w: W };
      Object.assign(ov.style, { left: v.x + 'px', top: v.y + 'px', width: v.w + 'px', height: v.w * 9 / 16 + 'px' });
      c.setTransform(1.5, 0, 0, 1.5, 0, 0);
      c.clearRect(0, 0, W, H);
      for (const l of layers) if (l.draw && t >= l.from && t < l.to) { try { l.draw(t); } catch (e) { console.error('[director] capa', e); } }
      return cam;
    }
  };

  const PARADE = [25, 1, 4, 7, 133, 150, 6, 94, 143, 448, 39, 52, 54, 129, 131, 147, 151, 152, 155, 158, 175, 196, 197, 212,
    248, 252, 255, 258, 282, 302, 359, 384, 393, 396, 403, 445, 470, 471, 495, 498, 501, 570, 607, 658, 700, 722, 725, 728,
    778, 887, 888, 812, 815, 818, 359, 26, 37, 59, 65, 68, 76, 92, 104, 113, 130, 149];

  async function setup() {
    await G.DB.ready();
    await document.fonts.load('700 40px Pixelify');
    await document.fonts.load('400 40px Pixelify');
    G.DB.playAsGuest();
    const sv = G.DB.save;
    for (const m of G.DEX) G.DB.grant(m.dex, 'gacha');
    sv.partner = sv.starter = 448;
    sv.coins = 99999;
    G.Settings.set('dmgNumbers', false);        // sin números de daño: se ve mejor qué hace cada ataque
    // Naturalezas que se notan en la ficha (una sube y otra baja) y la habilidad oculta de Lucario.
    G.Mons.setNature(448, 'modest');
    G.Mons.setNature(94, 'timid');
    G.Mons.setAbility(448, 2);
    G.Flow.goMenu();
    G.UI.hideAll();
    const css = document.createElement('style');
    css.textContent = '#ach-pop{display:none!important} .shop-stall.opening ~ .shop-inner{animation:none!important}';
    document.head.appendChild(css);
    ov = document.createElement('canvas');
    ov.width = W * 1.5; ov.height = H * 1.5;
    ov.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:720px;z-index:2147483647;pointer-events:none';
    document.body.appendChild(ov);
    c = ov.getContext('2d');
    PARADE.splice(0, PARADE.length, ...new Set(PARADE.filter(d => G.SPRITE_META[d])));
    const dexes = [...new Set([150, 54, 143, 130, 76, 149, 25, 381, 700, 135, 68, 65, 448, 384, 493, 352, 94, 6, ...PARADE])].filter(d => G.SPRITE_META[d]);
    await G.Sprites.preload(dexes, 30000);
    await G.Sprites.preload([384], 20000, true);
    console.warn('[director] Mewtwo/Bola Sombra:', G.Mons.canLearn(150, 'shadow-ball'), '· Psyduck/Lanzallamas:', G.Mons.canLearn(54, 'flamethrower'));
  }
})();
