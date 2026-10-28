/* ============ ui.js — utilidades comunes de la interfaz ============
 * - Mostrar / ocultar pantallas.
 * - Sprites animados de PMD dentro de <canvas> del DOM (menú, colección,
 *   gacha...). Se registran aquí y el bucle principal los anima con tick().
 * - Sonidos de interfaz (por delegación: cualquier botón suena solo).
 * - Panel de sonido, avisos (toast), monedas, chips de tipo, estrellas.
 */
G.UI = (() => {
  const $ = id => document.getElementById(id);
  const SCREENS = ['scr-login', 'scr-test', 'scr-result', 'scr-starters', 'scr-menu',
                   'scr-dex', 'scr-upgrades', 'scr-shop', 'scr-bag', 'scr-gacha', 'scr-levelup', 'scr-pause', 'scr-over',
                   'scr-mega', 'scr-nick', 'scr-friends', 'scr-lobby', 'scr-rank', 'scr-item', 'scr-goals', 'scr-bond', 'scr-mod'];

  function show(id, keepMenu = false) {
    for (const s of SCREENS) if (s !== id && !(keepMenu && s === 'scr-menu')) $(s).classList.add('hidden');
    $(id).classList.remove('hidden');
  }
  function hide(id) { $(id).classList.add('hidden'); }
  function hideAll() { for (const s of SCREENS) $(s).classList.add('hidden'); }
  function isOpen(id) { return !$(id).classList.contains('hidden'); }

  /** Barra superior (monedas, usuario, sonido) sólo fuera de las runs. */
  function chrome(on) {
    $('topbar').classList.toggle('hidden', !on);
    document.body.classList.toggle('in-run', !on);       // (para el CSS: en partida)
    $('credits-line').classList.toggle('hidden', !on);
    if (!on) $('sound-panel').classList.add('hidden');
    if (on) refreshCoins();
  }

  /** Un número para la barra de arriba: entero hasta 99.999 y en corto desde ahí ("250 mil", "1,2 M"). */
  function short(n) {
    n = +n || 0;
    if (n < 1e5) return n.toLocaleString(G.I18n.locale);
    try { return new Intl.NumberFormat(G.I18n.locale, { notation: 'compact', maximumFractionDigits: n < 1e6 ? 0 : 1 }).format(n); }
    catch (e) { return n.toLocaleString(G.I18n.locale); }
  }

  function refreshCoins() {
    const s = G.DB.save;
    $('coins').textContent = s ? short(s.coins) : '0';
    $('coins').parentElement.title = s ? s.coins.toLocaleString(G.I18n.locale) + ' ' + G.T('Pokémonedas') : '';
    const t = (s && s.tickets) || { t1: 0, t10: 0 };
    // Halloween: los caramelos, al lado (title: qué son).
    const cn = G.Halloween.on && s ? (s.bag && s.bag.candy) || 0 : null;
    $('tickets-pill').innerHTML = `${G.Icons.html('ticket', 18)} ${short(t.t1)} &nbsp;${G.Icons.html('ticket10', 18)} ${short(t.t10)}` +
      (cn != null ? ` &nbsp;<span title="${G.T('Caramelos de Halloween')}">${G.Icons.html('candy', 18)} ${short(cn)}</span>` : '');
    // Punto de sincronización: verde = guardado en la nube, amarillo = hay cambios
    // sin subir (sólo se suben con Guardar, desde el 20-10-2026), rojo = sin conexión.
    const st = G.DB.guest ? 'guest' : G.DB.syncState;
    const TIP = { ok: 'Guardado en la nube', syncing: 'Guardando…', pending: 'Sin guardar en la nube: pulsa Guardar',
                  offline: 'Sin conexión: pulsa Guardar cuando vuelva', local: 'Guardado sólo en este navegador', guest: 'Invitado: no se guarda' };
    $('user-pill').innerHTML = G.Icons.html(G.DB.guest ? 'user' : 'crown', 18) + ' <span translate="no">' + (G.DB.guest ? G.T('Invitado') : (G.DB.user || '')) + '</span>' +
      `<i class="sync ${st}" title="${TIP[st] || ''}"></i>`;
    $('user-pill').title = TIP[st] || '';
    // Botón Guardar: sólo con cuenta en la nube (en local ya se guarda al momento).
    const sb = $('btn-save');
    sb.classList.toggle('hidden', G.DB.guest || G.DB.mode !== 'cloud');  }

  let toastEl = null, toastT = 0;
  function toast(msg, ms = 2200) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.style.display = 'none'; }, ms);
  }

  function typeChips(types) {
    return types.map(t => `<span class="type" style="background:${G.U.TYPE_COLOR[t]}">${G.U.TYPE_NAME[t]}</span>`).join('');
  }

  /** Rareza: la Poké Ball que le corresponde (ver G.Icons.rarity). */
  function stars(n, size = 12) { return G.Icons.rarity(n, size > 16 ? 24 : 12); }

  // ---------------- sonido de la interfaz ----------------

  const CLICKABLE = '.btn, .menu-item, .tab, .chip, .card, .cell:not(.locked), .answer, .gen-tab';
  let lastHover = null;

  function wireSounds() {
    document.addEventListener('pointerover', e => {
      const el = e.target.closest(CLICKABLE);
      if (el && el !== lastHover && !el.disabled) G.Audio.sfx('hover');
      lastHover = el;
    });
    document.addEventListener('click', e => {
      const el = e.target.closest(CLICKABLE);
      if (!el) return;
      if (el.disabled) { G.Audio.sfx('error'); return; }
      // Los botones con su propio sonido (comprar, tirar, elegir...) lo ponen ellos.
      if (el.dataset.sfx === 'none') return;
      G.Audio.sfx(el.matches('[data-back]') ? 'back' : el.dataset.sfx || 'click');
    }, true);
  }

  // ---------------- cerrar pulsando fuera ----------------

  /* Ventanas del menú que se cierran pulsando en el fondo oscuro, fuera de la
   * caja: es como pulsar su Volver / Cerrar. Sólo si se pulsa y se suelta en el
   * fondo (arrastrar desde dentro no cierra). Sin cursor de mano en el fondo:
   * el mando lo tomaría por un botón (con el mando, B ya pulsa Volver). Durante
   * una tirada del gacha no pasa nada: #pull-fx tapa toda la pantalla. */
  const BACKDROP = ['scr-dex', 'scr-upgrades', 'scr-shop', 'scr-bag', 'scr-gacha', 'scr-goals', 'scr-friends', 'scr-rank', 'scr-settings', 'scr-news', 'scr-support'];
  function wireBackdrops() {
    let down = null;
    document.addEventListener('pointerdown', e => { down = e.target; });
    document.addEventListener('click', e => {
      const sc = e.target;
      if (sc !== down || !BACKDROP.includes(sc.id)) return;
      const back = [...sc.querySelectorAll('[data-back], [id$="-close"]')].find(b => b.getBoundingClientRect().width > 0);
      if (back) back.click();
    });
  }

  /** Controles de volumen (se usan en la barra superior y en la pausa). */
  function soundControls(box) {
    const st = G.Audio.settings;
    box.innerHTML = `
      <div class="snd-row">${G.Icons.html('sound', 18)}<span>Música</span>
        <input type="range" min="0" max="100" value="${Math.round(st.music * 100)}" data-k="music"></div>
      <div class="snd-row">${G.Icons.html('sound', 18)}<span>Efectos</span>
        <input type="range" min="0" max="100" value="${Math.round(st.sfx * 100)}" data-k="sfx"></div>
      <button class="btn small ${st.muted ? 'gold' : ''}" data-mute>${st.muted ? 'Activar sonido' : 'Silenciar todo'}</button>`;
    box.querySelectorAll('input[type=range]').forEach(r => {
      r.oninput = () => G.Audio.setVolume(r.dataset.k, r.value / 100);
      r.onchange = () => G.Audio.sfx('click');
    });
    box.querySelector('[data-mute]').onclick = () => { G.Audio.toggleMute(); soundControls(box); refreshSoundIcon(); };
  }

  function refreshSoundIcon() {
    $('btn-sound').innerHTML = G.Icons.html(G.Audio.settings.muted ? 'mute' : 'sound', 20);
  }

  // ---------------- aviso legal ----------------

  const CONTACT = 'contactopokesurvivor@gmail.com';
  const REPO = 'https://github.com/JPTER78/pokesurvivor';

  function openLegal() {
    $('legal-mail').textContent = CONTACT;
    $('legal-mail').href = 'mailto:' + CONTACT + '?subject=Pok%C3%A9Survivor';
    $('legal-repo').textContent = REPO.replace('https://', '');
    $('legal-repo').href = REPO;
    const canDelete = G.DB.loggedIn && !G.DB.guest;
    $('legal-delete').disabled = !canDelete;
    $('legal-del-msg').textContent = canDelete ? '' : 'Inicia sesión para poder borrar tu cuenta.';
    $('scr-legal').classList.remove('hidden');
  }

  /**
   * "¿Seguro que quieres borrar la cuenta?". Las cuentas de nombre y
   * contraseña escriben su contraseña (Firebase pide confirmar quién eres);
   * las de Google la confirman en la ventana de Google al seguir.
   * Devuelve { pass } o null si se cancela.
   */
  function confirmDelete() {
    if (!G.DB.nameAccount) return Promise.resolve(confirm(G.T('Se borrarán tu cuenta y toda tu partida, para siempre. ¿Seguro?')) ? { pass: '' } : null);
    return new Promise(done => {
      const el = document.createElement('section');
      el.className = 'scr dim';
      el.style.zIndex = 70;
      el.innerHTML = `<div class="box center" style="max-width:380px">
        <h3>Borrar cuenta</h3>
        <p class="sub">Se borrarán tu cuenta y toda tu partida, para siempre. Para confirmarlo, escribe tu contraseña.</p>
        <input class="field" type="password" maxlength="64" autocomplete="current-password" style="width:100%">
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:center;flex-wrap:wrap">
          <button class="btn ghost" data-a="no">Cancelar</button>
          <button class="btn danger" data-a="yes">Borrar para siempre</button>
        </div></div>`;
      document.body.appendChild(el);
      const inp = el.querySelector('input');
      const end = v => { el.remove(); done(v); };
      el.querySelector('[data-a=no]').onclick = () => end(null);
      el.querySelector('[data-a=yes]').onclick = () => { if (inp.value) end({ pass: inp.value }); else inp.focus(); };
      inp.onkeydown = e => { if (e.key === 'Enter' && inp.value) end({ pass: inp.value }); if (e.key === 'Escape') end(null); };
      setTimeout(() => inp.focus(), 50);
    });
  }

  function closeLegal() { $('scr-legal').classList.add('hidden'); }

  function wireLegal() {
    document.addEventListener('click', e => {
      if (e.target.closest('[data-legal]')) { e.preventDefault(); openLegal(); }
    });
    $('legal-close').onclick = closeLegal;
    $('legal-delete').onclick = async () => {
      const ok = await confirmDelete();
      if (!ok) return;
      $('legal-delete').disabled = true;
      const r = await G.DB.deleteAccount(ok.pass);
      if (!r.ok) { $('legal-del-msg').textContent = r.error; $('legal-delete').disabled = false; return; }
      closeLegal();
      toast('Cuenta borrada');
      G.Audio.music(null);
      G.Flow.toLogin();
    };
  }

  function initChrome() {
    G.Icons.installCss();
    wireLegal();
    G.DB.onSync(() => { if (!$('topbar').classList.contains('hidden')) refreshCoins(); });
    const sb = $('btn-save');
    sb.innerHTML = G.Icons.html('save', 18) + ' <span>Guardar</span>';
    sb.onclick = async () => {
      sb.disabled = true;
      const r = await G.DB.saveNow();
      sb.disabled = false;
      const MSG = { local: 'Tu partida se guarda en este navegador.', guest: 'Como invitado la partida no se guarda.',
                    done: 'Ya está todo guardado en la nube.', offline: 'Sin conexión: se guardará en cuanto vuelva.',
                    fail: 'No se pudo guardar. Vuelve a probar en un momento.' };
      toast(r.why === 'wait' ? `Se guarda en la nube en ${r.secs} s.` : r.why ? MSG[r.why] : '¡Partida guardada en la nube!', 3000);
    };
    wireSounds();
    wireBackdrops();
    refreshSoundIcon();
    $('btn-sound').onclick = () => {
      const p = $('sound-panel');
      p.classList.toggle('hidden');
      if (!p.classList.contains('hidden')) soundControls(p);
    };
  }

  // ---------------- sprites en canvas del DOM ----------------

  const live = new Set();
  const byCanvas = new WeakMap();      // canvas -> su animación (para no recorrer todas)
  // Sólo se animan los canvas que están a la vista (la colección tiene cientos).
  const seen = new WeakMap();
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(es => es.forEach(e => seen.set(e.target, e.isIntersecting)), { rootMargin: '80px' })
    : null;

  /**
   * Anima un Pokémon dentro de un <canvas>.
   * opts: { anim='Idle', dir=0, shiny, silhouette, lively (ataca de vez en
   *         cuando), spin (va girando), shadow=true,
   *         scale=2   tamaño de píxel FIJO (×2 como en el juego): todos los
   *                   Pokémon de una vista salen con el mismo píxel, aunque
   *                   los gigantes no quepan enteros
   *         skin      disfraz (core/skins.js)
   *         hero      vista de un solo Pokémon: puede reducir la escala para
   *                   que quepa, porque ahí no se compara con nada }
   */
  function sprite(cv, dex, opts = {}) {
    const prev = byCanvas.get(cv);
    if (prev) live.delete(prev);
    const a = new G.Sprites.Animator(dex, 1, !!opts.shiny);
    a.dir = opts.dir || 0;
    a.skin = opts.skin || null;
    a.loop(opts.anim || 'Idle');
    const s = { cv, ctx: cv.getContext('2d'), a, dex, opts, t: Math.random() * 3, spinT: 0, sparkT: 0 };
    live.add(s);
    byCanvas.set(cv, s);
    if (io) io.observe(cv);
    return s;
  }

  function tick(dt) {
    for (const s of live) {
      if (!s.cv.isConnected) { live.delete(s); if (io) io.unobserve(s.cv); continue; }
      if (s.cv.offsetParent === null) continue;            // pantalla oculta
      if (io && seen.get(s.cv) === false) continue;         // fuera de la vista
      s.a.update(dt);

      if (s.opts.lively) {
        s.t -= dt;
        if (s.t <= 0) { s.t = G.U.rand(2.5, 4.5); s.a.play(G.U.pick(['Attack', 'Shoot', 'Charge'])); }
      }
      if (s.opts.spin) {
        s.spinT += dt;
        if (s.spinT > 1.4) { s.spinT = 0; s.a.dir = (s.a.dir + 7) % 8; }
      }

      const { cv, ctx } = s;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.imageSmoothingEnabled = false;

      // Escala entera para que los píxeles queden nítidos.
      const m = G.Sprites.animMeta(s.dex, 'Idle');
      const ay = m ? m.ay : 24;
      let k = s.opts.scale || 2;
      if (s.opts.hero) k = Math.max(1, Math.min(k, Math.floor(cv.height * 0.8 / ay)));
      s.a.scale = k / G.Sprites.PX;
      // Si no cabe de pie, se centra el cuerpo en el recuadro.
      const big = ay * k > cv.height * 0.8;
      const fx = cv.width / 2, fy = big ? cv.height / 2 + ay * k * 0.45 : cv.height * 0.88;

      if (s.opts.shadow !== false && !s.opts.silhouette) {
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.beginPath(); ctx.ellipse(fx, fy, 9 * k, 3.4 * k, 0, 0, 6.2832); ctx.fill();
      }
      if (s.opts.silhouette) {
        ctx.save();
        ctx.filter = 'brightness(0)';
        ctx.globalAlpha = 0.55;
        s.a.draw(ctx, fx, fy);
        ctx.restore();
      } else {
        s.a.draw(ctx, fx, fy);
      }

      // Recolor (opts.hueSwap = [de, a, nuevo tono]): los píxeles con un tono entre
      // `de` y `a` pasan a `nuevo` (el Kecleon morado de la tienda: sin sprite shiny quieto).
      if (s.opts.hueSwap) hueSwap(ctx, cv, s.opts.hueSwap);

      // Centelleos alrededor de los shiny: cada uno nace en un sitio al azar.
      if (s.opts.shiny && !s.opts.silhouette && s.opts.twinkle !== false) {
        s.tw = s.tw || [];
        s.sparkT -= dt;
        if (s.sparkT <= 0 && s.tw.length < 4) {
          s.sparkT = G.U.rand(0.18, 0.45);
          s.tw.push({ x: fx + G.U.rand(-0.32, 0.32) * cv.width, y: G.U.rand(0.12, 0.7) * cv.height, t: 0, life: G.U.rand(0.5, 0.8) });
        }
        for (let i = s.tw.length - 1; i >= 0; i--) {
          const w = s.tw[i];
          w.t += dt;
          if (w.t >= w.life) { s.tw.splice(i, 1); continue; }
          G.Icons.twinkle(ctx, w.x, w.y, w.t / w.life, Math.max(2, k));
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Cambia el tono de los píxeles entre h0 y h1 (grados) por h2, con su luz y saturación. */
  function hueSwap(ctx, cv, [h0, h1, h2]) {
    const img = ctx.getImageData(0, 0, cv.width, cv.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
      if (c < 0.12) continue;                                   // grises: igual
      let h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
      h = (h * 60 + 360) % 360;
      if (h < h0 || h > h1) continue;
      const l = (mx + mn) / 2, sat = c / (1 - Math.abs(2 * l - 1));
      // HSL -> RGB con el tono nuevo.
      const C = (1 - Math.abs(2 * l - 1)) * sat, X = C * (1 - Math.abs((h2 / 60) % 2 - 1)), m = l - C / 2;
      const [R, G2, B] = h2 < 60 ? [C, X, 0] : h2 < 120 ? [X, C, 0] : h2 < 180 ? [0, C, X] : h2 < 240 ? [0, X, C] : h2 < 300 ? [X, 0, C] : [C, 0, X];
      d[i] = (R + m) * 255; d[i + 1] = (G2 + m) * 255; d[i + 2] = (B + m) * 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Crea un <canvas> con un sprite animado (para rejillas). */
  function spriteCanvas(dex, w, h, opts) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    sprite(cv, dex, opts);
    return cv;
  }

  return { $, show, hide, hideAll, isOpen, chrome, refreshCoins, toast, typeChips, stars, confirmDelete,
           sprite, spriteCanvas, tick, initChrome, soundControls, hueSwap };
})();
