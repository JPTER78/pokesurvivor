/* ============ net.js — conexión entre los jugadores de una sala ============
 * Topología en estrella: el ANFITRIÓN habla con cada invitado; los invitados
 * sólo hablan con el anfitrión (él reenvía lo que haga falta).
 *
 * Dos caminos, a la vez:
 *   directo  WebRTC (canal de datos entre navegadores, sin pasar por ningún
 *            servidor). La negociación (señalización) va por la base de datos.
 *            Si la red no deja conectar directo (algunos routers y datos
 *            móviles), WebRTC pasa por el TURN de Cloudflare (sigue siendo
 *            "directo" para el juego). Las claves las da cloudflare/turn-worker.js
 *            sólo a jugadores con cuenta.
 *   relé     Si ni así (o el Worker no responde), los mensajes van por la
 *            Realtime Database: rooms/{sala}/q/{destinatario}/{id}. Funciona,
 *            pero cuesta 1 $ el GB: antes del TURN era casi todo el gasto.
 *
 * Se envía por el canal directo si está abierto; si no, por el relé. El que
 * recibe escucha los dos, así que no hace falta ponerse de acuerdo.
 *
 * API:  open(roomId, isHost, hostUid) · close() · send(to, msg) · toHost(msg)
 *       broadcast(msg) · on(fn(from, msg)) · onPeer(fn(uid, state))
 *       peers() · mode(uid) -> 'connecting' | 'direct' | 'relay' | 'closed'
 */
