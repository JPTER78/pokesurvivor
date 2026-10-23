/* ============ camera.js — vista y transformación mundo<->pantalla ============
 * El ancho visible del mundo es constante (VIEW_W) sea cual sea el tamaño de
 * ventana, así el juego se siente igual en cualquier pantalla.
 */
G.Camera = {
  x: 0, y: 0,
  scale: 1,
  VIEW_W: 768,              // un 20% más de vista que al principio (640)
  shake: 0,
  _sx: 0, _sy: 0,

  /** Recalcula la escala para el tamaño actual del canvas. */
  dpr: 1,

  // En pantallas más anchas que 16:9 (móviles en horizontal) se asegura
  // también un alto mínimo de mundo, para no ver una franja estrecha.
  MIN_VIEW_H: 420,

  // Luminosfera: la vista se aleja (zoom > 1 = se ve más mundo); va hacia zoomTo poco a poco.
  zoom: 1, zoomTo: 1, _cw: 0, _ch: 0,

  resize(cssW, cssH, dpr = 1) {
    this.dpr = dpr;
    this._cw = cssW; this._ch = cssH;
    this.fit();
  },

  fit() {
    this.scale = Math.min(this._cw / this.VIEW_W, this._ch / this.MIN_VIEW_H) / this.zoom;
    this.w = this._cw / this.scale;
    this.h = this._ch / this.scale;
  },

  follow(tx, ty, dt) {
    if (this.zoom !== this.zoomTo) {
      this.zoom = Math.abs(this.zoom - this.zoomTo) < 0.003 ? this.zoomTo : G.U.damp(this.zoom, this.zoomTo, 3, dt);
      this.fit();
    }
    this.x = G.U.damp(this.x, tx, 9, dt);
    this.y = G.U.damp(this.y, ty, 9, dt);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.4);
      const a = this.shake * 7;
      this._sx = G.U.rand(-a, a);
      this._sy = G.U.rand(-a, a);
    } else { this._sx = this._sy = 0; }
  },

  kick(amount) {
    if (G.Settings.get('calm')) amount *= 0.25;      // "menos sacudidas"
    this.shake = Math.min(1.2, this.shake + amount);
  },

  /** Aplica la transformación de cámara al contexto. */
  apply(ctx) {
    // Redondea a píxeles físicos de pantalla: sin esto aparecen juntas de
    // 1 px entre chunks y los sprites "tiemblan" al moverse.
    const k = this.scale * this.dpr;
    ctx.translate(Math.round((-this.left() + this._sx) * k) / k,
                  Math.round((-this.top() + this._sy) * k) / k);
  },

  left() { return this.x - this.w / 2; },
  top() { return this.y - this.h / 2; },

  /** ¿Está el punto dentro de la vista (con margen)? */
  sees(x, y, pad = 60) {
    return x > this.left() - pad && x < this.left() + this.w + pad &&
           y > this.top() - pad && y < this.top() + this.h + pad;
  },

  /** Radio del círculo que envuelve la vista: usado para spawnear fuera. */
  outerRadius() { return Math.hypot(this.w, this.h) / 2 + 40; }
};
