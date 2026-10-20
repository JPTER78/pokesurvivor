/* Mensajes de la partida en binario, sin perder nada (PR #221 de aaronariasperez).
 * Cada paquete va solo: sin diccionario compartido ni diferencias con el anterior.
 * 'PS' + versión 1; etiquetas null/bool/entero/negativo/float64/centésimas/texto/lista/objeto.
 * Etiquetas 32..127 = enteros 0..95; 128..223 = enteros -1..-96.
 * Sólo se usa si el otro lo ha aceptado; lo que no se pueda codificar va en JSON.
 * Llega lo mismo que con JSON.parse(JSON.stringify(x)): -0 es 0, NaN/Infinity son null
 * y lo undefined es null en una lista o no se manda en un objeto.
 */
G.NetCodec = (() => {
  const MAX_BYTES = 1024 * 1024, MAX_NODES = 100000, MAX_DEPTH = 32;
  const utf8 = new TextEncoder(), text = new TextDecoder('utf-8', { fatal: true });
  const size = s => utf8.encode(s).byteLength;

  function encode(value) {
    try {
      let bytes = new Uint8Array(1024), at = 0, nodes = 0;
      function reserve(n) {
        if (at + n > MAX_BYTES) throw Error('packet size');
        if (at + n > bytes.length) {
          const next = new Uint8Array(Math.min(MAX_BYTES, Math.max(at + n, bytes.length * 2)));
          next.set(bytes); bytes = next;
        }
      }
      function byte(n) { reserve(1); bytes[at++] = n; }
      function uint(n) {
        do { const part = n % 128; n = Math.floor(n / 128); byte(part + (n ? 128 : 0)); } while (n);
      }
      function string(s) {
        if (s.length > MAX_BYTES) throw Error('string size');
        // UTF-8 cambiaría una mitad suelta de un carácter: mejor JSON que tocar un nombre.
        for (let i = 0; i < s.length; i++) {
          const c = s.charCodeAt(i);
          if (c >= 0xd800 && c <= 0xdbff) {
            const low = s.charCodeAt(++i);
            if (!(low >= 0xdc00 && low <= 0xdfff)) throw Error('surrogate');
          } else if (c >= 0xdc00 && c <= 0xdfff) throw Error('surrogate');
        }
        const b = utf8.encode(s); uint(b.length); reserve(b.length); bytes.set(b, at); at += b.length;
      }
      const skip = v => v === undefined || typeof v === 'function' || typeof v === 'symbol';
      function write(v, depth) {
        if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw Error('complexity');
        if (v === null || skip(v) || (typeof v === 'number' && !Number.isFinite(v))) { byte(0); return; }
        if (v === false) { byte(1); return; }
        if (v === true) { byte(2); return; }
        if (typeof v === 'number') {
          if (v === 0) { byte(32); return; }          // también -0, como en JSON
          if (Number.isSafeInteger(v)) {
            if (v >= 0 && v <= 95) { byte(32 + v); return; }
            if (v < 0 && v >= -96) { byte(127 - v); return; }
            byte(v < 0 ? 4 : 3); uint(Math.abs(v)); return;
          }
          const cents = Math.round(v * 100);
          if (Number.isSafeInteger(cents) && cents / 100 === v) {
            byte(v < 0 ? 7 : 6); uint(Math.abs(cents)); return;
          }
          byte(5); reserve(8); new DataView(bytes.buffer).setFloat64(at, v, true); at += 8; return;
        }
        if (typeof v === 'string') { byte(8); string(v); return; }
        if (Array.isArray(v)) {
          if (v.length > MAX_NODES) throw Error('array size');
          byte(9); uint(v.length); for (const item of v) write(item, depth + 1); return;
        }
        if (v && typeof v === 'object' &&
            (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)) {
          const keys = Object.keys(v).filter(k => !skip(v[k])); byte(10); uint(keys.length);
          for (const key of keys) { string(key); write(v[key], depth + 1); } return;
        }
        throw Error('unsupported value');
      }
      if (skip(value)) throw Error('unsupported value');
      byte(80); byte(83); byte(1); write(value, 0);
      return bytes.buffer.slice(0, at);
    } catch (e) { return null; }
  }

  function decode(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > MAX_BYTES) throw Error('packet size/type');
    const bytes = new Uint8Array(buffer), view = new DataView(buffer);
    let at = 0, nodes = 0;
    function need(n) { if (n > bytes.length - at) throw Error('truncated packet'); }
    function byte() { need(1); return bytes[at++]; }
    function uint() {
      let value = 0, scale = 1;
      for (let i = 0; i < 8; i++) {
        const b = byte(); value += (b & 127) * scale;
        if (!Number.isSafeInteger(value)) throw Error('integer overflow');
        if (!(b & 128)) { if (i && b === 0) throw Error('noncanonical integer'); return value; }
        scale *= 128;
      }
      throw Error('integer overflow');
    }
    function string() { const n = uint(); need(n); const s = text.decode(bytes.subarray(at, at + n)); at += n; return s; }
    function read(depth) {
      if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw Error('complexity');
      const tag = byte();
      if (tag >= 32 && tag <= 127) return tag - 32;
      if (tag >= 128 && tag <= 223) return 127 - tag;
      switch (tag) {
        case 0: return null;
        case 1: return false;
        case 2: return true;
        case 3: return uint();
        case 4: return -uint();
        case 5: {
          need(8); const n = view.getFloat64(at, true); at += 8;
          if (!Number.isFinite(n)) throw Error('number'); return n;
        }
        case 6: return uint() / 100;
        case 7: return -uint() / 100;
        case 8: return string();
        case 9: {
          const n = uint();
          if (n > MAX_NODES - nodes || n > bytes.length - at) throw Error('array size');
          const a = []; for (let i = 0; i < n; i++) a.push(read(depth + 1)); return a;
        }
        case 10: {
          const n = uint();
          if (n > MAX_NODES - nodes || n > (bytes.length - at) / 2) throw Error('object size');
          const o = {};
          for (let i = 0; i < n; i++) {
            const key = string();
            if (Object.prototype.hasOwnProperty.call(o, key)) throw Error('duplicate key');
            Object.defineProperty(o, key, { value: read(depth + 1), enumerable: true, writable: true, configurable: true });
          }
          return o;
        }
        default: throw Error('unknown tag');
      }
    }
    if (byte() !== 80 || byte() !== 83 || byte() !== 1) throw Error('protocol version');
    const value = read(0);
    if (at !== bytes.length) throw Error('trailing bytes');
    return value;
  }
  return { version: 1, encode, decode, size, MAX_BYTES };
})();
