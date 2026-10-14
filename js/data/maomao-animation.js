/* Mao Mao V0.3 — fotogramas intermedios creados desde sus sprites aprobados.
 *
 * La fuente sigue siendo cada PNG original (40x44, 8 direcciones). Tras cargarlo
 * generamos UNA hoja Canvas en memoria con más poses: pasos con elevación,
 * respiración, preparación/recuperación del disparo, daño y caída.
 * No se descargan recursos externos y no se alteran los Pokémon normales.
 * Los fotogramas expandidos NO se usan para cambiar dimensiones o colisiones.
 */
G.MaomaoAnimation = (() => {
  'use strict';
  const DEX = 10001;

  // from = fotograma de la hoja original; x/y = desplazamiento en píxeles
  // de arte; h = estiramiento leve con los pies como ancla (respiración).
  // Cada variante conserva la silueta y la paleta originales de Mao Mao.
  const layouts = {
    Idle: {
      d: [15, 15, 15, 15],
      frames: [
        { from: 0, h: 1 },
        { from: 0, h: 1.018 },
        { from: 0, h: 1.032 },
        { from: 0, h: 1.015 }
      ]
    },
    Walk: {
      d: [4, 4, 4, 4, 4, 4],
      frames: [
        { from: 0, x: 0,   y: 0 },
        { from: 0, x: -0.6,y: -1 },
        { from: 1, x: 0,   y: -2 },
        { from: 1, x: 0.6, y: -1 },
        { from: 0, x: 0,   y: 0 },
        { from: 0, x: -0.3,y: -1 }
      ]
    },
    Attack: {
      d: [5, 5, 5, 5, 6],
      frames: [
        { from: 0, x: -0.6, y: 0 },
        { from: 0, x: -1,   y: -1 },
        { from: 1, x: 0.8,  y: -1 },
        { from: 2, x: 1.5,  y: -1 },
        { from: 2, x: 0,    y: 0 }
      ]
    },
    Shoot: {
      d: [5, 5, 5, 5, 6],
      frames: [
        { from: 0, x: -0.7, y: 0 },
        { from: 0, x: -1,   y: -1 },
        { from: 1, x: 0,    y: -1 },
        { from: 2, x: 1.5,  y: -1 },
        { from: 2, x: 0,    y: 0 }
      ]
    },
    Charge: {
      d: [7, 7, 7, 7],
      frames: [
        { from: 0, h: 1 },
        { from: 0, h: 1.025, y: -1 },
        { from: 1, h: 1.035, y: -1 },
        { from: 1, h: 1.015 }
      ]
    },
    Hurt: {
      d: [5, 5, 7],
      frames: [
        { from: 0, x: 0,    y: 0 },
        { from: 0, x: -1.5, y: -1 },
        { from: 0, x: -0.5, y: 0 }
      ]
    },
    Faint: {
      d: [8, 7, 8, 10, 28],
      frames: [
        { from: 0, y: 0 },
        { from: 0, y: -1 },
        { from: 1, y: 0 },
        { from: 2, y: 0 },
        { from: 2, y: 1 }
      ]
    }
  };

  /** Devuelve null si no se puede generar; el motor usará la hoja sin cambios. */
  function expand(anim, source, base) {
    const layout = layouts[anim];
    if (!layout || !source || !base) return null;
    if (source.width !== base.w * base.n || source.height !== base.h * base.r) return null;
    if (layout.frames.some(f => f.from >= base.n)) return null;

    const canvas = document.createElement('canvas');
    canvas.width = base.w * layout.frames.length;
    canvas.height = base.h * base.r;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false; // conservar arte pixelado, sin difuminar

    for (let dir = 0; dir < base.r; dir++) {
      // Las diagonales de la hoja original reutilizan vistas cardinales;
      // una inclinación MUY leve les da una silueta direccional diferenciada.
      const side = (dir === 1 || dir === 2 || dir === 3) ? 1
        : (dir === 5 || dir === 6 || dir === 7) ? -1 : 0;
      const diagonal = dir % 2 === 1;
      for (let i = 0; i < layout.frames.length; i++) {
        const pose = layout.frames[i];
        const stretch = pose.h || 1;
        const shiftX = side * (pose.x || 0);
        const shiftY = pose.y || 0;
        ctx.save();
        // Origen en los pies, de forma que ninguna pose mueva el ancla.
        ctx.translate(i * base.w + base.ax, dir * base.h + base.ay);
        if (diagonal) ctx.transform(1, 0, -side * 0.035, 1, 0, 0);
        ctx.drawImage(source,
          pose.from * base.w, dir * base.h, base.w, base.h,
          Math.round(-base.ax + shiftX),
          Math.round(-base.ay * stretch + shiftY),
          base.w, Math.round(base.h * stretch));
        ctx.restore();
      }
    }
    return {
      img: canvas,
      meta: { ...base, n: layout.frames.length, d: layout.d.slice() }
    };
  }

  return { DEX, expand };
})();
