/* Generadores de terreno por bioma (js/world/layouts.js): deterministas,
 * conectados (pasillos de al menos 3 casillas, sin zonas cerradas) y rápidos. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = f => fs.readFileSync(path.join(root, f), 'utf8');

/**
 * Se cargan tal cual, fuera de node:vm: dentro, cada llamada cuesta unas 100
 * veces más que en el navegador (y aquí se generan cientos de miles de casillas).
 * Cada archivo de tests va en su propio proceso, así no ensucia a los demás.
 */
function boot() {
  globalThis.window = globalThis;
  globalThis.G = {};
  for (const f of ['js/core/util.js', 'js/world/layouts.js']) (0, eval)(source(f));
  return globalThis.G;
}

const G = boot();
const L = G.Layouts;
const FLOOR = 0, WALL = 1, LIQUID = 2;
const SEEDS = [1, 77, 4242, 987654];

/**
 * Casilla por la que se puede andar sin daño (los árboles de los rincones también bloquean).
 * `land`: sólo por tierra (en las islas, el agua frena: se mira que la tierra ya las una).
 */
function walkable(lay, tx, ty, seed, land = false) {
  const t = lay.terrain(tx, ty, seed);
  if (t === WALL) return false;
  if (t === LIQUID && (lay.liquidHurts || land)) return false;
  return lay.edgeProp(tx, ty, seed) !== 'tree';
}

/**
 * Componentes de casillas "gordas" (un bloque de 4×4 andable: cabe el Pokémon más grande,
 * 104 px de ancho) en un cuadrado de lado 2R.
 * Devuelve cuántas casillas gordas hay y cuántas no llegan a la del centro
 * (las que tocan el borde del cuadrado cuentan como conectadas: siguen fuera).
 */
function connectivity(lay, seed, R = 100, cx = 0, cy = 0, land = false) {
  const S = 2 * R + 1;
  const w = new Uint8Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) w[j * S + i] = walkable(lay, cx - R + i, cy - R + j, seed, land) ? 1 : 0;
  const fat = new Uint8Array(S * S);
  let total = 0;
  for (let j = 1; j < S - 2; j++) for (let i = 1; i < S - 2; i++) {
    let ok = 1;
    for (let b = -1; b <= 2 && ok; b++) for (let a = -1; a <= 2; a++) if (!w[(j + b) * S + i + a]) { ok = 0; break; }
    fat[j * S + i] = ok; total += ok;
  }
  const comp = new Int32Array(S * S).fill(-1);
  const sizes = [], touches = [];
  const q = new Int32Array(S * S);
  for (let s = 0; s < S * S; s++) {
    if (!fat[s] || comp[s] >= 0) continue;
    const id = sizes.length;
    let h = 0, t = 0, n = 0, edge = false;
    q[t++] = s; comp[s] = id;
    while (h < t) {
      const k = q[h++]; n++;
      const i = k % S, j = (k / S) | 0;
      if (i <= 1 || j <= 1 || i >= S - 3 || j >= S - 3) edge = true;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= S || jj >= S) continue;
        const kk = jj * S + ii;
        if (fat[kk] && comp[kk] < 0) { comp[kk] = id; q[t++] = kk; }
      }
    }
    sizes.push(n); touches.push(edge);
  }
  // El componente "principal": el que toca el borde y es el mayor (o el del centro).
  const mid = comp[R * S + R];
  let lost = 0;
  sizes.forEach((n, id) => { if (id !== mid && !touches[id]) lost += n; });
  // ¿Desde el centro se sale a lo lejos? (su componente llega al borde del cuadrado)
  return { total, lost, mid, midOut: mid >= 0 && touches[mid] };
}

