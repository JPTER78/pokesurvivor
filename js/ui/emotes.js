/* ============ emotes.js — mensajes rápidos en cooperativo ============
 * Cuatro mensajes: teclas 5-8 en el ordenador o el botón del bocadillo en el
 * móvil (abre los cuatro al lado). Salen en un bocadillo encima de tu Pokémon
 * y, si los demás no te ven, junto a tu flecha en el borde de su pantalla.
 * Como mucho uno cada CD s (el anfitrión también lo comprueba).
 *
 * Red (ver net/coop.js):  invitado -> anfitrión ['em', i]
 *                         anfitrión -> todos     ['em', uid, i]
 */
G.Emotes = (() => {
  const LIST = [
    { text: '¡Ayuda!', color: '#ff6b7a' },
    { text: '¡Aquí!', color: '#ffd23f' },
    { text: '¡Grieta!', color: '#c08bff' },
    { text: '¡Gracias!', color: '#7ee07a' }
  ];
  const SHOW = 3, CD = 1.2, MENU = 4;
  let lastAt = 0, menuT = 0;

  /** Enseña el mensaje `i` encima de `p` (tú o un compañero). */
  function show(p, i) {
    if (!p || !LIST[i]) return;
    p.emote = { i, t: SHOW };
    G.Audio.sfx('select');
  }

  /** Mandas el mensaje `i`. */
  function send(i) {
    menuT = 0;
    if (!G.Coop.active || !LIST[i]) return;
    const now = performance.now();
    if (now - lastAt < CD * 1000) return;
    lastAt = now;
    show(G.Coop.local, i);
    G.Coop.emote(i);
  }

  function keys() {
    if (!G.Coop.active) return;
    for (let i = 0; i < LIST.length; i++) {
      if (G.Input.tap('digit' + (i + 5)) || G.Input.tap('numpad' + (i + 5))) send(i);
    }
  }

  function tick(dt, players) {
    if (menuT > 0) menuT -= dt;
    for (const p of players) if (p.emote && (p.emote.t -= dt) <= 0) p.emote = null;
  }

  /** Bocadillo encima de un Pokémon (en el mundo; lo llama Player.draw). */
  function drawBubble(ctx, p) {
    const e = p.emote, d = e && LIST[e.i];
    if (!d) return;
    const pop = Math.min(1, (SHOW - e.t) * 6);           // aparece de golpe
    const fade = Math.min(1, e.t * 2);                   // y se va suave
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = '700 7px Pixelify,"Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(d.text).width;
    const bw = tw + 8, bh = 11;
    const x = p.x, y = p.y - p.bodyH - (p.tag ? 26 : 14);
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    G.HUD.roundRect(ctx, -bw / 2, -bh, bw, bh, 3);
    ctx.fillStyle = 'rgba(12,18,30,.88)'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = d.color; ctx.stroke();
    ctx.fillStyle = 'rgba(12,18,30,.88)';
    ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = d.color;
    ctx.fillText(d.text, 0, -3);
    ctx.restore();
  }

  /**
   * Móvil: el botón del bocadillo (debajo de la pausa) y, si está abierto,
   * los cuatro mensajes en columna debajo (o encima, si no caben). En fila
   * tapaban la barra del jefe. Lo llama el HUD con su posición.
   */
  function drawTouch(ctx, w, h, bx, by, F) {
    const bs = 40;
    G.HUD.roundRect(ctx, bx, by, bs, bs, 10);
    ctx.fillStyle = menuT > 0 ? 'rgba(40,60,96,.85)' : 'rgba(10,16,28,.7)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244,248,255,.8)'; ctx.stroke();
    // Bocadillo dibujado (sin emojis: la letra pixel no los tiene).
    ctx.fillStyle = '#f4f8ff';
    G.HUD.roundRect(ctx, bx + 9, by + 10, 22, 15, 4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx + 14, by + 24); ctx.lineTo(bx + 20, by + 24); ctx.lineTo(bx + 13, by + 31); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a2438';
    for (let k = 0; k < 3; k++) ctx.fillRect(bx + 14 + k * 5, by + 16, 3, 3);
    G.Touch.addButton(bx, by, bs, bs, () => { menuT = menuT > 0 ? 0 : MENU; G.Audio.sfx('click'); }, 6);
    if (menuT <= 0) return;
    ctx.font = F(800, 12);
    ctx.textAlign = 'center';
    const bw = Math.max(...LIST.map(d => ctx.measureText(d.text).width)) + 22, ph = 32, gap = 6;
    const left = bx < w / 2;                             // pegados al lado de la pantalla en que está el botón
    const ix = left ? bx : bx + bs - bw;
    const down = by + bs + gap + LIST.length * (ph + gap) <= h - 8;
    for (let i = 0; i < LIST.length; i++) {
      const d = LIST[i];
      const iy = down ? by + bs + gap + i * (ph + gap) : by - (i + 1) * (ph + gap);
      G.HUD.roundRect(ctx, ix, iy, bw, ph, 9);
      ctx.fillStyle = 'rgba(10,16,28,.85)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = d.color; ctx.stroke();
      ctx.fillStyle = d.color;
      ctx.fillText(d.text, ix + bw / 2, iy + 21);
      G.Touch.addButton(ix, iy, bw, ph, () => send(i), 2);
    }
  }

  return { LIST, CD, show, send, keys, tick, drawBubble, drawTouch, reset() { lastAt = 0; menuT = 0; } };
})();
