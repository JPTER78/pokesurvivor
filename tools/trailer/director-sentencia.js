/* ============ director-sentencia.js — tráiler de la Sentencia de Arceus (23-10-2026) ============
 *   node tools/trailer/record.mjs --director director-sentencia.js --out carpeta
 *   node tools/trailer/encode.mjs carpeta salida.mp4
 * Mismas herramientas y misma música (score.js) que director.js; los cortes caen en sus compases.
 * Sólo lo que sale en esta actualización (lo del 22 y el 23-10-2026):
 *
 *   0      Apertura y logo
 *   3-8    Gacha ×100, botón Saltar y Amuleto Iris (la ×100 completa Kanto); la Mochila
 *   8-11   Esferas de Mundo Misterioso (Pikachu usando cuatro)
 *   11-15  Movimientos evolucionados con «+»: Puño Meteoro + (cartel y Metagross jugando)
 *   15-24  La Sentencia: Tablas, la ruleta de las 17, pegarle a Arceus, legendarios que caen y el minuto 35
 *   24-28  El ranking partido (con apodos inventados)
 *   28-32  ¿Hasta dónde llegarás? y el resumen de todo lo nuevo
 *   32-38  Desfile de legendarios y logo final
 */
// El tráiler, en español (antes de que cargue el juego).
try { localStorage.setItem('ps.lang', 'es'); } catch (e) { /* nada */ }
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
    const sc = G.Enemies.scale(60), n = o.foes == null ? 7 : o.foes, R = o.ring || 125;
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


  // ---------------- la Sentencia ----------------
  const LEGS = [144, 145, 146, 243, 244, 245, 249, 250, 377, 378, 379, 380, 381, 382, 383, 480, 481, 482, 483, 484, 485, 487, 488, 638, 639, 640, 641, 642, 643, 644, 645, 716, 717, 718, 791, 792, 800, 888, 889];
  const PLATE = { fire: 'Tabla Llama', water: 'Tabla Linfa', electric: 'Tabla Trueno', grass: 'Tabla Pradal', ice: 'Tabla Helada',
    fighting: 'Tabla Fuerte', poison: 'Tabla Tóxica', ground: 'Tabla Terrax', flying: 'Tabla Cielo', psychic: 'Tabla Mental',
    bug: 'Tabla Bicho', rock: 'Tabla Pétrea', ghost: 'Tabla Terror', dragon: 'Tabla Draco', dark: 'Tabla Oscura', steel: 'Tabla Acero', fairy: 'Tabla Duende' };

  /** Partida limpia ya en la pelea contra Arceus, con su Tabla (sin la animación de entrada). */
  async function judge(dex, moves, o = {}) {
    G.Judgment.debugNoBosses(!!o.noBosses);
    const pl = await run(dex, moves, Object.assign({ zoom: 1.15 }, o, { foes: 0, pre: 0, time: 1700 }));
    if (o.item) pl.equip(o.item);
    if (o.atk) pl.atkMul *= o.atk;
    G.Judgment.onEvent(['jd', { tx: -6400, ty: -6400, q: o.q || LEGS.slice(), pl: o.plate || 'fire' }]);
    G.Game.debugTime(o.time || 1800);
    G.Judgment.onEvent(['jk']);
    await __preroll((o.pre == null ? 1.15 : o.pre) * 1000);
    const arc = G.EnemyMgr.all().find(e => e.arceus);
    // A su lado y un poco por encima de sus pies: su dibujo es alto y sube desde ahí.
    if (arc && o.near !== false) { pl.x = arc.x + (o.gap || 210); pl.y = arc.y - 70; G.Camera.x = pl.x - 90; G.Camera.y = pl.y; }
    if (o.axis) axisFn = o.axis;
    for (const m of pl.moves) m.t = Math.min(m.t, 0.05);
    return pl;
  }

  /** Marco que late alrededor de algo de la pantalla (x, y, ancho y alto en px de la página). */
  function glowBox(t, x, y, w, h, col = '255,214,70') {
    const p = 0.5 + 0.5 * Math.sin(t * 9);
    c.save();
    c.lineWidth = 4 + p * 3;
    c.strokeStyle = `rgba(${col},${0.7 + 0.3 * p})`;
    c.shadowColor = `rgb(${col})`; c.shadowBlur = 20;
    rrect(x, y, w, h, 10);
    c.stroke();
    c.restore();
  }

  /** Rótulo grande arriba, en el centro (para las escenas de juego). */
  function topTitle(t, t0, s, sub, colors) {
    if (t < t0) return;
    text(s, W / 2, 92, 54, { scale: slam(t, t0), colors });
    if (sub) text(sub, W / 2, 146, 26, { scale: slam(t, t0 + 0.1), fill: '#fff', depth: 2, deep: '#222', weight: 400 });
  }

  // Ranking de ejemplo (apodos inventados) para enseñar la pantalla partida.
  const NAMES = ['Kairo', 'LunaPixel', 'Draco_77', 'Mika', 'TeoTeo', 'Nébula', 'Sora', 'Pancho', 'Iris_GO', 'Zeta', 'Bruma', 'Kiko'];
  const MONS = [448, 445, 150, 658, 25, 6, 376, 94, 130, 248, 282, 887];
  const fakeRows = key => NAMES.map((n, i) => ({ id: 'x' + i, t: 2460 - i * 23 - (key === 'd' ? (i * 37) % 50 : 0), d: 248000 - i * 15300 - (i * 977) % 4000,
    uids: ['x' + i], names: [n], dex: [MONS[(i + (key === 'd' ? 3 : 0)) % MONS.length]], shiny: [i === 1], lv: 71 - i, kills: 6200 - i * 170 }))
    .sort((a, b) => (key === 'd' ? b.d - a.d : b.t - a.t));

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
          text('NUEVA ACTUALIZACIÓN', W / 2, H / 2, 50, { alpha: a, scale: 0.92 + 0.08 * cl((t - 0.15) / 1.2), fill: '#fff', depth: 0, stroke: 0, glow: 'rgba(255,214,90,.5)' });
        } else {
          text('ESFERAS · AMULETOS IRIS · GACHA ×100', W / 2, H / 2 - 74, 38, { scale: slam(t, B(1)), fill: '#fff', depth: 3, deep: '#333' });
          if (t >= B(1.5)) text('ARCEUS', W / 2, H / 2 + 14, 96, { scale: slam(t, B(1.5)) });
          if (t >= B(1.75)) text('ya no es sólo huir', W / 2, H / 2 + 96, 36, { scale: slam(t, B(1.75)), fill: '#9fe0ff', depth: 2, deep: '#123' });
        }
      } else {
        rays(W / 2, H / 2 - 20, t, 'rgba(255,214,90,1)', 0.12 * eo((t - B(2)) / 0.4));
        speedLines(t, B(2), 0.55);
        text('PokéSurvivor', W / 2, H / 2 - 30, 124, { scale: slam(t, B(2), 0.26), depth: 9, glow: 'rgba(255,200,60,.6)' });
        if (t >= B(2.25)) text('LA SENTENCIA DE ARCEUS', W / 2, H / 2 + 72, 34, { scale: slam(t, B(2.25)), fill: '#fff', depth: 3, deep: '#7a3c00' });
      }
      flash(t, B(1.5), 0.25, '255,255,255', 0.5);
      flash(t, B(2), 0.4);
    });
    at(B(1), () => sfx('confirm'));
    at(B(1.5), () => sfx('burst'));
    at(B(2), () => sfx('reveal', { rarity: 5 }));
    wipe(B(2.75), 0.84);

    // ---------- 1. Gacha ×100, Saltar y Amuleto Iris ----------
    // A Kanto le falta un Pokémon: la ×100 lo trae y con él, su Amuleto Iris.
    let missing = 0;
    at(B(3) - 0.05, () => {
      toUI();
      $('game').style.filter = 'brightness(.8)';
      const s = G.DB.save;
      missing = G.Gacha.pool(1, 1)[0].dex;
      delete s.owned[missing];
      s.tickets.t1 = 300;
      const real = G.Gacha.pull;
      G.Gacha.pull = (save, n, gen, use) => {
        const res = real(save, n, gen, use);
        if (res && n === 100 && !res.some(r => r.dex === missing)) {
          const r = res.find(x => x.rarity === 1 && !x.isNew && !x.shiny);
          if (r) { r.dex = missing; r.isNew = true; r.refund = 0; save.owned[missing] = { at: Date.now(), from: 'gacha' }; }
        }
        if (res && n === 100) res.iris = G.Gacha.hasIris(save, 1) ? 1 : 0;
        return res;
      };
      G.Gacha.debugForceShiny(1);
      G.GachaUI.open();
    });
    at(B(3) + 0.55, () => $('pull-100').click());
    at(B(4.5), () => { const b = $('pull-skip'); if (b && !b.classList.contains('hidden')) b.click(); });
    layer(B(3), B(5.5), t => {
      vignette();
      lowerThird(t, B(3.2), B(4.5) - 0.05, { title: 'GACHA ×100', sub: 'Diez ×10 seguidas, cada una con su Épica asegurada', color: '#ffd23f', icon: 'ticket10', isNew: true, y: H - 150 });
      lowerThird(t, B(4.5), B(5.5) - 0.05, { title: 'BOTÓN SALTAR', sub: 'Todas las cartas de golpe (también con Esc)', color: '#9fe0ff', isNew: true, y: H - 150 });
      flash(t, B(4.5), 0.2, '255,255,255', 0.5);
    });
    at(B(5.5) - 0.3, () => { const el = document.querySelector('.iris-get'); if (el) el.scrollIntoView({ block: 'center' }); });
    camera(B(5.5), B(6.75), t => camOn('.iris-get', eio((t - B(5.5)) / 0.4), 30, 620));
    layer(B(5.5), B(6.75), t => {
      lowerThird(t, B(5.5) + 0.15, B(6.75) - 0.05, { title: 'AMULETO IRIS', sub: 'Completa la Pokédex de una región: sus shiny, el doble', color: '#c47bff', icon: 'iris', isNew: true, y: 40 });
    });
    at(B(5.5) + 0.2, () => sfx('shinyGet'));
    // La Mochila, con los 9 Amuletos Iris.
    const irisBox = () => {
      const h = [...document.querySelectorAll('#bag-body h3')].find(x => /Iris/.test(x.textContent));
      return h ? [h, h.nextElementSibling && h.nextElementSibling.nextElementSibling || h.nextElementSibling] : null;
    };
    at(B(6.75), () => {
      $('pull-fx').classList.add('hidden');
      toUI(); G.ShopUI.openBag();
      const b = irisBox(); if (b) b[0].scrollIntoView({ block: 'start' });
    });
    camera(B(6.75), B(8), t => {
      const b = irisBox();
      if (!b || !b[1]) { cam = null; return; }
      const r0 = b[0].getBoundingClientRect(), r1 = b[1].getBoundingClientRect();
      const r = { left: Math.min(r0.left, r1.left), top: r0.top, width: Math.max(r0.right, r1.right) - Math.min(r0.left, r1.left), height: Math.min(r1.bottom, H) - r0.top };
      const f = frame(r, 20, 760), k = eio((t - B(6.75)) / 0.35);
      cam = { x: lerp(0, f.x, k), y: lerp(0, f.y, k), w: lerp(W, f.w, k) };
    });
    layer(B(6.75), B(8), t => {
      flash(t, B(6.75), 0.22, '255,255,255', 0.6);
      lowerThird(t, B(6.75) + 0.1, B(8) - 0.04, { title: 'UNO POR REGIÓN', sub: 'Los 9 en la Mochila, con lo que te falta para cada uno', color: '#c47bff', icon: 'bag', y: H - 150 });
    });

    // ---------- 2. Esferas de Mundo Misterioso ----------
    const ORB = [['slumber', B(8) + 0.5], ['blowback', B(9.25)], ['luminous', B(10)], ['quick', B(10.5)]];
    at(B(8), async () => {
      $('game').style.filter = '';
      const pl = await run(25, ['thunderbolt'], { time: 200, zoom: 1.3, foes: 10, ring: 170, slowK: 0.9, axis: t => (t > B(10.5) ? [Math.cos(t * 2), Math.sin(t * 2) * 0.6] : [0, 0]) });
      for (const [id] of ORB) G.Orbs.add(pl, id);
      G.Orbs.add(pl, 'slumber');
    });
    ORB.forEach(([id, t0], i) => at(t0, () => { G.Orbs.use(G.Game.player, G.Game.player.orbs.findIndex(o => o && o.id === id)); }));
    layer(B(8), B(11), t => {
      flash(t, B(8), 0.3);
      letterbox(t, (t - B(8)) / 0.3);
      lowerThird(t, B(8) + 0.2, B(9.25) - 0.05, { title: 'ESFERAS DE MUNDO MISTERIOSO', sub: 'De un solo uso: teclas 5-8, tocándolas o con X / Y', color: '#b39bff', isNew: true, y: 70, size: 40 });
      ORB.forEach(([id, t0], i) => {
        const o = G.Orbs.BY[id], t1 = ORB[i + 1] ? ORB[i + 1][1] : B(11);
        if (i === 0 || t < t0 || t > t1 - 0.05) return;
        text(G.T(o.name), W / 2, 110, 50, { scale: slam(t, t0), colors: ['#ffffff', o.col], deep: '#1d1030' });
        text(G.T(o.desc), W / 2, 162, 22, { scale: slam(t, t0 + 0.08), fill: '#fff', depth: 0, stroke: 4, outline: '#0a0c1c', weight: 400 });
      });
      // Las 4 casillas de esferas (encima de los ataques), recién usadas.
      if (t > B(8) + 0.3) {
        const s = G.Game.player && G.Game.player.orbs;
        if (s) glowBox(t, W / 2 - 92, H - 150, 184, 40, '179,155,255');
      }
    });

    // ---------- 3. Movimientos evolucionados con «+» ----------
    wipe(B(10.75), 0.84);
    at(B(11) - 0.05, () => { toUI(); $('game').style.filter = 'blur(4px) brightness(.35)'; });
    layer(B(11), B(13), t => {
      const lt = t - B(11);
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#102436'); g.addColorStop(1, '#070c16');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      rays(W / 2, H * 0.6, t, TYPE('steel'), 0.1);
      text('MOVIMIENTOS EVOLUCIONADOS', W / 2, 78, 52, { scale: slam(t, B(11)) });
      text('Ahora se llaman igual, con un +', W / 2, 132, 28, { scale: slam(t, B(11) + 0.12), fill: '#fff', depth: 2, deep: '#333' });
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.beginPath(); c.ellipse(W / 2, H * 0.66, 120, 24, 0, 0, 7); c.fill();
      drawMon(mon('metagross', 376, 3.2), W / 2, H * 0.66, 1 / 60);
      const evo = lt > 1.25;
      const s = evo ? slam(t, B(11) + 1.25) : 1;
      if (evo) {
        c.save(); c.globalAlpha = cl((lt - 1.25) / 0.15) * (1 - cl((lt - 1.5) / 0.6)); c.strokeStyle = '#ffd23f'; c.lineWidth = 10;
        c.beginPath(); c.arc(W / 2, H * 0.55, 40 + (lt - 1.25) * 420, 0, 7); c.stroke(); c.restore();
      }
      text(evo ? 'Puño Meteoro +' : 'Puño Meteoro', W / 2, H * 0.8, 64, { scale: s, colors: evo ? GOLD : ['#ffffff', '#d6e2ee', '#a8b8c4'], deep: evo ? '#7a3c00' : '#2a3440' });
      text(evo ? '×1,7 de daño, +2 meteoros y más radio' : 'al nivel máximo…', W / 2, H * 0.89, 26,
        { scale: evo ? slam(t, B(11) + 1.35) : 1, fill: evo ? '#ffe9a0' : 'rgba(255,255,255,.7)', depth: 0, stroke: 4, outline: '#0a0c1c', weight: 400 });
      text('Así ningún nombre queda gastado', W / 2, H - 28, 20, { fill: 'rgba(255,255,255,.6)', depth: 0, stroke: 0, weight: 400, alpha: cl((lt - 1.8) / 0.3) });
      flash(t, B(11) + 1.25, 0.3, '255,230,140', 0.5);
    });
    at(B(11) + 1.25, () => { sfx('surge'); mon('metagross', 376, 3.2).play('Attack'); });
    at(B(13), async () => { $('game').style.filter = ''; await run(376, ['meteor-mash'], { time: 330, zoom: 1.3, ring: 140 }); });
    layer(B(13), B(15), t => {
      flash(t, B(13), 0.3);
      letterbox(t, (t - B(13)) / 0.3);
      lowerThird(t, B(13) + 0.2, B(15) - 0.05, { title: 'Puño Meteoro +', sub: 'El mismo movimiento, evolucionado', color: TYPE('steel'), icon: 'move:meteor-mash' });
    });

    // ---------- 4. La Sentencia de Arceus ----------
    at(B(15), () => { toUI(); $('game').style.filter = 'blur(4px) brightness(.3)'; sfx('reveal', { rarity: 5 }); });
    layer(B(15), B(16), t => {
      const g = c.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 820);
      g.addColorStop(0, '#3a2408'); g.addColorStop(1, '#0c0703');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      rays(W / 2, H / 2, t, '#ffd25e', 0.12);
      speedLines(t, B(15), 0.6);
      text('MINUTO 30', W / 2, H / 2 - 70, 120, { scale: slam(t, B(15), 0.2), depth: 10, glow: 'rgba(255,190,40,.6)' });
      text('LA SENTENCIA DE ARCEUS', W / 2, H / 2 + 48, 54, { scale: slam(t, B(15) + 0.18) });
      text('ha cambiado', W / 2, H / 2 + 106, 30, { scale: slam(t, B(15) + 0.32), fill: '#ffe9b0', depth: 2, deep: '#3a2408' });
      flash(t, B(15), 0.3);
    });

    // 4a. Tablas: Arceus de tipo Fuego y el aviso del juego
    at(B(16), async () => { $('game').style.filter = ''; await judge(658, ['water-gun', 'hydro-pump'], { plate: 'fire', noBosses: true, atk: 3 }); });
    layer(B(16), B(18), t => {
      flash(t, B(16), 0.3);
      letterbox(t, 1);
      lowerThird(t, B(16) + 0.3, B(18) - 0.05, { title: 'TABLAS', sub: 'Arceus lleva una al azar en cada partida: cambia de tipo', color: TYPE('fire'), isNew: true });
    });

    // 4b. La ruleta de las 17 Tablas
    at(B(18), () => { toUI(); $('game').style.filter = 'blur(4px) brightness(.3)'; });
    const PT = Object.keys(PLATE), PSTEP = RB * 0.72 / PT.length;
    layer(B(18), B(19), t => {
      const lt = t - B(18), i = Math.min(PT.length - 1, Math.floor(lt / PSTEP)), ty = lt > RB * 0.72 ? 'dragon' : PT[i];
      const g = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 800);
      g.addColorStop(0, '#20202c'); g.addColorStop(1, '#07070c');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      rays(W / 2, H / 2 + 40, t, TYPE(ty), 0.14);
      c.save(); c.globalAlpha = 0.45; c.fillStyle = TYPE(ty);
      c.beginPath(); c.ellipse(W / 2, H * 0.7, 170, 40, 0, 0, 7); c.fill(); c.restore();
      drawMon(mon('arceus', 493, 2.6), W / 2, H * 0.7, 1 / 60);
      text('17 TABLAS', W / 2, 76, 62, { scale: slam(t, B(18)) });
      const s = lt > RB * 0.72 ? slam(t, B(18) + RB * 0.72) : 1;
      text(PLATE[ty], W / 2, H * 0.83, 46, { scale: s, colors: ['#ffffff', TYPE(ty)], deep: '#111' });
      text('Tipo ' + G.U.TYPE_NAME[ty], W / 2, H * 0.91, 26, { scale: s, fill: '#fff', depth: 0, stroke: 4, outline: '#0a0c1c', weight: 400 });
      c.save(); c.imageSmoothingEnabled = false;
      PT.forEach((p, k) => {
        const a = k / PT.length * Math.PI * 2 + t * 0.5;
        c.globalAlpha = p === ty ? 1 : 0.45;
        const R = p === ty ? 52 : 38;
        G.Icons.draw(c, 'type:' + p, W / 2 + Math.cos(a) * 470 - R / 2, H / 2 + 20 + Math.sin(a) * 230 - R / 2, R);
      });
      c.restore();
      text('Los ataques de Lucha ya no son siempre los mejores', W / 2, 132, 24, { fill: '#fff', depth: 0, stroke: 4, outline: '#0a0c1c', weight: 400, alpha: cl((lt - 0.2) / 0.2) });
    });
    for (let k = 0; k < PT.length; k += 2) at(B(18) + k * PSTEP, () => sfx('hover'));
    at(B(18) + RB * 0.72, () => sfx('levelup'));

    // 4c. Ahora se le puede pegar: el contador de daño sube
    at(B(19), async () => { $('game').style.filter = ''; await judge(445, ['dragon-claw', 'outrage'], { plate: 'dragon', noBosses: true, atk: 25, zoom: 1.25 }); });
    layer(B(19), B(21), t => {
      flash(t, B(19), 0.25);
      letterbox(t, 1);
      lowerThird(t, B(19) + 0.1, B(21) - 0.05, { title: '¡AHORA SE LE PUEDE PEGAR!', sub: 'Es invencible, pero cada golpe cuenta para el ranking', color: '#ff6a3d', isNew: true, size: 40 });
    });

    // 4d. Legendarios que sí caen
    at(B(21), async () => { await judge(150, ['psychic', 'shadow-ball', 'aura-sphere'], { plate: 'ghost', atk: 14, pre: 2.2, zoom: 1.1 }); });
    layer(B(21), B(22), t => {
      flash(t, B(21), 0.2, '255,255,255', 0.5);
      letterbox(t, 1);
      lowerThird(t, B(21) + 0.05, B(22) - 0.02, { title: 'LEGENDARIOS QUE CAEN', sub: 'Cada uno, un 25 % más fuerte que el anterior (antes, el doble)', color: TYPE('psychic'), size: 40 });
    });

    // 4e. Minuto 35: Arceus rompe los objetos
    at(B(22), async () => { await judge(448, ['aura-sphere'], { plate: 'steel', noBosses: true, item: 'focussash', time: 2099.45, atk: 3 }); });
    layer(B(22), B(24), t => {
      flash(t, B(22), 0.2, '255,255,255', 0.5);
      letterbox(t, 1);
      lowerThird(t, B(22) + 0.1, B(24) - 0.05, { title: 'MINUTO 35', sub: 'Arceus rompe el objeto de todos, Banda Focus incluida', color: '#ffb070', icon: 'focussash', isNew: true });
    });

    // ---------- 5. El ranking partido ----------
    at(B(24) - 0.05, () => {
      G.Judgment.debugNoBosses(false);
      toUI();
      $('game').style.filter = 'blur(3px) brightness(.5)';
      G.SocialUI.needOnline = () => true;
      G.Social.started = true;
      try { Object.defineProperty(G.Social, 'me', { get: () => ({ name: 'Kairo' }), configurable: true }); } catch (e) { /* nada */ }
      try { Object.defineProperty(G.Social, 'uid', { get: () => 'x0', configurable: true }); } catch (e) { /* nada */ }
      G.Ranking.top = async () => fakeRows('t');
      G.Ranking.topDmg = async () => ({ rows: fakeRows('d'), me: { pos: 1, d: fakeRows('d')[0].d } });
      G.Ranking.myRank = async () => ({ pos: 1, t: fakeRows('t')[0].t, row: fakeRows('t')[0] });
      G.RankingUI.open();
    });
    camera(B(24), B(26), t => {
      const L = document.querySelector('#scr-rank .rk-col'), R = document.querySelectorAll('#scr-rank .rk-col')[1];
      if (!L || !R) { cam = null; return; }
      const fl = frame(L.getBoundingClientRect(), 14, 640), fr = frame(R.getBoundingClientRect(), 14, 640);
      const k = eio((t - B(24)) / 0.35), m = eio((t - B(25)) / 0.4);
      const f = { x: lerp(fl.x, fr.x, m), y: lerp(fl.y, fr.y, m), w: lerp(fl.w, fr.w, m) };
      cam = { x: lerp(0, f.x, k), y: lerp(0, f.y, k), w: lerp(W, f.w, k) };
    });
    layer(B(24), B(26), t => {
      vignette();
      const dmg = t < B(25);
      lowerThird(t, dmg ? B(24) + 0.1 : B(25), dmg ? B(25) - 0.02 : B(26) - 0.04,
        dmg ? { title: 'DAÑO A ARCEUS', sub: '¿Quién le pega más fuerte?', color: '#ff6a3d', isNew: true, y: H - 140 }
            : { title: 'TIEMPO AGUANTADO', sub: 'Como siempre, ahora a la derecha', color: '#5aa8ff', y: H - 140 });
    });
    layer(B(26), B(28), t => {
      vignette();
      text('UN RANKING, DOS MITADES', W / 2, 52, 44, { scale: slam(t, B(26)) });
      text('Todas las tablas empiezan de cero · sin límite de 45 minutos', W / 2, H - 34, 24, { scale: slam(t, B(26) + 0.15), fill: '#fff', depth: 2, deep: '#222', weight: 400 });
      flash(t, B(26), 0.2, '255,255,255', 0.4);
    });

    // ---------- 6. ¿Hasta dónde llegarás? y el resumen ----------
    at(B(28), () => { toUI(); $('game').style.filter = 'blur(4px) brightness(.3)'; sfx('confirm'); });
    layer(B(28), B(30), t => {
      const lt = t - B(28);
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#2a1608'); g.addColorStop(1, '#0c0a14');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      rays(W / 2, H / 2, t, '#ffd25e', 0.07);
      flash(t, B(28), 0.2, '255,255,255', 0.5);
      const sec = Math.min(35 * 60, 30 * 60 + Math.floor(eio(lt / (RB * 1.6)) * 300));
      text(G.U.mmss(sec), W / 2, H / 2 - 40, 150, { scale: slam(t, B(28)), depth: 10, colors: sec >= 2100 ? ['#ffe8d0', '#ffb070', '#ff6a1a', '#c0400a'] : GOLD, glow: 'rgba(255,170,40,.45)' });
      text('¿HASTA DÓNDE LLEGARÁS?', W / 2, H / 2 + 90, 56, { scale: slam(t, B(28) + 0.2) });
      text('¿Y cuánto daño le harás a Arceus?', W / 2, H / 2 + 150, 28, { scale: slam(t, B(29)), fill: '#9fe0ff', depth: 2, deep: '#123', alpha: t >= B(29) ? 1 : 0 });
    });
    const RECAP = [['Esferas de Mundo Misterioso', '#b39bff'], ['Amuletos Iris', '#c47bff'], ['Gacha ×100 y botón Saltar', '#ffd23f'],
      ['Movimientos evolucionados con +', TYPE('steel')], ['Arceus con Tablas', TYPE('fire')], ['Ranking de daño a Arceus', '#ff6a3d'],
      ['Objetos rotos en el minuto 35', '#ffb070'], ['Legendarios que caen', TYPE('psychic')]];
    const RSTEP = (RB * 2 - 0.3) / RECAP.length;
    layer(B(30), B(32), t => {
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#1d1446'); g.addColorStop(1, '#0b2a4a');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      rays(W / 2, H / 2, t, '#7fb8ff', 0.06);
      text('TODO LO NUEVO', W / 2, 66, 54, { scale: slam(t, B(30)) });
      RECAP.forEach(([s, col], k) => {
        const t0 = B(30) + 0.15 + k * RSTEP;
        if (t < t0) return;
        const x = k % 2 ? W * 0.74 : W * 0.26, y = 160 + Math.floor(k / 2) * 120, sc = slam(t, t0, 0.16);
        c.save(); c.translate(x, y); c.scale(sc, sc);
        rrect(-270, -40, 540, 80, 14); c.fillStyle = 'rgba(8,10,24,.85)'; c.fill();
        c.lineWidth = 4; c.strokeStyle = col; c.stroke();
        c.fillStyle = col; rrect(-258, -28, 14, 56, 6); c.fill();
        c.restore();
        text(s, x + 8 * sc, y, 28, { scale: sc, fill: '#fff', depth: 0, stroke: 4, outline: '#05060f' });
      });
    });
    for (let k = 0; k < RECAP.length; k++) at(B(30) + 0.15 + k * RSTEP, () => sfx('select'));

    // ---------- 7. Desfile de legendarios y final ----------
    const ROWS = 5, PER = 11;
    function parade(t, t0, dim) {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#3a2a12'); g.addColorStop(1, '#140d06');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const lt = t - t0;
      for (let r = 0; r < ROWS; r++) {
        const y = 160 + r * 118, dir = r % 2 ? 2 : 6, sp = 60 + (r * 37) % 50;
        c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, y - 6, W, 14);
        for (let k = 0; k < PER; k++) {
          const dex = PARADE[(r * PER + k) % PARADE.length];
          const a = mon('p' + r + '-' + k, dex, 1.3);
          a.loop('Walk'); a.dir = dir;
          const span = W + 260, base = k * span / PER + (dir === 6 ? -1 : 1) * lt * sp;
          const x = ((base % span) + span) % span - 130;
          drawMon(a, x, y, 1 / 60);
        }
      }
      c.fillStyle = `rgba(8,5,2,${dim})`; c.fillRect(0, 0, W, H);
    }
    layer(B(32), B(34), t => {
      parade(t, B(32), 0.5);
      flash(t, B(32), 0.25, '255,255,255', 0.6);
      text('¿Quién llegará más lejos?', W / 2, H / 2 - 30, 80, { scale: slam(t, B(32) + 0.05), depth: 8, glow: 'rgba(255,200,60,.5)' });
      text('El ranking empieza hoy desde cero', W / 2, H / 2 + 50, 34, { scale: slam(t, B(32) + 0.25), fill: '#fff', depth: 3, deep: '#3a2408' });
    });
    at(B(32), () => sfx('reveal', { rarity: 4 }));

    at(B(34), () => sfx('legend'));
    layer(B(34), DUR + 1, t => {
      parade(t, B(32), 0.5 + 0.3 * eo((t - B(34)) / 0.5));
      rays(W / 2, H / 2 - 40, t, 'rgba(255,214,90,1)', 0.12);
      speedLines(t, B(34), 0.6);
      text('PokéSurvivor', W / 2, H / 2 - 70, 132, { scale: slam(t, B(34), 0.26), depth: 10, glow: 'rgba(255,200,60,.6)' });
      if (t >= B(34.5)) text('LA SENTENCIA DE ARCEUS, YA DISPONIBLE', W / 2, H / 2 + 34, 36, { scale: slam(t, B(34.5)), fill: '#fff', depth: 3, deep: '#7a3c00' });
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
      if (st === 'carga' && window.G && G.Flow && G.DB && G.ShopUI && G.GachaUI && G.RankingUI && $('tap-start')) {
        st = 'preparando';
        setup().then(() => { st = 'listo'; }).catch(e => { st = 'error ' + (e && e.stack || e); });
      }
      return st;
    },
    begin() {
      $('tap-start').classList.add('hidden');
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

  const PARADE = [493, 150, 249, 250, 384, 383, 382, 487, 483, 484, 644, 643, 716, 717, 791, 792, 888, 889, 890, 144, 145, 146,
    243, 244, 245, 377, 378, 379, 380, 381, 480, 481, 482, 485, 486, 488, 638, 639, 640, 641, 642, 645, 646, 718, 800, 1007, 1008];

  async function setup() {
    await G.DB.ready();
    await document.fonts.load('700 40px Pixelify');
    await document.fonts.load('400 40px Pixelify');
    G.DB.playAsGuest();
    const sv = G.DB.save;
    for (const m of G.DEX) G.DB.grant(m.dex, 'gacha');
    sv.partner = sv.starter = 448;
    sv.coins = 99999;
    sv.stats.judged = 5;                        // la animación de la Sentencia ya se ha visto: se puede saltar
    G.Settings.set('dmgNumbers', false);        // sin números de daño: se ve mejor qué hace cada ataque
    G.Flow.goMenu();
    G.UI.hideAll();
    const css = document.createElement('style');
    css.textContent = '#ach-pop{display:none!important} #toast{display:none!important}';
    document.head.appendChild(css);
    ov = document.createElement('canvas');
    ov.width = W * 1.5; ov.height = H * 1.5;
    ov.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:720px;z-index:2147483647;pointer-events:none';
    document.body.appendChild(ov);
    c = ov.getContext('2d');
    PARADE.splice(0, PARADE.length, ...new Set(PARADE.filter(d => G.SPRITE_META[d])));
    const dexes = [...new Set([25, 376, 658, 445, 150, 448, 493, ...LEGS, ...MONS, ...PARADE])].filter(d => G.SPRITE_META[d]);
    await G.Sprites.preload(dexes, 30000);
  }
})();
