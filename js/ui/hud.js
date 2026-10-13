/* ============ hud.js — interfaz dentro del canvas ============
 * Se dibuja en coordenadas de PANTALLA (sin la transformación de cámara).
 */
G.HUD = (() => {
  const F = (w, s) => `${w} ${s}px Pixelify,"Segoe UI",system-ui,sans-serif`;
  let showStats = false;
  function toggleStats() { showStats = !showStats; }

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

  function fmtHp(n) {
    n = Math.max(0, Math.ceil(n));
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    return n.toLocaleString('es-ES');
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
    const px = 16, py = 20;
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

    // Botón para alternar estadísticas en tiempo real
    const btnStatsX = px + 48 + 168 + 8, btnStatsY = py + 16, btnStatsW = 54, btnStatsH = 14;
    roundRect(ctx, btnStatsX, btnStatsY, btnStatsW, btnStatsH, 4);
    ctx.fillStyle = showStats ? '#ffd23f' : 'rgba(8, 14, 28, 0.7)';
    ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = F(800, 8.5);
    ctx.fillStyle = showStats ? '#10131a' : '#ffd23f';
    ctx.textAlign = 'center';
    ctx.fillText('[C] STATS', btnStatsX + btnStatsW / 2, btnStatsY + 10.5);
    G.Touch.addButton(btnStatsX, btnStatsY, btnStatsW, btnStatsH, toggleStats);

    // buffs activos con temporizador y barra de drenado continuo
    const COL = { atk: '#ff6b4d', spd: '#7fe0ff', def: '#b0b8c8', regen: '#5fe08a' };
    const LBL = { atk: 'ATK', spd: 'VEL', def: 'DEF', regen: 'REG' };
    let bx = px;
    ctx.textAlign = 'left';
    let hasBuffs = false;
    for (const k in pl.buffs) {
      const b = pl.buffs[k];
      if (b.n <= 0) continue;
      hasBuffs = true;

      const pct = Math.round(b.n * b.amount * 100);
      const timeStr = b.t >= 10 ? Math.ceil(b.t) + 's' : b.t.toFixed(1) + 's';
      ctx.font = F(800, 9);
      const labelTxt = LBL[k] + ' ×' + b.n + ' (+' + pct + '%)';
      const labelW = ctx.measureText(labelTxt).width;
      ctx.font = F(700, 8);
      const timeW = ctx.measureText(timeStr).width;
      const tw = labelW + timeW + 16;
      const th = 17;
      const by = py + 34;

      // 1. Fondo base oscuro
      roundRect(ctx, bx, by, tw, th, 5);
      ctx.fillStyle = 'rgba(8, 14, 28, 0.8)'; ctx.fill();

      // 2. Barra de tiempo decreciente (se drena de derecha a izquierda según b.t)
      const frac = G.U.clamp(b.t / (b.dur || 5), 0, 1);
      ctx.save();
      roundRect(ctx, bx, by, tw, th, 5);
      ctx.clip();
      ctx.fillStyle = COL[k] + '33';
      ctx.fillRect(bx, by, tw * frac, th);
      // Barrita inferior de progreso visible
      ctx.fillStyle = COL[k];
      ctx.fillRect(bx, by + th - 2.5, tw * frac, 2.5);
      ctx.restore();

      // 3. Borde del color del stat
      ctx.strokeStyle = COL[k] + 'aa';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 4. Texto de la etiqueta y porcentaje
      ctx.font = F(800, 9);
      ctx.fillStyle = COL[k];
      ctx.fillText(labelTxt, bx + 5, by + 11.5);

      // 5. Tiempo restante en segundos
      ctx.font = F(700, 8);
      ctx.fillStyle = '#fffdf0';
      ctx.fillText(timeStr, bx + 5 + labelW + 4, by + 11.5);

      bx += tw + 6;
    }

    // Poder de altar activo (estatua / bendición)
    if (pl.power) {
      const pw = pl.power, txt = pw.def.name.toUpperCase() + ' ' + Math.ceil(pw.t) + 's';
      ctx.font = F(800, 9);
      ctx.textAlign = 'left';
      const tw = ctx.measureText(txt).width + 12;
      roundRect(ctx, bx, py + 34, tw, 17, 6);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fill();
      ctx.strokeStyle = pw.def.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = pw.def.color;
      ctx.fillText(txt, bx + 6, py + 45.5);
      bx += tw + 6;
    }

    const hasBadges = bx > px;

    // ---------- panel de estadísticas en tiempo real (tecla C o click en [C] STATS) ----------
    if (showStats) {
      const sx = px, sy = py + (hasBadges ? 56 : 36);
      const sw = 236, sh = 92;

      roundRect(ctx, sx, sy, sw, sh, 6);
      ctx.fillStyle = 'rgba(8, 14, 28, 0.94)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255, 210, 63, 0.75)'; ctx.lineWidth = 1.5; ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = F(800, 10);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText('ESTADÍSTICAS EN VIVO', sx + 8, sy + 15);

      ctx.textAlign = 'right';
      ctx.font = F(600, 8.5);
      ctx.fillStyle = '#8fa3c4';
      ctx.fillText('(C para cerrar)', sx + sw - 8, sy + 15);

      const atkBuff = pl.buffs.atk.n > 0 ? ` (+${Math.round(pl.buffs.atk.n * pl.buffs.atk.amount * 100)}%)` : '';
      const defBuff = pl.buffs.def.n > 0 ? ` (+${Math.round(pl.buffs.def.n * pl.buffs.def.amount * 100)}%)` : '';
      const spdBuff = pl.buffs.spd.n > 0 ? ` (+${Math.round(pl.buffs.spd.n * pl.buffs.spd.amount * 100)}%)` : '';
      const rgnBuff = pl.buffs.regen.n > 0 ? ` (+${(pl.buffs.regen.n * pl.buffs.regen.amount).toFixed(1)}/s)` : '';

      const lines = [
        { lbl: 'PS:', val: `${Math.ceil(pl.hp)} / ${Math.round(pl.maxHp)}`, col: '#ff5f6d' },
        { lbl: 'ATQ:', val: `×${pl.atk.toFixed(2)}${atkBuff}`, col: pl.buffs.atk.n > 0 ? '#ff8e4d' : '#eaf2ff' },
        { lbl: 'DEF:', val: `${Math.round(pl.reduction * 100)}%${defBuff}`, col: pl.buffs.def.n > 0 ? '#5fb4ff' : '#eaf2ff' },
        { lbl: 'VEL:', val: `${Math.round(pl.spd)} px/s${spdBuff}`, col: pl.buffs.spd.n > 0 ? '#ffd23f' : '#eaf2ff' },
        { lbl: 'REC:', val: `-${Math.round((1 - pl.cdMul) * 100)}%`, col: '#d07fff' },
        { lbl: 'REG:', val: `+${pl.regen.toFixed(1)}/s${rgnBuff}`, col: pl.buffs.regen.n > 0 ? '#5fe08a' : '#eaf2ff' }
      ];

      ctx.textAlign = 'left';
      ctx.font = F(700, 9);
      for (let i = 0; i < lines.length; i++) {
        const col = i < 3 ? 0 : 1;
        const row = i % 3;
        const lx = sx + 8 + col * 116;
        const ly = sy + 32 + row * 19;
        ctx.fillStyle = '#8fa3c4';
        ctx.fillText(lines[i].lbl, lx, ly);
        ctx.fillStyle = lines[i].col;
        ctx.fillText(lines[i].val, lx + 26, ly);
      }
    }

    // ---------- reloj / bioma / kills ----------
    ctx.textAlign = 'center';
    ctx.font = F(800, 24);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.fillText(G.U.mmss(st.time), w / 2, 38);
    ctx.font = F(600, 9.5);
    ctx.fillStyle = '#8fa3c4';
    ctx.fillText(G.World.biomeName().toUpperCase() + '  ·  ' + pl.kills + ' DERROTADOS  ·  ' + pl.coins + ' MONEDAS', w / 2, 52);

    // ---------- clima (arriba a la derecha) ----------
    const wx = G.Weather.current;
    if (wx) {
      ctx.font = F(800, 11);
      ctx.textAlign = 'left';
      const txt = wx.name.toUpperCase() + ' · ' + Math.ceil(wx.left) + 's';
      const tw = ctx.measureText(txt).width + 40;
      const x0 = w - tw - 16 - (touch ? 56 : 0), y0 = 14;
      roundRect(ctx, x0, y0, tw, 26, 9);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
      G.Icons.draw(ctx, wx.icon, x0 + 6, y0 + 3, 20);
      ctx.fillStyle = wx.color;
      ctx.fillText(txt, x0 + 32, y0 + 17);
    }

    // ---------- barra(s) de jefe(s) ----------
    const bosses = G.EnemyMgr.all().filter(e => e.boss && !e.dead);
    if (bosses.length > 0) {
      const bw = Math.min(480, w - 80);
      const bx = (w - bw) / 2;
      const count = Math.min(bosses.length, 3);
      const barH = count > 1 ? 12 : 15;
      const startY = count > 1 ? 66 : 74;
      const gap = 16;

      for (let i = 0; i < count; i++) {
        const b = bosses[i];
        const by = startY + i * gap;
        const frac = b.hp / b.maxHp;
        const col = i === 0 ? '#ffcb3d' : (i === 1 ? '#ff9e3d' : '#ff5f5f');
        bar(ctx, bx, by, bw, barH, frac, col);

        const cur = fmtHp(b.hp), max = fmtHp(b.maxHp);
        const pct = Math.max(0, Math.ceil(frac * 100));
        const txt = (b.shiny ? '★ ' : '') + b.name.toUpperCase() + ' · ' + cur + ' / ' + max + ' (' + pct + '%)';

        ctx.font = F(800, count > 1 ? 8.5 : 10);
        ctx.textAlign = 'center';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(10,12,18,0.75)';
        ctx.strokeText(txt, w / 2, by + barH - 3.5);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(txt, w / 2, by + barH - 3.5);
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

    if (G.Coop.active) drawCoop(ctx, w, h, pl, px, py + (showStats ? (hasBadges ? 56 : 36) + 98 : (bx > px ? 56 : 40)));

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
      const riftY = bosses.length > 1 ? 112 : (bosses.length === 1 ? 104 : 76);
      ctx.fillText('GRIETA · ' + G.U.mmss(G.Rift.timeLeft), w / 2, riftY);
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
      ctx.font = F(800, 22);
      ctx.fillStyle = '#ffcb3d';
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4;
      ctx.strokeText(ban.text, w / 2, h * 0.3);
      ctx.fillText(ban.text, w / 2, h * 0.3);
      ctx.restore();
    }

    // ---------- ranura de movimientos ----------
    const S = 54, GAP = 9;
    const n = Math.max(1, pl.slots.length);
    const totalW = n * S + (n - 1) * GAP;
    let sx = (w - totalW) / 2;
    // Por encima de la barra de inicio del iPhone (allí los toques a veces no llegan).
    const sy = h - S - 18 - (touch ? Math.min(28, G.Touch.safeArea().bottom) : 0);
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
        ctx.fillText(fused ? m.name + ' +' + (g.length - 1) : m.name, x + S / 2, y - 7);
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
    }

    // ---------- botón de dash (hasta 3 cargas) ----------
    {
      const bondOffset = pl.bonds > 0 ? (pl.bonds > 1 ? 46 : 34) : 0;
      const dx = sx + totalW + 14 + bondOffset, dy = sy;
      const charges = pl.dashCharges != null ? pl.dashCharges : 1;
      const maxC = pl.dashMaxCharges || 3;
      const ready = charges > 0;
      const recharging = charges < maxC;
      const cdFrac = recharging ? G.U.clamp((pl.dashTimer || 0) / (pl.dashCd || 4), 0, 1) : 0;

      // Fondo
      roundRect(ctx, dx, dy, S, S, 12);
      ctx.fillStyle = ready ? 'rgba(18,28,48,.92)' : 'rgba(10,16,28,.8)';
      ctx.fill();

      // Borde
      ctx.lineWidth = ready ? 2.2 : 1.2;
      ctx.strokeStyle = ready ? '#4fd1ff' : 'rgba(140,170,210,.25)';
      ctx.stroke();

      // Icono de Ataque Rápido / Dash
      G.Icons.draw(ctx, 'move:quick-attack', dx + (S - 32) / 2, dy + (S - 32) / 2 - 2, 32);

      // Sombra si no queda ninguna carga
      if (charges === 0 && cdFrac > 0) {
        ctx.save();
        roundRect(ctx, dx, dy, S, S, 12); ctx.clip();
        ctx.fillStyle = 'rgba(0,0,0,.68)';
        ctx.fillRect(dx, dy, S, S * cdFrac);
        ctx.restore();

        // Texto del tiempo restante para la primera carga
        ctx.font = F(800, 12);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(pl.dashTimer.toFixed(1) + 's', dx + S / 2, dy + S / 2 + 5);
      }

      // 3 Pips / barritas de cargas en la parte inferior
      const pw = 10, ph = 3, pgap = 3;
      const ptotal = maxC * pw + (maxC - 1) * pgap;
      const px0 = dx + (S - ptotal) / 2, py0 = dy + S - 8;
      for (let c = 0; c < maxC; c++) {
        if (c < charges) {
          ctx.fillStyle = '#4fd1ff';
        } else if (c === charges && recharging) {
          ctx.fillStyle = 'rgba(79,209,255,.35)';
        } else {
          ctx.fillStyle = 'rgba(255,255,255,.14)';
        }
        ctx.fillRect(px0 + c * (pw + pgap), py0, pw, ph);
      }

      // Tecla o rótulo superior izquierdo
      ctx.font = F(800, 8);
      ctx.fillStyle = ready ? '#4fd1ff' : 'rgba(180,200,230,.5)';
      ctx.textAlign = 'left';
      ctx.fillText(touch ? 'DASH' : 'ESPACIO', dx + 4, dy + 10);

      // Contador de cargas arriba a la derecha (ej. ×2, ×3)
      ctx.font = F(800, 10);
      ctx.fillStyle = charges === maxC ? '#5fe08a' : ready ? '#4fd1ff' : '#ff8a96';
      ctx.textAlign = 'right';
      ctx.fillText('×' + charges, dx + S - 4, dy + 10);

      // Rótulo superior "DASH"
      ctx.font = F(700, 9);
      ctx.textAlign = 'center';
      ctx.fillStyle = ready ? '#4fd1ff' : 'rgba(180,200,230,.6)';
      ctx.fillText(charges > 0 ? (recharging ? `DASH (${pl.dashTimer.toFixed(1)}s)` : 'DASH') : 'RECARGA', dx + S / 2, dy - 7);

      // Botón táctil o clic
      G.Touch.addButton(dx, dy, S, S, () => {
        if (G.Game.state === 'playing') pl.dash();
      }, 6);
    }

    // ---------- botón de dash flotante (móvil/táctil) ----------
    if (touch) {
      const sa = G.Touch.safeArea();
      const r = 26;
      const fx = w - r - 22 - Math.min(28, sa.right);
      const fy = h - r - 30 - Math.min(24, sa.bottom);
      const charges = pl.dashCharges != null ? pl.dashCharges : 1;
      const maxC = pl.dashMaxCharges || 3;
      const ready = charges > 0;
      const recharging = charges < maxC;
      const cdFrac = recharging ? G.U.clamp((pl.dashTimer || 0) / (pl.dashCd || 4), 0, 1) : 0;

      ctx.save();
      ctx.beginPath();
      ctx.arc(fx, fy, r, 0, 6.2832);
      ctx.fillStyle = ready ? 'rgba(20,34,58,.88)' : 'rgba(10,16,28,.75)';
      ctx.fill();
      ctx.lineWidth = ready ? 2.5 : 1.5;
      ctx.strokeStyle = ready ? '#4fd1ff' : 'rgba(140,170,210,.3)';
      ctx.stroke();

      G.Icons.draw(ctx, 'move:quick-attack', fx - 16, fy - 16, 32);

      if (charges === 0 && cdFrac > 0) {
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.arc(fx, fy, r, -Math.PI / 2, -Math.PI / 2 + cdFrac * 6.2832);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fill();

        ctx.font = F(800, 10);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(pl.dashTimer.toFixed(1) + 's', fx, fy + 4);
      } else {
        // Insignia con el número de cargas
        ctx.font = F(800, 10);
        ctx.fillStyle = charges === maxC ? '#5fe08a' : '#4fd1ff';
        ctx.textAlign = 'center';
        ctx.fillText('×' + charges, fx, fy + r + 11);
      }
      ctx.restore();

      G.Touch.addButton(fx - r, fy - r, r * 2, r * 2, () => {
        if (G.Game.state === 'playing') pl.dash();
      }, 8);
    }

    // ---------- botón de pausa (táctil) ----------
    if (touch) {
      const sa = G.Touch.safeArea();
      const bx = w - 52 - Math.min(44, sa.right), by = 12 + Math.min(20, sa.top), bs = 40;
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
      ctx.fillText(touch ? 'Arrastra para moverte  ·  DASH para esquivar (hasta 3 cargas)  ·  toca un ataque para cambiarlo'
                         : 'WASD moverse  ·  Espacio/Shift dash (hasta 3 cargas)  ·  1-4 ataque  ·  C stats  ·  Esc pausa', w / 2, h - 4);
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
      ctx.fillText(m.name, px, y + 9);
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
      ctx.fillText(m.name.charAt(0).toUpperCase(), 0, 5);
      // Nombre y distancia: al lado contrario de la flecha, para que no se salga
      const lx = -Math.cos(a) * 30, ly = -Math.sin(a) * 26 + 4;
      ctx.font = F(800, 12);
      const label = (o.dead ? '¡' + m.name + ' necesita ayuda! ' : m.name + ' ') + '· ' + metres + ' m';
      ctx.textAlign = Math.cos(a) > 0.3 ? 'right' : Math.cos(a) < -0.3 ? 'left' : 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(label, lx, ly);
      ctx.fillStyle = col;
      ctx.fillText(label, lx, ly);
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
      ctx.restore();
    }
  }

  return { draw, roundRect, bar, toggleStats, get showStats() { return showStats; } };
})();