test('el terreno nuevo nace con el jugador en un sitio suyo: suelo alrededor y salida a lo lejos (sin empujar)', () => {
  const ids = ['plains', 'cave', 'plant', 'lava', 'marsh'];
  for (const id of ids) {
    // Con el ancla en el 0,0, igual que el de siempre.
    const base = L.get(id), at0 = L.make(id, { tx: 0, ty: 0 });
    for (let ty = -30; ty < 30; ty += 3) for (let tx = -30; tx < 30; tx += 3) assert.equal(at0.terrain(tx, ty, 5), base.terrain(tx, ty, 5), id);
    for (let n = 0; n < 40; n++) {
      const seed = SEEDS[n % SEEDS.length];
      const tx = Math.floor((G.U.hash(n, 1, 9) - 0.5) * 20000), ty = Math.floor((G.U.hash(n, 2, 9) - 0.5) * 20000);
      const lay = L.make(id, { tx, ty });
      for (let b = -5; b <= 5; b++) for (let a = -5; a <= 5; a++) {
        if (a * a + b * b > 25) continue;
        assert.equal(lay.terrain(tx + a, ty + b, seed), FLOOR, `${id} @${tx},${ty} (${a},${b}): no es suelo`);
      }
      // Andando (o vadeando, en las islas de agua) se sale lejos.
      const land = id !== 'islands' && id !== 'cave';
      const { midOut } = connectivity(lay, seed, 45, tx, ty, land);
      assert.ok(midOut, `${id} @${tx},${ty}: desde el inicio no se sale`);
    }
  }
});

test('existen los generadores y el reparto por bioma', () => {
  for (const id of ['plains', 'cave', 'plant', 'lava', 'marsh']) assert.ok(L.get(id), id);
  assert.equal(L.get('forest'), null);
  assert.equal(L.forBiome(0), 'plains');                // el bosque, con el campo de siempre
  assert.equal(L.forBiome(1), 'cave');
  assert.equal(L.forBiome(2), 'lava');
});

test('plains es exactamente la fórmula de siempre (world.js)', () => {
  const H = (x, y, s) => G.U.hash(x, y, s);
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = H(xi, yi, s), b = H(xi + 1, yi, s), c = H(xi, yi + 1, s), d = H(xi + 1, yi + 1, s);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.65 + vnoise(x * 2.13 + 17, y * 2.13 - 9, s + 1) * 0.35;
  const old = (tx, ty, seed) => {
    const d = Math.hypot(tx, ty);
    if (d < 9) return FLOOR;
    const ramp = Math.min(1, Math.max(0, (d - 9) / 8));
    if (fbm(tx / 13, ty / 13, seed + 101) < 0.04 + 0.23 * ramp) return LIQUID;
    if (fbm(tx / 8, ty / 8, seed + 202) > 1 - 0.27 * ramp) return WALL;
    return FLOOR;
  };
  const p = L.get('plains');
  for (const seed of SEEDS) for (let ty = -60; ty <= 60; ty += 3) for (let tx = -60; tx <= 60; tx += 3) {
    assert.equal(p.terrain(tx, ty, seed), old(tx, ty, seed), `seed ${seed} (${tx},${ty})`);
  }
});

test('deterministas: misma semilla, mismo mapa; otra semilla, otro', () => {
  for (const id of L.IDS) {
    const lay = L.get(id);
    let same = true, diff = 0;
    // Terreno y objetos del generador.
    const sig = (tx, ty, s) => lay.terrain(tx, ty, s) + ':' + lay.edgeProp(tx, ty, s);
    for (let ty = -40; ty < 40; ty++) for (let tx = -40; tx < 40; tx++) {
      if (sig(tx, ty, 9) !== sig(tx, ty, 9)) same = false;
      if (sig(tx, ty, 9) !== sig(tx, ty, 10)) diff++;
    }
    assert.ok(same, id);
    assert.ok(diff > 50, id + ' cambia con la semilla');
  }
});

test('cada bioma nuevo se ve distinto: hay pared o líquido de verdad', () => {
  const liquid = {};
  for (const id of ['cave', 'lava', 'marsh']) {
    const lay = L.get(id);
    const n = [0, 0, 0];
    for (let ty = -80; ty < 80; ty++) for (let tx = -80; tx < 80; tx++) n[lay.terrain(tx, ty, 3)]++;
    const all = n[0] + n[1] + n[2];
    liquid[id] = n[LIQUID] / all;
    if (id === 'lava' || id === 'marsh') assert.ok(n[LIQUID] / all > 0.08, `${id}: ${n}`);
    else if (id === 'islands') assert.ok(n[LIQUID] / all > 0.3 && n[WALL] / all < 0.05, `islands: ${n}`);
    else assert.ok(n[WALL] / all > 0.25, `${id}: ${n}`);
    assert.ok(n[FLOOR] / all > 0.3, `${id} deja sitio para jugar: ${n}`);
  }
  // El pantano: más ríos que el volcán.
  assert.ok(liquid.marsh > liquid.lava * 1.3, JSON.stringify(liquid));
});

