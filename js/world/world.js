/* ============ world.js — arena abierta infinita con obstáculos ============
 *
 * Terreno por tile, determinista (ruido de valor con semilla):
 *   floor   suelo (con manchas de tierra)
 *   wall    formaciones rocosas: bloquean a quien camina y a los proyectiles
 *   liquid  agua (ralentiza) o lava en el volcán (quema)
 *
 * Objetos del escenario (props), dibujados ordenados por Y con las entidades:
 *   tree    bloquea, indestructible (cobertura)
 *   rock    bloquea, se rompe; puede soltar experiencia, monedas o bayas
 *   chest   bloquea, se rompe; suelta un buen botín
 *   grass   hierba alta, no bloquea; se corta con cualquier ataque
 *
 * Los Pokémon voladores, los fantasma y los jefes ignoran el terreno.
 *
 * Coordenadas: (x, y) de una entidad = sus PIES, en el plano del suelo.
 * Los chunks se separan en DATOS (baratos, siempre) e IMAGEN (horneada a
 * resolución de arte y sólo para los visibles).
 */
G.World = (() => {
  const T = G.Tiles.T;                     // px de arte por tile
  const N = 16;                            // tiles por chunk
  const TS = T * G.Sprites.PX;             // tamaño de tile en mundo (32)
  const CW = N * TS;                       // tamaño de chunk en mundo (512)
  const FLOOR = 0, WALL = 1, LIQUID = 2;
  const KIND = ['floor', 'wall', 'liquid'];

  let seed = 1, biome = 0;
  const data = new Map();                  // "cx,cy" -> datos del chunk
  const images = new Map();                // "cx,cy" -> canvas horneado
  const MAX_IMAGES = 48, MAX_DATA = 400;
  const broken = new Set();                // props destruidos: "tx,ty"
  let nextPropId = 1;

  // ---------------- ruido ----------------

  const H = (x, y, s) => G.U.hash(x, y, s);

  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = H(xi, yi, s), b = H(xi + 1, yi, s), c = H(xi, yi + 1, s), d = H(xi + 1, yi + 1, s);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.65 + vnoise(x * 2.13 + 17, y * 2.13 - 9, s + 1) * 0.35;

  /** Terreno "puro" de un tile (sin caché). */
  function terrainRaw(tx, ty) {
    const d = Math.hypot(tx, ty);
    if (d < 9) return FLOOR;                          // claro inicial
    const ramp = G.U.clamp((d - 9) / 8, 0, 1);       // aparición suave
    if (fbm(tx / 13, ty / 13, seed + 101) < 0.04 + 0.23 * ramp) return LIQUID;
    if (fbm(tx / 8, ty / 8, seed + 202) > 1 - 0.27 * ramp) return WALL;
    return FLOOR;
  }

  // ---------------- datos de chunk ----------------

  function chunkData(cx, cy) {
    const k = cx + ',' + cy;
    let c = data.get(k);
    if (c) return c;

    c = { cx, cy, terr: new Uint8Array(N * N),
          props: [], propAt: new Map(), liquids: [] };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const tx = cx * N + i, ty = cy * N + j;
      const t = terrainRaw(tx, ty);
      c.terr[j * N + i] = t;
      if (t === LIQUID) c.liquids.push(tx, ty);
    }
    if (data.size > MAX_DATA) data.delete(data.keys().next().value);
    data.set(k, c);
    placeProps(c);
    return c;
  }

  function terrainAt(tx, ty) {
    const cx = Math.floor(tx / N), cy = Math.floor(ty / N);
    const c = data.get(cx + ',' + cy) || chunkData(cx, cy);
    return c.terr[(ty - cy * N) * N + (tx - cx * N)];
  }

  function placeProps(c) {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (c.terr[j * N + i] !== FLOOR) continue;
      const tx = c.cx * N + i, ty = c.cy * N + j;
      if (Math.hypot(tx, ty) < 7) continue;
      if (broken.has(tx + ',' + ty)) continue;

      // Necesita suelo alrededor para no pegarse a paredes / agua.
      let open = true;
      for (let b = -1; b <= 1 && open; b++) for (let a = -1; a <= 1; a++)
        if (terrainRaw(tx + a, ty + b) !== FLOOR) { open = false; break; }

      const h = H(tx, ty, seed + 404);
      const grove = fbm(tx / 10, ty / 10, seed + 505) > 0.6;
      let type = null;
      if (open && h < (grove ? 0.07 : 0.006)) type = 'tree';
      else if (open && h > 0.992) type = 'rock';
      else if (open && h > 0.985 && h <= 0.992 && H(tx, ty, seed + 606) < 0.07) type = 'chest';
      else if (fbm(tx / 5, ty / 5, seed + 707) > 0.66 && H(tx, ty, seed + 808) < 0.75) type = 'grass';
      if (!type) continue;

      const p = makeProp(type, tx, ty);
      c.props.push(p);
      if (p.solid) c.propAt.set(tx + ',' + ty, p);
    }
  }

  const PROP = {
    tree:  { solid: true,  hp: Infinity, r: 13 },
    rock:  { solid: true,  hp: 34,       r: 12 },
    chest: { solid: true,  hp: 22,       r: 12 },
    grass: { solid: false, hp: 1,        r: 14 }
  };

  function makeProp(type, tx, ty) {
    const d = PROP[type];
    return {
      id: nextPropId++, type, tx, ty,
      x: tx * TS + TS / 2, y: ty * TS + TS - 4,
      r: d.r, hp: d.hp, maxHp: d.hp, solid: d.solid,
      destructible: d.hp !== Infinity, flash: 0,
      wiggle: H(tx, ty, 9) * 6.28
    };
  }

  // ---------------- consultas ----------------

  const tileOf = v => Math.floor(v / TS);

  function kindAt(x, y) { return KIND[terrainAt(tileOf(x), tileOf(y))]; }
  function isWall(x, y) { return terrainAt(tileOf(x), tileOf(y)) === WALL; }
  function isLiquid(x, y) { return terrainAt(tileOf(x), tileOf(y)) === LIQUID; }
  function liquidKind() { return G.Tiles.BIOMES[biome].liquid; }

  function propAtTile(tx, ty) {
    const cx = Math.floor(tx / N), cy = Math.floor(ty / N);
    const c = data.get(cx + ',' + cy) || chunkData(cx, cy);
    return c.propAt.get(tx + ',' + ty) || null;
  }

  /** ¿Hay sitio para que algo de radio r esté aquí? */
  function isFree(x, y, r = 12, allowLiquid = false) {
    const t0x = tileOf(x - r), t1x = tileOf(x + r), t0y = tileOf(y - r), t1y = tileOf(y + r);
    for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
      const t = terrainAt(tx, ty);
      if (t === WALL || (!allowLiquid && t === LIQUID)) return false;
      const p = propAtTile(tx, ty);
      if (p && G.U.dist2(x, y, p.x, p.y) < (r + p.r) ** 2) return false;
    }
    return true;
  }

  /** Objetos destructibles (incluida la hierba) que tocan un círculo. */
  function propsInCircle(x, y, r) {
    const out = [];
    const c0x = Math.floor((x - r) / CW), c1x = Math.floor((x + r) / CW);
    const c0y = Math.floor((y - r) / CW), c1y = Math.floor((y + r) / CW);
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
      const c = chunkData(cx, cy);
      for (const p of c.props) {
        if (!p.destructible || p.hp <= 0) continue;
        if (G.U.dist2(x, y, p.x, p.y) <= (r + p.r) ** 2) out.push(p);
      }
    }
    return out;
  }

  /** Roca o cofre más cercano (para apuntar cuando no hay enemigos). */
  function nearestBreakable(x, y, r) {
    let best = null, bd = r * r;
    for (const p of propsInCircle(x, y, r)) {
      if (!p.solid) continue;
      const d = G.U.dist2(x, y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /**
   * Empuja un círculo fuera de paredes y objetos sólidos (deslizando).
   * Devuelve true si ha chocado con algo.
   */
  function collide(e) {
    const r = e.r;
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      const t0x = tileOf(e.x - r), t1x = tileOf(e.x + r), t0y = tileOf(e.y - r), t1y = tileOf(e.y + r);
      for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
        if (terrainAt(tx, ty) === WALL) {
          // Punto más cercano de la caja del tile al centro del círculo.
          const bx0 = tx * TS, by0 = ty * TS, bx1 = bx0 + TS, by1 = by0 + TS;
          const qx = G.U.clamp(e.x, bx0, bx1), qy = G.U.clamp(e.y, by0, by1);
          let dx = e.x - qx, dy = e.y - qy;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          hit = true;
          if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            e.x += dx / d * (r - d); e.y += dy / d * (r - d);
          } else {
            // Centro dentro de la caja: sal por el lado más cercano.
            const l = e.x - bx0, rr = bx1 - e.x, u = e.y - by0, b = by1 - e.y;
            const m = Math.min(l, rr, u, b);
            if (m === l) e.x = bx0 - r; else if (m === rr) e.x = bx1 + r;
            else if (m === u) e.y = by0 - r; else e.y = by1 + r;
          }
        }
        const p = propAtTile(tx, ty);
        if (p && p.solid) {
          const dx = e.x - p.x, dy = e.y - p.y;
          const min = r + p.r, d2 = dx * dx + dy * dy;
          if (d2 < min * min) {
            hit = true;
            const d = Math.sqrt(d2) || 0.01;
            e.x = p.x + dx / d * min; e.y = p.y + dy / d * min;
          }
        }
      }
    }
    return hit;
  }

  /** ¿Choca un proyectil aquí? Devuelve 'wall', el prop sólido, o null. */
  function projectileBlock(x, y, r) {
    const tx = tileOf(x), ty = tileOf(y);
    if (terrainAt(tx, ty) === WALL) return 'wall';
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const p = propAtTile(tx + a, ty + b);
      if (p && p.solid && G.U.dist2(x, y, p.x, p.y) < (r + p.r) ** 2) return p;
    }
    return null;
  }

  // ---------------- daño a objetos ----------------

  function damageProp(p, amount, color = '#fff') {
    if (!p.destructible || p.hp <= 0) return false;
    p.hp -= amount;
    p.flash = 0.08;
    if (p.type !== 'grass') G.FX.spark(p.x, p.y - 10, color, 0, -1, 3);
    if (p.hp <= 0) { destroyProp(p); return true; }
    return false;
  }

  /** Rompe el objeto de esa casilla (llega por la red en cooperativo). */
  function breakAt(tx, ty) {
    const k = tx + ',' + ty;
    if (broken.has(k)) return;
    const c = data.get(Math.floor(tx / N) + ',' + Math.floor(ty / N));
    const p = c && c.props.find(o => o.tx === tx && o.ty === ty);
    if (p) destroyProp(p, true); else broken.add(k);
  }

  function destroyProp(p, fromNet = false) {
    broken.add(p.tx + ',' + p.ty);
    if (G.Coop.active && !fromNet) G.Coop.propBroken(p);
    const cx = Math.floor(p.tx / N), cy = Math.floor(p.ty / N);
    const c = data.get(cx + ',' + cy);
    if (c) {
      c.props.splice(c.props.indexOf(p), 1);
      c.propAt.delete(p.tx + ',' + p.ty);
    }
    const B = G.Tiles.BIOMES[biome];
    G.Audio.sfx(p.type === 'grass' ? 'grass' : p.type === 'chest' ? 'chest' : 'break');
    if (p.type === 'grass') {
      G.FX.burst(p.x, p.y - 6, B.grass[1], 6, 70);
      const r = Math.random();
      if (r < 0.05) G.Pickups.drop('heal', p.x, p.y);
      else if (r < 0.11) G.Pickups.drop('coin', p.x, p.y, 1);
      return;
    }
    if (p.type === 'rock') {
      G.FX.burst(p.x, p.y - 10, B.rock[1], 14, 140);
      G.FX.ring(p.x, p.y - 8, 4, 26, B.rock[2], 0.3, 3);
      const r = Math.random();
      if (r < 0.40) G.Pickups.dropXp(p.x, p.y, 6);
      if (r > 0.75) G.Pickups.drop('coin', p.x, p.y, 2);
      if (r > 0.94) G.Pickups.drop('heal', p.x + 8, p.y);
      return;
    }
    if (p.type === 'chest') {
      G.FX.burst(p.x, p.y - 10, '#f2c443', 22, 180);
      G.FX.ring(p.x, p.y - 8, 6, 46, '#f2c443', 0.45, 4);
      G.Camera.kick(0.25);
      const n = G.U.randInt(4, 7);
      for (let i = 0; i < n; i++) G.Pickups.drop('coin', p.x + G.U.rand(-14, 14), p.y + G.U.rand(-10, 10), 3);
      G.Pickups.drop(Math.random() < 0.5 ? 'heal' : 'magnet', p.x, p.y);
      G.Pickups.dropXp(p.x, p.y, 20);
    }
  }

  // ---------------- dibujo ----------------

  function chunkImage(cx, cy) {
    const k = cx + ',' + cy;
    let img = images.get(k);
    if (img) return img;
    const at = (tx, ty) => KIND[terrainAt(tx, ty)];
    // Campo continuo de "tierra"; tiles.js lo muestrea en rejilla y lo
    // interpola por píxel para que las manchas tengan bordes orgánicos.
    const S = 6 * G.Tiles.T;
    const dirtField = (gx, gy) => fbm(gx / S, gy / S, seed + 303);
    img = G.Tiles.paintChunk(cx, cy, N, at, dirtField, biome, seed);
    if (images.size > MAX_IMAGES) images.delete(images.keys().next().value);
    images.set(k, img);
    return img;
  }

  function visibleChunks(cam, pad = 0) {
    const out = [];
    const x0 = Math.floor((cam.left() - pad) / CW), x1 = Math.floor((cam.left() + cam.w + pad) / CW);
    const y0 = Math.floor((cam.top() - pad) / CW), y1 = Math.floor((cam.top() + cam.h + pad) / CW);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) out.push([cx, cy]);
    return out;
  }

  function drawGround(ctx, cam) {
    ctx.imageSmoothingEnabled = false;
    for (const [cx, cy] of visibleChunks(cam)) {
      // +1 de solape: con escalas no enteras evita juntas entre chunks.
      ctx.drawImage(chunkImage(cx, cy), cx * CW, cy * CW, CW + 1, CW + 1);
    }
  }

  /** Brillos animados sobre el agua / burbujas de la lava. */
  function drawLiquid(ctx, cam, t) {
    const B = G.Tiles.BIOMES[biome];
    const lava = B.liquid === 'lava';
    ctx.fillStyle = B.foam;
    const P = G.Sprites.PX;
    for (const [cx, cy] of visibleChunks(cam)) {
      const c = chunkData(cx, cy);
      for (let i = 0; i < c.liquids.length; i += 2) {
        const tx = c.liquids[i], ty = c.liquids[i + 1];
        const x = tx * TS, y = ty * TS;
        if (!cam.sees(x + TS / 2, y + TS / 2, TS)) continue;
        const ph = H(tx, ty, 77) * 6.28;
        const k = (Math.sin(t * (lava ? 2.2 : 1.6) + ph) + 1) / 2;
        ctx.globalAlpha = lava ? 0.35 + k * 0.5 : k * 0.7;
        const sx = x + Math.floor(H(tx, ty, 78) * 12 + 2) * P;
        const sy = y + Math.floor(H(tx, ty, 79) * 12 + 2) * P;
        ctx.fillRect(sx + Math.round(k * 2) * P, sy, P * (lava ? 2 : 3), P);
        if (lava && k > 0.8) ctx.fillRect(sx, sy - P * 2, P, P);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Props visibles, para mezclarlos en el orden por Y con las entidades. */
  function visibleProps(cam) {
    const out = [];
    for (const [cx, cy] of visibleChunks(cam, 60)) {
      for (const p of chunkData(cx, cy).props) if (cam.sees(p.x, p.y, 70)) out.push(p);
    }
    return out;
  }

  function drawProp(ctx, p, t) {
    const P = G.Sprites.PX;
    const variant = p.type === 'grass' ? (Math.sin(t * 2.4 + p.wiggle) > 0.55 ? 1 : 0)
                  : p.type === 'rock' ? (p.hp < p.maxHp * 0.5 ? 1 : 0) : 0;
    const img = G.Tiles.propSprite(biome, p.type, variant);
    const w = img.width * P, h = img.height * P;
    if (p.type !== 'grass') {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 1.1, p.r * 0.38, 0, 0, 6.2832); ctx.fill();
    }
    ctx.save();
    if (p.flash > 0) ctx.filter = 'brightness(2.2)';
    ctx.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - h + (p.type === 'grass' ? 4 : 2)), w, h);
    ctx.restore();
  }

  function update(dt, cam) {
    for (const [cx, cy] of visibleChunks(cam, 60)) {
      for (const p of chunkData(cx, cy).props) if (p.flash > 0) p.flash -= dt;
    }
  }

  // ---------------- control ----------------

  function reset(s) {
    seed = (s | 0) || 1;
    data.clear(); images.clear(); broken.clear();
  }

  function setBiome(i) {
    const b = ((i % G.Tiles.BIOMES.length) + G.Tiles.BIOMES.length) % G.Tiles.BIOMES.length;
    if (b === biome) return;
    biome = b;
    images.clear();          // el terreno es el mismo: sólo cambia la paleta
  }

  function biomeName() { return G.Tiles.BIOMES[biome].name; }

  /** Viñeta en coordenadas de pantalla. */
  function drawVignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  return {
    TS, CW, reset, setBiome, biomeName, liquidKind,
    kindAt, isWall, isLiquid, isFree, collide, projectileBlock, propsInCircle, nearestBreakable,
    damageProp, breakAt, update, drawGround, drawLiquid, visibleProps, drawProp, drawVignette,
    get biome() { return biome; }
  };
})();
