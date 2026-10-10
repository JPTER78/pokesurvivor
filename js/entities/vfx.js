/* ============ vfx.js — sprites pixel art de los ataques ============
 * Formas (llama, gota, burbuja, hoja, rayo...) generadas por código a
 * resolución de arte, igual que los tiles, y coloreadas con la paleta del tipo.
 * Así una misma burbuja sale azul de agua o morada de veneno, y todo comparte
 * píxel y contorno oscuro con los sprites de Mundo Misterioso.
 *
 *   G.VFX.draw(ctx, shape, pal, x, y, { angle, scale, frame, alpha })
 *   G.VFX.forMove(m)  -> cómo se ve ese movimiento (proyectil, rayo, golpe...)
 *   G.VFX.forType(t)  -> forma por defecto de un tipo (disparos enemigos)
 */
G.VFX = (() => {
  const PX = G.Sprites.PX;

  // Paletas por tipo: contorno, oscuro, medio, claro, brillo.
  const PAL = {
    fire:     ['#6b1200', '#b8300a', '#ff6a1f', '#ffb22e', '#fff2a0'],
    water:    ['#0f2f78', '#1f56c4', '#3d8bff', '#8ccaff', '#eaf7ff'],
    grass:    ['#14400f', '#24721e', '#45b23c', '#97e36c', '#eaffd0'],
    electric: ['#6b4300', '#c48a00', '#ffd21a', '#fff36a', '#ffffff'],
    psychic:  ['#5e0a3a', '#b0246e', '#ff4f9a', '#ff9fcf', '#ffe8f3'],
    ice:      ['#134a60', '#2f8aa8', '#62d2ea', '#bff3ff', '#ffffff'],
    fighting: ['#561208', '#9a2a16', '#e04a2e', '#ff9c6c', '#ffe2cc'],
    poison:   ['#2e0a3c', '#5e1f7e', '#a043d0', '#d995f2', '#f7e2ff'],
    ground:   ['#3a250c', '#6e4c1e', '#aa7c3c', '#dcb66c', '#f6e6b8'],
    flying:   ['#283c66', '#5672b0', '#93b2ff', '#d2e2ff', '#ffffff'],
    bug:      ['#2e3a06', '#5b7414', '#90b82a', '#cbe86c', '#f4ffd2'],
    rock:     ['#2e2418', '#5a4a34', '#8e7a5a', '#c6b08a', '#f0e4c6'],
    ghost:    ['#160e2c', '#33256a', '#5c48aa', '#9e8aea', '#e8deff'],
    dragon:   ['#160a50', '#2e1ea0', '#5a3cff', '#a490ff', '#e8e2ff'],
    dark:     ['#0e0a0c', '#2a2026', '#463840', '#7c6a74', '#d4c4cc'],
    steel:    ['#232d38', '#56667a', '#8c9caf', '#cad6e2', '#ffffff'],
    fairy:    ['#6a2050', '#b04a8a', '#ff8acb', '#ffc4e6', '#ffffff'],
    normal:   ['#3e3834', '#7a7068', '#c4bcb0', '#ece6dc', '#ffffff'],
    aura:     ['#0c2460', '#1c4cb0', '#3a7cff', '#90d2ff', '#ffffff']
  };
  const IDX = { o: 0, d: 1, m: 2, l: 3, w: 4 };
  const H = (a, b, c) => G.U.hash(a, b, c);

  // ---------------- lienzo de píxeles ----------------
  // Las formas escriben letras (o d m l w, o L = claro semitransparente);
  // luego se colorean con la paleta.

  function grid(w, h) {
    const g = Array.from({ length: h }, () => Array(w).fill(null));
    return {
      w, h, g,
      set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; },
      get(x, y) { return x >= 0 && y >= 0 && x < w && y < h ? g[y][x] : null; },
      fill(fn) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); if (c) g[y][x] = c; } },
      // Contorno de 1 px alrededor de lo opaco, como en los sprites de PMD.
      outline() {
        const marks = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (g[y][x]) continue;
          if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const c = this.get(x + a, y + b); return c && c !== 'o'; })) marks.push([x, y]);
        }
        for (const [x, y] of marks) g[y][x] = 'o';
      },
      line(x0, y0, x1, y1, c, thick = 0, side = null) {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
        for (let i = 0; i <= n; i++) {
          const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
          if (thick) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!this.get(Math.round(x + a), Math.round(y + b))) this.set(x + a, y + b, side || c);
          this.set(x, y, c);
        }
      },
      arc(cx, cy, r, a0, a1, c) {
        const n = Math.ceil(r * Math.abs(a1 - a0) * 2) + 2;
        for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; this.set(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c); }
      }
    };
  }

  // ---------------- formas ----------------
  // Todas miran hacia la DERECHA (se rotan al dibujar si son direccionales).

  const SHAPES = {
    fire: { w: 15, h: 11, frames: 3, dir: true, gen(P, f) {
      const cx = 10.5, cy = 5;
      for (let x = 1; x <= 9; x++) {                               // cola que parpadea
        const t = (x - 1) / 8;
        const th = 0.5 + t * 2.6 + (H(x, f, 3) - 0.5) * 1.3;
        const yc = cy + Math.sin(x * 1.4 + f * 2.1) * 0.8 * (1 - t);
        for (let y = 0; y < P.h; y++) {
          const d = Math.abs(y - yc);
          if (d > th || (t < 0.3 && H(x, y + f * 7, 5) < 0.4)) continue;
          P.set(x, y, d < th * 0.4 && t > 0.3 ? 'l' : 'm');
        }
      }
      P.fill((x, y) => {                                           // cabeza
        const d = Math.hypot(x - cx, (y - cy) * 1.1);
        return d < 1.3 ? 'w' : d < 2.4 ? 'l' : d < 3.5 ? 'm' : null;
      });
      P.outline();
    } },
    drop: { w: 13, h: 9, dir: true, gen(P) {
      for (let x = 2; x <= 7; x++) {
        const th = (x - 2) / 5 * 2.6;
        for (let y = 0; y < P.h; y++) { const d = Math.abs(y - 4); if (d <= th) P.set(x, y, d < th * 0.5 ? 'l' : 'm'); }
      }
      P.fill((x, y) => { const d = Math.hypot(x - 8.5, y - 4); return d < 1.6 ? 'l' : d < 3.3 ? 'm' : null; });
      P.set(9, 2, 'w'); P.set(10, 3, 'w');
      P.outline();
    } },
    bubble: { w: 11, h: 11, frames: 2, gen(P, f) {
      const rx = 4.3 + f * 0.3, ry = 4.3 - f * 0.3;
      P.fill((x, y) => { const e = Math.hypot((x - 5) / rx, (y - 5) / ry); return e <= 1 ? (e > 0.76 ? 'm' : 'L') : null; });
      P.set(3, 3, 'w'); P.set(4, 3, 'w'); P.set(3, 4, 'w'); P.set(7, 7, 'l');
      P.outline();
    } },
    leaf: { w: 12, h: 7, spin: true, gen(P) {
      P.fill((x, y) => { const dx = Math.abs(x - 5.5) / 5.6, dy = (y - 3) / 2.7; return dx + dy * dy <= 1 ? (y < 3 ? 'l' : 'm') : null; });
      for (let x = 2; x <= 9; x++) P.set(x, 3, 'd');
      P.set(4, 2, 'w');
      P.outline();
    } },
    bolt: { w: 15, h: 10, frames: 2, dir: true, gen(P, f) {
      const pts = f ? [[0, 3], [4, 7], [7, 2], [10, 7], [14, 4]] : [[0, 6], [4, 2], [7, 7], [10, 2], [14, 5]];
      for (let i = 0; i < pts.length - 1; i++) P.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 'w', 1, 'l');
      P.outline();
    } },
    shard: { w: 13, h: 7, dir: true, gen(P) {
      P.fill((x, y) => Math.abs(x - 6) / 6.2 + Math.abs(y - 3) / 3.4 <= 1 ? (y < 3 ? 'l' : 'm') : null);
      for (let x = 6; x <= 11; x++) P.set(x, 3, 'w');
      P.set(4, 2, 'w');
      P.outline();
    } },
    rock: { w: 12, h: 11, frames: 3, spin: true, gen(P, f) {
      const r = [0, 1, 2, 3, 4, 5, 6].map(i => 3.6 + H(i, f, 9) * 1.4);
      P.fill((x, y) => {
        const dx = x - 5.5, dy = y - 5, a = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * 6;
        const i = Math.floor(a), t = a - i;
        const R = r[i] * (1 - t) + r[(i + 1) % 6] * t;
        const d = Math.hypot(dx, dy);
        if (d > R) return null;
        const lit = (-dx * 0.6 - dy * 0.8) / R;
        return lit > 0.35 ? 'l' : lit > -0.3 ? 'm' : 'd';
      });
      P.set(6, 5, 'd'); P.set(7, 6, 'd'); P.set(4, 3, 'w');
      P.outline();
    } },
    blob: { w: 12, h: 11, frames: 2, gen(P, f) {
      P.fill((x, y) => {
        const dx = x - 5.5, dy = y - 4.8, a = Math.atan2(dy, dx);
        const R = 3.9 + Math.sin(a * 3 + f * 2) * 0.5;
        const d = Math.hypot(dx, dy);
        if (d > R) return null;
        const lit = (-dx * 0.6 - dy * 0.8) / R;
        return lit > 0.4 ? 'l' : lit > -0.35 ? 'm' : 'd';
      });
      P.set(4, 3, 'w'); P.set(3, 3, 'w');
      P.set(6, 9, 'm'); if (f) P.set(6, 10, 'm');                   // gota que cuelga
      P.outline();
    } },
    needle: { w: 13, h: 5, dir: true, gen(P) {
      for (let x = 1; x <= 9; x++) P.set(x, 2, 'm');
      for (let x = 3; x <= 8; x++) P.set(x, 1, 'l');
      P.set(10, 2, 'w'); P.set(11, 2, 'w');
      P.set(1, 1, 'd'); P.set(1, 3, 'd');
      P.outline();
    } },
    star: { w: 11, h: 11, frames: 2, spin: true, gen(P, f) {
      const L = f ? 3 : 4;
      for (let i = -L; i <= L; i++) { P.set(5 + i, 5, Math.abs(i) === L ? 'm' : 'l'); P.set(5, 5 + i, Math.abs(i) === L ? 'm' : 'l'); }
      const D = f ? 2 : 1;
      for (let i = 1; i <= D; i++) for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) P.set(5 + a * i, 5 + b * i, 'l');
      P.set(5, 5, 'w'); P.set(4, 5, 'w'); P.set(6, 5, 'w'); P.set(5, 4, 'w'); P.set(5, 6, 'w');
    } },
    streak: { w: 15, h: 5, dir: true, gen(P) {
      for (let x = 0; x < 15; x++) P.set(x, 2, x < 4 ? 'd' : x < 8 ? 'm' : x < 12 ? 'l' : 'w');
      for (let x = 7; x <= 12; x++) { P.set(x, 1, 'l'); P.set(x, 3, 'm'); }
      P.set(13, 1, 'w'); P.set(13, 3, 'w');
    } },
    wind: { w: 13, h: 11, frames: 2, spin: true, gen(P, f) {
      P.arc(6, 5, 4.6, -0.6 + f * 0.7, 2.9 + f * 0.7, 'l');
      P.arc(6, 5, 3.6, -0.3 + f * 0.7, 2.2 + f * 0.7, 'w');
      P.arc(6, 5, 2.2, 1.8 + f, 4.6 + f, 'l');
    } },
    web: { w: 11, h: 11, spin: true, gen(P) {
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; P.line(5, 5, 5 + Math.cos(a) * 5, 5 + Math.sin(a) * 5, 'l'); }
      for (const r of [2.4, 4.4]) for (let k = 0; k < 8; k++) {
        const a0 = k * Math.PI / 4, a1 = (k + 1) * Math.PI / 4;
        P.line(5 + Math.cos(a0) * r, 5 + Math.sin(a0) * r, 5 + Math.cos(a1) * r, 5 + Math.sin(a1) * r, 'w');
      }
    } },
    ring: { w: 13, h: 13, frames: 2, gen(P, f) {
      P.fill((x, y) => {
        const d = Math.hypot(x - 6, y - 6);
        if (Math.abs(d - (5 + f * 0.6)) < 0.75) return 'm';
        if (Math.abs(d - (3 + f * 0.5)) < 0.7) return 'l';
        return null;
      });
      P.set(6, 6, 'w');
    } },
    crescent: { w: 12, h: 11, dir: true, gen(P) {
      P.fill((x, y) => {
        const a = Math.hypot(x - 6.5, y - 5), b = Math.hypot(x - 3.8, y - 5);
        if (a > 4.8 || b < 4.2) return null;
        return b < 5.1 ? 'l' : 'm';
      });
      P.outline();
    } },
    note: { w: 11, h: 11, dir: true, gen(P) {
      P.arc(1, 5, 2.2, -0.7, 0.7, 'w');
      P.arc(1, 5, 4.6, -0.6, 0.6, 'l');
      P.arc(1, 5, 7.2, -0.5, 0.5, 'm');
    } },
    impact: { w: 15, h: 15, frames: 2, gen(P, f) {
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + (f ? Math.PI / 8 : 0), L = (k % 2 ? 3.5 : 6) * (f ? 1 : 0.75);
        P.line(7, 7, 7 + Math.cos(a) * L, 7 + Math.sin(a) * L, 'l');
        P.set(7 + Math.cos(a) * L, 7 + Math.sin(a) * L, 'm');
      }
      P.fill((x, y) => Math.hypot(x - 7, y - 7) < 1.8 ? 'w' : null);
    } },
    claw: { w: 13, h: 13, gen(P) {
      for (let i = 0; i < 3; i++) P.line(1 + i * 3.5, 11, 6 + i * 3.5, 1, 'w', 1, 'l');
      P.outline();
    } },
    jaws: { w: 13, h: 11, frames: 2, gen(P, f) {
      const gap = f ? 0 : 2;
      for (let x = 1; x <= 11; x++) { P.set(x, 1, 'm'); P.set(x, 9, 'm'); }
      for (let t = 0; t < 4; t++) {
        const x = 2 + t * 3;
        P.set(x, 2, 'w'); P.set(x + 1, 2, 'w'); P.set(x, 3, 'w'); P.set(x + 1, 3, 'l');
        if (!gap) { P.set(x, 4, 'w'); }
        P.set(x + 1, 8, 'w'); P.set(x + 2, 8, 'w'); P.set(x + 1, 7, 'w'); P.set(x + 2, 7, 'l');
        if (!gap) P.set(x + 1, 6, 'w');
      }
      P.outline();
    } },
    arrow: { w: 7, h: 9, gen(P) {
      for (let y = 0; y < 4; y++) for (let x = 3 - y; x <= 3 + y; x++) P.set(x, y, x === 3 - y ? 'w' : 'l');
      for (let y = 4; y < 9; y++) for (let x = 2; x <= 4; x++) P.set(x, y, x === 2 ? 'w' : 'm');
      P.outline();
    } },
    ball: { w: 11, h: 11, frames: 2, gen(P, f) {
      P.fill((x, y) => { const d = Math.hypot(x - 5, y - 5); return d < 1.5 ? 'w' : d < 2.9 ? 'l' : d < 4.2 + f * 0.3 ? 'm' : null; });
      P.set(3, 3, 'w');
      P.outline();
    } },
    shadow: { w: 13, h: 13, frames: 3, gen(P, f) {
      P.fill((x, y) => { const d = Math.hypot(x - 6, y - 6); return d < 1.6 ? 'l' : d < 3 ? 'm' : d < 4.4 ? 'd' : null; });
      for (let k = 0; k < 6; k++) {                                 // jirones de sombra
        const a = k * 1.05 + f * 0.7, r = 4.8 + H(k, f, 4) * 1.4;
        P.set(6 + Math.cos(a) * r, 6 + Math.sin(a) * r, 'm');
      }
      P.set(5, 5, 'w');
      P.outline();
    } },
    heart: { w: 9, h: 8, gen(P) {
      ['.ll...ll.', 'lwll.llll', 'lllllllll', 'lllllllll', '.lllllll.', '..lllll..', '...lll...', '....l....']
        .forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') P.set(x, y, c === 'w' ? 'w' : 'l'); }));
      P.outline();
    } }
  };

  // ---------------- caché y dibujo ----------------

  const cache = new Map();

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }

  function sprite(shape, pal, frame = 0) {
    const S = SHAPES[shape] || SHAPES.ball;
    const f = (frame | 0) % (S.frames || 1);
    const k = shape + '|' + pal + '|' + f;
    let cv = cache.get(k);
    if (cv) return cv;
    const P = grid(S.w, S.h);
    S.gen(P, f);
    cv = document.createElement('canvas');
    cv.width = S.w; cv.height = S.h;
    const c = cv.getContext('2d');
    const colors = PAL[pal] || PAL.normal;
    for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
      const ch = P.g[y][x];
      if (!ch) continue;
      c.fillStyle = ch === 'L' ? rgba(colors[3], 0.5) : colors[IDX[ch]];
      c.fillRect(x, y, 1, 1);
    }
    cache.set(k, cv);
    return cv;
  }

  /** Dibuja centrado en (x, y). opts: angle, scale (1 = píxel de juego), frame, alpha. */
  function draw(ctx, shape, pal, x, y, o = {}) {
    const S = SHAPES[shape] || SHAPES.ball;
    const cv = sprite(shape, pal, o.frame || 0);
    const k = PX * (o.scale || 1);
    ctx.save();
    if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= o.alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(x), Math.round(y));
    let a = o.angle || 0;
    if (a) {
      a = Math.round(a / (Math.PI / 8)) * (Math.PI / 8);          // 16 direcciones: menos parpadeo
      ctx.rotate(a);
    }
    ctx.drawImage(cv, -S.w * k / 2, -S.h * k / 2, S.w * k, S.h * k);
    ctx.restore();
  }

  function isDir(shape) { return !!(SHAPES[shape] && SHAPES[shape].dir); }
  function spins(shape) { return !!(SHAPES[shape] && SHAPES[shape].spin); }
  function frames(shape) { return (SHAPES[shape] && SHAPES[shape].frames) || 1; }

  // ---------------- cómo se ve cada movimiento ----------------
  //   proj: forma del proyectil (también novas y orbes)
  //   beam: forma que viaja por el rayo ('lightning' = zigzag)
  //   melee: extra del golpe (impact, jaws, claw, vine, feather)
  //   aura / buff: partícula que acompaña
  //   pal: paleta si no es la del tipo · trail: partículas de estela

  const MOVE = {
    'quick-attack':  { proj: 'streak' },
    'ember':         { proj: 'fire', trail: 'ember' },
    'heat-wave':     { proj: 'fire', trail: 'ember' },
    'fire-spin':     { proj: 'fire', trail: 'ember' },
    'flamethrower':  { proj: 'fire', trail: 'ember', beam: 'fire' },
    'water-gun':     { proj: 'drop', trail: 'drip' },
    'bubble':        { proj: 'bubble' },
    'hydro-pump':    { beam: 'drop' },
    'aqua-ring':     { buff: 'bubble' },
    'vine-whip':     { melee: 'vine' },
    'razor-leaf':    { proj: 'leaf' },
    'leaf-storm':    { proj: 'leaf' },
    'giga-drain':    { aura: 'heart', inward: true },
    'thunder-shock': { proj: 'bolt', trail: 'spark' },
    'discharge':     { aura: 'bolt' },
    'thunderbolt':   { beam: 'lightning' },
    'confusion':     { proj: 'ring' },
    'psybeam':       { beam: 'ring' },
    'psychic':       { proj: 'ring' },
    'sludge':        { proj: 'blob', trail: 'bubbles' },
    'poison-sting':  { proj: 'needle' },
    'toxic':         { aura: 'bubble', rise: true },
    'mud-shot':      { proj: 'blob', trail: 'dirt' },
    'bulldoze':      { aura: 'rock', rise: true },
    'gust':          { proj: 'wind' },
    'wing-attack':   { melee: 'feather' },
    'tackle':        { melee: 'impact' },
    'body-slam':     { melee: 'impact' },
    'hyper-voice':   { proj: 'note' },
    'bug-bite':      { melee: 'jaws' },
    'string-shot':   { proj: 'web' },
    'bug-buzz':      { aura: 'note' },
    'rock-throw':    { proj: 'rock', trail: 'dirt' },
    'rock-slide':    { proj: 'rock', trail: 'dirt' },
    'ice-beam':      { beam: 'shard' },
    'powder-snow':   { aura: 'star' },
    'karate-chop':   { melee: 'impact' },
    'aura-sphere':   { proj: 'ball', pal: 'aura', trail: 'spark' },
    'lick':          { melee: 'impact' },
    'shadow-ball':   { proj: 'shadow', trail: 'wisp' },
    'dragon-rage':   { beam: 'fire' },
    'dragon-dance':  { buff: 'arrow' },
    'fairy-wind':    { proj: 'star' },
    'dazzling-gleam': { aura: 'star' },
    'metal-claw':    { melee: 'claw' },
    'flash-cannon':  { beam: 'shard' },
    'bite':          { melee: 'jaws' },
    'dark-pulse':    { proj: 'crescent' },
    'night-shade':   { aura: 'shadow', rise: true },
    'swords-dance':  { buff: 'arrow', pal: 'fighting' },
    'agility':       { buff: 'arrow', pal: 'flying' },
    'harden':        { buff: 'arrow', pal: 'steel' },
    'bonemerang':    { proj: 'crescent' },
    'psycho-cut':    { proj: 'crescent' },
    'spikes':        { proj: 'star' },
    'toxic-spikes':  { proj: 'star' },
    'hail':          { proj: 'shard' },
    'meteor-mash':   { proj: 'rock', trail: 'spark' },
    'will-o-wisp':   { proj: 'ball', trail: 'ember' },
    'substitute':    { proj: 'star' },
    'aerial-ace':    { proj: 'wind' },
    'flame-wheel':   { proj: 'fire', aura: 'fire' },
    'bubble-beam':   { proj: 'bubble' },
    'hex':           { beam: 'shadow', proj: 'shadow' }
  };

  const TYPE_SHAPE = {
    fire: 'fire', water: 'drop', grass: 'leaf', electric: 'bolt', psychic: 'ring', ice: 'shard',
    fighting: 'ball', poison: 'blob', ground: 'blob', flying: 'wind', bug: 'needle', rock: 'rock',
    ghost: 'shadow', dragon: 'fire', dark: 'crescent', steel: 'shard', fairy: 'star', normal: 'star'
  };

  function forMove(m) {
    const v = MOVE[m.id] || {};
    return Object.assign({ pal: m.type, proj: TYPE_SHAPE[m.type] || 'ball' }, v, { pal: v.pal || m.type });
  }
  function forType(type) { return { proj: TYPE_SHAPE[type] || 'ball', pal: PAL[type] ? type : 'normal' }; }

  return { PAL, SHAPES, draw, sprite, forMove, forType, isDir, spins, frames };
})();
