/* ============ sprites.js — sprites estilo Mundo Misterioso (locales) ============
 * Hojas de SpriteCollab en assets/pokemon/{dex}/{Anim}.png, geometría en
 * G.SPRITE_META (js/data/sprites-meta.js, generado por tools/fetch_sprites.py).
 * Variantes: s/ shiny · f/ hembra · fs/ hembra shiny. La hembra es sólo de
 * aspecto: el tamaño del cuerpo (colisiones) sale siempre del macho.
 *
 *   columnas = fotogramas · filas = 8 direcciones
 *   0 Down · 1 DownRight · 2 Right · 3 UpRight · 4 Up · 5 UpLeft · 6 Left · 7 DownLeft
 *
 * Cada animación tiene su propio tamaño de fotograma, así que se alinean por el
 * ancla al suelo (ax, ay): ese píxel cae siempre en los pies de la entidad y
 * el sprite no "salta" al pasar de Walk a Attack.
 */
G.Sprites = (() => {
  /** Unidades de mundo por píxel de arte. Tiles y sprites comparten escala. */
  const PX = 2;
  const sheets = new Map();          // "dex/Anim[/s|/f|/fs]" -> {img, ready, failed}

  function meta(dex) { return G.SPRITE_META[dex] || null; }

  /** ¿Flota en su sprite? (tools/hover_flags.py) Pasa por encima de rocas y agua. */
  function hovers(dex) { const m = meta(dex); return !!(m && m.hv); }

  /**
   * Versión blanca de una imagen (para el destello al recibir un golpe).
   * Se hace una vez por hoja con composición "source-in": mucho más barato
   * que ctx.filter en cada dibujo, que era lo que más ralentizaba con muchos
   * enemigos a la vez.
   */
  const whites = new WeakMap();
  function white(img) {
    let c = whites.get(img);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, c.width, c.height);
    whites.set(img, c);
    return c;
  }

  /** ¿Tiene versión shiny? (assets/pokemon/{dex}/s/) */
  function hasShiny(dex) { const m = meta(dex); return !!(m && m.sh); }

  /** ¿Tiene aspecto de hembra? (assets/pokemon/{dex}/f/) */
  function hasFemale(dex) { const m = meta(dex); return !!(m && m.f); }

  /** ¿Tiene hembra shiny? (assets/pokemon/{dex}/fs/) */
  function hasFemaleShiny(dex) { const m = meta(dex); return !!(m && m.fs); }

  /** Animaciones disponibles para esa variante. */
  function has(m, anim, shiny) {
    return !!m.a[anim] && !(shiny && m.sm && m.sm.includes(anim));
  }

  /** ¿Esa animación está en la hoja de hembra (shiny o no)? Si no, se usa la del macho. */
  function femaleHas(m, anim, shiny) {
    if (!m.f || (shiny && !m.fs)) return false;
    const miss = shiny ? m.fsm : m.fm;
    return !!m.a[anim] && !(miss && miss.includes(anim));
  }

  function animName(dex, anim, shiny = false, female = false) {
    const m = meta(dex);
    if (!m) return null;
    shiny = shiny && !!m.sh;
    if (has(m, anim, shiny) || (female && femaleHas(m, anim, shiny))) return anim;
    return has(m, 'Idle', shiny) ? 'Idle' : 'Walk';
  }

  /** Geometría de una animación (la shiny sólo difiere en casos raros). */
  function animMeta(dex, anim, shiny = false, female = false) {
    const m = meta(dex);
    if (!m) return null;
    shiny = shiny && !!m.sh;
    const name = animName(dex, anim, shiny, female);
    // Hembra: lo que difiera de la normal (fa) y, la shiny, de la hembra (fsa).
    if (female && femaleHas(m, name, shiny)) return (shiny && m.fsa && m.fsa[name]) || (m.fa && m.fa[name]) || m.a[name] || null;
    if (shiny && m.sa && m.sa[name]) return m.sa[name];
    return m.a[name] || null;
  }

  // Hojas en memoria como mucho. Antes no se soltaba ninguna: en partidas de
  // más de una hora pasaban cientos de especies, se llenaba la memoria gráfica
  // y la pantalla se quedaba en negro hasta que el navegador recargaba la página.
  const MAX_SHEETS = 200, IDLE_MS = 20000;   // ~0,66 MB cada una ya dibujada: ~130 MB
  function evict(now) {
    const old = [...sheets].filter(([, s]) => now - s.at > IDLE_MS).sort((a, b) => a[1].at - b[1].at);
    const drop = old.slice(0, Math.max(sheets.size - Math.floor(MAX_SHEETS * 0.75), 0));
    for (const [k, s] of drop) {
      sheets.delete(k);
      s.img.onload = s.img.onerror = null;
      s.img.src = '';                 // suelta la imagen decodificada
    }
  }

  function sheet(dex, anim, shiny = false, female = false) {
    const m = meta(dex);
    shiny = shiny && !!(m && m.sh);
    const name = animName(dex, anim, shiny, female);
    if (!name) return null;
    // Carpeta de la variante: '' normal · s/ shiny · f/ hembra · fs/ hembra shiny.
    const sub = female && femaleHas(m, name, shiny) ? (shiny ? 'fs' : 'f') : shiny ? 's' : '';
    const k = dex + '/' + name + (sub ? '/' + sub : '');
    let s = sheets.get(k);
    const now = Date.now();
    if (s) {
      s.at = now;
      // Si la descarga se cortó (red mala, servidor saturado), reintenta más tarde.
      if (s.failed && performance.now() > s.retryAt) { s.failed = false; s.img.src = s.src + '?r=' + s.tries; }
      return s;
    }
    if (sheets.size >= MAX_SHEETS) evict(now);
    s = { ready: false, failed: false, img: new Image(), tries: 0, retryAt: 0, at: now,
          src: `assets/pokemon/${dex}/${sub ? sub + '/' : ''}${name}.png` };
    s.img.onload = () => { s.ready = true; };
    s.img.onerror = () => { s.failed = true; s.retryAt = performance.now() + 1000 * Math.min(8, 2 ** s.tries++); };
    s.img.src = s.src;
    sheets.set(k, s);
    return s;
  }

  const ANIMS = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint'];

  /** Precarga todas las animaciones de esos Pokémon. */
  function preload(dexes, timeout = 8000, shiny = false, female = false) {
    const hs = [];
    for (const d of dexes) for (const a of ANIMS) { const s = sheet(d, a, shiny, female); if (s) hs.push(s); }
    return new Promise(res => {
      const t0 = performance.now();
      (function check() {
        if (hs.every(h => h.ready || h.failed) || performance.now() - t0 > timeout) return res();
        setTimeout(check, 50);
      })();
    });
  }

  /** Ángulo de pantalla (atan2(dy,dx)) -> fila de dirección 0..7. */
  function dirFromAngle(a) {
    return ((Math.round((Math.PI / 2 - a) / (Math.PI / 4)) % 8) + 8) % 8;
  }

  /** Radio de colisión aproximado a partir del tamaño del sprite (del macho: la hembra no cambia nada). */
  function bodyRadius(dex, scale = 1) {
    const m = animMeta(dex, 'Idle');
    const w = m ? m.w : 32;
    return G.U.clamp(w * 0.22, 5, 26) * PX * scale;
  }

  /*
   * Tu Pokémon, si es de los grandes (18-10-2026: Onix, Gyarados, Eternatus...
   * chocaban con todo y casi no se podía jugar con ellos):
   *   - se dibuja más pequeño, pero sin pasarse: hasta 36 píxeles de alto (el
   *     90 % de los Pokémon) igual; lo que pase de ahí cuenta un 40 %. Gyarados
   *     queda al 75 % y sigue siendo de los más grandes. Los muy anchos y no
   *     tan altos (Cetitan, Regieleki) cuentan por su ancho (el del marco × 0,55).
   *   - choca como uno normal: como mucho PLAYER_R de radio (el de Pikachu; el
   *     85 % de los Pokémon no llega), así cabe por los pasillos y no recibe
   *     más golpes por ser grande.
   */
  const BIG_H = 36, BIG_K = 0.4, PLAYER_R = 18;
  function playerScale(dex) {
    const m = animMeta(dex, 'Idle');
    const h = m ? Math.max(m.ay, m.w * 0.55) : 24;
    if (h <= BIG_H) return 1;
    return Math.round((BIG_H + (h - BIG_H) * BIG_K) / h * 16) / 16;
  }
  function playerRadius(dex) { return Math.min(PLAYER_R, bodyRadius(dex, playerScale(dex))); }

  /** Alto visual aproximado (para barras de vida y números de daño). */
  function bodyHeight(dex, scale = 1) {
    const m = animMeta(dex, 'Idle');
    return (m ? m.ay : 24) * PX * scale;
  }

  /** Sombra elíptica bajo los pies, tamaño según el ShadowSize de PMD. */
  function drawShadow(ctx, dex, x, y, scale = 1) {
    const m = meta(dex);
    const s = m ? m.s : 1;
    const rx = [5, 8, 12][G.U.clamp(s, 0, 2)] * PX * scale;
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * 0.42, 0, 0, 6.2832);
    ctx.fill();
  }

  // ---------------- Animator ----------------

  /**
   * Reproduce las animaciones de un Pokémon.
   *   loop(anim)        animación de fondo (Idle / Walk); no reinicia si ya suena
   *   play(anim, opts)  animación de una vez (Attack, Shoot, Hurt...) que tapa
   *                     a la de fondo hasta que termina
   */
  class Animator {
    /** @param female  aspecto de hembra (si no hay hojas de hembra para esa variante, el normal) */
    constructor(dex, scale = 1, shiny = false, female = false) {
      this.dex = dex;
      this.shiny = shiny && hasShiny(dex);
      this.female = !!female && (this.shiny ? hasFemaleShiny(dex) : hasFemale(dex));
      this.scale = scale;
      this.base = 'Idle';
      this.cur = 'Idle';
      this.frame = 0;
      this.t = 0;              // tiempo dentro del fotograma, en 1/60 s
      this.speed = 1;
      this.once = false;
      this.hold = false;       // se queda en el último fotograma (Faint)
      this.done = false;
      this.dir = 0;
      // Las hojas se cargan al dibujarse por primera vez; la run las precarga
      // todas con preload() para que no parpadeen al primer ataque.
    }

    loop(anim, speed = 1) {
      this.base = anim;
      if (!this.once && this.cur !== anim) this._start(anim, false);
      if (!this.once) this.speed = speed;
    }

    /** opts: { speed, hold } */
    play(anim, opts = {}) {
      this._start(anim, true);
      this.speed = opts.speed || 1;
      this.hold = !!opts.hold;
    }

    /** ¿Está sonando una animación de una vez sin terminar? */
    busy() { return this.once && !this.done; }

    /** Progreso 0..1 de la animación actual. */
    progress() {
      const m = animMeta(this.dex, this.cur, this.shiny, this.female);
      if (!m) return 1;
      let total = 0, before = 0;
      for (let i = 0; i < m.n; i++) { if (i < this.frame) before += m.d[i]; total += m.d[i]; }
      return total ? (before + this.t) / total : 1;
    }

    _start(anim, once) {
      this.cur = animName(this.dex, anim, this.shiny, this.female) || 'Idle';
      this.frame = 0; this.t = 0;
      this.once = once; this.done = false;
    }

    update(dt) {
      const m = animMeta(this.dex, this.cur, this.shiny, this.female);
      if (!m || this.done) return;
      this.t += dt * 60 * this.speed;
      while (this.t >= m.d[this.frame]) {
        this.t -= m.d[this.frame];
        this.frame++;
        if (this.frame >= m.n) {
          if (this.once) {
            if (this.hold) { this.frame = m.n - 1; this.done = true; return; }
            // Vuelve a la animación de fondo.
            this._start(this.base, false);
            this.speed = 1;
            return;
          }
          this.frame = 0;
        }
      }
    }

    /** Dibuja con los pies en (x, y). opts: { flash, alpha } */
    draw(ctx, x, y, opts = {}) {
      let m = animMeta(this.dex, this.cur, this.shiny, this.female);
      let s = sheet(this.dex, this.cur, this.shiny, this.female);
      const k = PX * this.scale;
      if (s && !s.ready) {
        // Mientras carga esta animación, enseña Idle si ya está.
        const idle = sheet(this.dex, 'Idle', this.shiny, this.female);
        if (idle && idle.ready) { s = idle; m = animMeta(this.dex, 'Idle', this.shiny, this.female); }
      }
      const frame = s === sheet(this.dex, this.cur, this.shiny, this.female) ? this.frame : 0;
      if (!m || !s || !s.ready) {
        // Respaldo: bolita, por si falta el fichero.
        ctx.fillStyle = opts.color || '#6b7a94';
        ctx.beginPath(); ctx.arc(x, y - 12 * k, 8 * k, 0, 6.2832); ctx.fill();
        return;
      }
      const row = Math.min(this.dir, m.r - 1);
      const alpha = opts.alpha == null ? 1 : opts.alpha;
      if (alpha <= 0) return;
      const sx = Math.min(frame, m.n - 1) * m.w, sy = row * m.h;
      const dx = Math.round(x - m.ax * k), dy = Math.round(y - m.ay * k);
      const prev = ctx.globalAlpha;
      if (alpha < 1) ctx.globalAlpha = prev * alpha;
      // Destello: blanco entero (enemigos) o medio blanco encima (tu Pokémon).
      if (!opts.flash || opts.softFlash) ctx.drawImage(s.img, sx, sy, m.w, m.h, dx, dy, m.w * k, m.h * k);
      if (opts.flash) {
        if (opts.softFlash) ctx.globalAlpha = prev * alpha * 0.55;
        ctx.drawImage(white(s.img), sx, sy, m.w, m.h, dx, dy, m.w * k, m.h * k);
      }
      ctx.globalAlpha = prev;
    }
  }

  return { PX, meta, hasShiny, hasFemale, hasFemaleShiny, hovers, white, animMeta, sheet, preload, dirFromAngle, bodyRadius, bodyHeight, playerScale, playerRadius,
           drawShadow, Animator, ANIMS, get sheetCount() { return sheets.size; } };
})();
