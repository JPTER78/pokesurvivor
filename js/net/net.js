/* ============ net.js — conexión entre los jugadores de una sala ============
 * Topología en estrella: el ANFITRIÓN habla con cada invitado; los invitados
 * sólo hablan con el anfitrión (él reenvía lo que haga falta).
 *
 * Dos caminos, a la vez:
 *   directo  WebRTC (canal de datos entre navegadores). La negociación
 *            (señalización) va por la base de datos. STUN gratuito de Google y,
 *            si la red no deja conectar directo (algunos routers y datos
 *            móviles), el TURN propio turn.pokesurvivor.com hace de puente.
 *            Sus credenciales caducan y se piden a
 *            ice.pokesurvivor.com con la sesión de Firebase; si no las da, se
 *            sigue sólo con STUN. Sólo se usa al reintentar una pareja que no
 *            conectó directa, y aun así el navegador prefiere la vía directa.
 *   relé     (APAGADO) los mensajes irían por la Realtime Database:
 *            rooms/{sala}/q/{destinatario}/{id}, a 1 $ el GB.
 *
 * Se envía por el canal directo si está abierto; si no, por el relé. El que
 * recibe escucha los dos, así que no hace falta ponerse de acuerdo.
 *
 * API:  open(roomId, isHost, hostUid) · close() · send(to, msg) · toHost(msg)
 *       broadcast(msg) · on(fn(from, msg)) · onPeer(fn(uid, state))
 *       peers() · mode(uid) -> 'connecting' | 'direct' | 'relay' | 'closed'
 */
