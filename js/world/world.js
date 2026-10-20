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
 *   altar   altar de poder: al tocarlo da un poder temporal (una vez)
 *   spring  manantial: cura mientras estás encima; se agota y se recarga
 *   bigchest cofre con candado: se abre quedándote al lado unos segundos
 *   trap    trampa (veneno, pegajosa, explosiva): salta al pisarla, también
 *           con los enemigos
 *   (la lógica de los interactivos está en systems/interact.js)
 *
 * Grieta: setArena() convierte una zona lejana del mapa en una arena redonda
 * cerrada por paredes, donde se lucha contra un legendario (systems/rift.js).
 *
 * Los Pokémon voladores, los fantasma y los jefes ignoran el terreno.
 *
 * Generadores (world/layouts.js): cada bioma de la run tiene su forma de
 * terreno (campo, cueva, ríos de lava). Al cambiar de bioma con otro
 * generador, el terreno nuevo se abre paso desde el jugador detrás de la onda
 * (sweep): dentro del círculo, la capa nueva; fuera, la vieja, hasta que el
 * círculo pasa de la pantalla. Cada capa tiene su paleta y sus cachés. En
 * cooperativo sólo cambia la paleta (cada uno vería la onda desde su sitio).
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

  let seed = 1, biome = 0;                 // biome: la paleta de la capa actual (cur.biome)
  let arena = null;                        // { tx, ty, r } en tiles
  /*
   * Capa: un generador con su paleta y sus cachés ("cx,cy" -> ...):
   *   terr    terreno del chunk (Uint8Array), sin objetos
   *   data    datos del chunk: terreno, objetos, líquidos
   *   images  canvas horneado
   *   broken  objetos destruidos: "tx,ty"
   * (Donde empieza la onda, el generador pone su sala, su isla o su trozo de
   * tierra del principio: el jugador ya está en un sitio libre y unido a los
   * demás. Los enemigos que queden dentro de una pared salen a la casilla libre
   * más cercana: unstick.)
   */
  // anchor: donde empieza su terreno (el jugador al cambiar de bioma): el generador lo hace suyo (layouts.js make).
  const ORIGIN = { tx: 0, ty: 0 };
  const newLayer = (layout, bi, anchor = ORIGIN) => ({ layout, anchor, gen: G.Layouts.make(layout, anchor), biome: bi,
    terr: new Map(), data: new Map(), images: new Map(), broken: new Set() });
  let cur = newLayer('plains', 0), old = null;
  // Onda del generador nuevo: { ox, oy, r, speed, max } en px del mundo. Llega al
  // borde de la pantalla en SWEEP_TIME (como el anillo de game.js) y sigue un chunk más.
  let sweep = null, settling = false;
  const SWEEP_TIME = 0.7;
  // Cambio de bioma: durante FADE segundos se funde la paleta vieja con la nueva.
  const FADE = 2.6;
  let fade = null;                         // { from, images, t }
  const MAX_IMAGES = 48, MAX_DATA = 400;
  let nextPropId = 1;

  // ---------------- ruido ----------------

  const H = (x, y, s) => G.U.hash(x, y, s);

  const fbm = G.Layouts.fbm;                // el mismo ruido que los generadores

  /** Terreno "puro" de un tile (sin caché). */
  function arenaDist(tx, ty) { return arena ? Math.hypot(tx - arena.tx, ty - arena.ty) : Infinity; }

  /**
   * Pasillo libre de la arena: donde aparecéis (sur) y el legendario (norte).
   * Con `clear` en el tema, además un claro donde aterriza Arceus (5 al norte).
   */
  function arenaSafe(tx, ty) {
    const lx = tx - arena.tx, ly = ty - arena.ty;
    return (Math.abs(lx) <= 2 && ly >= -6 && ly <= 5) || Math.hypot(lx, ly) < 2.5 ||
           (arena.th.clear > 0 && Math.hypot(lx, ly + 5) < arena.th.clear);
  }

  function terrainRaw(tx, ty, L = cur) {
    const ad = arenaDist(tx, ty);
    if (ad < arena_outer()) {
      if (ad >= arena.r) return WALL;
      if (arenaSafe(tx, ty)) return FLOOR;
      const th = arena.th;
      // Columnas de 2×2 (cobertura) y charcos según el tipo de la arena.
      if (th.pillars && ad < arena.r - 2 && H(tx >> 1, ty >> 1, seed + 31 + arena.tx) < th.pillars) return WALL;
      if (th.pools && ad < arena.r - 1.5 && fbm(tx / 3.2, ty / 3.2, seed + 37 + arena.tx) < th.pools) return LIQUID;
      return FLOOR;
    }
    return L.gen.terrain(tx, ty, seed);              // (todos traen el claro inicial)
  }

  // ---------------- datos de chunk ----------------

  /** Terreno de un chunk (sin objetos): una vez por capa; los objetos miran el de sus vecinos. */
  function terrChunk(cx, cy, L) {
    const k = cx + ',' + cy;
    let t = L.terr.get(k);
    if (t) return t;
    t = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) t[j * N + i] = terrainRaw(cx * N + i, cy * N + j, L);
    if (L.terr.size > MAX_DATA * 2) L.terr.delete(L.terr.keys().next().value);
    L.terr.set(k, t);
    return t;
  }

  function terrOf(tx, ty, L) {
    const cx = Math.floor(tx / N), cy = Math.floor(ty / N);
    return terrChunk(cx, cy, L)[(ty - cy * N) * N + (tx - cx * N)];
  }

  function chunkData(cx, cy, L = cur) {
    const k = cx + ',' + cy;
    let c = L.data.get(k);
    if (c) return c;

    c = { cx, cy, terr: terrChunk(cx, cy, L),
          props: [], propAt: new Map(), liquids: [] };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (c.terr[j * N + i] === LIQUID) c.liquids.push(cx * N + i, cy * N + j);
    }
    if (L.data.size > MAX_DATA) L.data.delete(L.data.keys().next().value);
    L.data.set(k, c);
    placeProps(c, L);
    return c;
  }

  /** Capa de esta casilla: en plena onda, la nueva dentro del círculo y la vieja fuera. */
  function layerAt(tx, ty) {
    if (!sweep) return cur;
    const dx = tx * TS + TS / 2 - sweep.ox, dy = ty * TS + TS / 2 - sweep.oy;
    return dx * dx + dy * dy <= sweep.r * sweep.r ? cur : old;
  }

  /** ¿El chunk entero cae en una capa? 'cur' | 'old' | 'both' (para no filtrar casilla a casilla). */
  function chunkSide(cx, cy) {
    if (!sweep) return 'cur';
    const x0 = cx * CW, y0 = cy * CW, x1 = x0 + CW, y1 = y0 + CW;
    const nx = G.U.clamp(sweep.ox, x0, x1) - sweep.ox, ny = G.U.clamp(sweep.oy, y0, y1) - sweep.oy;
    const fx = Math.max(Math.abs(x0 - sweep.ox), Math.abs(x1 - sweep.ox));
    const fy = Math.max(Math.abs(y0 - sweep.oy), Math.abs(y1 - sweep.oy));
    const r2 = sweep.r * sweep.r;
    if (fx * fx + fy * fy <= r2) return 'cur';
    if (nx * nx + ny * ny > r2) return 'old';
    return 'both';
  }

  /** Objetos de un chunk tal como están ahora (en plena onda, cada uno de la capa de su casilla). */
  function chunkProps(cx, cy) {
    const side = chunkSide(cx, cy);
    if (side !== 'both') return chunkData(cx, cy, side === 'cur' ? cur : old).props;
    return chunkData(cx, cy, cur).props.filter(p => layerAt(p.tx, p.ty) === cur)
      .concat(chunkData(cx, cy, old).props.filter(p => layerAt(p.tx, p.ty) === old));
  }

  function terrainAt(tx, ty) { return terrOf(tx, ty, layerAt(tx, ty)); }

  const arena_outer = () => (arena ? arena.r + 7 : 0);

  function placeProps(c, L) {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (c.terr[j * N + i] !== FLOOR) continue;
      const tx = c.cx * N + i, ty = c.cy * N + j;
      const fromStart = Math.hypot(tx - L.anchor.tx, ty - L.anchor.ty);
      if (fromStart < 7) continue;                                     // nada encima del jugador al empezar
      if (L.broken.has(tx + ',' + ty)) continue;

      // Necesita suelo alrededor para no pegarse a paredes / agua.
      let open = true;
      for (let b = -1; b <= 1 && open; b++) for (let a = -1; a <= 1; a++)
        if (terrOf(tx + a, ty + b, L) !== FLOOR) { open = false; break; }
      // Fuera del campo abierto, los sólidos al azar (árboles, rocas, cofres...)
      // sólo con 5×5 de suelo: así no tapan pasillos ni senderos.
      const roomy = open && (L.layout === 'plains' || roomyAt(tx, ty, L));

      // Dentro de la arena: la decoración de su tipo (y nada en el pasillo).
      const ad = arenaDist(tx, ty);
      if (ad < arena_outer() + 2) {
        if (!arena || ad >= arena.r - 1.2 || arenaSafe(tx, ty)) continue;
        const pr = arena.th.props, hh = H(tx, ty, seed + 777);
        let at = null;
        if (open && hh < (pr.tree || 0)) at = 'tree';
        else if (open && hh < (pr.tree || 0) + (pr.rock || 0)) at = 'rock';
        else if (hh > 1 - (pr.grass || 0)) at = 'grass';
        if (at) { const p = makeProp(at, tx, ty, 0, L); c.props.push(p); if (p.solid) c.propAt.set(tx + ',' + ty, p); }
        continue;
      }

      const h = H(tx, ty, seed + 404);
      const grove = fbm(tx / 10, ty / 10, seed + 505) > 0.6;
      let type = null, kind = 0;
      // Lo que pone el generador (los cristales del borde de la cueva...).
      type = L.gen.edgeProp(tx, ty, seed, (x, y) => terrOf(x, y, L));
      // Interactivos (raros), lejos del claro del principio.
      const hs = H(tx, ty, seed + 909);
      if (!type && roomy && fromStart > 12 && hs < 0.0032) {
        type = hs < 0.0004 ? 'altar' : hs < 0.0008 ? 'spring' : hs < 0.0011 ? 'bigchest' : 'trap';
        kind = Math.floor(H(tx, ty, seed + 910) * (type === 'altar' ? 4 : 3));
      }
      if (type) { /* ya elegido */ }
      else if (roomy && h < (grove ? 0.07 : 0.006)) type = 'tree';
      else if (roomy && h > 0.992) type = 'rock';
      else if (roomy && h > 0.985 && h <= 0.992 && H(tx, ty, seed + 606) < 0.07) type = 'chest';
      else if (fbm(tx / 5, ty / 5, seed + 707) > 0.66 && H(tx, ty, seed + 808) < 0.75) type = 'grass';
      if (!type) continue;

      const p = makeProp(type, tx, ty, kind, L);
      c.props.push(p);
      if (p.solid) c.propAt.set(tx + ',' + ty, p);
    }
  }

  /** ¿Suelo en los 5×5 de alrededor? */
  function roomyAt(tx, ty, L) {
    for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) if (terrOf(tx + a, ty + b, L) !== FLOOR) return false;
    return true;
  }

  const PROP = {
    tree:  { solid: true,  hp: Infinity, r: 13 },
    rock:  { solid: true,  hp: 34,       r: 12 },
    chest: { solid: true,  hp: 22,       r: 12 },
    grass: { solid: false, hp: 1,        r: 14 },
    altar:    { solid: true,  hp: Infinity, r: 9 },
    spring:   { solid: false, hp: Infinity, r: 22, flat: true },
    bigchest: { solid: true,  hp: Infinity, r: 14 },
    trap:     { solid: false, hp: Infinity, r: 9, flat: true }
  };
  const SPECIAL = new Set(['altar', 'spring', 'bigchest', 'trap']);

  function makeProp(type, tx, ty, kind = 0, layer = cur) {
    const d = PROP[type];
    return {
      id: nextPropId++, type, tx, ty, kind, layer,
      x: tx * TS + TS / 2, y: ty * TS + TS - 4,
      r: d.r, hp: d.hp, maxHp: d.hp, solid: d.solid, flat: !!d.flat,
      destructible: d.hp !== Infinity, flash: 0,
      wiggle: H(tx, ty, 9) * 6.28,
      used: false, charge: 1, open: 0          // altar / manantial / cofre con candado
    };
  }

  // ---------------- consultas ----------------

  const tileOf = v => Math.floor(v / TS);

  function kindAt(x, y) { return KIND[terrainAt(tileOf(x), tileOf(y))]; }
  function isWall(x, y) { return terrainAt(tileOf(x), tileOf(y)) === WALL; }
  function isLiquid(x, y) { return terrainAt(tileOf(x), tileOf(y)) === LIQUID; }
  function liquidKind() { return G.Tiles.BIOMES[biome].liquid; }

  /**
   * Efecto del charco actual sobre un Pokémon de estos tipos:
   *   { slow, dmg, every, color, slide }  (dmg en % de vida máxima)
   * Los de su tipo no sufren el suyo (Fuego en lava, Veneno en veneno...).
   */
  const LIQ = {
    water: { slow: 0.6, immune: ['water'] },     // los de tipo agua nadan sin frenarse
    swamp: { slow: 0.45, immune: ['water'] },
    lava:   { dmg: 0.06, flat: 5, every: 0.5, color: '#ff8a3d', immune: ['fire'] },
    poison: { dmg: 0.035, flat: 3, every: 0.5, color: '#c86bdc', immune: ['poison', 'steel'] },
    spark:  { dmg: 0.045, flat: 4, every: 0.7, color: '#ffe14d', immune: ['electric', 'ground'] },
    ice:    { slide: true, immune: ['ice'] }
  };
  /** (x, y): dónde está; en plena onda, el líquido es el de la capa de esa casilla. */
  function liquidEffect(types, x, y) {
    const kind = x == null ? liquidKind() : G.Tiles.BIOMES[layerAt(tileOf(x), tileOf(y)).biome].liquid;
    const e = LIQ[kind] || LIQ.water;
    if (e.immune && types && types.some(t => e.immune.includes(t))) return {};
    return e;
  }

  function propAtTile(tx, ty) {
    const cx = Math.floor(tx / N), cy = Math.floor(ty / N);
    const L = layerAt(tx, ty);
    const c = L.data.get(cx + ',' + cy) || chunkData(cx, cy, L);
    return c.propAt.get(tx + ',' + ty) || null;
  }

  /** ¿Se puede pasar por esta casilla andando? (pathing.js) */
  function walkable(tx, ty) {
    const t = terrainAt(tx, ty);
    if (t === WALL) return false;
    if (t === LIQUID && (LIQ[G.Tiles.BIOMES[layerAt(tx, ty).biome].liquid] || {}).dmg) return false;   // lava, veneno, descarga
    const p = propAtTile(tx, ty);
    return !(p && p.solid);
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
      for (const p of chunkProps(cx, cy)) {
        if (!p.destructible || p.hp <= 0) continue;
        if (G.U.dist2(x, y, p.x, p.y) <= (r + p.r) ** 2) out.push(p);
      }
    }
    return out;
  }

  /** Objetos interactivos (altares, manantiales, cofres con candado, trampas) cerca. */
  function specialsNear(x, y, r) {
    const out = [];
    const c0x = Math.floor((x - r) / CW), c1x = Math.floor((x + r) / CW);
    const c0y = Math.floor((y - r) / CW), c1y = Math.floor((y + r) / CW);
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
      for (const p of chunkProps(cx, cy)) {
        if (SPECIAL.has(p.type) && G.U.dist2(x, y, p.x, p.y) <= (r + p.r) ** 2) out.push(p);
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
    const L = layerAt(tx, ty);
    if (L.broken.has(k)) return;
    const c = L.data.get(Math.floor(tx / N) + ',' + Math.floor(ty / N));
    const p = c && c.props.find(o => o.tx === tx && o.ty === ty);
    if (p) destroyProp(p, true); else L.broken.add(k);
  }

  function destroyProp(p, fromNet = false) {
    const L = p.layer;
    L.broken.add(p.tx + ',' + p.ty);
    if (G.Coop.active && !fromNet) G.Coop.propBroken(p);
    const cx = Math.floor(p.tx / N), cy = Math.floor(p.ty / N);
    const c = L.data.get(cx + ',' + cy);
    if (c) {
      const i = c.props.indexOf(p);
      if (i >= 0) c.props.splice(i, 1);
      c.propAt.delete(p.tx + ',' + p.ty);
    }
    const B = G.Tiles.BIOMES[L.biome];
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
      if (Math.random() < 0.08) G.Pickups.drop('item', p.x, p.y - 12, G.Items.roll());
      return;
    }
    if (p.type === 'bigchest') {
      // Botín grande: monedas, tickets y experiencia para subir un nivel.
      G.FX.burst(p.x, p.y - 12, '#f2c443', 34, 220);
      G.FX.ring(p.x, p.y - 8, 6, 80, '#f2c443', 0.6, 5);
      G.Camera.kick(0.4);
      for (let i = 0; i < 9; i++) G.Pickups.drop('coin', p.x + G.U.rand(-22, 22), p.y + G.U.rand(-14, 14), 4);
      const tk = G.U.randInt(1, 3);
      for (let i = 0; i < tk; i++) G.Pickups.drop('ticket', p.x + G.U.rand(-16, 16), p.y + G.U.rand(-10, 10), 1);
      if (Math.random() < 0.15) G.Pickups.drop('ticket10', p.x, p.y - 10, 1);
      if (Math.random() < 0.5) G.Pickups.drop('item', p.x + 14, p.y - 14, G.Items.roll());
      G.Pickups.dropXp(p.x, p.y, G.Game.levelXp());
      G.Progress.event('chest');
      return;
    }
    if (p.type === 'trap') G.Interact.trapEffect(p);
  }

  // ---------------- dibujo ----------------

  function chunkImage(cx, cy, L = cur, bi = L.biome, cache = L.images) {
    const k = cx + ',' + cy;
    let img = cache.get(k);
    if (img) return img;
    const at = (tx, ty) => KIND[terrOf(tx, ty, L)];
    // Campo continuo de "tierra"; tiles.js lo muestrea en rejilla y lo
    // interpola por píxel para que las manchas tengan bordes orgánicos.
    const S = 6 * G.Tiles.T;
    const dirtField = (gx, gy) => fbm(gx / S, gy / S, seed + 303);
    img = G.Tiles.paintChunk(cx, cy, N, at, dirtField, bi, seed);
    if (cache.size > MAX_IMAGES) cache.delete(cache.keys().next().value);
    cache.set(k, img);
    return img;
  }

  /** 0..1 del fundido de bioma (suavizado), o null si no hay. */
  function fadeK() { if (!fade) return null; const x = Math.min(1, fade.t / FADE); return x * x * (3 - 2 * x); }

  function visibleChunks(cam, pad = 0) {
    const out = [];
    const x0 = Math.floor((cam.left() - pad) / CW), x1 = Math.floor((cam.left() + cam.w + pad) / CW);
    const y0 = Math.floor((cam.top() - pad) / CW), y1 = Math.floor((cam.top() + cam.h + pad) / CW);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) out.push([cx, cy]);
    return out;
  }

  function drawGround(ctx, cam) {
    ctx.imageSmoothingEnabled = false;
    if (sweep) { drawSweep(ctx, cam); return; }
    const k = fadeK();
    for (const [cx, cy] of visibleChunks(cam)) {
      // +1 de solape: con escalas no enteras evita juntas entre chunks.
      if (k == null) { ctx.drawImage(chunkImage(cx, cy), cx * CW, cy * CW, CW + 1, CW + 1); continue; }
      // Fundido: el bioma viejo debajo y el nuevo apareciendo encima.
      ctx.drawImage(chunkImage(cx, cy, cur, fade.from, fade.images), cx * CW, cy * CW, CW + 1, CW + 1);
      ctx.globalAlpha = k;
      ctx.drawImage(chunkImage(cx, cy), cx * CW, cy * CW, CW + 1, CW + 1);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * En plena onda: la capa vieja entera y, recortada por el círculo, sólo los
   * chunks de la nueva que ya toca (así no se hornean todos en el mismo fotograma).
   */
  function drawSweep(ctx, cam) {
    const vis = visibleChunks(cam);
    for (const [cx, cy] of vis) {
      if (chunkSide(cx, cy) !== 'cur') ctx.drawImage(chunkImage(cx, cy, old), cx * CW, cy * CW, CW + 1, CW + 1);
    }
    ctx.save();
    ctx.beginPath(); ctx.arc(sweep.ox, sweep.oy, sweep.r, 0, 6.2832); ctx.clip();
    for (const [cx, cy] of vis) {
      if (chunkSide(cx, cy) !== 'old') ctx.drawImage(chunkImage(cx, cy, cur), cx * CW, cy * CW, CW + 1, CW + 1);
    }
    ctx.restore();
  }

  /** Brillos animados sobre el agua / burbujas de la lava (y del veneno y la electricidad). */
  function drawLiquid(ctx, cam, t) {
    for (const L of sweep ? [cur, old] : [cur]) drawLiquidOf(ctx, cam, t, L);
    ctx.globalAlpha = 1;
  }

  function drawLiquidOf(ctx, cam, t, L) {
    const B = G.Tiles.BIOMES[L.biome];
    const lava = B.liquid === 'lava' || B.liquid === 'poison' || B.liquid === 'spark';
    ctx.fillStyle = B.foam;
    const P = G.Sprites.PX;
    for (const [cx, cy] of visibleChunks(cam)) {
      const side = chunkSide(cx, cy);
      if ((side === 'cur' && L !== cur) || (side === 'old' && L !== old)) continue;
      const c = chunkData(cx, cy, L);
      for (let i = 0; i < c.liquids.length; i += 2) {
        const tx = c.liquids[i], ty = c.liquids[i + 1];
        const x = tx * TS, y = ty * TS;
        if (!cam.sees(x + TS / 2, y + TS / 2, TS)) continue;
        if (side === 'both' && layerAt(tx, ty) !== L) continue;
        const ph = H(tx, ty, 77) * 6.28;
        const k = (Math.sin(t * (lava ? 2.2 : 1.6) + ph) + 1) / 2;
        ctx.globalAlpha = lava ? 0.35 + k * 0.5 : k * 0.7;
        const sx = x + Math.floor(H(tx, ty, 78) * 12 + 2) * P;
        const sy = y + Math.floor(H(tx, ty, 79) * 12 + 2) * P;
        ctx.fillRect(sx + Math.round(k * 2) * P, sy, P * (lava ? 2 : 3), P);
        if (lava && k > 0.8) ctx.fillRect(sx, sy - P * 2, P, P);
      }
    }
  }

  /** Props visibles, para mezclarlos en el orden por Y con las entidades. */
  function visibleProps(cam) {
    const out = [];
    for (const [cx, cy] of visibleChunks(cam, 60)) {
      for (const p of chunkProps(cx, cy)) if (cam.sees(p.x, p.y, 70)) out.push(p);
    }
    return out;
  }

  function drawProp(ctx, p, t) {
    const P = G.Sprites.PX;
    const variant = p.type === 'grass' ? (Math.sin(t * 2.4 + p.wiggle) > 0.55 ? 1 : 0)
                  : p.type === 'rock' ? (p.hp < p.maxHp * 0.5 ? 1 : 0)
                  : p.type === 'altar' ? p.kind * 2 + (p.used ? 1 : 0)
                  : p.type === 'spring' ? (p.charge < 0.15 ? 1 : 0)
                  : p.type === 'trap' ? p.kind : 0;
    const img = G.Tiles.propSprite(p.layer.biome, p.type, variant);
    const w = img.width * P, h = img.height * P;
    if (p.flat) {
      // Planos (manantial, trampa): pegados al suelo, centrados en su casilla.
      ctx.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - 8 - h / 2), w, h);
      if (p.type === 'spring' && p.charge >= 0.15 && Math.sin(t * 3 + p.wiggle) > 0.92) {
        G.FX.twinkle(p.x + G.U.rand(-20, 20), p.y - 8 + G.U.rand(-6, 6));
      }
      return;
    }
    if (p.type === 'altar' && !p.used) {
      // Halo del orbe, latiendo.
      const col = ['#ff5f6d', '#5fd4ff', '#ff8ad8', '#ffd23f'][p.kind];
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.sin(t * 3 + p.wiggle) * 0.1;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(p.x, p.y - h + 11 * P, 13, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    if (p.type === 'bigchest' && p.open > 0) {
      ctx.save();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y - h / 2, 26, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, p.open / G.Interact.CHEST_TIME));
      ctx.stroke();
      ctx.restore();
    }
    if (p.type !== 'grass') {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 1.1, p.r * 0.38, 0, 0, 6.2832); ctx.fill();
    }
    ctx.save();
    const x = Math.round(p.x - w / 2), y = Math.round(p.y - h + (p.type === 'grass' ? 4 : 2));
    const k = p.layer === cur ? fadeK() : null;
    if (k != null) {
      // El objeto viejo se desvanece mientras aparece el nuevo.
      const old = G.Tiles.propSprite(fade.from, p.type, variant);
      ctx.globalAlpha = 1 - k;
      ctx.drawImage(old, Math.round(p.x - old.width * P / 2), Math.round(p.y - old.height * P + (p.type === 'grass' ? 4 : 2)), old.width * P, old.height * P);
      ctx.globalAlpha = k;
    }
    ctx.drawImage(img, x, y, w, h);
    if (p.flash > 0) { ctx.globalAlpha = 0.6; ctx.drawImage(G.Sprites.white(img), x, y, w, h); }
    ctx.restore();
  }

  function update(dt, cam) {
    if (fade && (fade.t += dt) >= FADE) fade = null;
    if (sweep && (sweep.r += sweep.speed * dt) >= sweep.max) finishSweep();
    for (const [cx, cy] of visibleChunks(cam, 60)) {
      for (const p of chunkProps(cx, cy)) if (p.flash > 0) p.flash -= dt;
    }
  }

  /** Acaba la onda: lo que quede de la capa vieja (ya fuera de la pantalla) pasa a la nueva de golpe. */
  function finishSweep() {
    if (!sweep) return;
    sweep = null; old = null;
    settling = true;
  }

  /**
   * game.js ya ha sacado de las paredes a quien hiciera falta: si la onda ha
   * acabado, deja de avisar. ¿Ha terminado ahora? (entonces, a recalcular caminos)
   */
  function settled() {
    if (sweep || !settling) return false;
    settling = false;
    return true;
  }

  /**
   * Casilla libre más cercana para un círculo de radio r (en anillos de casillas,
   * hasta MAX_PUSH): para sacar de una pared a quien la onda haya dejado dentro.
   * Mejor en suelo; en un charco (o en la lava) sólo si no hay otra.
   */
  const MAX_PUSH = 20;                     // (en la cueva, la roca entre salas puede ser gruesa)
  function freeSpot(x, y, r) {
    return ringSearch(x, y, r, false) || ringSearch(x, y, r, true);
  }

  function ringSearch(x, y, r, allowLiquid) {
    const tx0 = tileOf(x), ty0 = tileOf(y);
    for (let d = 1; d <= MAX_PUSH; d++) {
      let best = null, bd = Infinity;
      for (let b = -d; b <= d; b++) for (let a = -d; a <= d; a++) {
        if (Math.max(Math.abs(a), Math.abs(b)) !== d) continue;
        const px = (tx0 + a) * TS + TS / 2, py = (ty0 + b) * TS + TS / 2;
        if (!isFree(px, py, r, allowLiquid)) continue;
        const dd = (px - x) ** 2 + (py - y) ** 2;
        if (dd < bd) { bd = dd; best = [px, py]; }
      }
      if (best) return best;
    }
    return null;
  }

  /**
   * Si la onda le ha dejado dentro de una pared o un objeto sólido, o en un
   * líquido que hace daño (lava, veneno, descarga: el agua no, se nada), lo saca.
   * ¿Lo ha movido?
   * En plena onda: sólo a quien ya está dentro del círculo, y buscando sitio en
   * el terreno NUEVO (si no, lo dejaría en lo viejo de fuera del círculo y la
   * onda lo volvería a empujar fotograma a fotograma: parecería que sale volando).
   * Si el sitio queda fuera del círculo, el círculo crece hasta él.
   */
  function unstick(e) {
    const tx = tileOf(e.x), ty = tileOf(e.y);
    if (sweep && layerAt(tx, ty) !== cur) return false;          // aún no le ha llegado la onda
    const saved = sweep;
    sweep = null;                                                 // todo lo que sigue, con la capa nueva
    try {
      const r = Math.max(6, e.r * 0.6);
      // (A los de su tipo no les hace nada: Fuego en la lava, Veneno en el veneno...)
      const burning = terrainAt(tx, ty) === LIQUID && !!liquidEffect(e.types || (e.mon && e.mon.types), e.x, e.y).dmg;
      if (!burning && isFree(e.x, e.y, r, true)) return false;
      // Fuera del líquido; si no hay suelo cerca (MAX_PUSH), se queda: en el líquido se puede andar.
      const p = burning ? ringSearch(e.x, e.y, r, false) : freeSpot(e.x, e.y, r);
      if (!p) return false;
      e.x = p[0]; e.y = p[1];
      if (saved) saved.r = Math.max(saved.r, Math.hypot(p[0] - saved.ox, p[1] - saved.oy) + TS);
      return true;
    } finally {
      sweep = saved;
    }
  }

  // ---------------- control ----------------

  function reset(s) {
    seed = (s | 0) || 1;
    cur = newLayer('plains', biome); old = null; sweep = null; settling = false;
    fade = null; arena = null;
  }

  /**
   * @param i        bioma (G.Tiles.ARENA y siguientes son las arenas de la grieta)
   * @param instant  sin fundido (al empezar una run)
   * Una run cambia de bioma cada 4 min y recorre toda la lista; al acabarse,
   * vuelve a empezar. (Antes, pasado el último, hacia el minuto 84, se pedía
   * un bioma que no existe: pantalla negra, el juego roto y niveles sin fin.)
   */
  const normBiome = i => { const n = G.Tiles.BIOMES.length; return ((i % n) + n) % n; };

  function setBiome(i, instant = false) {
    if (instant) finishSweep();
    const b = normBiome(i);
    if (b === biome) return;
    // El terreno es el mismo: sólo cambia la paleta, fundiéndose poco a poco.
    fade = instant ? null : { from: biome, images: cur.images, t: 0 };
    biome = cur.biome = b;
    cur.images = new Map();
  }

  /** Generador de terreno de golpe (al empezar la run): 'plains' | 'cave' | 'lava'. */
  function setLayout(layout) {
    finishSweep();
    if (layout === cur.layout) return;
    cur = newLayer(layout, biome);
    fade = null;
  }

  /**
   * Bioma i-ésimo de la run (cada 4 min): la paleta y, si su generador es otro,
   * el terreno nuevo, que se abre paso desde (x, y) detrás de la onda. En
   * cooperativo, sólo la paleta: ver arriba.
   */
  function changeBiome(i, x, y) {
    const b = G.Tiles.runBiome(i);                     // el i-ésimo de la run (G.Tiles.RUN)
    const layout = G.Coop.active ? cur.layout : G.Layouts.forBiome(b);
    // Mismo terreno, otra paleta: el líquido puede pasar a quemar (el agua de las charcas, lava): a mirar quién está dentro.
    if (layout === cur.layout) { setBiome(b); settling = true; return; }
    finishSweep();
    fade = null;
    old = cur;
    cur = newLayer(layout, b, { tx: tileOf(x), ty: tileOf(y) });
    biome = b;
    const reach = G.Camera.outerRadius();
    sweep = { ox: x, oy: y, r: 0, speed: reach / SWEEP_TIME, max: reach + CW };
    settling = true;
  }

  /**
   * En la grieta o en la Sentencia, el nombre de la arena; en el mapa, el del sitio.
   * (No vale mirar `arena`: al volver de la grieta se queda puesta.)
   */
  function biomeName() {
    const B = G.Tiles.BIOMES[biome];
    return G.Rift.inArena || G.Judgment.active ? B.name : (B.place || B.name);
  }

  /** Viñeta en coordenadas de pantalla. */
  function drawVignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  return {
    TS, CW, reset, setBiome, setLayout, changeBiome, unstick, freeSpot, settled, biomeName, liquidKind, liquidEffect, walkable,
    kindAt, isWall, isLiquid, isFree, collide, projectileBlock, propsInCircle, nearestBreakable,
    damageProp, breakAt, specialsNear, update,
    breakProp(p) { if (!p.layer.broken.has(p.tx + ',' + p.ty)) destroyProp(p); },
    /** Arena de la grieta: { tx, ty, r } (en tiles) o null. */
    setArena(a) {
      finishSweep();
      arena = a;
      if (!a) return;
      a.th = G.Tiles.ARENA_THEMES[a.type] || G.Tiles.ARENA_THEMES.normal;
      // Olvida los chunks de esa zona (si se hubieran generado antes).
      const R = a.r + 9;
      for (const k of [...cur.terr.keys(), ...cur.data.keys(), ...cur.images.keys()]) {
        const [cx, cy] = k.split(',').map(Number);
        if (Math.abs(cx * N + N / 2 - a.tx) < R + N && Math.abs(cy * N + N / 2 - a.ty) < R + N) {
          cur.terr.delete(k); cur.data.delete(k); cur.images.delete(k);
        }
      }
    },
    get arena() { return arena; }, drawGround, drawLiquid, visibleProps, drawProp, drawVignette,
    get biome() { return biome; }, get layout() { return cur.layout; },
    /**
     * Desde que empieza la onda hasta que game.js llama a settled() con la onda
     * acabada: hay que mirar quién ha quedado dentro de una pared (aunque la onda
     * la haya cortado una grieta o la Sentencia, que no pasan por settle()).
     */
    get settling() { return settling; }
  };
})();
