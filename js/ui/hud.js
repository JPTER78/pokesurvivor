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
    const o = G.Orbs.BY[id], name = G.T(o.name);
    const lines = [];
    if (full) {
      ctx.font = F(600, 11);
      let cur = '';
      for (const word of G.T(o.desc).split(' ')) {
        const t = cur ? cur + ' ' + word : word;
        if (ctx.measureText(t).width > 240 && cur) { lines.push(cur); cur = word; } else cur = t;
      }
      if (cur) lines.push(cur);
    }
    ctx.font = F(800, 12);
    let bw = ctx.measureText(name).width;
    ctx.font = F(600, 11);
    for (const l of lines) bw = Math.max(bw, ctx.measureText(l).width);
    bw += 16;
    const bh = 20 + lines.length * 14, bx = G.U.clamp(cx - bw / 2, 4, w - bw - 4), y = by - bh;
    ctx.save();
    roundRect(ctx, bx, y, bw, bh, 8);
    ctx.fillStyle = 'rgba(10,14,28,.92)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = o.col; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = F(800, 12); ctx.fillStyle = o.col;
    ctx.fillText(name, bx + bw / 2, y + 14);
    ctx.font = F(600, 11); ctx.fillStyle = '#e6ecff';
    lines.forEach((l, k) => ctx.fillText(l, bx + bw / 2, y + 28 + k * 14));
    ctx.restore();
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
    ctx.font = F(600, 10);
    ctx.fillStyle = '#8fa3c4';
    // Halloween: también los caramelos que llevas en esta partida.
    const cn = G.Halloween.inRun ? '  ·  ' + (pl.candy || 0) + ' CARAMELOS' : '';
    ctx.fillText(G.World.biomeName().toUpperCase() + '  ·  ' + pl.kills + ' DERROTADOS  ·  ' + pl.coins + ' MONEDAS' + cn, w / 2, 58);

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
      const bw = Math.min(420, w - 80);
      bar(ctx, (w - bw) / 2, 70, bw, 12, boss.hp / boss.maxHp, '#ffcb3d');
      ctx.font = F(800, 10);
      ctx.fillStyle = '#20160a';
      ctx.fillText(boss.name.toUpperCase(), w / 2, 80);
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

    if (G.Coop.active) drawCoop(ctx, w, h, pl, px, py + (bx > px ? 56 : 40));

    // Grieta: flecha grande que late en el borde si no se ve, y si se ve, una
    // flecha que bota encima; en la arena, cuenta atrás.
    const rift = G.Rift.rift;
    const redRift = (rift || G.Rift.arena || {}).kind === 'mega';
    const riftLabel = redRift ? 'MEGAGRIETA' : 'GRIETA';
    if (rift) {
      const sx = (rift.x - cam.left()) * cam.scale, sy = (rift.y - 40 - cam.top()) * cam.scale;
      const now = performance.now() / 1000, beat = 0.5 + Math.sin(now * 7) * 0.5;
      const label = G.T(riftLabel) + ' · ' + Math.round(G.U.dist(pl.x, pl.y, rift.x, rift.y) / 32) + ' m · ' + Math.ceil(rift.ttl) + ' s';
      const off = sx < 0 || sx > w || sy < 0 || sy > h;
      ctx.save();
      if (off) {
        const M = 52, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
        const a = Math.atan2(sy - ey, sx - ex), ca = Math.cos(a), sa = Math.sin(a);
        ctx.translate(ex, ey);
        // Halo que late.
        ctx.globalAlpha = 0.18 + beat * 0.22;
        ctx.fillStyle = (redRift ? '#ff4966' : '#b48aff');
        ctx.beginPath(); ctx.arc(0, 0, 30 + beat * 8, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
        const tri = (k) => {
          ctx.beginPath();
          ctx.moveTo(ca * 40 * k, sa * 40 * k);
          ctx.lineTo(Math.cos(a + 2.45) * 20 * k, Math.sin(a + 2.45) * 20 * k);
          ctx.lineTo(Math.cos(a - 2.45) * 20 * k, Math.sin(a - 2.45) * 20 * k);
          ctx.closePath();
        };
        tri(1.12); ctx.fillStyle = (redRift ? '#330914' : '#1a0b33'); ctx.fill();
        tri(1); ctx.fillStyle = beat > 0.5 ? (redRift ? '#ffd0dc' : '#e2d0ff') : (redRift ? '#ff4966' : '#a06bff'); ctx.fill();
        ctx.font = F(800, 12);
        ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
        const lx = -ca * 34, ly = -sa * 30 + 4;
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = (redRift ? '#ffd0dc' : '#e2d0ff');
        ctx.fillText(label, lx, ly);
      } else {
        // Encima de la grieta: flecha hacia abajo que bota.
        const by = sy - 46 - Math.abs(Math.sin(now * 4)) * 10;
        ctx.translate(sx, by);
        ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(15, -12); ctx.lineTo(0, 8); ctx.closePath();
        ctx.lineWidth = 4; ctx.strokeStyle = (redRift ? '#330914' : '#1a0b33'); ctx.stroke();
        ctx.fillStyle = beat > 0.5 ? (redRift ? '#ffd0dc' : '#e2d0ff') : (redRift ? '#ff4966' : '#a06bff'); ctx.fill();
        ctx.font = F(800, 11); ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        const l2 = G.T(riftLabel) + ' · ' + Math.ceil(rift.ttl) + ' s';
        ctx.strokeText(l2, 0, -18); ctx.fillStyle = (redRift ? '#ffd0dc' : '#e2d0ff'); ctx.fillText(l2, 0, -18);
      }
      ctx.restore();
    }
    if (G.Rift.inArena) {
      ctx.textAlign = 'center';
      ctx.font = F(800, 12);
      ctx.fillStyle = (redRift ? '#ff9cba' : '#d9c2ff');
      ctx.fillText(G.T(riftLabel) + ' · ' + G.U.mmss(G.Rift.timeLeft), w / 2, boss ? 98 : 76);
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
      const t1 = redRift ? '¡SE HA ABIERTO UNA MEGAGRIETA!' : '¡SE HA ABIERTO UNA GRIETA!',
            t2 = redRift ? 'Sigue la flecha roja: vence al legendario para transformarte' : 'Sigue la flecha morada: dentro te espera un legendario';
      const bw = Math.min(w - 24, Math.max(ctx.measureText(t1).width, (ctx.font = F(700, 11), ctx.measureText(t2).width)) + 36);
      roundRect(ctx, -bw / 2, -26, bw, 52, 10);
      ctx.fillStyle = (redRift ? 'rgba(51,8,20,.88)' : 'rgba(26,11,51,.88)'); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = (redRift ? '#ff4966' : '#b48aff'); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = F(800, 20); ctx.fillStyle = (redRift ? '#ffd0dc' : '#e2d0ff'); ctx.fillText(t1, 0, -2);
      ctx.font = F(700, 11); ctx.fillStyle = (redRift ? '#ffb0c2' : '#c9b0ff'); ctx.fillText(t2, 0, 16);
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
    const mega = !!(pl.megaStone || G.Forms.rewardForDex(pl.mon.dex));
    const n = Math.max(1, pl.slots.length), pb = touch && G.Touch.spot('bar');
    const hotbar = G.Hotbar.layout(w, h, n, mega, touch ? G.Touch.safeArea() : {}, pb,
      pb ? Math.max(n, pl.maxMoves) : n);
    const S = hotbar.size, GAP = hotbar.gap, totalW = hotbar.totalW, sx = hotbar.sx, sy = hotbar.y;
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
        const C = Math.min(22, Math.floor((S - 9) / 2)), P = (S - C * 2) / 3;
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
      const bx = mega ? hotbar.megaX : sx + totalW - 24, by = sy - 36;
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

    // Separate, passive Mega Stone slot, immediately after the move slots.
    if (mega) {
      const x = hotbar.megaX;
      roundRect(ctx, x, sy, S, S, 12);
      ctx.fillStyle = pl.megaStone ? 'rgba(65,12,30,.9)' : 'rgba(10,16,28,.45)'; ctx.fill();
      ctx.lineWidth = pl.megaStone ? 2 : 1;
      ctx.strokeStyle = pl.megaStone ? '#ff5473' : 'rgba(180,130,155,.3)'; ctx.stroke();
      // Imported 32px sheets have generous transparent margins; render at 2x.
      const iconSize = Math.min(64, S * 1.25);
      if (pl.megaStone) G.Icons.draw(ctx, pl.megaStone, x + (S - iconSize) / 2, sy + (S - iconSize) / 2, iconSize);
      else { ctx.globalAlpha = 0.35; G.Icons.draw(ctx, G.Forms.rewardForDex(pl.mon.dex)?.category === 'fusion' ? 'dna_splicers' : 'mega_bracelet', x + (S - iconSize) / 2, sy + (S - iconSize) / 2, iconSize); ctx.globalAlpha = 1; }
      ctx.font = F(700, 9); ctx.textAlign = 'center'; ctx.fillStyle = '#ff9ab0';
      const form = G.Forms.get(pl.formId) || G.Forms.rewardForDex(pl.mon.dex);
      ctx.fillText(G.T(form && (pl.megaStone || form.category === 'fusion') ? form.stoneName : 'Megapiedra'), x + S / 2, sy - 6);
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