test('cueva: sin rendijas de una casilla (parecen paso y no se cabe) y con charcas', () => {
  const lay = L.get('cave');
  let slits = 0, floor = 0, liquid = 0;
  for (const seed of SEEDS) for (let ty = -300; ty < -180; ty++) for (let tx = 400; tx < 520; tx++) {
    const t = lay.terrain(tx, ty, seed);
    if (t === LIQUID) liquid++;
    if (t === WALL) continue;
    floor++;
    const w = (a, b) => lay.terrain(tx + a, ty + b, seed) === WALL;
    if ((w(-1, 0) && w(1, 0)) || (w(0, -1) && w(0, 1))) slits++;
  }
  assert.equal(slits, 0, `${slits} casillas de suelo entre dos paredes`);
  assert.ok(liquid / (floor + 1) > 0.02, `pocas charcas (${(liquid / floor * 100).toFixed(1)}%)`);
});

test('pasillos y pasos de tierra de ancho variado (no todos iguales, como hechos a mano)', () => {
  // Ancho de cada tramo recto: en cada fila, las rachas de suelo entre dos "no suelo".
  for (const [id, other] of [['cave', WALL]]) {
    const lay = L.get(id), widths = new Map();
    for (const seed of SEEDS) for (let ty = -400; ty < -200; ty += 3) {
      let run = 0;
      for (let tx = 300; tx < 600; tx++) {
        const t = lay.terrain(tx, ty, seed);
        if (t === FLOOR) { run++; continue; }
        if (t === other && run >= 3 && run <= 12) widths.set(run, (widths.get(run) || 0) + 1);
        run = 0;
      }
    }
    const total = [...widths.values()].reduce((a, b) => a + b, 0);
    const top = Math.max(...widths.values());
    assert.ok(widths.size >= 6 && top / total < 0.3, `${id}: anchos ${JSON.stringify([...widths].sort((a, b) => a[0] - b[0]))}`);
  }
});

test('conectados por tierra: pasillos de 4+ casillas y sin zonas cerradas', () => {
  for (const id of ['cave', 'plant', 'lava', 'marsh']) {
    const lay = L.get(id);
    for (const seed of SEEDS) {
      // En varios sitios del mapa, no sólo alrededor del inicio.
      for (const [cx, cy] of [[0, 0], [517, -233], [-1200, 900]]) {
        // Por tierra: el líquido puede ser veneno o descarga (los colores de las grietas), y los ríos tienen
        // puentes. Menos en la cueva de agua (sus charcas pisan los pasillos) y en las islas (hay vados): se vadean.
        const { total, lost, mid } = connectivity(lay, seed, 90, cx, cy, id !== 'cave' && id !== 'islands');
        assert.ok(total > 2000, `${id} seed ${seed} @${cx},${cy}: pocas casillas libres (${total})`);
        assert.ok(lost / total < 0.01, `${id} seed ${seed} @${cx},${cy}: ${lost}/${total} casillas en zonas cerradas`);
        if (cx === 0 && cy === 0) assert.ok(mid >= 0, `${id}: el inicio tiene sitio`);
      }
    }
  }
});

test('rápidos: un chunk de 16×16 se genera en mucho menos de un fotograma', () => {
  for (const id of L.IDS) {
    const lay = L.get(id);
    // Como world.js: el terreno de cada casilla una vez (con 1 de margen) y los adornos leyendo ese terreno.
    const chunk = (ox, oy) => {
      const S = 18, terr = new Uint8Array(S * S);
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) terr[j * S + i] = lay.terrain(ox + i - 1, oy + j - 1, 5);
      const at = (x, y) => terr[(y - oy + 1) * S + (x - ox + 1)];
      let n = 0;
      for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if (lay.edgeProp(ox + i, oy + j, 5, at)) n++;
      return n;
    };
    for (let c = 0; c < 32; c++) chunk(-4000 + c * 16, 900);        // calentar el JIT
    const t0 = process.hrtime.bigint();
    for (let c = 0; c < 64; c++) chunk((c % 8) * 16 + 300, ((c / 8) | 0) * 16 - 200);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 64;
    assert.ok(ms < 0.6, `${id}: ${ms.toFixed(3)} ms por chunk`);
  }
});
