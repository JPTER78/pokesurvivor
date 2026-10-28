/* ============ util.js — helpers compartidos ============ */
window.G = window.G || {};

/** Altura a la que vuelan proyectiles y efectos sobre el plano del suelo. */
G.LIFT = 18;

G.U = {
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  /*
   * Lo que llega de OTROS jugadores (ranking, perfiles, reportes) se limpia
   * con esto al leerlo, antes de usarlo en ningún sitio (18-10-2026: alguien
   * metió código en el "nivel" de su fila del ranking y se ejecutaba en el
   * navegador de quien lo abría). Un número es siempre un número y un texto,
   * siempre texto (y se escapa al pintarlo).
   */
  int(v, max = 1e12) { return Number.isFinite(+v) && +v > 0 ? Math.min(max, Math.floor(+v)) : 0; },
  str(v, max = 64) { return typeof v === 'string' ? v.slice(0, max) : ''; },
  list(v, max = 50) { return Array.isArray(v) ? v.slice(0, max) : []; },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  /** Elige n elementos distintos al azar. */
  pickN(arr, n) {
    const c = arr.slice();
    const out = [];
    while (out.length < n && c.length) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
    return out;
  },

  dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); },
  dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },

  /** Normaliza un vector; devuelve [0,0] si es nulo. */
  norm(x, y) { const m = Math.hypot(x, y); return m > 1e-6 ? [x / m, y / m] : [0, 0]; },

  /** Interpolación independiente del framerate. */
  damp(a, b, rate, dt) { return b + (a - b) * Math.exp(-rate * dt); },

  /** Hash determinista 2D -> [0,1). Para generar el mapa siempre igual. */
  hash(x, y, seed = 0) {
    // Todo en enteros de 32 bits con Math.imul: es la función más llamada
    // al hornear el mapa, y así V8 no sale nunca de la ruta rápida.
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  },

  /** "3:07" a partir de segundos. */
  mmss(s) {
    const m = Math.floor(s / 60);
    return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  },
  /** Como mmss, pero con horas si pasa de una: "1:02:05". */
  hmmss(t) { return t >= 3600 ? Math.floor(t / 3600) + ':' + G.U.mmss(t % 3600).padStart(5, '0') : G.U.mmss(t); },

  /**
   * Velos radiales a pantalla completa (viñeta, niebla, cielo de la Sentencia).
   * `layers`: de abajo arriba, [r0, r1, 'r,g,b', a]: transparente hasta r0 y
   * con opacidad `a` desde r1 (r0 = fracción del lado corto, r1 = del lado
   * largo); r0 = r1 = 0 es un tinte uniforme.
   * Antes cada capa era un degradado radial nuevo y relleno a pantalla
   * completa en cada fotograma (con niebla: tinte + viñeta + niebla), y en el
   * móvil caía a ~10 FPS. Ahora todas las capas se funden (composición exacta)
   * en una imagen del tamaño real del lienzo, que sólo se rehace si cambia el
   * tamaño o la intensidad, y cada fotograma es una copia 1:1 de esa imagen.
   */
  veil(ctx, w, h, layers) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    if (w <= 0 || h <= 0 || !cw || !ch) return;
    const cache = G.U._veils || (G.U._veils = new Map());
    const key = cw + 'x' + ch + '|' + w + 'x' + h + '|' + layers.join('|');
    let cv = cache.get(key);
    if (cv) cache.delete(key);            // (el último usado, al final)
    else {
      // Se guardan 3 (viñeta, niebla, Sentencia); el lienzo que sale se reaprovecha.
      let spare = null;
      while (cache.size >= 3) { const k = cache.keys().next().value; spare = cache.get(k); cache.delete(k); }
      cv = spare || document.createElement('canvas');
      cv.width = cw; cv.height = ch;        // (también lo deja en blanco)
      const c = cv.getContext('2d');
      c.setTransform(cw / w, 0, 0, ch / h, 0, 0);
      const S = Math.min(w, h), L = Math.max(w, h);
      const ring = layers.filter(l => l[1] > 0);
      const D0 = Math.min(...ring.map(l => l[0] * S)), D1 = Math.max(...ring.map(l => l[1] * L));
      const g = c.createRadialGradient(w / 2, h / 2, D0, w / 2, h / 2, D1);
      // Una capa: su degradado tal cual. Varias: se componen (source-over) en cada parada.
      const N = layers.length === 1 ? 2 : 32, stops = [];
      for (let i = 0; i < N; i++) {
        const d = D0 + (D1 - D0) * i / (N - 1);
        let A = 0, R = 0, Gc = 0, B = 0;
        for (const [r0, r1, rgb, a] of layers) {
          const al = r1 > 0 ? a * G.U.clamp((d - r0 * S) / (r1 * L - r0 * S), 0, 1) : a;
          const [cr, cg, cb] = rgb.split(',').map(Number);
          R = R * (1 - al) + cr * al; Gc = Gc * (1 - al) + cg * al; B = B * (1 - al) + cb * al;
          A = 1 - (1 - A) * (1 - al);
        }
        stops.push(A > 0 ? [R / A, Gc / A, B / A, A] : null);
      }
      // Las paradas transparentes llevan el color de la siguiente (si no, el
      // paso de transparente a color se oscurecería).
      for (let i = N - 1; i >= 0; i--) if (!stops[i]) { const n = stops[i + 1] || [0, 0, 0, 0]; stops[i] = [n[0], n[1], n[2], 0]; }
      stops.forEach(([r, gg, b, al], i) => g.addColorStop(i / (N - 1), `rgba(${r.toFixed(1)},${gg.toFixed(1)},${b.toFixed(1)},${al.toFixed(4)})`));
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
    cache.set(key, cv);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(cv, 0, 0);
    ctx.restore();
  },

  /** Texto seguro para meterlo en HTML (nombres y demás que escriben otros jugadores). */
  esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  /** Colores de tipo Pokémon (para proyectiles, tags y efectos). */
  TYPE_COLOR: {
    normal: '#b0a99f', fire: '#ff7b3d', water: '#4b9bff', grass: '#5fcb6a',
    electric: '#ffd33d', ice: '#7fe0e0', fighting: '#e0533d', poison: '#b45ec4',
    ground: '#d6b25c', flying: '#9bb8ff', psychic: '#ff5f9e', bug: '#a3c43d',
    rock: '#bfa96b', ghost: '#7a6bc4', dragon: '#6b58ff', dark: '#6b5c52',
    steel: '#a8b8c4', fairy: '#ff9ed8'
  },

  TYPE_NAME: {
    normal: 'Normal', fire: 'Fuego', water: 'Agua', grass: 'Planta',
    electric: 'Eléctrico', ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno',
    ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
    rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro',
    steel: 'Acero', fairy: 'Hada'
  }
};
