/* ============ tiles.js — pixel art del mundo, pintado en código ============
 * Todo se pinta a resolución de ARTE (16 px por tile) escribiendo en un
 * ImageData, y luego se dibuja escalado ×G.Sprites.PX sin suavizado. Así los
 * tiles comparten tamaño de píxel con los sprites de Mundo Misterioso.
 *
 * Autotiling: cada tile mira a sus 8 vecinos al pintarse (bordes de pared,
 * cara frontal, esquinas redondeadas, espuma de la orilla...).
 */
G.Tiles = (() => {
  const T = 16;                       // píxeles de arte por tile

  const BIOMES = [
    { name: 'Bosque Umbrío', liquid: 'water',
      floor: ['#3e7a39', '#44813d', '#397134'], dirt: ['#7d6742', '#735e3b', '#86704a'],
      speck: '#2f5f2b', light: '#5f9d50', flowers: ['#f4d65c', '#f39ac0', '#eef2ff'],
      wallTop: ['#5d6e49', '#677a50', '#566544'], wallLight: '#88a06e', wallEdge: '#26301f',
      wallFace: ['#3e4934', '#363f2d'], wallFaceDark: '#232a1d',
      liq: '#3b7fc6', liqDeep: '#2c64a6', foam: '#b3defa', shore: '#2b5b2a',
      prop: 'tree', leaf: ['#235a2b', '#2f7535', '#45943f', '#64b252'], trunk: ['#5b3b22', '#7a5130'],
      rock: ['#5e6670', '#7f8893', '#a1aab4'], grass: ['#2f6b2c', '#4c9a3f', '#7cc45a'] },
    { name: 'Cueva Cristal', liquid: 'water',
      floor: ['#4d5778', '#535e81', '#47506f'], dirt: ['#3c4462', '#424a69', '#37405b'],
      speck: '#3b4363', light: '#6a78a4', flowers: ['#8fe3ff', '#c9a6ff', '#7ef0d0'],
      wallTop: ['#5f5089', '#695996', '#56497d'], wallLight: '#a08ddc', wallEdge: '#1f1934',
      wallFace: ['#3f3463', '#382e59'], wallFaceDark: '#221c3a',
      liq: '#2a9cab', liqDeep: '#1d7c8a', foam: '#aaf4f7', shore: '#33405e',
      prop: 'crystal', leaf: ['#5ad1e8', '#8fe7f5', '#c8f7ff', '#ffffff'], trunk: ['#3a4a78', '#4e64a0'],
      rock: ['#555d79', '#737c9c', '#959fc0'], grass: ['#3d5c8a', '#5a86c0', '#8ab8ee'] },
    { name: 'Volcán Ceniza', liquid: 'lava',
      floor: ['#5b4537', '#644c3c', '#533f32'], dirt: ['#403530', '#473b34', '#392f2b'],
      speck: '#47362b', light: '#806452', flowers: ['#ff8d3d', '#ffc45e', '#e06a4a'],
      wallTop: ['#3c3634', '#443d3a', '#35302e'], wallLight: '#625752', wallEdge: '#141110',
      wallFace: ['#2b2624', '#25201f'], wallFaceDark: '#151211',
      liq: '#e45a1f', liqDeep: '#b9401a', foam: '#ffd46a', shore: '#3a2a22',
      prop: 'dead', leaf: ['#4a3a30', '#5e4a3c', '#6f5a49', '#806a58'], trunk: ['#3a2e27', '#52423a'],
      rock: ['#4e4642', '#6a605b', '#877c76'], grass: ['#6b4a2a', '#94693a', '#c4914e'] }
  ];

  // ---------------- utilidades de color / píxel ----------------

  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // Empaquetado ABGR (little-endian) para escribir de golpe en un Uint32Array.
  function pack(hex, a = 255) {
    const [r, g, b] = rgb(hex);
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  /** Mezcla dos colores hex y devuelve el empaquetado. */
  function mixPack(h1, h2, t) {
    const a = rgb(h1), b = rgb(h2);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
  }

  /** Lienzo de píxeles: set(x,y,color) y canvas() al final. */
  function Pix(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    const img = c.createImageData(w, h);
    const buf = new Uint32Array(img.data.buffer);
    return {
      w, h,
      set(x, y, col) { if (x >= 0 && y >= 0 && x < w && y < h) buf[y * w + x] = col; },
      get(x, y) { return buf[y * w + x]; },
      canvas() { c.putImageData(img, 0, 0); return cv; }
    };
  }

  const H = (x, y, s) => G.U.hash(x, y, s);

  // ---------------- chunk de suelo ----------------

  /**
   * Pinta un chunk de n×n tiles. `at(tx,ty)` devuelve el tipo de terreno
   * global ('floor' | 'wall' | 'liquid'), así el autotiling ve más allá del
   * borde del chunk.
   */
  /**
   * Máscara de tierra del chunk a resolución de píxel (más una fila por
   * arriba para detectar bordes). El ruido se evalúa cada 4 px y se interpola:
   * ~30 veces menos llamadas que evaluarlo píxel a píxel.
   */
  function dirtMask(gx0, gy0, W, field, seed) {
    const S = 4, gw = W / S + 3;
    const grid = new Float32Array(gw * gw);
    for (let j = 0; j < gw; j++) for (let i = 0; i < gw; i++)
      grid[j * gw + i] = field(gx0 + (i - 1) * S, gy0 + (j - 1) * S);
    const mask = new Uint8Array(W * (W + 1));
    for (let y = -1; y < W; y++) {
      const fy = (y + S) / S, j = Math.floor(fy), v = fy - j;
      for (let x = 0; x < W; x++) {
        const fx = (x + S) / S, i = Math.floor(fx), u = fx - i;
        const a = grid[j * gw + i], b = grid[j * gw + i + 1];
        const c = grid[(j + 1) * gw + i], d = grid[(j + 1) * gw + i + 1];
        let val = (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
        val += (H((gx0 + x) >> 1, (gy0 + y) >> 1, seed + 9) - 0.5) * 0.05;
        mask[(y + 1) * W + x] = val > 0.64 ? 1 : 0;
      }
    }
    // dirtAt(x, y) en coordenadas locales del chunk (y puede ser -1).
    return (x, y) => mask[(y + 1) * W + x] === 1;
  }

  function paintChunk(cx, cy, n, at, dirtField, bi, seed = 0) {
    const B = BIOMES[bi];
    const P = Pix(n * T, n * T);
    const C = {};
    for (const k of ['floor', 'dirt', 'wallTop', 'wallFace', 'flowers', 'grass'])
      C[k] = B[k].map(h => pack(h));
    for (const k of ['speck', 'light', 'wallLight', 'wallEdge', 'wallFaceDark', 'liq', 'liqDeep', 'foam', 'shore'])
      C[k] = pack(B[k]);
    C.liqLight = mixPack(B.liq, B.foam, 0.28);

    const tx0 = cx * n, ty0 = cy * n;
    const dirtAt = dirtMask(tx0 * T, ty0 * T, n * T, dirtField, seed);

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const tx = tx0 + i, ty = ty0 + j;
        const ox = i * T, oy = j * T;
        const kind = at(tx, ty);

        // 1) Suelo bajo todo (las esquinas redondeadas de las paredes lo dejan ver).
        paintFloor(P, C, ox, oy, tx, ty, dirtAt, at);

        if (kind === 'wall') paintWall(P, C, ox, oy, tx, ty, at);
        else if (kind === 'liquid') paintLiquid(P, C, ox, oy, tx, ty, at);
      }
    }
    return P.canvas();
  }

  function paintFloor(P, C, ox, oy, tx, ty, dirtAt, at) {
    let dirtCount = 0;
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const gx = tx * T + x, gy = ty * T + y;
        const lx = ox + x, ly = oy + y;           // coordenadas locales del chunk
        const dirt = dirtAt(lx, ly);
        if (dirt) dirtCount++;
        const pal = dirt ? C.dirt : C.floor;
        // Tono por ruido suave + tramado por píxel.
        const band = H(gx >> 3, gy >> 3, 11) * 0.7 + H(gx, gy, 12) * 0.5;
        let col = pal[Math.min(pal.length - 1, Math.floor(band * pal.length / 1.2))];
        const r = H(gx, gy, 13);
        if (r < 0.035) col = C.speck;
        else if (r > 0.985) col = C.light;
        // Borde de la tierra: labio oscuro arriba, hierba que la invade abajo.
        if (dirt && !dirtAt(lx, ly - 1)) col = C.speck;
        else if (!dirt && dirtAt(lx, ly - 1) && r < 0.5) col = C.light;
        P.set(ox + x, oy + y, col);
      }
    }
    const dirt = dirtCount > T * T / 2;
    // Sombra de contacto bajo las paredes que hay justo al norte.
    if (at(tx, ty - 1) === 'wall') {
      for (let x = 0; x < T; x++) { P.set(ox + x, oy, C.wallFaceDark); if ((x + ty) % 2) P.set(ox + x, oy + 1, C.speck); }
    }

    // Detalles: matojo, piedrecita o flor.
    const d = H(tx, ty, 14);
    const dx = ox + 3 + Math.floor(H(tx, ty, 15) * 10), dy = oy + 4 + Math.floor(H(tx, ty, 16) * 9);
    if (dirt) {
      if (d < 0.22) { P.set(dx, dy, C.light); P.set(dx + 1, dy, C.light); P.set(dx, dy + 1, C.speck); P.set(dx + 1, dy + 1, C.speck); }
      return;
    }
    if (d < 0.18) {                         // matojo
      P.set(dx, dy, C.light); P.set(dx - 1, dy - 1, C.light); P.set(dx + 1, dy - 1, C.light);
      P.set(dx, dy - 2, C.light); P.set(dx, dy + 1, C.speck);
    } else if (d < 0.26) {                  // flor
      const fc = C.flowers[Math.floor(H(tx, ty, 17) * C.flowers.length)];
      P.set(dx, dy - 1, fc); P.set(dx - 1, dy, fc); P.set(dx + 1, dy, fc); P.set(dx, dy + 1, fc);
      P.set(dx, dy, C.light);
    } else if (d < 0.32) {                  // piedrecita
      P.set(dx, dy, C.light); P.set(dx + 1, dy, C.light); P.set(dx, dy + 1, C.speck); P.set(dx + 1, dy + 1, C.speck);
    }
  }

  function paintWall(P, C, ox, oy, tx, ty, at) {
    const W = (x, y) => at(x, y) === 'wall';
    const n = W(tx, ty - 1), s = W(tx, ty + 1), w = W(tx - 1, ty), e = W(tx + 1, ty);
    const FACE = s ? 0 : 6;                 // filas de cara frontal visibles

    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        // Esquinas redondeadas exteriores: dejan ver el suelo.
        if (!n && !w && x + y < 3) continue;
        if (!n && !e && (T - 1 - x) + y < 3) continue;
        if (!s && !w && x + (T - 1 - y) < 2) continue;
        if (!s && !e && (T - 1 - x) + (T - 1 - y) < 2) continue;

        const gx = tx * T + x, gy = ty * T + y;
        let col;
        if (y >= T - FACE) {
          // Cara frontal: vetas verticales y base oscura.
          const fy = y - (T - FACE);
          col = C.wallFace[(x + (H(gx, 0, 21) < 0.5 ? 0 : 1)) % 3 === 0 ? 1 : 0];
          if (fy === 0) col = C.wallEdge;
          else if (y === T - 1) col = C.wallFaceDark;
          else if (H(gx, gy, 22) < 0.08) col = C.wallFaceDark;
        } else {
          // Cara superior con tramado.
          col = C.wallTop[Math.floor(H(gx >> 1, gy >> 1, 23) * 2.2 + H(gx, gy, 24) * 0.8) % C.wallTop.length];
          if (H(gx, gy, 25) < 0.05) col = C.wallLight;
          // Bordes: luz al norte, contorno oscuro a los lados.
          if (!n && y === 0) col = C.wallEdge;
          else if (!n && y === 1) col = C.wallLight;
          if (!w && x === 0) col = C.wallEdge;
          if (!e && x === T - 1) col = C.wallEdge;
        }
        P.set(ox + x, oy + y, col);
      }
    }
  }

  function paintLiquid(P, C, ox, oy, tx, ty, at) {
    const L = (x, y) => at(x, y) === 'liquid';
    const n = L(tx, ty - 1), s = L(tx, ty + 1), w = L(tx - 1, ty), e = L(tx + 1, ty);
    const nw = L(tx - 1, ty - 1), ne = L(tx + 1, ty - 1), sw = L(tx - 1, ty + 1), se = L(tx + 1, ty + 1);
    const BIG = 99;

    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        // Esquinas exteriores redondeadas: dejan ver el suelo de debajo.
        if (!n && !w && x + y < 3) continue;
        if (!n && !e && (T - 1 - x) + y < 3) continue;
        if (!s && !w && x + (T - 1 - y) < 3) continue;
        if (!s && !e && (T - 1 - x) + (T - 1 - y) < 3) continue;

        // Distancia a la orilla dentro del tile (incluye esquinas interiores).
        let d = Math.min(n ? BIG : y, s ? BIG : T - 1 - y, w ? BIG : x, e ? BIG : T - 1 - x);
        if (n && w && !nw) d = Math.min(d, Math.hypot(x, y) - 0.5);
        if (n && e && !ne) d = Math.min(d, Math.hypot(T - 1 - x, y) - 0.5);
        if (s && w && !sw) d = Math.min(d, Math.hypot(x, T - 1 - y) - 0.5);
        if (s && e && !se) d = Math.min(d, Math.hypot(T - 1 - x, T - 1 - y) - 0.5);

        const gx = tx * T + x, gy = ty * T + y;
        const r = H(gx, gy, 31);
        let col;
        if (d < 1) col = C.shore;                       // labio de tierra
        else if (d < 2) col = C.foam;                   // espuma
        else if (d < 4) col = C.liqLight;               // agua somera
        else if (d < 6) col = r < 0.5 ? C.liq : C.liqLight;
        else col = d < 8 && r < 0.5 ? C.liq : C.liqDeep;
        if (d >= 6 && d < BIG && r < 0.08) col = C.liq;

        // Olas sueltas: rayitas horizontales de 3 px, pocas.
        if (d >= 3 && H(gx >> 2, gy, 33) < 0.045 && (gx & 3) !== 3) col = C.liqLight;
        if (d >= 3 && H(gx, gy, 34) < 0.004) col = C.foam;
        P.set(ox + x, oy + y, col);
      }
    }
  }

  // ---------------- sprites de objetos del escenario ----------------

  const propCache = new Map();          // "bioma/tipo/variante" -> canvas

  function propSprite(bi, type, variant = 0) {
    const k = bi + '/' + type + '/' + variant;
    let cv = propCache.get(k);
    if (!cv) { cv = PAINT[type](BIOMES[bi], variant); propCache.set(k, cv); }
    return cv;
  }

  function disc(P, cx, cy, r, colFn) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) { const c = colFn(x, y, d / r); if (c != null) P.set(x, y, c); }
      }
  }

  function outline(P, col) {
    // Contorno de 1 px alrededor de todo lo opaco.
    const marks = [];
    for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
      if (P.get(x, y) >>> 24) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => {
        const xx = x + a, yy = y + b;
        return xx >= 0 && yy >= 0 && xx < P.w && yy < P.h && (P.get(xx, yy) >>> 24);
      });
      if (near) marks.push([x, y]);
    }
    for (const [x, y] of marks) P.set(x, y, col);
  }

  const PAINT = {
    tree(B) {
      const P = Pix(30, 40);
      const L = B.leaf.map(h => pack(h)), Tr = B.trunk.map(h => pack(h));
      const edge = pack('#14200f');
      if (B.prop === 'crystal') return PAINT.crystal(B);
      if (B.prop === 'dead') return PAINT.deadtree(B);
      for (let y = 26; y < 38; y++) for (let x = 13; x < 18; x++) P.set(x, y, Tr[x === 13 || x === 17 ? 0 : 1]);
      P.set(12, 37, Tr[0]); P.set(18, 37, Tr[0]); P.set(11, 38, Tr[0]); P.set(19, 38, Tr[0]);
      const blobs = [[15, 20, 10], [9, 16, 7], [21, 16, 7], [15, 10, 8], [10, 23, 6], [20, 23, 6]];
      for (const [bx, by, br] of blobs) {
        disc(P, bx, by, br, (x, y, d) => {
          // Luz desde arriba a la izquierda.
          const lit = ((x - bx) * -0.6 + (y - by) * -0.8) / br;
          const idx = lit > 0.45 ? 3 : lit > 0.05 ? 2 : lit > -0.45 ? 1 : 0;
          return (H(x, y, 41) < 0.12 && idx > 0) ? L[idx - 1] : L[idx];
        });
      }
      outline(P, edge);
      return P.canvas();
    },

    crystal(B) {
      const P = Pix(26, 40);
      const L = B.leaf.map(h => pack(h)), D = B.trunk.map(h => pack(h));
      const spires = [[13, 2, 5, 38], [7, 14, 4, 38], [19, 12, 4, 38]];
      for (const [cx, top, half, bot] of spires) {
        for (let y = top; y <= bot; y++) {
          const t = Math.min(1, (y - top) / 8);
          const hw = Math.round(half * t);
          for (let x = cx - hw; x <= cx + hw; x++) {
            const side = x < cx ? (x === cx - hw ? 3 : 2) : x === cx ? 1 : 0;
            P.set(x, y, side >= 2 ? L[side] : y > bot - 4 ? D[1] : L[side]);
          }
        }
      }
      outline(P, D[0]);
      return P.canvas();
    },

    deadtree(B) {
      const P = Pix(28, 40);
      const Tr = B.trunk.map(h => pack(h)), L = B.leaf.map(h => pack(h));
      for (let y = 12; y < 38; y++) for (let x = 12; x < 16; x++) P.set(x, y, Tr[x < 14 ? 0 : 1]);
      const branch = (x0, y0, dx, len) => {
        for (let i = 0; i < len; i++) { P.set(x0 + dx * i, y0 - i, L[1]); P.set(x0 + dx * i, y0 - i + 1, L[0]); }
      };
      branch(12, 20, -1, 9); branch(15, 17, 1, 10); branch(13, 13, -1, 7); branch(14, 12, 1, 6);
      outline(P, pack('#0f0b09'));
      return P.canvas();
    },

    rock(B, variant) {
      const P = Pix(22, 17);
      const R = B.rock.map(h => pack(h));
      const shine = pack('#ffffff');
      // Peñasco achatado: elipse más ancha que alta, base plana.
      for (let y = 2; y <= 15; y++) for (let x = 1; x <= 20; x++) {
        const nx = (x - 10.5) / 9.5, ny = (y - 9.5) / 7;
        const d = nx * nx + ny * ny + (H(x, y, 61) - 0.5) * 0.08;
        if (d > 1) continue;
        const lit = -nx * 0.55 - ny * 0.85 + (H(x, y, 62) - 0.5) * 0.25;
        let c = R[lit > 0.4 ? 2 : lit > -0.15 ? 1 : 0];
        if (y >= 14) c = R[0];
        P.set(x, y, c);
      }
      // Brillo y textura.
      [[6, 5], [7, 5], [6, 6], [8, 4]].forEach(([x, y]) => P.set(x, y, shine));
      [[13, 8], [14, 9], [9, 11], [16, 11], [11, 7]].forEach(([x, y]) => P.set(x, y, R[0]));
      // Grietas en la variante dañada.
      if (variant === 1) {
        const dark = pack('#1b1d22');
        [[9, 4], [10, 5], [10, 6], [11, 7], [10, 8], [12, 8], [13, 9], [8, 9], [7, 10]].forEach(([x, y]) => P.set(x, y, dark));
      }
      outline(P, pack('#17191d'));
      return P.canvas();
    },

    grass(B, variant) {
      // Matojo de hojas en abanico: cada hoja es una curva que se inclina
      // hacia fuera, con la base oscura y la punta clara. La variante 1 es el
      // fotograma "mecido por el viento".
      const P = Pix(20, 17);
      const Gc = B.grass.map(h => pack(h));
      const dark = pack(B.speck);
      const sway = variant === 1 ? 1.2 : 0;
      const blades = 11;
      // Primero las de atrás (más oscuras), luego las de delante.
      for (let pass = 0; pass < 2; pass++) {
        for (let b = pass; b < blades; b += 2) {
          const t = b / (blades - 1);                     // 0 izquierda .. 1 derecha
          const x0 = 3 + t * 13 + (H(b, 7, 52) - 0.5) * 2;
          const hgt = 8 + Math.floor(H(b, 3, 51) * 6) + (Math.abs(t - 0.5) < 0.25 ? 3 : 0);
          const lean = (t - 0.5) * 7 + sway * (0.6 + H(b, 1, 53));
          for (let i = 0; i <= hgt; i++) {
            const k = i / hgt;
            const x = Math.round(x0 + lean * k * k);
            const y = 16 - i;
            let c = k > 0.78 ? Gc[2] : k > 0.25 ? Gc[1] : Gc[0];
            if (pass === 0 && k <= 0.78) c = Gc[0];
            P.set(x, y, c);
            if (i < hgt * 0.45) P.set(x + 1, y, k < 0.15 ? dark : Gc[0]);
          }
        }
      }
      outline(P, pack('#0e1d0c'));
      return P.canvas();
    },

    chest() {
      const P = Pix(16, 14);
      const gold = pack('#f2c443'), goldD = pack('#b5832a'), wood = pack('#8a4f2a'), woodD = pack('#5e3418');
      const lid = pack('#c4662e');
      for (let y = 2; y < 13; y++) for (let x = 1; x < 15; x++) {
        let c = y < 6 ? lid : wood;
        if (y === 6) c = goldD;
        if (x === 1 || x === 14) c = woodD;
        if ((x === 4 || x === 11) && y > 1) c = y < 6 ? gold : goldD;
        if (y === 12) c = woodD;
        P.set(x, y, c);
      }
      for (let x = 6; x < 10; x++) for (let y = 5; y < 9; y++) P.set(x, y, (x + y) % 3 ? gold : goldD);
      outline(P, pack('#2a160a'));
      return P.canvas();
    }
  };

  function clearProps() { propCache.clear(); }

  return { T, BIOMES, paintChunk, propSprite, clearProps };
})();