G.Net = (() => {
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const TURN_API = 'https://ice.pokesurvivor.com/v1/ice';
  // Primero se intenta sin TURN (lo normal es conectar directo) y sólo si falla se
  // reintenta al momento con él: el navegador reserva un hueco en el TURN por cada
  // conexión que lo lleve, aunque luego vaya directa, y así los huecos llegan para todos.
  const DIRECT_TIMEOUT = 9000, TURN_TIMEOUT = 15000;   // ms para conseguir canal
  // Relé por la Realtime Database APAGADO (12-10-2026): a 1 $ el GB era lo que más
  // costaba del cooperativo. Sin conexión directa, esa pareja no puede jugar
  // junta ('failed') y el anfitrión lo reintenta cada RETRY_MS. Por la base de datos
  // sólo pasa la señalización (unos pocos mensajes pequeños para conectarse).
  const ALLOW_RELAY = false, RETRY_MS = 15000;
  const ICE_BATCH = 250, ICE_MAX = 40;    // candidatos: se juntan 250 ms (o 40) en un mensaje (ver newPeer)


  let rtdb = null, uid = null, roomId = null, isHost = false, hostUid = null;
  let qref = null;
  const peers = new Map();         // uid -> { pc, dc, mode, timer }
  // Anfitrión: invitados con los que ya falló la vía directa. Se recuerda toda la
  // sesión (no sólo la sala) para no perder otra vez la espera sin TURN; y si ha
  // fallado con 2 o más, el problema será la red propia: TURN desde el principio.
  const needTurn = new Set();
  const handlers = new Set(), peerHandlers = new Set();
  const stats = { sent: 0, recv: 0, relaySent: 0,
    // Sólo los datos de la partida que se han mandado bien (sin ICE/SCTP/DTLS/TURN).
    sentBytes: 0, jsonBytes: 0, recvBytes: 0, binarySent: 0, binaryRecv: 0, invalidBinary: 0 };

  // ---------------- TURN propio ----------------
  // Credenciales temporales (2 h) por cuenta. Una conexión por el TURN deja de
  // funcionar cuando caducan las suyas (el servidor ya no le renueva el hueco), así
  // que sólo se reutilizan si les queda más que una partida larga (TURN_KEEP); si
  // el servidor no las da (cuenta no autorizada, caído, sin red), no se vuelve a
  // preguntar en un rato y se juega sólo con STUN.
  let turn = null, turnUid = null, turnAsk = null, turnRetry = 0;
  const TURN_KEEP = 80 * 60000;

  function cleanIce(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 4).map(s => ({
      urls: (Array.isArray(s && s.urls) ? s.urls : []).filter(x => typeof x === 'string' &&
        /^turns?:turn\.pokesurvivor\.com:\d{2,5}(\?transport=(udp|tcp))?$/.test(x)).slice(0, 4),
      username: String(s && s.username || '').slice(0, 200),
      credential: String(s && s.credential || '').slice(0, 200)
    })).filter(s => s.urls.length && s.username && s.credential);
  }

  function turnUser() {
    const fb = G.DB.fb, user = fb && !fb.emulator && fb.auth && fb.auth.currentUser;
    return user && !user.isAnonymous ? user : null;
  }

  /** Lo que ya se sabe sin preguntar: la lista (puede ir vacía) o null si hay que pedirla. */
  function turnNow() {
    const user = turnUser();
    if (!user) return [];
    if (turn && turnUid === user.uid && turn.expiresAt * 1000 - Date.now() > TURN_KEEP) return turn.iceServers;
    return Date.now() < turnRetry ? [] : null;
  }

  function turnServers() {
    const now = turnNow(), user = turnUser();
    if (now) return Promise.resolve(now);
    if (!turnAsk) {
      turnAsk = (async () => {
        const ctl = new AbortController(), stop = setTimeout(() => ctl.abort(), 4000);
        try {
          const token = await user.getIdToken();
          const r = await fetch(TURN_API, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, signal: ctl.signal });
          // 403: esta cuenta no tiene TURN (todavía); no insistir en media hora.
          if (!r.ok) { turnRetry = Date.now() + (r.status === 403 ? 1800000 : 60000); return; }
          const j = await r.json(), iceServers = cleanIce(j && j.iceServers);
          if (!iceServers.length || !(j.expiresAt * 1000 > Date.now())) { turnRetry = Date.now() + 60000; return; }
          turn = { iceServers, expiresAt: j.expiresAt }; turnUid = user.uid;
        } catch (e) { turnRetry = Date.now() + 60000; }
        finally { clearTimeout(stop); turnAsk = null; }
      })();
    }
    return turnAsk.then(() => turn && turnUid === user.uid ? turn.iceServers : []);
  }

  /** ¿La conexión con u ha acabado pasando por el TURN? (para la sala) */
  async function checkTurn(u, p) {
    try {
      const st = await p.pc.getStats();
      let pair = null;
      st.forEach(r => { if (r.type === 'transport' && r.selectedCandidatePairId) pair = st.get(r.selectedCandidatePairId); });
      if (!pair) st.forEach(r => { if (!pair && r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') pair = r; });
      const local = pair && st.get(pair.localCandidateId), remote = pair && st.get(pair.remoteCandidateId);
      const via = !!((local && local.candidateType === 'relay') || (remote && remote.candidateType === 'relay'));
      if (via !== !!p.viaTurn && peers.get(u) === p) { p.viaTurn = via; emitPeer(u); }
    } catch (e) { /* sólo es para el texto de la sala */ }
  }

  function emitPeer(u) {
    const p = peers.get(u);
    peerHandlers.forEach(fn => { try { fn(u, p ? p.mode : 'closed'); } catch (e) { console.warn(e); } });
  }

  // ---------------- apertura ----------------

  function open(id, host, hostId) {
    if (roomId === id) return;
    close();
    const fb = G.DB.fb;
    rtdb = fb.rtdb; uid = fb.uid;
    roomId = id; isHost = host; hostUid = hostId;
    qref = rtdb.ref('rooms/' + id + '/q/' + uid);
    qref.on('child_added', s => {
      const raw = s.val();
      s.ref.remove().catch(() => {});
      let m;
      try { m = JSON.parse(raw); } catch (e) { return; }
      if (!m || !m.f) return;
      if (m.sig) onSignal(m.f, m.sig);
      else deliver(m.f, m.d);
    });
    // Invitado: hueco para el anfitrión desde ya (se sustituye al llegar su
    // oferta). Así, si no llega nunca, se sigue por el relé y se sabe cuándo se va.
    if (!isHost) {
      const p = { pc: null, dc: null, mode: 'connecting', timer: 0 };
      p.timer = setTimeout(() => { if (p.mode === 'connecting') { p.mode = ALLOW_RELAY ? 'relay' : 'failed'; emitPeer(hostId); } }, DIRECT_TIMEOUT + TURN_TIMEOUT + 3000);
      peers.set(hostId, p);
    }
  }

  function close() {
    for (const u of [...peers.keys()]) drop(u);
    if (qref) { qref.off(); qref = null; }
    roomId = null; isHost = false; hostUid = null;
  }

  const turnFirst = u => needTurn.has(u) || needTurn.size >= 2;

  /** El anfitrión llama a esto cuando cambian los miembros de la sala. */
  function syncMembers(uids) {
    if (!roomId) return;
    if (isHost) {
      for (const u of uids) if (u !== uid && !peers.has(u)) connect(u);
      for (const u of [...peers.keys()]) if (!uids.includes(u)) drop(u);
    } else if (!uids.includes(hostUid)) {
      drop(hostUid);
    }
  }

  // ---------------- WebRTC ----------------

  function newPeer(u, turnIce) {
    const p = { pc: null, dc: null, mode: 'connecting', timer: 0, viaTurn: false, turn: !!(turnIce && turnIce.length) };
    peers.set(u, p);
    // Sin WebRTC (navegador antiguo o bloqueado): directamente por el relé.
    let pc;
    try { pc = p.pc = new RTCPeerConnection({ iceServers: ICE.concat(turnIce || []) }); }
    catch (e) { p.mode = 'relay'; emitPeer(u); return p; }
    /*
     * Los candidatos de conexión se juntan ICE_BATCH ms y van en un solo mensaje
     * ({ cs: [...] }), y en cuanto no hay más (candidate null), al momento.
     * Antes iba uno por mensaje: unos 4.000 por minuto por la base de datos
     * (25-10-2026), lo que más se descargaba de ella. Quien recibe entiende los
     * dos (las versiones de antes mandan { c }).
     */
    const iceOut = [];
    let iceT = 0;
    const flushIce = () => { clearTimeout(iceT); iceT = 0; if (iceOut.length && peers.get(u) === p) signal(u, { cs: iceOut.splice(0) }); };
    pc.onicecandidate = e => {
      if (!e.candidate) { flushIce(); return; }
      iceOut.push(e.candidate.toJSON());
      if (iceOut.length >= ICE_MAX) flushIce();
      else if (!iceT) iceT = setTimeout(flushIce, ICE_BATCH);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && p.mode !== 'closed') useRelay(u);
    };
    // Si en unos segundos no hay canal directo, se sigue por el relé.
    p.timer = setTimeout(() => { if (p.mode === 'connecting') useRelay(u); }, p.turn ? TURN_TIMEOUT : DIRECT_TIMEOUT);
    emitPeer(u);
    return p;
  }

  function wireChannel(u, p, dc) {
    p.dc = dc;
    p.binaryVersion = 0;
    dc.binaryType = 'arraybuffer';
    dc.onopen = () => {
      clearTimeout(p.timer); p.mode = 'direct';
      if (p.pc) checkTurn(u, p);
      // Aviso de que entendemos binario (las versiones viejas lo ignoran); hasta que el otro
      // mande el suyo, se le habla en JSON.
      try { dc.send(JSON.stringify({ k: 'net-cap', binary: G.NetCodec.version })); } catch (e) { /* el JSON sigue valiendo */ }
      emitPeer(u);
    };
    dc.onclose = () => { if (p.mode === 'direct') { p.mode = 'connecting'; useRelay(u); } };
    dc.onmessage = e => {
      let m;
      if (typeof e.data === 'string') {
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m && m.k === 'net-cap') {
          p.binaryVersion = m.binary === G.NetCodec.version ? m.binary : 0;
          return;
        }
        stats.recvBytes += G.NetCodec.size(e.data);
      } else {
        try {
          if (p.binaryVersion !== G.NetCodec.version) throw Error('unnegotiated binary');
          m = G.NetCodec.decode(e.data);
          if (!m || m.k !== 'f') throw Error('not a frame');
        } catch (err) { stats.invalidBinary++; return; }
        stats.recvBytes += e.data.byteLength; stats.binaryRecv++;
      }
      deliver(u, m);
    };
  }

  function useRelay(u) {
    const p = peers.get(u);
    if (!p || p.mode === 'direct' || p.mode === 'closed' || p.mode === 'failed') return;
    if (ALLOW_RELAY) { p.mode = 'relay'; emitPeer(u); return; }
    // Sin relé: no se puede jugar con esa persona por ahora. El anfitrión reintenta.
    clearTimeout(p.timer);
    p.mode = 'failed';
    try { if (p.pc) p.pc.close(); } catch (e) { /* nada */ }
    emitPeer(u);
    if (!isHost) return;
    // Primer fallo sin TURN: se reintenta ya, esta vez con él (si la cuenta lo tiene).
    const withTurn = !p.turn && !needTurn.has(u) && !!turnUser();
    if (withTurn) needTurn.add(u);
    p.timer = setTimeout(() => { if (peers.get(u) === p && p.mode === 'failed' && roomId) { drop(u, true); connect(u); } }, withTurn ? 0 : RETRY_MS);
  }

  /** Anfitrión: abre conexión con un invitado. */
  async function connect(u) {
    if (!roomId || peers.has(u)) return;
    let turnIce = turnFirst(u) ? turnNow() : [];
    if (!turnIce) {
      const room = roomId; turnIce = await turnServers();
      if (roomId !== room || peers.has(u)) return;
    }
    const p = newPeer(u, turnIce);
    if (!p.pc) return;
    wireChannel(u, p, p.pc.createDataChannel('g', { ordered: true }));
    try {
      const offer = await p.pc.createOffer();
      await p.pc.setLocalDescription(offer);
      // t: el invitado también usa el TURN en este intento (las versiones viejas lo ignoran).
      signal(u, p.turn ? { sdp: p.pc.localDescription.toJSON(), t: 1 } : { sdp: p.pc.localDescription.toJSON() });
    } catch (e) { useRelay(u); }
  }

  const pendingIce = new Map();     // candidatos que llegan antes que la oferta

  async function onSignal(from, sig) {
    let p = peers.get(from);
    try {
      if (sig.sdp && sig.sdp.type === 'offer') {
        if (isHost) return;
        let turnIce = sig.t ? turnNow() : [];
        if (!turnIce) {
          const room = roomId; turnIce = await turnServers();
          if (roomId !== room) return;
          p = peers.get(from);
        }
        if (p) drop(from, true);
        p = newPeer(from, turnIce);
        if (!p.pc) return;
        p.pc.ondatachannel = e => wireChannel(from, p, e.channel);
        await p.pc.setRemoteDescription(sig.sdp);
        const ans = await p.pc.createAnswer();
        await p.pc.setLocalDescription(ans);
        signal(from, { sdp: p.pc.localDescription.toJSON() });
        for (const c of pendingIce.get(from) || []) await p.pc.addIceCandidate(c).catch(() => {});
        pendingIce.delete(from);
      } else if (sig.sdp && sig.sdp.type === 'answer') {
        if (p && p.pc) await p.pc.setRemoteDescription(sig.sdp);
      } else if (sig.c || Array.isArray(sig.cs)) {
        for (const c of sig.cs || [sig.c]) {
          if (p && p.pc && p.pc.remoteDescription) await p.pc.addIceCandidate(c).catch(() => {});
          else { if (!pendingIce.has(from)) pendingIce.set(from, []); pendingIce.get(from).push(c); }
        }
      }
    } catch (e) {
      console.warn('[Net] señalización:', e.message);
      useRelay(from);
    }
  }

  function signal(to, sig) { relayPush(to, { f: uid, sig }); }

  function drop(u, silent) {
    const p = peers.get(u);
    if (!p) return;
    clearTimeout(p.timer);
    p.mode = 'closed';
    try { if (p.dc) p.dc.close(); } catch (e) { /* nada */ }
    try { if (p.pc) p.pc.close(); } catch (e) { /* nada */ }
    peers.delete(u);
    if (!silent) emitPeer(u);
  }

  // ---------------- envío / recepción ----------------

  /*
   * Cada remitente tiene 100 huecos por destinatario (tuUid_00 ... tuUid_99) y
   * los va usando en orden; quien recibe borra cada mensaje al leerlo. Antes cada
   * mensaje era nuevo (push) y sin tope de tamaño, y el 23-10-2026 se llenó la
   * base de datos de basura (ver social.js, createRoom). Las reglas
   * (database.rules.json) sólo admiten estos huecos y mensajes de hasta 16.000.
   */
  let slot = 0;
  function relayPush(to, env) {
    if (!rtdb || !roomId) return;
    const key = uid + '_' + String(slot++ % 100).padStart(2, '0');
    rtdb.ref('rooms/' + roomId + '/q/' + to + '/' + key).set(JSON.stringify(env)).catch(e => console.warn('[Net] relé:', e.code || e.message));
  }

  function send(to, msg) {
    if (!roomId) return;
    const p = peers.get(to);
    stats.sent++;
    if (p && p.dc && p.dc.readyState === 'open') {
      try {
        const json = JSON.stringify(msg), jsonBytes = G.NetCodec.size(json);
        const packed = p.binaryVersion === G.NetCodec.version && msg && msg.k === 'f'
          ? G.NetCodec.encode(msg) : null;
        const binary = packed && packed.byteLength < jsonBytes;
        p.dc.send(binary ? packed : json);
        stats.sentBytes += binary ? packed.byteLength : jsonBytes;
        stats.jsonBytes += jsonBytes;
        if (binary) stats.binarySent++;
        return;
      } catch (e) { /* cae al relé */ }
    }
    // Sin relé, los datos de la partida no van por la base de datos (se pierden: esa
    // pareja no está conectada). Sólo pasa el aviso de empezar.
    if (!ALLOW_RELAY && !(msg && msg.k === 'start')) return;
    stats.relaySent++;
    relayPush(to, { f: uid, d: msg });
  }

  function toHost(msg) { if (!isHost && hostUid) send(hostUid, msg); }
  function broadcast(msg, except) { for (const u of peers.keys()) if (u !== except) send(u, msg); }

  function deliver(from, msg) {
    stats.recv++;
    handlers.forEach(fn => { try { fn(from, msg); } catch (e) { console.error('[Net] mensaje:', e); } });
  }

  return {
    open, close, syncMembers, send, toHost, broadcast,
    on(fn) { handlers.add(fn); }, off(fn) { handlers.delete(fn); },
    onPeer(fn) { peerHandlers.add(fn); },
    mode(u) { const p = peers.get(u); return p ? p.mode : 'closed'; },
    /** ¿Conectado pero pasando por el TURN propio? */
    viaTurn(u) { const p = peers.get(u); return !!(p && p.mode === 'direct' && p.viaTurn); },
    /** ¿Va por el relé (o no hay conexión)? Entonces se manda menos a menudo. */
    slow(u) { const p = peers.get(u); return !p || p.mode !== 'direct'; },
    peers() { return [...peers.keys()]; },
    get open_() { return !!roomId; },
    get isHost() { return isHost; },
    get uid() { return uid; },
    get hostUid() { return hostUid; },
    stats
  };
})();