G.Net = (() => {
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
               { urls: 'stun:stun.cloudflare.com:3478' }];
  const DIRECT_TIMEOUT = 9000;     // ms para conseguir canal directo antes de usar el relé

  // ---------------- TURN (Cloudflare) ----------------
  const TURN_URL = 'https://turn.pokesurvivor.com/';
  let turn = null, turnAt = 0, turnReq = null;
  /** Pide (o reutiliza) credenciales TURN. Nunca falla: sin ellas, se sigue como antes. */
  function fetchTurn() {
    const fb = G.DB.fb;
    if (!fb || fb.emulator || !fb.auth || !fb.auth.currentUser) return Promise.resolve(null);
    if (turn && Date.now() - turnAt < (turn.ttl - 600) * 1000) return Promise.resolve(turn);
    if (turnReq) return turnReq;
    turnReq = fb.auth.currentUser.getIdToken()
      .then(tok => fetch(TURN_URL, { headers: { Authorization: 'Bearer ' + tok } }))
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (j && j.iceServers) { turn = { servers: [].concat(j.iceServers), ttl: j.ttl || 3600 }; turnAt = Date.now(); }
        return turn;
      })
      .catch(e => { console.warn('[Net] TURN:', e.message); return null; })
      .finally(() => { turnReq = null; });
    return turnReq;
  }
  /** Espera las credenciales como mucho 2,5 s (si tardan más, se conecta sin ellas). */
  const waitTurn = () => Promise.race([fetchTurn(), new Promise(r => setTimeout(r, 2500))]);
  const iceServers = () => (turn ? ICE.concat(turn.servers) : ICE);

  let rtdb = null, uid = null, roomId = null, isHost = false, hostUid = null;
  let qref = null;
  const peers = new Map();         // uid -> { pc, dc, mode, timer }
  const handlers = new Set(), peerHandlers = new Set();
  let stats = { sent: 0, recv: 0, relaySent: 0 };

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
    fetchTurn();                    // se piden ya, para tenerlas al conectar
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
      p.timer = setTimeout(() => { if (p.mode === 'connecting') { p.mode = 'relay'; emitPeer(hostId); } }, DIRECT_TIMEOUT + 3000);
      peers.set(hostId, p);
    }
  }

  function close() {
    for (const u of [...peers.keys()]) drop(u);
    if (qref) { qref.off(); qref = null; }
    roomId = null; isHost = false; hostUid = null;
  }

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

  function newPeer(u) {
    const p = { pc: null, dc: null, mode: 'connecting', timer: 0 };
    peers.set(u, p);
    // Sin WebRTC (navegador antiguo o bloqueado): directamente por el relé.
    let pc;
    try { pc = p.pc = new RTCPeerConnection({ iceServers: iceServers() }); }
    catch (e) { p.mode = 'relay'; emitPeer(u); return p; }
    pc.onicecandidate = e => { if (e.candidate) signal(u, { c: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected'].includes(pc.connectionState) && p.mode !== 'closed') useRelay(u);
      else if (pc.connectionState === 'connected' && p.dc && p.dc.readyState === 'open' && peers.get(u) === p) {
        p.mode = 'direct'; emitPeer(u);
      }
    };
    // Si en unos segundos no hay canal directo, se sigue por el relé.
    p.timer = setTimeout(() => { if (p.mode === 'connecting') useRelay(u); }, DIRECT_TIMEOUT);
    emitPeer(u);
    return p;
  }

  function wireChannel(u, p, dc) {
    p.dc = dc;
    dc.onopen = () => { clearTimeout(p.timer); p.mode = 'direct'; emitPeer(u); checkTurn(p); };
    dc.onclose = () => { if (p.mode === 'direct') { p.mode = 'relay'; emitPeer(u); } };
    dc.onmessage = e => {
      let m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      deliver(u, m);
    };
  }

  /**
   * ¿El canal "directo" pasa en realidad por el TURN de Cloudflare? Entonces se
   * manda menos a menudo (ver coop.js): el TURN se paga por GB a partir de 1.000 al mes.
   */
  async function checkTurn(p) {
    try {
      const st = await p.pc.getStats();
      st.forEach(s => {
        if (s.type !== 'candidate-pair' || !s.nominated || s.state !== 'succeeded') return;
        const l = st.get(s.localCandidateId), r = st.get(s.remoteCandidateId);
        if ((l && l.candidateType === 'relay') || (r && r.candidateType === 'relay')) p.turn = true;
      });
    } catch (e) { /* nada */ }
  }

  function useRelay(u) {
    const p = peers.get(u);
    if (!p || p.mode === 'relay' || p.mode === 'closed') return;
    p.mode = 'relay';
    emitPeer(u);
  }

  /** Anfitrión: abre conexión con un invitado. */
  async function connect(u) {
    await waitTurn();
    if (!roomId || peers.has(u)) return;
    const p = newPeer(u);
    if (!p.pc) return;
    wireChannel(u, p, p.pc.createDataChannel('g', { ordered: true }));
    try {
      const offer = await p.pc.createOffer();
      await p.pc.setLocalDescription(offer);
      signal(u, { sdp: p.pc.localDescription.toJSON() });
    } catch (e) { useRelay(u); }
  }

  const pendingIce = new Map();     // candidatos que llegan antes que la oferta

  async function onSignal(from, sig) {
    let p = peers.get(from);
    try {
      if (sig.sdp && sig.sdp.type === 'offer') {
        if (isHost) return;
        if (p) drop(from, true);
        await waitTurn();
        p = newPeer(from);
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
      } else if (sig.c) {
        if (p && p.pc && p.pc.remoteDescription) await p.pc.addIceCandidate(sig.c).catch(() => {});
        else { if (!pendingIce.has(from)) pendingIce.set(from, []); pendingIce.get(from).push(sig.c); }
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

  function relayPush(to, env) {
    if (!rtdb || !roomId) return;
    rtdb.ref('rooms/' + roomId + '/q/' + to).push(JSON.stringify(env)).catch(e => console.warn('[Net] relé:', e.code || e.message));
  }

  function send(to, msg) {
    if (!roomId) return;
    const p = peers.get(to);
    stats.sent++;
    if (p && p.mode === 'direct' && p.dc && p.dc.readyState === 'open') {
      try { p.dc.send(JSON.stringify(msg)); return; } catch (e) { /* cae al relé */ }
    }
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
    /** ¿Va por el relé? Entonces se manda menos a menudo. */
    slow(u) { const p = peers.get(u); return !p || p.mode !== 'direct'; },
    /** ¿Va directo pero a través del TURN de Cloudflare? (se manda algo menos) */
    viaTurn(u) { const p = peers.get(u); return !!p && p.mode === 'direct' && !!p.turn; },
    peers() { return [...peers.keys()]; },
    get open_() { return !!roomId; },
    get isHost() { return isHost; },
    get uid() { return uid; },
    get hostUid() { return hostUid; },
    stats,
    /** ¿Hay credenciales TURN? (para pruebas y diagnóstico) */
    get turn() { return !!turn; }
  };
})();
