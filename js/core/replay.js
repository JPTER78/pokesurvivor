/* ============ replay.js — grabación de la partida (para poder verificarla) ============
 * Guarda lo necesario para volver a jugar una partida en un servidor y
 * comprobar su resultado (fase 2, ver docs/anticheat.md):
 *
 *   cabecera  versión del juego, semilla del mundo, Pokémon, mejoras, atajos...
 *   entradas  cada cambio del joystick/teclas (cuantizado), cartas y objetos
 *             elegidos, fusiones, cambios de movimiento, abandonar
 *   puntos    cada 30 s: nivel, derrotados, posición y vida (para detectar
 *             dónde se separa una repetición de la partida real)
 *
 * Todo en un binario compacto (varints) en base64url: unos 10-40 KB en una
 * partida de 30 min. Sólo sube al servidor si la marca mejora alguna tabla del
 * ranking (net/ranking.js, colección replays/{uid}), y se quita al borrar la cuenta.
 *
 * OJO: hoy sirve para REGISTRAR, no para reproducir bit a bit: el juego usa
 * Math.random y pasos de tiempo variables. docs/anticheat.md explica lo que
 * falta (generador con semilla y paso fijo) antes de poder verificar.
 */
G.Replay = (() => {
  const MAX_BYTES = 90000;                 // tope de lo grabado (luego sólo se marca "truncado")
  const CHECK_EVERY = 30;                  // segundos entre puntos de control
  // Códigos de las entradas
  const AXIS = 1, CARD = 2, REROLL = 3, ITEM = 4, BOND = 5, SLOT = 6, CHECK = 7, QUIT = 8;

  let hdr = null, buf = [], lastT = 0, ax = 0, ay = 0, nextCheck = CHECK_EVERY, truncated = false, n = 0, rid = '';

  const version = () => {
    const tag = document.querySelector('script[src*="app.min.js?v="]');
    return tag ? (tag.getAttribute('src').match(/v=([0-9a-f]+)/) || [])[1] || '' : 'dev';
  };

  /** 16 bits de una cadena (para comprobar que la carta o el objeto es el mismo al repetir). */
  function h16(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) & 0xffff;
  }

  function varint(v) {
    v = Math.max(0, Math.round(v));
    while (v > 127) { buf.push((v & 127) | 128); v = Math.floor(v / 128); }
    buf.push(v);
  }
  const zig = v => (v < 0 ? -2 * v - 1 : 2 * v);

  /** Nueva partida. */
  function begin(h) {
    const a = new Uint8Array(9);
    (crypto && crypto.getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 256; }));
    rid = Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
    hdr = Object.assign({ v: version(), at: Date.now() }, h);
    buf = []; lastT = 0; ax = ay = 0; nextCheck = CHECK_EVERY; truncated = false; n = 0;
  }

  function put(t, code, a = 0, b = 0) {
    if (!hdr) return;
    if (buf.length > MAX_BYTES) { truncated = true; return; }
    const ms = Math.max(0, Math.round(t * 1000));
    varint(ms - lastT); lastT = ms;
    buf.push(code);
    varint(zig(a)); varint(zig(b));
    n++;
  }

  /** Cada fotograma: sólo se anota cuando cambia (a 1/127 de precisión). */
  function axis(t, x, y) {
    const qx = Math.round(x * 127), qy = Math.round(y * 127);
    if (qx !== ax || qy !== ay) { ax = qx; ay = qy; put(t, AXIS, qx, qy); }
  }

  const card = (t, c) => put(t, CARD, h16(c.key || c.title || ''));
  const reroll = t => put(t, REROLL);
  const item = (t, id) => put(t, ITEM, h16(String(id)));
  const bond = (t, moves) => put(t, BOND, moves.length, h16(moves.map(m => m.id).join()));
  const slot = (t, i) => put(t, SLOT, i);
  const quit = t => put(t, QUIT);

  /** Punto de control cada 30 s: dónde estás y cómo vas. */
  function tick(t, pl) {
    if (!hdr || t < nextCheck) return;
    nextCheck += CHECK_EVERY;
    put(t, CHECK, pl.level, pl.kills);
    put(t, CHECK, Math.round(pl.x), Math.round(pl.y));
    put(t, CHECK, Math.round(pl.hp), Math.round(pl.xp));
  }

  /** Lo grabado, listo para subir. */
  function finish(t) {
    if (!hdr) return null;
    put(t, CHECK, -1, n);
    let s = '';
    for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.slice(i, i + 8192));
    const log = btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return { rid, hdr, log, n, trunc: truncated };
  }

  return { begin, axis, card, reroll, item, bond, slot, quit, tick, finish, get rid() { return rid; }, CODES: { AXIS, CARD, REROLL, ITEM, BOND, SLOT, CHECK, QUIT } };
})();
