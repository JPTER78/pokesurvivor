/* ============ hud.js — interfaz dentro del canvas ============
 * Se dibuja en coordenadas de PANTALLA (sin la transformación de cámara).
 */
G.HUD = (() => {
  const F = (w, s) => `${w} ${s}px Pixelify,"Segoe UI",system-ui,sans-serif`;
  /** Parte un texto en líneas de como mucho maxW de ancho (con la letra que tenga ctx). */
  function wrap(ctx, text, maxW) {
    const out = [];
    let cur = '';
    for (const word of String(text).split(' ')) {
      const t = cur ? cur + ' ' + word : word;
      if (cur && ctx.measureText(t).width > maxW) { out.push(cur); cur = word; } else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  }

  /** Cartel encima de una esfera: su nombre y, con el ratón encima, también lo que hace. */
  function orbTip(ctx, id, cx, by, full, w) {
    const o = G.Orbs.BY[id];
    tipBox(ctx, G.T(o.name), full ? G.T(o.desc) : '', o.col, cx, by, w);
  }

  /** Cartelito centrado en cx y apoyado en by: un título y, si lo hay, un texto debajo (partido en líneas). */
  function tipBox(ctx, name, desc, col, cx, by, w) {
    ctx.font = F(600, 11);
    const lines = desc ? wrap(ctx, desc, 240) : [];
    ctx.font = F(800, 12);
    let bw = ctx.measureText(name).width;
    ctx.font = F(600, 11);
    for (const l of lines) bw = Math.max(bw, ctx.measureText(l).width);
    bw += 16;
    const bh = 20 + lines.length * 14, bx = G.U.clamp(cx - bw / 2, 4, w - bw - 4), y = by - bh;
    ctx.save();
    roundRect(ctx, bx, y, bw, bh, 8);
    ctx.fillStyle = 'rgba(10,14,28,.92)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = F(800, 12); ctx.fillStyle = col;
    ctx.fillText(name, bx + bw / 2, y + 14);
    ctx.font = F(600, 11); ctx.fillStyle = '#e6ecff';
    lines.forEach((l, k) => ctx.fillText(l, bx + bw / 2, y + 28 + k * 14));
    ctx.restore();
  }

  /** Las cartas de mejora que llevas en la partida (sin la Baya Zidra, que se gasta al cogerla). */
  function cardList(pl) {
    const taken = pl.statsTaken || {};
    return G.LevelUp.STATS.filter(s => s.id !== 'heal' && taken[s.id] > 0)
      .map(s => ({ s, n: taken[s.id], full: !!s.max && taken[s.id] >= s.max }));
  }

  /**
   * Bioma, derrotados y monedas (y caramelos en Halloween) en una línea. Los
   * números van con su icono, así no hay que decir "1 monedas". Devuelve el
   * ancho; con x === null sólo mide.
   */
  function runInfo(ctx, pl, x, y, align, size) {
    const IS = Math.round(size * 1.5), GAP = Math.round(size * 0.9);
    const nums = [['ball', pl.kills], ['coin', pl.coins]];
    if (G.Halloween.inRun) nums.push(['candy', pl.candy || 0]);
    ctx.font = F(800, size);
    const parts = [];
    if (G.World.biomeName) parts.push({ text: G.World.biomeName().toUpperCase(), col: '#c9d6ee' });
    for (const [icon, v] of nums) parts.push({ icon }, { text: Number(v).toLocaleString(G.I18n.locale), col: '#f4f8ff' });
    const widthOf = q => q.icon ? IS + 4 : ctx.measureText(q.text).width;
    const total = parts.reduce((a, q, i) => a + widthOf(q) + (i && !parts[i - 1].icon ? GAP : 0), 0);
    if (x === null) return total;
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.textAlign = 'left';
    parts.forEach((q, i) => {
      if (i && !parts[i - 1].icon) cx += GAP;
      if (q.icon) G.Icons.draw(ctx, q.icon, cx, y - IS + Math.round(size * 0.2), IS);
      else { ctx.fillStyle = q.col; ctx.fillText(q.text, cx, y); }
      cx += widthOf(q);
    });
    return total;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function bar(ctx, x, y, w, h, frac, col, bg = 'rgba(0,0,0,.55)') {
    roundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
    if (frac > 0) {
      ctx.save();
      roundRect(ctx, x, y, w, h, h / 2); ctx.clip();
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w * G.U.clamp(frac, 0, 1), h);
      ctx.restore();
    }
  }

  function draw(ctx, w, h, pl, st) {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    G.Touch.clearButtons();
    const touch = G.Touch.active;

    // ---------- barra de experiencia (borde superior) ----------
    const xpF = pl.xp / pl.xpNext;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0, 0, w, 7);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#4fd1ff'); g.addColorStop(1, '#a98bff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w * G.U.clamp(xpF, 0, 1), 7);

    // ---------- vida + nivel ----------
    const sa = G.Touch.safeArea();
    const px = 16 + sa.left, py = 20 + sa.top;     // lejos de la muesca del iPhone
    ctx.font = F(800, 13);
    ctx.fillStyle = '#eaf2ff';
    ctx.textAlign = 'left';
    ctx.fillText(pl.mon.name, px, py + 10);

    ctx.font = F(700, 11);
    ctx.fillStyle = '#ffcb3d';
    ctx.fillText('Nv. ' + pl.level, px, py + 26);

    bar(ctx, px + 48, py + 17, 168, 11, pl.hp / pl.maxHp, '#ff5f6d');
    ctx.font = F(700, 10);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(pl.hp) + ' / ' + Math.round(pl.maxHp), px + 48 + 84, py + 26);

    // buffs activos
    const COL = { atk: '#ff6b4d', patk: '#ff6b4d', satk: '#c47bff', spd: '#7fe0ff', def: '#b0b8c8', regen: '#5fe08a' };
    const LBL = { atk: 'ATK', patk: 'ATK', satk: 'AT.E', spd: 'VEL', def: 'DEF', regen: 'REG' };
    let bx = px;
    ctx.textAlign = 'left';
    for (const k in pl.buffs) {
      const b = pl.buffs[k];
      if (b.n <= 0) continue;
      ctx.font = F(800, 9);
      const txt = LBL[k] + ' ×' + b.n;
      const tw = ctx.measureText(txt).width + 12;
      roundRect(ctx, bx, py + 34, tw, 15, 7);
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fill();
      ctx.fillStyle = COL[k];
      ctx.fillText(txt, bx + 6, py + 45);
      bx += tw + 5;
    }

    // ---------- reloj / bioma / kills ----------
    ctx.textAlign = 'center';
    ctx.font = F(800, 26);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.fillText(G.U.mmss(st.time), w / 2, 42);
    // En el móvil, bioma, derrotados y monedas van a la derecha del reloj (abajo
    // estorbaría al dedo); en el ordenador van a la derecha de los ataques.
    // Si no caben antes del clima, debajo del reloj como antes.
    if (touch) {
      const rx = w / 2 + ctx.measureText(G.U.mmss(st.time)).width / 2 + 20;
      let lim = w - 16 - sa.right - 56;
      if (G.Weather.current) {
        ctx.font = F(800, 11);
        const wx = G.Weather.current;
        lim -= ctx.measureText(wx.name.toUpperCase() + ' · ' + Math.ceil(wx.left) + 's').width + 48;
      }
      if (rx + runInfo(ctx, pl, null, 0, 'left', 11) <= lim) runInfo(ctx, pl, rx, 37, 'left', 11);
      else runInfo(ctx, pl, w / 2, 58, 'center', 10);
    }

    // ---------- clima (arriba a la derecha) ----------
    const wx = G.Weather.current;
    if (wx) {
      ctx.font = F(800, 11);
      ctx.textAlign = 'left';
      const txt = wx.name.toUpperCase() + ' · ' + Math.ceil(wx.left) + 's';
      const tw = ctx.measureText(txt).width + 40;
      const x0 = w - tw - 16 - sa.right - (touch ? 56 : 0), y0 = 14 + sa.top;
      roundRect(ctx, x0, y0, tw, 26, 9);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
      G.Icons.draw(ctx, wx.icon, x0 + 6, y0 + 3, 20);
      ctx.fillStyle = wx.color;
      ctx.fillText(txt, x0 + 32, y0 + 17);
    }

    // ---------- barra del jefe ----------
    const boss = G.EnemyMgr.all().find(e => e.boss && !e.dead);
    if (boss) {
      ctx.textAlign = 'center';
      if (touch) {
        // En el móvil, la de siempre: fina y con el nombre dentro.
        const bw = Math.min(420, w - 80);
        bar(ctx, (w - bw) / 2, 70, bw, 12, boss.hp / boss.maxHp, '#ffcb3d');
        ctx.font = F(800, 10);
        ctx.fillStyle = '#20160a';
        ctx.fillText(boss.name.toUpperCase(), w / 2, 80);
      } else {
        // En el ordenador, más gruesa y con el nombre en blanco con borde.
        const bw = Math.min(520, w - 80);
        bar(ctx, (w - bw) / 2, 68, bw, 18, boss.hp / boss.maxHp, '#ffcb3d');
        ctx.font = F(800, 14);
        ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,14,4,.9)';
        ctx.strokeText(boss.name.toUpperCase(), w / 2, 82);
        ctx.fillStyle = '#fff';
        ctx.fillText(boss.name.toUpperCase(), w / 2, 82);
      }
    }

    // ---------- aviso ----------
    // ---------- shinies fuera de pantalla: destello en el borde ----------
    const cam = G.Camera, pulse = 0.6 + Math.sin(performance.now() / 160) * 0.4;
    for (const e of G.EnemyMgr.shinies()) {
      const sx = (e.x - cam.left()) * cam.scale, sy = (e.y - cam.top()) * cam.scale;
      if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
      const M = 34;
      const ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 60, h - M - 70);
      const a = Math.atan2(sy - ey, sx - ex);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.translate(ex, ey);
      ctx.fillStyle = '#9ae6ff';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
      ctx.lineTo(Math.cos(a + 2.5) * 12, Math.sin(a + 2.5) * 12);
      ctx.lineTo(Math.cos(a - 2.5) * 12, Math.sin(a - 2.5) * 12);
      ctx.fill();
      ctx.globalAlpha = 1;
      G.Icons.draw(ctx, 'shiny', -12, -12, 24);
      ctx.restore();
    }

    // Poder de altar activo.
    if (pl.power) {
      const pw = pl.power, txt = pw.def.name.toUpperCase() + ' ' + Math.ceil(pw.t) + 's';
      ctx.font = F(800, 9);
      ctx.textAlign = 'left';
      const tw = ctx.measureText(txt).width + 12;
      roundRect(ctx, bx, py + 34, tw, 15, 7);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fill();
      ctx.fillStyle = pw.def.color;
      ctx.fillText(txt, bx + 6, py + 45);
      bx += tw + 5;
    }

    // Móvil: las cartas de mejora, en columna pegada al borde izquierdo (abajo estorbarían al dedo).
    if (touch) {
      const cards = cardList(pl), CH = 18, CG = 4;
      ctx.font = F(800, 10);
      ctx.textAlign = 'left';
      const cw = Math.max(0, ...cards.map(c => 4 + 16 + 3 + ctx.measureText('×' + c.n).width + 6));
      let y = (h - cards.length * (CH + CG) + CG) / 2;
      const x = 6 + sa.left;
      for (const c of cards) {
        roundRect(ctx, x, y, cw, CH, 7);
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fill();
        G.Icons.draw(ctx, c.s.icon, x + 4, y + 1, 16);
        ctx.fillStyle = c.full ? '#ffd23f' : '#eaf2ff';
        ctx.fillText('×' + c.n, x + 23, y + 13);
        y += CH + CG;
      }
    }

    if (G.Coop.active) drawCoop(ctx, w, h, pl, px, py + (bx > px ? 56 : 40));

    // Grieta: flecha grande que late en el borde si no se ve, y si se ve, una
    // flecha que bota encima; en la arena, cuenta atrás.
    const rift = G.Rift.rift;
    if (rift) {
      const sx = (rift.x - cam.left()) * cam.scale, sy = (rift.y - 40 - cam.top()) * cam.scale;
      const now = performance.now() / 1000, beat = 0.5 + Math.sin(now * 7) * 0.5;
      const label = 'GRIETA · ' + Math.round(G.U.dist(pl.x, pl.y, rift.x, rift.y) / 32) + ' m · ' + Math.ceil(rift.ttl) + ' s';
      const off = sx < 0 || sx > w || sy < 0 || sy > h;
      ctx.save();
      if (off) {
        const M = 52, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
        const a = Math.atan2(sy - ey, sx - ex), ca = Math.cos(a), sa = Math.sin(a);
        ctx.translate(ex, ey);
        // Halo que late.
        ctx.globalAlpha = 0.18 + beat * 0.22;
        ctx.fillStyle = '#b48aff';
        ctx.beginPath(); ctx.arc(0, 0, 30 + beat * 8, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
        const tri = (k) => {
          ctx.beginPath();
          ctx.moveTo(ca * 40 * k, sa * 40 * k);
          ctx.lineTo(Math.cos(a + 2.45) * 20 * k, Math.sin(a + 2.45) * 20 * k);
          ctx.lineTo(Math.cos(a - 2.45) * 20 * k, Math.sin(a - 2.45) * 20 * k);
          ctx.closePath();
        };
        tri(1.12); ctx.fillStyle = '#1a0b33'; ctx.fill();
        tri(1); ctx.fillStyle = beat > 0.5 ? '#e2d0ff' : '#a06bff'; ctx.fill();
        ctx.font = F(800, 12);
        ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
        const lx = -ca * 34, ly = -sa * 30 + 4;
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = '#e2d0ff';
        ctx.fillText(label, lx, ly);
      } else {
        // Encima de la grieta: flecha hacia abajo que bota.
        const by = sy - 46 - Math.abs(Math.sin(now * 4)) * 10;
        ctx.translate(sx, by);
        ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(15, -12); ctx.lineTo(0, 8); ctx.closePath();
        ctx.lineWidth = 4; ctx.strokeStyle = '#1a0b33'; ctx.stroke();
        ctx.fillStyle = beat > 0.5 ? '#e2d0ff' : '#a06bff'; ctx.fill();
        ctx.font = F(800, 11); ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        const l2 = 'GRIETA · ' + Math.ceil(rift.ttl) + ' s';
        ctx.strokeText(l2, 0, -18); ctx.fillStyle = '#e2d0ff'; ctx.fillText(l2, 0, -18);
      }
      ctx.restore();
    }
    if (G.Rift.inArena) {
      ctx.textAlign = 'center';
      ctx.font = F(800, 12);
      ctx.fillStyle = '#d9c2ff';
      ctx.fillText('GRIETA · ' + G.U.mmss(G.Rift.timeLeft), w / 2, boss ? 104 : 76);
    }

    // Eventos: cuenta atrás, flecha al Pokémon perdido / a la marca y a los duendes.
    G.Events.drawHud(ctx, w, h, pl, F);

    // Aviso propio al abrirse una grieta (no lo tapan los otros avisos).
    if (rift && rift.t < 4.5) {
      const a = Math.min(1, rift.t * 4, (4.5 - rift.t) * 2), pop = 1 + Math.max(0, 0.25 - rift.t) * 1.6;
      const y0 = h * 0.2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(w / 2, y0); ctx.scale(pop, pop);
      ctx.font = F(800, 20);
      const t1 = '¡SE HA ABIERTO UNA GRIETA!', t2 = 'Sigue la flecha morada: dentro te espera un legendario';
      const bw = Math.min(w - 24, Math.max(ctx.measureText(t1).width, (ctx.font = F(700, 11), ctx.measureText(t2).width)) + 36);
      roundRect(ctx, -bw / 2, -26, bw, 52, 10);
      ctx.fillStyle = 'rgba(26,11,51,.88)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#b48aff'; ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = F(800, 20); ctx.fillStyle = '#e2d0ff'; ctx.fillText(t1, 0, -2);
      ctx.font = F(700, 11); ctx.fillStyle = '#c9b0ff'; ctx.fillText(t2, 0, 16);
      ctx.restore();
    }

    const ban = G.Spawner.banner();
    if (ban) {
      const a = Math.min(1, ban.t * 1.6);
      ctx.save();
      ctx.globalAlpha = a;
      // Siempre centrado (antes heredaba la alineación de lo último dibujado, p.
      // ej. la flecha de un duende del tesoro, y salía descolocado).
      ctx.textAlign = 'center';
      // En el móvil las frases largas (las esferas) se salían por los dos lados:
      // se parten en líneas y, si aún no caben en tres, la letra baja.
      let size = 22, lines;
      for (;;) {
        ctx.font = F(800, size);
        lines = wrap(ctx, ban.text, w - 40);
        if (lines.length <= 3 || size <= 14) break;
        size -= 2;
      }
      ctx.fillStyle = '#ffcb3d';
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4;
      // (Nunca por encima de la línea de bioma, derrotados y monedas, bajo el reloj.)
      const y0 = Math.max(78 + size * 0.5, h * 0.3 - (lines.length - 1) / 2 * size * 1.25);
      lines.forEach((ln, i) => {
        const y = y0 + i * size * 1.25;
        ctx.strokeText(ln, w / 2, y);
        ctx.fillText(ln, w / 2, y);
      });
      ctx.restore();
    }

    // ---------- ranura de movimientos ----------
    const S = 54, GAP = 9;
    const n = Math.max(1, pl.slots.length);
    const totalW = n * S + (n - 1) * GAP;
    let sx = (w - totalW) / 2;
    // Por encima de la barra de inicio del iPhone (allí los toques a veces no llegan).
    let sy = h - S - 18 - (touch ? Math.min(28, G.Touch.safeArea().bottom) : 0);
    // En móvil, donde la haya puesto el jugador: el bloque objeto + todos los
    // huecos (aunque aún no estén llenos), por su centro, como en el editor
    // (layout-ui.js); los ataques nuevos van saliendo hacia la derecha.
    const pb = touch && G.Touch.spot('bar');
    if (pb) {
      const nAll = Math.max(n, pl.maxMoves), bw = S + 18 + nAll * S + (nAll - 1) * GAP;
      sx = G.U.clamp(pb[0] * w - bw / 2, 6, Math.max(6, w - bw - 6)) + S + 18;
      sy = G.U.clamp(pb[1] * h - S / 2, 24, h - S - 6);
    }
    const BOND = '#ff8ad8';
    const cdOf = m => m.kind === 'orbit' ? 0 : G.U.clamp(m.t / (m.cd * pl.cdMul), 0, 1);

    for (let i = 0; i < n; i++) {
      const g = pl.slots[i] || [];
      const m = g[0];
      const fused = g.length > 1;
      const on = i === pl.active;
      const x = sx + i * (S + GAP);
      const y = on ? sy - 6 : sy;
      // Tocar (o hacer clic en) un icono activa ese movimiento.
      if (m) G.Touch.addButton(x, y, S, S, () => { if (G.Game.state === 'playing' && pl.active !== i) { pl.setActive(i); G.Audio.sfx('click'); } }, GAP / 2 + 3);
      const col = m ? G.U.TYPE_COLOR[m.type] : '#4a5468';

      // fondo
      roundRect(ctx, x, y, S, S, 12);
      ctx.fillStyle = on ? 'rgba(20,30,50,.95)' : 'rgba(10,16,28,.8)';
      ctx.fill();
      ctx.lineWidth = on ? 2.5 : fused || (m && m.evolved) ? 2 : 1.2;
      // Vínculo: borde rosa. Evolucionado: dorado.
      ctx.strokeStyle = fused ? BOND : m && m.evolved ? '#ffd23f' : on ? col : 'rgba(140,170,210,.22)';
      ctx.stroke();

      if (!m) continue;

      if (fused) {
        // Vínculo: los movimientos en una cuadrícula de 2×2, cada uno con su recarga.
        const C = 22, P = (S - C * 2) / 3;
        g.forEach((gm, k) => {
          const cx = x + P + (k % 2) * (C + P), cy = y + P + Math.floor(k / 2) * (C + P);
          G.Icons.draw(ctx, 'move:' + gm.id, cx, cy, C);
          const f = cdOf(gm);
          if (f > 0) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(cx, cy, C, C * f); }
          if (gm.evolved) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1; ctx.strokeRect(cx + 0.5, cy + 0.5, C - 1, C - 1); }
          // Destello al lanzarse.
          const fl = 1 - (performance.now() - (gm.castAt || 0)) / 180;
          if (fl > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (fl * 0.55).toFixed(2) + ')'; ctx.fillRect(cx, cy, C, C); }
        });
      } else {
        // recarga: se vacía de abajo a arriba
        const cdFrac = cdOf(m);
        if (cdFrac > 0) {
          ctx.save();
          roundRect(ctx, x, y, S, S, 12); ctx.clip();
          ctx.fillStyle = 'rgba(0,0,0,.6)';
          ctx.fillRect(x, y, S, S * cdFrac);
          ctx.restore();
        }

        // emblema del tipo + insignia de la familia
        G.Icons.draw(ctx, 'move:' + m.id, x + (S - 32) / 2, y + (S - 32) / 2 - 2, 32);

        // nivel del movimiento (puntitos)
        const dots = m.def.maxLvl;
        const dw = 4, dgap = 2;
        const tw = dots * dw + (dots - 1) * dgap;
        for (let d = 0; d < dots; d++) {
          ctx.fillStyle = d < m.lvl ? col : 'rgba(255,255,255,.18)';
          ctx.fillRect(x + (S - tw) / 2 + d * (dw + dgap), y + S - 9, dw, 3);
        }
      }

      // tecla
      ctx.font = F(800, 9);
      ctx.fillStyle = fused ? BOND : on ? col : 'rgba(180,200,230,.6)';
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), x + 3, y + 10);

      // nombre encima del activo (con un vínculo: "Ascuas +2")
      if (on) {
        ctx.font = F(700, 10);
        ctx.textAlign = 'center';
        ctx.fillStyle = fused ? BOND : col;
        ctx.fillText(fused ? G.T(m.name, 'move') + ' +' + (g.length - 1) : G.T(m.name, 'move'), x + S / 2, y - 7);
      }
    }

    // ---------- vínculo guardado (aún no hay dos movimientos sueltos) ----------
    if (pl.bonds > 0) {
      const bx = sx + totalW + 12, by = sy + S / 2 - 12;
      G.Icons.draw(ctx, 'bond', bx, by, 24);
      if (pl.bonds > 1) {
        ctx.font = F(800, 10);
        ctx.textAlign = 'left';
        ctx.fillStyle = BOND;
        ctx.fillText('×' + pl.bonds, bx + 25, by + 20);
      }
    }

    // ---------- objeto equipado (a la izquierda de los movimientos) ----------
    {
      const ix = sx - S - 18, iy = sy;
      roundRect(ctx, ix, iy, S, S, 12);
      ctx.fillStyle = pl.item ? 'rgba(40,30,10,.9)' : 'rgba(10,16,28,.55)';
      ctx.fill();
      ctx.lineWidth = pl.item ? 2 : 1;
      ctx.strokeStyle = pl.item ? '#ffd23f' : 'rgba(140,170,210,.18)';
      ctx.stroke();
      if (pl.item) {
        G.Icons.draw(ctx, pl.item, ix + (S - 36) / 2, iy + (S - 36) / 2, 36);
        ctx.font = F(700, 9);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd23f';
        ctx.fillText(G.Items.BY[pl.item].name, ix + S / 2, iy - 6);
      }

      // ---------- ordenador: cartas de mejora a la izquierda del objeto ----------
      // (Antes sólo se veían en la pausa.) Icono y ×N, de dos en dos (una encima
      // de otra) para que ocupen poco; si son impares, Aprendizaje va sola a la
      // izquierda. Con el ratón encima, qué hace.
      const cards = touch ? [] : cardList(pl);
      if (cards.length) {
        const CH = 25, CG = 4, GAPX = 6, right = ix - 26;
        const mo = G.Input.mouse();
        ctx.font = F(800, 13);
        const cw = Math.max(...cards.map(c => 6 + 20 + 4 + ctx.measureText('×' + c.n).width + 8));
        const cols = [];
        let rest = cards;
        if (cards.length % 2) {
          const solo = cards.find(c => c.s.id === 'xp') || cards[cards.length - 1];
          cols.push([solo]);
          rest = cards.filter(c => c !== solo);
        }
        for (let i = 0; i < rest.length; i += 2) cols.push(rest.slice(i, i + 2));
        let tip = null;
        let x = right - cols.length * cw - (cols.length - 1) * GAPX;
        for (const col of cols) {
          col.forEach((c, k) => {
            const y = col.length === 1 ? iy + (S - CH) / 2 : iy + (S - 2 * CH - CG) / 2 + k * (CH + CG);
            roundRect(ctx, x, y, cw, CH, 8);
            ctx.fillStyle = 'rgba(10,16,28,.8)'; ctx.fill();
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = c.full ? '#ffd23f' : 'rgba(140,170,210,.3)';
            ctx.stroke();
            G.Icons.draw(ctx, c.s.icon, x + 6, y + (CH - 20) / 2, 20);
            ctx.font = F(800, 13);
            ctx.textAlign = 'left';
            ctx.fillStyle = c.full ? '#ffd23f' : '#f4f8ff';
            ctx.fillText('×' + c.n, x + 30, y + CH / 2 + 5);
            if (mo.x >= x && mo.x <= x + cw && mo.y >= y && mo.y <= y + CH) tip = { c, cx: x + cw / 2, y: iy };
          });
          x += cw + GAPX;
        }
        if (tip) tipBox(ctx, tip.c.s.title, tip.c.s.desc, tip.c.full ? '#ffd23f' : '#9fc4ff', tip.cx, tip.y - 6, w);
      }
    }

    // ---------- ordenador: bioma, derrotados y monedas a la derecha de los ataques ----------
    if (!touch) {
      const ix = sx + totalW + 28 + (pl.bonds > 1 ? 54 : pl.bonds > 0 ? 34 : 0);
      const tw = runInfo(ctx, pl, null, 0, 'left', 13);
      roundRect(ctx, ix, sy + (S - 34) / 2, tw + 20, 34, 9);
      ctx.fillStyle = 'rgba(10,16,28,.72)'; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(140,170,210,.22)'; ctx.stroke();
      runInfo(ctx, pl, ix + 10, sy + S / 2 + 5, 'left', 13);
    }

    // ---------- esferas (encima de los ataques; teclas 5-8) y sus mejoras activas ----------
    const orbs = pl.orbs || [], ob = pl.orbBuff || {};
    const buffs = Object.keys(ob).filter(id => ob[id] > 0);
    if (orbs.some(Boolean) || buffs.length) {
      const OS = 40, OG = 6, ow = G.Orbs.SLOTS * OS + (G.Orbs.SLOTS - 1) * OG;
      const ox = sx + totalW / 2 - ow / 2, oy = sy - 30 - OS;
      const cdF = G.U.clamp(G.Orbs.cd, 0, 1);
      for (let i = 0; i < G.Orbs.SLOTS; i++) {
        const o = orbs[i], x = ox + i * (OS + OG);
        roundRect(ctx, x, oy, OS, OS, 9);
        ctx.fillStyle = o ? 'rgba(20,24,44,.88)' : 'rgba(10,16,28,.45)';
        ctx.fill();
        const pick = o && !!G.Pad.name && i === G.Orbs.sel;      // con mando: la que usa X
        ctx.lineWidth = pick ? 2.5 : 1.2;
        ctx.strokeStyle = pick ? '#ffd23f' : o ? G.Orbs.BY[o.id].col : 'rgba(140,170,210,.18)';
        ctx.stroke();
        if (!o) continue;
        G.Touch.addButton(x, oy, OS, OS, () => G.Orbs.use(pl, i), OG / 2 + 2);
        G.Icons.draw(ctx, 'orb:' + o.id, x + (OS - 24) / 2, oy + (OS - 24) / 2, 24);
        if (cdF > 0) {
          ctx.save(); roundRect(ctx, x, oy, OS, OS, 9); ctx.clip();
          ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x, oy, OS, OS * cdF);
          ctx.restore();
        }
        ctx.font = F(800, 9);
        // Con mando: X usa la elegida, Y pasa a la siguiente (las teclas 5-8 no sirven ahí).
        if (G.Pad.name) { ctx.textAlign = 'left'; ctx.fillStyle = pick ? '#ffd23f' : 'rgba(180,200,230,.7)'; ctx.fillText(pick ? 'X' : 'Y', x + 3, oy + 10); }
        else if (!touch) { ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(180,200,230,.7)'; ctx.fillText(String(i + 5), x + 3, oy + 10); }
        if (o.n > 1) { ctx.textAlign = 'right'; ctx.fillStyle = '#f4f8ff'; ctx.fillText('×' + o.n, x + OS - 3, oy + OS - 4); }
      }
      // Qué hace cada una: ratón encima (PC), la elegida con mando, o la que acabas de coger (3 s).
      const mo = G.Input.mouse(), fresh = pl.orbNew && performance.now() - pl.orbNew.at < 3000 ? pl.orbNew.i : -1;
      let tip = -1, full = false;
      if (!touch) for (let i = 0; i < G.Orbs.SLOTS; i++) {
        const x = ox + i * (OS + OG);
        if (orbs[i] && mo.x >= x && mo.x <= x + OS && mo.y >= oy && mo.y <= oy + OS) { tip = i; full = true; }
      }
      if (tip < 0 && G.Pad.name && orbs[G.Orbs.sel]) tip = G.Orbs.sel;
      if (tip < 0 && fresh >= 0 && orbs[fresh]) tip = fresh;
      if (fresh >= 0 && orbs[fresh]) {
        const x = ox + fresh * (OS + OG), a = 1 - (performance.now() - pl.orbNew.at) / 3000;
        ctx.save(); ctx.globalAlpha = a;
        roundRect(ctx, x - 2, oy - 2, OS + 4, OS + 4, 11);
        ctx.lineWidth = 3; ctx.strokeStyle = G.Orbs.BY[orbs[fresh].id].col; ctx.stroke();
        ctx.restore();
      }
      if (tip >= 0) orbTip(ctx, orbs[tip].id, ox + tip * (OS + OG) + OS / 2, oy - 8, full, w);

      // Mejoras activas: icono y segundos que quedan.
      buffs.forEach((id, k) => {
        const bx = ox + ow + 10 + k * 30, by = oy + 4;
        G.Icons.draw(ctx, 'orb:' + id, bx, by, 24);
        ctx.font = F(800, 10); ctx.textAlign = 'center';
        ctx.fillStyle = G.Orbs.BY[id].col;
        ctx.fillText(Math.ceil(ob[id]) + 's', bx + 12, by + 35);
      });
    }

    // ---------- botón de pausa (táctil) ----------
    if (touch) {
      const sa = G.Touch.safeArea();
      const pp = G.Touch.spot('pause');
      const bx = pp ? G.U.clamp(pp[0] * w - 20, 4, w - 44) : w - 52 - Math.min(44, sa.right);
      const by = pp ? G.U.clamp(pp[1] * h - 20, 10, h - 44) : 12 + Math.min(20, sa.top), bs = 40;
      roundRect(ctx, bx, by, bs, bs, 10);
      ctx.fillStyle = 'rgba(10,16,28,.7)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244,248,255,.8)'; ctx.stroke();
      ctx.fillStyle = '#f4f8ff';
      ctx.fillRect(bx + 13, by + 11, 5, 18); ctx.fillRect(bx + 22, by + 11, 5, 18);
      G.Touch.addButton(bx, by, bs, bs, () => G.Game.togglePause(), 8);
    }

    // pista de controles
    if (st.time < 14) {
      ctx.font = F(600, 10);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(180,200,230,.55)';
      ctx.fillText(touch ? 'Arrastra el dedo para moverte  ·  toca un ataque para cambiarlo'
                         : 'WASD moverse  ·  1-4 / Q / E o clic en un ataque para cambiarlo  ·  Esc pausa', w / 2, h - 4);
    }

    ctx.restore();
  }

  // ---------------- cooperativo ----------------

  /**
   * - Vida de cada compañero debajo de la tuya.
   * - Flecha en el borde de la pantalla hacia los que no se ven, con su nombre
   *   y a cuántos metros están (roja y parpadeando si está caído).
   * - Si has caído tú: aviso y barra de "te están levantando".
   */
  function drawCoop(ctx, w, h, pl, px, top) {
    const cam = G.Camera;
    const t = performance.now() / 1000;
    let y = top;
    ctx.textAlign = 'left';
    for (const m of G.Coop.mates) {
      if (!m.connected) continue;
      const o = m.pl;
      ctx.font = F(800, 10);
      ctx.fillStyle = m.color;
      G.I18n.rawCanvas(ctx, 'fillText', m.name, px, y + 9);
      const lx = px + 78;
      bar(ctx, lx, y + 1, 110, 8, o.dead ? 0 : o.hp / o.maxHp, o.dead ? '#ff5f6d' : '#5fe08a');
      if (o.dead) {
        ctx.font = F(800, 9);
        ctx.fillStyle = Math.sin(t * 8) > 0 ? '#ff8a96' : '#ffd0d5';
        ctx.fillText('CAÍDO', lx + 116, y + 9);
      }
      y += 15;
    }

    // Flechas hacia los compañeros fuera de la vista.
    for (const m of G.Coop.mates) {
      if (!m.connected) continue;
      const o = m.pl;
      const sx = (o.x - cam.left()) * cam.scale, sy = (o.y - o.bodyH * 0.5 - cam.top()) * cam.scale;
      if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
      const M = 42;
      const ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
      const a = Math.atan2(sy - ey, sx - ex);
      const metres = Math.round(G.U.dist(pl.x, pl.y, o.x, o.y) / 32);
      const col = o.dead ? (Math.sin(t * 8) > 0 ? '#ff5f6d' : '#ffd0d5') : m.color;
      ctx.save();
      ctx.translate(ex, ey);
      // Flecha
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, 6.2832); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28);
      ctx.lineTo(Math.cos(a + 2.4) * 14, Math.sin(a + 2.4) * 14);
      ctx.lineTo(Math.cos(a - 2.4) * 14, Math.sin(a - 2.4) * 14);
      ctx.closePath(); ctx.fill();
      // Inicial del compañero dentro del círculo
      ctx.font = F(800, 14);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      G.I18n.rawCanvas(ctx, 'fillText', m.name.charAt(0).toUpperCase(), 0, 5);
      // Nombre y distancia: al lado contrario de la flecha, para que no se salga
      const lx = -Math.cos(a) * 30, ly = -Math.sin(a) * 26 + 4;
      ctx.font = F(800, 12);
      const label = o.dead ? G.I18n.f('¡{x} necesita ayuda! · {x} m', m.name, metres) : m.name + ' · ' + metres + ' m';
      ctx.textAlign = Math.cos(a) > 0.3 ? 'right' : Math.cos(a) < -0.3 ? 'left' : 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      G.I18n.rawCanvas(ctx, 'strokeText', label, lx, ly);
      ctx.fillStyle = col;
      G.I18n.rawCanvas(ctx, 'fillText', label, lx, ly);
      ctx.restore();
    }

    // Tú, caído.
    if (pl.dead) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = F(800, 20);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      const msg = G.Coop.players().every(p => p.dead) ? 'Habéis caído todos…' : 'Has caído: un compañero puede levantarte';
      ctx.strokeText(msg, w / 2, h * 0.62);
      ctx.fillStyle = '#ffb0b8';
      ctx.fillText(msg, w / 2, h * 0.62);
      const f = (pl.reviveT || 0) / G.Player.REVIVE_TIME;
      if (f > 0) bar(ctx, w / 2 - 110, h * 0.62 + 12, 220, 10, f, '#5fe08a');
      // Mirar a un compañero vivo mientras tanto (botón, Q / E o LB / RB).
      const w0 = G.Game.watching;
      if (w0 || G.Coop.puppets().some(p => !p.dead)) {
        const m = w0 && G.Coop.mates.find(x => x.pl === w0);
        const label = (m ? G.I18n.f('Viendo a {x}', m.name) + ' · ' + G.I18n.t('cambiar') : G.I18n.t('Ver a un compañero'))
          + (G.Touch.active ? '' : '  (E)');
        ctx.font = F(800, 13);
        const bw = ctx.measureText(label).width + 28, bh = 28, bx = w / 2 - bw / 2, by = h * 0.62 + 32;
        roundRect(ctx, bx, by, bw, bh, 8);
        ctx.fillStyle = 'rgba(10,16,28,.75)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = m ? m.color : 'rgba(244,248,255,.8)'; ctx.stroke();
        ctx.fillStyle = '#f4f8ff';
        G.I18n.rawCanvas(ctx, 'fillText', label, w / 2, by + 19);
        G.Touch.addButton(bx, by, bw, bh, () => G.Game.cycleWatch(1), 8);
      }
      ctx.restore();
    }
  }

  return { draw, roundRect, bar };
})();
