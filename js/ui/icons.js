/* ============ icons.js — iconos pixel art (sustituyen a los emojis) ============
 * Todo se dibuja desde mapas de caracteres, igual que los tiles: así la
 * interfaz comparte estilo con los sprites de Mundo Misterioso.
 *
 *   G.Icons.html('coin', 18)     <img> para el DOM
 *   G.Icons.draw(ctx, 'coin', x, y, 18)   en el canvas
 *   G.Icons.url('star')          data URL (para CSS)
 *   'move:<id>'                  emblema del tipo + insignia de la familia
 *   'type:<tipo>'                sólo el emblema
 */
G.Icons = (() => {
  const K = '#1b1528';          // contorno

  // ---------------- iconos de interfaz (12×12) ----------------
  const UI = {
    heart: { pal: { r: '#ff5f6d', s: '#c23a4b', w: '#ffd3d8' }, rows: [
      '............', '.kkk....kkk.', 'kwwrk..krrrk', 'kwrrrkkrrrsk', 'krrrrrrrrrsk', 'krrrrrrrrrsk',
      '.krrrrrrrsk.', '..krrrrrsk..', '...krrrsk...', '....krsk....', '.....kk.....', '............'] },
    fist: { pal: { r: '#ff5f6d', s: '#c23a4b', w: '#ffd3d8', c: '#e8e8f0' }, rows: [
      '............', '..kkkkkk....', '.krrrrrrk...', 'krwwrrrrrkk.', 'krwrrrrrrrrk', 'krrrrrrrkrsk',
      'krrrrrrrkrsk', '.krrrrrrskk.', '..kssssssk..', '..kcccccck..', '..kkkkkkkk..', '............'] },
    up: { pal: { g: '#5fe08a', d: '#2f9a52', w: '#c8ffd8' }, rows: [
      '.....kk.....', '....kwgk....', '...kwgggk...', '..kwgggggk..', '.kwgggggggk.', 'kkkkggggkkkk',
      '...kggggk...', '...kggggk...', '...kggddk...', '...kgdddk...', '...kddddk...', '...kkkkkk...'] },
    boot: { pal: { b: '#4fb4ff', d: '#2a6fb0', w: '#e6f4ff', g: '#e8e8f0' }, rows: [
      '............', '....kkkk....', '....kbbk....', '....kbbk....', '....kbbk....', '....kbbbkk..',
      '...kbwbbbbk.', '..kbbbbbbbbk', '..kdddddddbk', '..kgggggggk.', '...kkkkkkk..', '............'] },
    clock: { pal: { w: '#f4f4ff', y: '#ffd23f', o: '#c9c9e0' }, rows: [
      '....kkkk....', '..kkyyyykk..', '.kyywwwwyyk.', '.kywwwkwwyk.', 'kywwwwkwwwyk', 'kywwwwkwwwyk',
      'kywwwwkkkwyk', 'kywwwwwwwwyk', '.kywwwwwwyk.', '.kyyowwwyyk.', '..kkyyyykk..', '....kkkk....'] },
    shield: { pal: { s: '#9fb1c9', d: '#5d6f8c', w: '#e6eef8', r: '#4fb4ff' }, rows: [
      '............', '.kkkkkkkkkk.', '.kwwsssssdk.', '.kwssrrssdk.', '.kwssrrssdk.', '.kssrrrrsdk.',
      '.kssrrrrsdk.', '..kssrrsdk..', '..kssssddk..', '...ksssdk...', '....kddk....', '.....kk.....'] },
    sprout: { pal: { g: '#5fe08a', d: '#2f9a52', b: '#8a5a2b' }, rows: [
      '............', '..kkk..kkk..', '.kgggk.kgggk', '.kggggkgggdk', '..kdggkggdk.', '...kkdgdkk..',
      '.....kgk....', '.....kgk....', '...kkkdkkk..', '..kbbbbbbbk.', '..kbbbbbbbk.', '...kkkkkkk..'] },
    magnet: { pal: { r: '#ff5f6d', s: '#c23a4b', w: '#e8e8f0' }, rows: [
      '............', '..kkkkkkkk..', '.krrrrrrrrk.', 'krrsskkssrrk', 'krrk....krrk', 'krrk....krrk',
      'krrk....krrk', 'kwwk....kwwk', 'kwwk....kwwk', 'kkkk....kkkk', '............', '............'] },
    book: { pal: { c: '#4fb4ff', d: '#2a6fb0', p: '#f4f4ff', y: '#ffd23f' }, rows: [
      '............', '.kkkkkkkkkk.', '.kcccccccck.', '.kcyyyyyyck.', '.kcccccccck.', '.kccyyyyyck.',
      '.kcccccccck.', '.kcccccccck.', '.kddddddddk.', '.kppppppppk.', '.kkkkkkkkkk.', '............'] },
    coin: { pal: { y: '#ffd23f', o: '#c08a10', w: '#fff4b0' }, rows: [
      '....kkkk....', '..kkyyyykk..', '.kyywwyyyyk.', '.kywyyyyyok.', 'kyyyyooyyyok', 'kywyoyyoyyok',
      'kyyyoyyoyyok', 'kyyyyooyyyok', '.kyyyyyyyok.', '.kooyyyyook.', '..kkooookk..', '....kkkk....'] },
    cards: { pal: { a: '#ffd23f', b: '#4fb4ff', w: '#e6f4ff' }, rows: [
      '............', '.kkkkkk.....', '.kaaaaakkkk.', '.kaaaakbbbbk', '.kaaaakbwwbk', '.kaaaakbwwbk',
      '.kaaaakbbbbk', '.kaaaakbwwbk', '.kkkkkkbwwbk', '......kbbbbk', '......kkkkkk', '............'] },
    berry: { pal: { r: '#ff7a9e', s: '#c23a6b', w: '#ffd3e0', g: '#5fe08a', d: '#2f9a52' }, rows: [
      '............', '.....kkk....', '....kgggk...', '..kkkgdkkk..', '.krrrkkrrrk.', 'krwwrrrrrrsk',
      'krwrrrrrrrsk', 'krrrrrrrrrsk', 'krrrrrrrrssk', '.krrrrrrssk.', '..kkssssskk.', '....kkkkk...'] },
    bomb: { pal: { b: '#3a3a4a', w: '#8a8aa0', f: '#ffd23f', r: '#ff7b3d' }, rows: [
      '........r...', '.......rfr..', '......kfr...', '.....kfk....', '...kkkkkk...', '..kbbbbbbk..',
      '.kbwwbbbbbk.', '.kbwbbbbbbk.', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '..kbbbbbbk..', '...kkkkkk...'] },
    star: { pal: { y: '#ffd23f', o: '#c08a10', w: '#fff4b0' }, rows: [
      '.....kk.....', '.....kk.....', '....kwyk....', '....kyyk....', 'kkkkwyyykkkk', 'kwyyyyyyyyok',
      '.kyyyyyyyok.', '..kyyyyyyk..', '..kyyyoyyk..', '.kyok..koyk.', '.kok....kok.', '.kk......kk.'] },
    // Marca de shiny: la estrella roja de la ficha de los juegos, con un destello.
    shiny: { pal: { y: '#ff4d5e', w: '#ffd0d6', o: '#b8283a', x: '#fff6b0' }, rows: [
      '.....kk...x.', '.....kk..xxx', '....kwyk..x.', '....kyyk....', 'kkkkwyyykkkk', 'kwyyyyyyyyok',
      '.kyyyyyyyok.', '..kyyyyyyk..', '..kyyyoyyk..', '.kyok..koyk.', '.kok....kok.', '.kk......kk.'] },
    crown: { pal: { y: '#ffd23f', o: '#c08a10', r: '#ff5f6d' }, rows: [
      '............', '............', 'k....k....k.', 'kk..kyk..kk.', 'kyk.kyk.kyk.', 'kyykyyykyyk.',
      'kyyyyyyyyyk.', 'kyyryyyryyk.', 'kyyyyyyyyyk.', 'koooooooook.', 'kkkkkkkkkkk.', '............'] },
    user: { pal: { u: '#b9cbf0', d: '#7f93c0' }, rows: [
      '............', '....kkkk....', '...kuuuuk...', '...kuuuuk...', '...kuuuuk...', '....kuuk....',
      '..kkkuukkk..', '.kuuuuuuuuk.', '.kuuuuuuuuk.', '.kdduuuuddk.', '.kkkkkkkkkk.', '............'] },
    cursor: { pal: { y: '#ffd23f' }, rows: [
      'k.......', 'kk......', 'kyk.....', 'kyyk....', 'kyyyk...', 'kyyyyk..',
      'kyyyk...', 'kyyk....', 'kyk.....', 'kk......', 'k.......', '........'] },
    sound: { pal: { w: '#e8eef8' }, rows: [
      '............', '.....kk.....', '....kwk..k..', '...kwwk...k.', 'kkkwwwk.k..k', 'kwwwwwk..k.k',
      'kwwwwwk..k.k', 'kkkwwwk.k..k', '...kwwk...k.', '....kwk..k..', '.....kk.....', '............'] },
    mute: { pal: { w: '#e8eef8', r: '#ff5f6d' }, rows: [
      '............', '.....kk.....', '....kwk.....', '...kwwk.....', 'kkkwwwk.r..r', 'kwwwwwk..rr.',
      'kwwwwwk..rr.', 'kkkwwwk.r..r', '...kwwk.....', '....kwk.....', '.....kk.....', '............'] },
    ticket: { pal: { y: '#ffd23f', d: '#c08a10', w: '#fff3b0', r: '#ff5f6d' }, rows: [
      '............', '............', 'kkkkkkkkkkkk', 'kwyyydyyyyyk', 'kyyyyyyrryyk', '.kyyydyrryk.',
      '.kyyyyyrryk.', 'kyyyydyyyyyk', 'kddddddddddk', 'kkkkkkkkkkkk', '............', '............'] },
    ticket10: { pal: { p: '#c47bff', q: '#8a3fd0', w: '#f0d8ff', y: '#ffd23f' }, rows: [
      '............', '............', 'kkkkkkkkkkkk', 'kwpppqppyypk', 'kppppqpyyypk', '.kpppqpyyyk.',
      '.kpppqppyyk.', 'kppppqpppppk', 'kqqqqqqqqqqk', 'kkkkkkkkkkkk', '............', '............'] },
    wsun: { pal: { y: '#ffd23f', o: '#ff9a3d' }, rows: [
      '.....yy.....', '..y..yy..y..', '...y....y...', '....kkkk....', 'yy.kyyyyk.yy', 'yy.kyyoyk.yy',
      '...kyooyk...', '....kkkk....', '...y....y...', '..y..yy..y..', '.....yy.....', '............'] },
    wrain: { pal: { w: '#e8eef8', g: '#9fb1c9', b: '#4fb4ff' }, rows: [
      '............', '...kkkk.....', '..kwwwwkkk..', '.kwwwwwwwwk.', 'kwwwwwwwwwgk', 'kggggggggggk',
      '.kkkkkkkkkk.', '..b...b...b.', '.b...b...b..', '..b...b...b.', '.b...b...b..', '............'] },
    wsand: { pal: { s: '#e0bf73', d: '#9a7a3a' }, rows: [
      '............', '..ssssss....', '........ss..', 'ssssssss..s.', '.........s..', '..dddddd....',
      '........dd..', 'dddddd....d.', '.........d..', '...sssss....', '............', '............'] },
    wsnow: { pal: { w: '#ffffff', c: '#9fe0ff' }, rows: [
      '.....w......', '...w.w.w....', '....www.....', '.w..cwc..w..', '..w.cwc.w...', 'wwwwwwwwwww.',
      '..w.cwc.w...', '.w..cwc..w..', '....www.....', '...w.w.w....', '.....w......', '............'] },
    wfog: { pal: { g: '#c9cfdc', d: '#8f98ab' }, rows: [
      '............', '............', '..gggggg....', '.g......gg..', '............', '....gggggg..',
      '..dd......d.', '............', '.ggggggg....', 'g.......gg..', '............', '............'] },
    // Bolas del tragaperras del gacha (una por rareza).
    ball2: { pal: { r: '#3d7bff', s: '#2a56b8', w: '#cfe0ff', b: '#f4f4f4' }, rows: [
      '....kkkk....', '..kkrrrrkk..', '.krwrrrrrrk.', '.krwrrrrrsk.', 'krrrrkkrrssk', 'kkkkkbbkkkkk', 'kbbbkbbkbbbk', 'kbbbbkkbbbbk', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '..kkbbbbkk..', '....kkkk....'] },
    ball3: { pal: { r: '#3a3a46', s: '#1d1d26', w: '#ffd23f', b: '#f4f4f4' }, rows: [
      '....kkkk....', '..kkrrrrkk..', '.krwrrrrrrk.', '.krwrrrrrsk.', 'krrrrkkrrssk', 'kkkkkbbkkkkk', 'kbbbkbbkbbbk', 'kbbbbkkbbbbk', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '..kkbbbbkk..', '....kkkk....'] },
    ball4: { pal: { r: '#8a3fd0', s: '#5e2a96', w: '#ff8ad8', b: '#f4f4f4' }, rows: [
      '....kkkk....', '..kkrrrrkk..', '.krwrrrrrrk.', '.krwrrrrrsk.', 'krrrrkkrrssk', 'kkkkkbbkkkkk', 'kbbbkbbkbbbk', 'kbbbbkkbbbbk', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '..kkbbbbkk..', '....kkkk....'] },
    ballLux: { pal: { r: '#30303a', s: '#18181e', w: '#ff5f6d', b: '#ffd23f' }, rows: [
      '....kkkk....', '..kkrrrrkk..', '.krwrrrrrrk.', '.krwrrrrrsk.', 'krrrrkkrrssk', 'kkkkkbbkkkkk', 'kbbbkbbkbbbk', 'kbbbbkkbbbbk', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '..kkbbbbkk..', '....kkkk....'] },
    trophy: { pal: { y: '#ffd23f', d: '#c08a10', w: '#fff3b0' }, rows: [
      '............', '..kkkkkkkk..', 'kkkwyyyydkkk', 'k.kwyyyydk.k', 'k.kwyyyydk.k', '.kkwyyyydkk.',
      '...kyyyyk...', '....kyyk....', '....kyyk....', '...kddddk...', '..kyyyyyyk..', '..kkkkkkkk..'] },
    friends: { pal: { b: '#4fb4ff', d: '#2a6fb0', g: '#5fe08a', h: '#2f9a52' }, rows: [
      '............', '..kkk..kkk..', '.kbbbkkgggk.', '.kbbbkkgggk.', '..kkk..kkk..', '............',
      '.kkkkkkkkkk.', 'kbbbbkkggggk', 'kbbbbkkggggk', 'kddddkkhhhhk', 'kkkkkkkkkkkk', '............'] },
    ball: { pal: { r: '#ff4d4d', w: '#f4f4f4', s: '#c23a3a' }, rows: [
      '....kkkk....', '..kkrrrrkk..', '.krwrrrrrrk.', '.krwrrrrrsk.', 'krrrrkkrrssk', 'kkkkkwwkkkkk',
      'kwwwkwwkwwwk', 'kwwwwkkwwwwk', '.kwwwwwwwwk.', '.kwwwwwwwwk.', '..kkwwwwkk..', '....kkkk....'] }
  };
  // Variantes de paleta.
  UI.starDim = { rows: UI.star.rows, pal: { y: '#3a4870', o: '#2a3458', w: '#4a5a88' } };

  // ---------------- glifos de tipo (8×8, blancos sobre el emblema) ----------------
  const TYPE_GLYPH = {
    normal:   ['..####..', '.#....#.', '#......#', '#..##..#', '#..##..#', '#......#', '.#....#.', '..####..'],
    fire:     ['...#....', '...##...', '..###.#.', '.#####..', '.######.', '##.####.', '##..###.', '.######.'],
    water:    ['...##...', '...##...', '..####..', '.######.', '.##.###.', '.#.####.', '.######.', '..####..'],
    grass:    ['.....###', '...#####', '..######', '.####.##', '.###.###', '.##.####', '.#.####.', '#.......'],
    electric: ['....###.', '...###..', '..###...', '.######.', '...###..', '..###...', '.##.....', '#.......'],
    psychic:  ['.######.', '#......#', '#.####.#', '#.#..#.#', '#.#.##.#', '#.#....#', '#.######', '#.......'],
    ice:      ['...#....', '.#.#.#..', '..###...', '#######.', '..###...', '.#.#.#..', '...#....', '........'],
    fighting: ['.######.', '########', '########', '#.#.#.##', '########', '.#######', '..#####.', '..####..'],
    poison:   ['.....##.', '....####', '.....##.', '.###....', '#####...', '#####.##', '.###.###', '.....##.'],
    ground:   ['........', '...##...', '..####..', '.##..##.', '.######.', '##.##.##', '########', '........'],
    flying:   ['#.......', '##......', '###.....', '####....', '######..', '########', '.#######', '...####.'],
    bug:      ['.#....#.', '..#..#..', '..####..', '.##.###.', '########', '###.####', '.######.', '..####..'],
    rock:     ['...###..', '..#####.', '.###.###', '######.#', '##.#####', '#######.', '.#####..', '........'],
    ghost:    ['..####..', '.######.', '##.##.##', '##.##.##', '########', '########', '########', '#.#..#.#'],
    dragon:   ['#.......', '##....#.', '.##..##.', '.######.', '..####..', '.######.', '##.##.##', '#..##..#'],
    dark:     ['..####..', '.###....', '###.....', '###.....', '###.....', '###.....', '.###....', '..####..'],
    steel:    ['..####..', '.######.', '###..###', '##....##', '##....##', '###..###', '.######.', '..####..'],
    fairy:    ['...#....', '...#....', '..###...', '#######.', '..###...', '..#.#...', '.#...#..', '........']
  };

  // Insignia de la familia de movimiento (5×5).
  const KIND_GLYPH = {
    projectile: ['..#..', '...#.', '#####', '...#.', '..#..'],
    melee:      ['....#', '...#.', '..#..', '.#...', '#....'],
    beam:       ['.....', '#####', '.....', '#####', '.....'],
    orbit:      ['.###.', '#...#', '#...#', '#...#', '.###.'],
    nova:       ['#.#.#', '.###.', '#####', '.###.', '#.#.#'],
    aura:       ['.###.', '#...#', '#.#.#', '#...#', '.###.'],
    buff:       ['..#..', '.###.', '#####', '..#..', '..#..']
  };

  // ---------------- render ----------------

  const cache = new Map();      // clave -> canvas a 1×
  const urls = new Map();

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = c => Math.max(0, Math.min(255, Math.round(c * k)));
    return '#' + [f(n >> 16 & 255), f(n >> 8 & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function fromRows(def) {
    const h = def.rows.length, w = Math.max(...def.rows.map(r => r.length));
    const pad = def.outline ? 1 : 0;
    const cv = document.createElement('canvas');
    cv.width = w + pad * 2; cv.height = h + pad * 2;
    const c = cv.getContext('2d');
    const pal = Object.assign({ k: K }, def.pal);
    if (def.outline) {
      c.fillStyle = K;
      def.rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.' || ch === ' ') return;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.fillRect(x + pad + dx, y + pad + dy, 1, 1);
      }));
    }
    def.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.' || ch === ' ' || !pal[ch]) return;
      c.fillStyle = pal[ch];
      c.fillRect(x + pad, y + pad, 1, 1);
    }));
    return cv;
  }

  /** Emblema circular de un tipo (16×16), con insignia de familia opcional. */
  function emblem(type, kind) {
    const S = 16;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const col = G.U.TYPE_COLOR[type] || '#b0a99f';
    const dark = shade(col, 0.55), lite = shade(col, 1.3);
    // Disco con contorno, sombra abajo-derecha y brillo arriba-izquierda.
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 7.6) continue;
      let f = col;
      if (d > 6.6) f = K;
      else if ((x - 7.5) + (y - 7.5) > 6) f = dark;
      else if ((x - 7.5) + (y - 7.5) < -6.5) f = lite;
      c.fillStyle = f; c.fillRect(x, y, 1, 1);
    }
    const g = TYPE_GLYPH[type] || TYPE_GLYPH.normal;
    // Sombra del glifo y glifo.
    c.fillStyle = dark;
    g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') c.fillRect(x + 5, y + 5, 1, 1); }));
    c.fillStyle = '#ffffff';
    g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') c.fillRect(x + 4, y + 4, 1, 1); }));

    if (kind && KIND_GLYPH[kind]) {
      c.fillStyle = K; c.fillRect(9, 9, 7, 7);
      c.fillStyle = '#2b3454'; c.fillRect(10, 10, 5, 5);
      c.fillStyle = '#ffd23f';
      KIND_GLYPH[kind].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') c.fillRect(x + 10, y + 10, 1, 1); }));
    }
    return cv;
  }

  function canvas(name) {
    let cv = cache.get(name);
    if (cv) return cv;
    if (name.startsWith('move:')) {
      const m = G.Moves.BY_ID[name.slice(5)];
      cv = emblem(m ? m.type : 'normal', m ? m.kind : null);
    } else if (name.startsWith('type:')) {
      cv = emblem(name.slice(5));
    } else {
      cv = fromRows(UI[name] || UI.star);
    }
    cache.set(name, cv);
    return cv;
  }

  function url(name) {
    let u = urls.get(name);
    if (!u) { u = canvas(name).toDataURL(); urls.set(name, u); }
    return u;
  }

  /**
   * Ajusta el tamaño a un múltiplo entero de la resolución del icono: un
   * icono de 16 px pintado a 24 duplicaría unos píxeles sí y otros no.
   */
  function snap(name, size) {
    const w = canvas(name).width;
    return w * Math.max(1, Math.round(size / w));
  }

  /** <img> pixelado para el DOM. */
  function html(name, size = 20, cls = '') {
    const cv = canvas(name), w = snap(name, size), h = w * cv.height / cv.width;
    return `<img class="pix ${cls}" src="${url(name)}" width="${w}" height="${h}" alt="" draggable="false">`;
  }

  function draw(ctx, name, x, y, size) {
    const cv = canvas(name);
    const s2 = snap(name, size);
    x += (size - s2) / 2; y += (size - s2) / 2; size = s2;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, Math.round(x), Math.round(y), size, size * cv.height / cv.width);
    ctx.imageSmoothingEnabled = prev;
  }

  /**
   * Centelleo de shiny, dibujado píxel a píxel (no es un icono): una cruz que
   * nace, crece, echa puntas en diagonal y se apaga, como en los juegos.
   * phase 0..1 · px = tamaño de píxel en pantalla.
   */
  function twinkle(ctx, x, y, phase, px = 2) {
    const st = phase < 0.15 ? 0 : phase < 0.32 ? 1 : phase < 0.62 ? 2 : phase < 0.82 ? 1 : 0;
    const X = Math.round(x / px) * px, Y = Math.round(y / px) * px;
    const dot = (dx, dy, c) => { ctx.fillStyle = c; ctx.fillRect(X + dx * px, Y + dy * px, px, px); };
    const ARM = '#fff3a8', TIP = '#9ae6ff';
    dot(0, 0, '#ffffff');
    if (st >= 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(dx, dy, ARM);
    if (st >= 2) {
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) dot(dx, dy, ARM);
      for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) dot(dx, dy, TIP);
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) dot(dx, dy, TIP);
    }
  }

  /**
   * Rareza como Poké Ball: Poké (Común), Super (Poco común), Ultra (Rara),
   * Lujo (Épica) y Master (Legendaria).
   */
  const RARITY_BALL = { 1: 'ball', 2: 'ball2', 3: 'ball3', 4: 'ballLux', 5: 'ball4' };
  function rarity(n, size = 12) {
    return `<span class="rarity-ball" title="${(G.Gacha && G.Gacha.RARITY_NAME[n]) || ''}">${html(RARITY_BALL[n] || 'ball', size)}</span>`;
  }

  /** Publica en CSS los iconos que usan las hojas de estilo. */
  function installCss() {
    const r = document.documentElement.style;
    r.setProperty('--ico-coin', `url(${url('coin')})`);
    r.setProperty('--ico-cursor', `url(${url('cursor')})`);
  }

  return { canvas, url, html, draw, twinkle, rarity, RARITY_BALL, installCss, UI, TYPE_GLYPH };
})();
