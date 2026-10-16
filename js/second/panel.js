/* ============ panel.js — lo que se ve en la segunda pantalla ============
 * Página aparte (second.html), sin el juego: recibe de js/core/second.js un
 * resumen de la partida varias veces por segundo y lo pinta; lo que se toca
 * aquí vuelve al juego como acción ({ a: 'mov', i }, { a: 'pausa' }...).
 *
 * Modos (pestañas de arriba, o Ajustes > Controles en el juego):
 *   stats  datos de la partida y lista de ataques
 *   map    radar: enemigos, jefes, shinies, grieta y compañeros
 *   moves  botones grandes para cambiar de ataque con el dedo
 * Al subir de nivel, las cartas salen encima de cualquier modo (si está
 * activado en Ajustes).
 *
 * Un modo nuevo: su pestaña en second.html, lo que necesite en resumen()
 * (core/second.js) y su parte en pintar().
 */
G.Panel = (() => {
  const $ = id => document.getElementById(id);
  const nat = window.PSNativo && PSNativo.accion ? PSNativo : null;
  let canal = null;
  if (!nat) { try { canal = new BroadcastChannel('ps.second'); } catch (e) { /* nada */ } }

  let ultimo = 0;            // cuándo llegó el último resumen
  let firmaMov = '', firmaCartas = '';
  let est = null;

  function accion(o) {
    const s = JSON.stringify(o);
    if (nat) nat.accion(s);
    else if (canal) canal.postMessage(s);
  }

  // Sólo se toca el DOM si el valor cambia (llegan ~12 resúmenes por segundo).
  function txt(el, v) { if (el.__v !== v) { el.__v = v; el.textContent = v; } }
  function ancho(el, f, prop = 'width') { const v = Math.round(f * 100) + '%'; if (el.__w !== v) { el.__w = v; el.style[prop] = v; } }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------- llegada de datos ----------------

  /** La app Android (o el BroadcastChannel) entrega aquí cada resumen. */
  function recibir(s) {
    let o = s;
    if (typeof s === 'string') { try { o = JSON.parse(s); } catch (e) { return; } }
    if (!o || o.t !== 'e') return;
    if (otroIdioma(o.lang)) return;
    ultimo = performance.now();
    est = o;
    pintar(o);
  }
  if (canal) canal.onmessage = e => recibir(e.data);

  /**
   * El idioma se cambia en los Ajustes del juego, que sólo recarga su página:
   * si el juego ya va en otro, el panel se recarga para leer el nuevo. Una
   * vez por idioma (si aun así no coincide, p. ej. el juego abierto en /en/
   * sin idioma guardado, no se insiste).
   */
  function otroIdioma(lang) {
    if (!lang || lang === G.I18n.lang) return false;
    try {
      if (sessionStorage.getItem('ps.second.lang') === lang) return false;
      sessionStorage.setItem('ps.second.lang', lang);
    } catch (e) { return false; }
    location.reload();
    return true;
  }

  function espera(msg) {
    $('espera').classList.toggle('hidden', !msg);
    if (!msg) return;
    txt($('espera-t'), msg);
    cartas(null);            // sin partida a la vista no hay cartas que elegir
  }

  // ---------------- dibujo ----------------

  const BUFF = { atk: ['ATK', '#ff6b4d'], spd: ['VEL', '#7fe0ff'], def: ['DEF', '#b0b8c8'], regen: ['REG', '#5fe08a'] };

  function pintar(o) {
    if (o.modo === 'off') { espera('Pantalla apagada: toca para encenderla.'); return; }
    if (o.s === 'ui' || !o.p) { espera('Aquí verás tu partida cuando empieces a jugar.'); return; }
    espera(null);

    if (document.body.dataset.v !== o.modo) document.body.dataset.v = o.modo;
    document.querySelectorAll('#tabs [data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === o.modo));
    $('pausa').classList.toggle('on', o.s === 'paused');

    const p = o.p;
    const nm = $('nombre');
    const cab = p.n + '|' + p.lv;
    if (nm.__v !== cab) { nm.__v = cab; nm.innerHTML = '<span translate="no">' + esc(p.n) + '</span><small>Nv. ' + (p.lv | 0) + '</small>'; }
    txt($('reloj'), p.tm);
    ancho($('hp'), p.mh ? p.hp / p.mh : 0);
    txt($('hp-t'), p.hp + ' / ' + p.mh);
    ancho($('xp'), p.xp);

    txt($('linea'), p.bio + '  ·  ' + p.k + ' derrotados  ·  ' + p.c + ' monedas');

    const j = $('jefe');
    j.classList.toggle('hidden', !o.boss);
    if (o.boss) { txt(j.lastElementChild, o.boss[0]); ancho(j.firstElementChild, o.boss[1]); }

    // Potenciadores, poder de altar, objeto y clima.
    const chips = [];
    for (const [k, n] of p.buffs) if (BUFF[k]) chips.push([BUFF[k][0] + ' ×' + n, BUFF[k][1]]);
    if (p.power) chips.push([p.power[0] + ' ' + p.power[1] + 's', p.power[2]]);
    if (p.item) chips.push([p.item, '#ffd23f']);
    if (o.wx) chips.push([o.wx[0] + ' · ' + o.wx[1] + 's', o.wx[2]]);
    const fc = JSON.stringify(chips), box = $('chips');
    if (box.__v !== fc) { box.__v = fc; box.innerHTML = chips.map(([t, c]) => `<span style="color:${esc(c)}">${esc(t)}</span>`).join(''); }

    ataques(o.m || [], p.act);
    if (o.modo === 'map' && o.map) mapa(o.map);
    cartas(o.cards, o.ck);
  }

  function ataques(list, act) {
    const box = $('movs');
    // Los botones sólo se rehacen si cambian los ataques: rehacerlos en cada
    // resumen se comería los toques.
    const firma = list.map(m => m.n + m.c + m.ev + m.f).join('|');
    if (firma !== firmaMov) {
      firmaMov = firma;
      box.innerHTML = '';
      list.forEach((m, i) => {
        const b = document.createElement('button');
        b.className = 'mov' + (m.ev ? ' ev' : '') + (m.f ? ' fus' : '');
        b.style.setProperty('--c', m.c);
        b.innerHTML = `<span class="sw" translate="no">${i + 1}</span>
          <span class="tx"><b>${esc(m.n)}${m.f ? ' +' + (m.f | 0) : ''}</b><small></small></span><i class="cd"></i>`;
        b.addEventListener('pointerdown', e => { e.preventDefault(); accion({ a: 'mov', i }); });
        box.appendChild(b);
      });
    }
    const grande = document.body.dataset.v === 'moves';
    list.forEach((m, i) => {
      const b = box.children[i];
      if (!b) return;
      b.classList.toggle('on', i === act);
      txt(b.querySelector('small'), m.ty + ' · Nv.' + m.lv + '/' + m.mx);
      // La recarga se vacía de arriba abajo (botones grandes) o de derecha a izquierda (lista).
      const cd = b.querySelector('.cd');
      if (cd.__g !== grande) { cd.__g = grande; cd.style.width = cd.style.height = ''; cd.__w = null; }
      ancho(cd, m.cd, grande ? 'height' : 'width');
    });
  }

  function cartas(list, tanda) {
    const box = $('cartas');
    box.classList.toggle('hidden', !list);
    const firma = list ? tanda + '#' + list.map(c => c.n).join('|') : '';
    if (firma === firmaCartas) return;
    firmaCartas = firma;
    box.innerHTML = '';
    if (!list) return;
    const h = document.createElement('h2');
    h.textContent = 'Elige una carta';
    box.appendChild(h);
    list.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'carta' + (c.ty === 'evo' ? ' evo' : '');
      b.style.setProperty('--c', c.c);
      b.innerHTML = `<span><b>${esc(c.n)}<em>${esc(c.tag || '')}</em></b><small>${esc(c.d)}</small></span>`;
      b.addEventListener('click', () => accion({ a: 'carta', i, k: tanda }));
      box.appendChild(b);
    });
  }

  // Radar: tú en el centro; lo importante que queda fuera se pega al borde.
  function mapa(m) {
    const cv = $('mapa'), dpr = Math.min(2, devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, k = Math.min(w, h) / 2 / m.r, M = 12;
    const pos = (dx, dy, pegar) => {
      let x = cx + dx * k, y = cy + dy * k;
      if (pegar) { x = Math.max(M, Math.min(w - M, x)); y = Math.max(M, Math.min(h - M, y)); }
      return [x, y];
    };
    const punto = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); };
    const rotulo = (s, x, y, col) => {
      ctx.font = '700 11px Pixelify, system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y);
    };

    // Anillos de distancia.
    ctx.strokeStyle = 'rgba(140,170,210,.18)'; ctx.lineWidth = 1;
    for (const f of [1 / 3, 2 / 3, 1]) { ctx.beginPath(); ctx.arc(cx, cy, m.r * k * f, 0, 6.2832); ctx.stroke(); }

    const e = m.e;
    for (let i = 0; i < e.length; i += 3) if (!e[i + 2]) { const [x, y] = pos(e[i], e[i + 1]); punto(x, y, 2.2, '#ff5f6d'); }
    for (let i = 0; i < e.length; i += 3) {
      if (!e[i + 2]) continue;
      const [x, y] = pos(e[i], e[i + 1], true);
      if (e[i + 2] === 2) { punto(x, y, 7, '#ffcb3d'); rotulo('Jefe', x, y - 10, '#ffcb3d'); }
      else punto(x, y, 5, '#9ae6ff');
    }
    if (m.rift) {
      const [x, y] = pos(m.rift[0], m.rift[1], true);
      ctx.fillStyle = '#b48aff';
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.fill();
      rotulo('Grieta', x, y - 12, '#e2d0ff');
    }
    for (const a of m.mates) {
      const [x, y] = pos(a[0], a[1], true);
      punto(x, y, 5, a[3] ? '#ff5f6d' : a[2]);
      ctx.save(); ctx.font = '700 11px Pixelify, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = a[2]; ctx.fillText(a[4], x, y - 9); ctx.restore();
    }
    punto(cx, cy, 5, '#ffd23f');
    ctx.lineWidth = 2; ctx.strokeStyle = '#a55f00'; ctx.stroke();
  }

  // ---------------- arranque ----------------

  function init() {
    G.I18n.startDom();
    document.querySelectorAll('#tabs [data-m]').forEach(b => b.addEventListener('click', () => accion({ a: 'modo', v: b.dataset.m })));
    $('pausa').addEventListener('click', () => accion({ a: 'pausa' }));
    $('espera').addEventListener('click', () => { if (est && est.modo === 'off') accion({ a: 'modo', v: 'stats' }); });
    addEventListener('contextmenu', e => e.preventDefault());
    accion({ a: 'hola' });
    // Saludo periódico: el juego sabe que el panel sigue ahí, y si se recarga
    // o aún no había arrancado, vuelve a mandar resúmenes.
    setInterval(() => {
      accion({ a: 'hola' });
      if (performance.now() - ultimo > 3000 && (!est || est.modo !== 'off')) espera('Esperando al juego…');
    }, 2000);
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init);
  else init();

  return { recibir };
})();
