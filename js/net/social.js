/* ============ social.js — apodo, amigos, invitaciones y salas ============
 * Sólo funciona con cuenta en la nube (G.DB.online). Usa:
 *
 *   Firestore
 *     names/{apodo en minúsculas}  { uid }               apodos únicos
 *     profiles/{uid}               { name, lower, at }   apodo público
 *     friendships/{uidA_uidB}      { users, from, to, status: 'pending'|'ok', names, at }
 *
 *     pres/{uid}                   (el "en línea", quitado el 20-10-2026: sólo se borra con la cuenta)
 *     inv/{para_de}                { to, from, room, name, at } invitaciones
 *
 *   Realtime Database: SÓLO mientras estás en una sala o partida en grupo
 *     rooms/{id}          { host, open, at, m: { uid: { name, dex, shiny } }, q: ... }
 *                         la sala; q/ son los mensajes de net.js
 *
 * Por qué así: el plan gratuito de Firebase sólo admite 100 conexiones a la
 * vez a la Realtime Database. Si todo el mundo estuviera conectado, ése sería
 * el máximo de jugadores: sólo se conectan los que están en una sala.
 *
 * El resto del juego escucha los cambios con G.Social.on(fn).
 */
G.Social = (() => {
  const VALID = /^[A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]{3,16}$/;
  const MAX_PLAYERS = 4;
  const INVITE_TTL = 3 * 60 * 1000;
  const REINVITE_MS = 20 * 1000;     // volver a invitar al mismo amigo antes de esto no escribe nada
  /*
   * Hora real: la del servidor de la web (cabecera Date de version.json, gratis).
   * Si el reloj del aparato va adelantado (p. ej. la zona horaria mal puesta),
   * todas las invitaciones parecían caducadas y se borraban sin enseñarse, y
   * los amigos salían siempre desconectados (pasaba en 2026-10).
   */
  let skew = 0;
  const now = () => Date.now() + skew;
  function measureSkew() {
    const t0 = Date.now();
    fetch('version.json?t=' + t0, { method: 'HEAD', cache: 'no-store' }).then(r => {
      const d = Date.parse(r.headers.get('date') || '');
      if (!d) return;
      const s = d + 500 - (t0 + Date.now()) / 2;          // (la cabecera va en segundos)
      skew = Math.abs(s) > 60000 ? s : 0;
      if (skew) console.warn('[Social] el reloj de este aparato va desfasado', Math.round(skew / 60000), 'min: se corrige');
    }).catch(() => {});
  }
  let fb = null, uid = null;
  let me = null;                    // { uid, name }
  let friends = new Map();          // otherUid -> { uid, name, pid, status: 'ok'|'in'|'out', online, play }
  let unFriends = null;
  let listening = false, unInv = null;  // listening: ya se ha puesto en marcha (online)
  const sentInv = new Map();        // a quién invitaste: uid -> { room, at } (para retirarlo al salir)
  let room = null;                  // { id, host, isHost, members: [{ uid, name, dex, shiny }] }
  let roomRefs = [];
  const invites = new Map();        // fromUid -> { from, name, room, at }
  const listeners = new Set();
  let started = false;

  function emit(what) { listeners.forEach(fn => { try { fn(what); } catch (e) { console.warn(e); } }); }
  const ts = () => firebase.database.ServerValue.TIMESTAMP;
  const fts = () => firebase.firestore.FieldValue.serverTimestamp();
  const msOf = v => (v && v.toMillis ? v.toMillis() : +v || 0);

  // ---------------- arranque ----------------

  /** Tras iniciar sesión. → 'ok' | 'need-nick' | 'off' (sin nube) */
  async function start() {
    if (!G.DB.online) return 'off';
    if (started) return me ? 'ok' : 'need-nick';
    fb = G.DB.fb; uid = fb.uid;
    started = true;
    measureSkew();
    // El apodo no cambia nunca: se recuerda en este navegador y así no se lee
    // el perfil en cada visita (una lectura menos por jugador y sesión).
    const NICK = 'ps.nick.' + uid;
    let cachedNick = null;
    try { cachedNick = localStorage.getItem(NICK); } catch (e) { /* nada */ }
    const prof = cachedNick ? { name: cachedNick }
      : await fb.fs.collection('profiles').doc(uid).get().then(s => s.exists ? s.data() : null).catch(() => null);
    if (prof) {
      me = { uid, name: prof.name };
      if (G.DB.user !== prof.name) G.DB.setName(prof.name);
      try { localStorage.setItem(NICK, prof.name); } catch (e) { /* nada */ }
    }
    else if (G.DB.nameAccount) {
      // Cuentas de nombre y contraseña: su nombre ya es único, se usa de apodo.
      const r = await claimNick(G.DB.save.name);
      if (!r.ok) return 'need-nick';
    } else return 'need-nick';
    online();
    return 'ok';
  }

  /** Reserva un apodo único y crea el perfil público. */
  async function claimNick(name) {
    name = (name || '').trim();
    if (!VALID.test(name)) return { ok: false, error: 'El apodo debe tener 3-16 letras, números o _.' };
    const lower = name.toLowerCase();
    try {
      await fb.fs.runTransaction(async tx => {
        const nref = fb.fs.collection('names').doc(lower);
        const n = await tx.get(nref);
        if (n.exists && n.data().uid !== uid) throw { code: 'taken' };
        if (!n.exists) tx.set(nref, { uid });
        tx.set(fb.fs.collection('profiles').doc(uid),
          { name, lower, at: firebase.firestore.FieldValue.serverTimestamp() });
      });
    } catch (e) {
      if (e && e.code === 'taken') return { ok: false, error: 'Ese apodo ya lo tiene otro jugador.' };
      return { ok: false, error: 'No se pudo guardar el apodo (' + ((e && e.code) || 'error') + ').' };
    }
    me = { uid, name };
    try { localStorage.setItem('ps.nick.' + uid, name); } catch (e) { /* nada */ }
    G.DB.setName(name);
    if (started && !listening) online();
    publishProfile(true);
    return { ok: true };
  }

  /*
   * Amigos e invitaciones. Nada de esto usa la Realtime Database.
   * Desde el 20-10-2026 la lista de amigos NO se carga al entrar (1 lectura por
   * amigo en cada carga de la página, para todos): sólo al abrir Amigos, la sala
   * o el ranking de amigos (ensureFriends). Las invitaciones sí se escuchan desde
   * el principio si este navegador sabe que tienes amigos (hasFrKey); el servidor
   * ya comprueba que sean de un amigo.
   */
  const hasFrKey = () => 'ps.hasfr.' + uid;
  function online() {
    if (listening) return;                    // ya estaba en marcha
    listening = true;
    if (fb.rtdb) fb.rtdb.goOffline();         // se conecta sólo al entrar en una sala
    let known = false;
    try { known = localStorage.getItem(hasFrKey()) === '1'; } catch (e) { /* nada */ }
    if (known) listenInvites();
  }

  /** Carga la lista de amigos (y la sigue escuchando) la primera vez que hace falta. */
  let friendsReady = null;
  function ensureFriends() {
    if (!fb || !me) return Promise.resolve();
    if (!friendsReady) friendsReady = new Promise(res => listenFriends(res));
    return friendsReady;
  }

  /** Invitaciones a salas: sólo te pueden llegar de amigos, así que sin amigos no se escucha (lecturas). */
  function listenInvites() {
    if (unInv || !fb) return;
    unInv = fb.fs.collection('inv').where('to', '==', uid).onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        const v = ch.doc.data();
        if (ch.type === 'removed') { invites.delete(v.from); emit('invites'); return; }
        onInvite(ch.doc.ref, v);
      });
    }, e => console.warn('[Social] invitaciones:', e.code || e.message));
  }

  let playing = false;
  /** ¿Tienes algún amigo confirmado? (si no, nadie te puede invitar) */
  const hasFriends = () => [...friends.values()].some(f => f.status === 'ok');
  // El "en línea" de los amigos se quitó el 20-10-2026: era 1/4 de todas las
  // escrituras de Firestore (unas 2 millones al día). Ya no se escribe ni se lee
  // pres/{uid}; se puede invitar a cualquier amigo (la invitación caduca sola).
  const presKey = () => 'ps.pres.' + uid;    // (sólo para borrar lo que quedó de entonces)
  function setPlaying(p) {
    playing = !!p;
    // Al acabar la partida, la sala se vuelve a comprobar (los que se fueron, fuera).
    if (!playing && room) { if (room.lost) room.tries = 0; emit('room'); }
  }

  async function stop(why) {
    if (!started) return;
    await leaveRoom().catch(() => {});
    if (unFriends) { unFriends(); unFriends = null; }
    if (unInv) { unInv(); unInv = null; }
    listening = false; friendsReady = null;
    try { localStorage.removeItem(presKey()); } catch (e) { /* nada */ }
    if (why === 'delete') {
      try { localStorage.removeItem('ps.nick.' + uid); } catch (e) { /* nada */ }
      await deleteAll().catch(e => console.warn('[Social] borrar:', e));
    }
    friends.clear(); invites.clear(); sentInv.clear();
    me = null; started = false; fb = null; uid = null; playing = false;
    emit('stop');
  }

  /** Al borrar la cuenta: amistades, marcas del ranking, perfil y apodo. */
  async function deleteAll() {
    // Cada paso por separado: si uno falla, los demás se borran igual.
    const step = async (what, fn) => { try { await fn(); } catch (e) { console.warn('[Social] no se pudo borrar ' + what + ':', e.code || e.message); } };
    const del = async q => { const s = await q.get(); await Promise.all(s.docs.map(d => d.ref.delete().catch(() => {}))); };
    await step('amistades', () => del(fb.fs.collection('friendships').where('users', 'array-contains', uid)));
    await step('filas del ranking', () => G.Ranking.removeMine());
    await step('invitaciones', () => del(fb.fs.collection('inv').where('to', '==', uid)));
    await step('marcas', () => del(fb.fs.collectionGroup('e').where('uids', 'array-contains', uid)));
    await step('partida en curso', () => fb.fs.collection('runs').doc(uid).delete());
    await step('en línea', () => fb.fs.collection('pres').doc(uid).delete());
    await step('apodo', async () => {
      const prof = await fb.fs.collection('profiles').doc(uid).get();
      const lower = prof.exists ? prof.data().lower : me && me.name.toLowerCase();
      if (lower) await fb.fs.collection('names').doc(lower).delete().catch(() => {});
      if (prof.exists) await fb.fs.collection('profiles').doc(uid).delete();
    });
  }

  // ---------------- amigos ----------------

  function listenFriends(ready) {
    unFriends = fb.fs.collection('friendships').where('users', 'array-contains', uid).onSnapshot(snap => {
      const next = new Map();
      snap.forEach(d => {
        const f = d.data();
        const other = f.users[0] === uid ? f.users[1] : f.users[0];
        next.set(other, {
          uid: other, pid: d.id, name: (f.names && f.names[other]) || '???',
          status: f.status === 'ok' ? 'ok' : f.to === uid ? 'in' : 'out',
          online: false, play: false, room: '', seen: 0
        });
      });
      friends = next;
      emit('friends');
      // Con amigos ya te pueden invitar (y este navegador lo recuerda para la próxima vez).
      try { if (hasFriends()) localStorage.setItem(hasFrKey(), '1'); else localStorage.removeItem(hasFrKey()); } catch (e) { /* nada */ }
      if (hasFriends()) listenInvites();
      if (ready) { ready(); ready = null; }
    }, e => { console.warn('[Social] amigos:', e.code || e.message); if (ready) { ready(); ready = null; } });
  }

  /** (Quitado el 20-10-2026 con el "en línea": ya no lee nada.) */

  /** Envía una solicitud de amistad (o acepta la que ya te había mandado). */
  async function request(name) {
    name = (name || '').trim();
    if (!me) return { ok: false, error: 'Primero elige tu apodo.' };
    if (!VALID.test(name)) return { ok: false, error: 'Escribe el apodo exacto de tu amigo.' };
    const n = await fb.fs.collection('names').doc(name.toLowerCase()).get().catch(() => null);
    if (!n || !n.exists) return { ok: false, error: 'No hay ningún jugador con ese apodo.' };
    const other = n.data().uid;
    if (other === uid) return { ok: false, error: 'Ese eres tú.' };
    const f = friends.get(other);
    if (f && f.status === 'ok') return { ok: false, error: 'Ya sois amigos.' };
    if (f && f.status === 'out') return { ok: false, error: 'Ya le enviaste una solicitud.' };
    if (f && f.status === 'in') return accept(other);
    const prof = await fb.fs.collection('profiles').doc(other).get().catch(() => null);
    const otherName = prof && prof.exists ? prof.data().name : name;
    const users = [uid, other].sort();
    try {
      await fb.fs.collection('friendships').doc(users[0] + '_' + users[1]).set({
        users, from: uid, to: other, status: 'pending',
        names: { [uid]: me.name, [other]: otherName },
        at: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { ok: true, msg: 'Solicitud enviada a ' + otherName };
    } catch (e) { return { ok: false, error: 'No se pudo enviar (' + (e.code || 'error') + ').' }; }
  }

  async function accept(other) {
    const f = friends.get(other);
    if (!f || f.status !== 'in') return { ok: false, error: 'No hay solicitud.' };
    try {
      await fb.fs.collection('friendships').doc(f.pid).update({
        status: 'ok', at: firebase.firestore.FieldValue.serverTimestamp(), ['names.' + uid]: me.name
      });
      return { ok: true, msg: 'Ahora eres amigo de ' + f.name };
    } catch (e) { return { ok: false, error: 'No se pudo aceptar (' + (e.code || 'error') + ').' }; }
  }

  async function remove(other) {
    const f = friends.get(other);
    if (!f) return { ok: false };
    try { await fb.fs.collection('friendships').doc(f.pid).delete(); return { ok: true }; }
    catch (e) { return { ok: false, error: 'No se pudo borrar (' + (e.code || 'error') + ').' }; }
  }

  // ---------------- salas ----------------

  function memberInfo() {
    const s = G.DB.save;
    return { name: me.name, dex: s.partner, shiny: !!s.partnerShiny && G.DB.ownsShiny(s.partner), at: ts() };
  }

  /**
   * La Realtime Database sólo se conecta mientras estás en una sala: cada
   * conexión abierta gasta descargas (se pagan a partir de 360 MB al día).
   * (El 11-10-2026 hubo un contador de gente en línea que la tenía siempre
   * conectada; se quitó por eso.)
   */
  function rtOn() { if (fb.rtdb) fb.rtdb.goOnline(); }
  function rtOff() { if (fb && fb.rtdb && !room) fb.rtdb.goOffline(); }

  /*
   * Salas con límite (25-10-2026): el 23-10 una cuenta creada fuera del juego
   * llenó la base de datos con 19.691 salas de basura (100 GB, ~17 $ al día).
   * Ahora (database.rules.json) cada cuenta tiene UNA sala, que se llama como
   * ella; el anfitrión sólo puede poner en su sala a quien haya entrado de
   * verdad (rin/{sala}/{uid}, que sólo escribe cada invitado), y los mensajes
   * son pequeños y van a huecos fijos (net.js).
   */
  const rinRef = (id, u = uid) => fb.rtdb.ref('rin/' + id + '/' + u);

  async function createRoom() {
    if (room) return room;
    rtOn();
    const id = uid;
    await fb.rtdb.ref('rooms/' + id).set({ host: uid, open: true, at: ts(), m: { [uid]: memberInfo() } });
    enterRoom(id, uid);
    return room;
  }

  async function joinRoom(id) {
    if (room && room.id === id) return { ok: true };
    if (room) await leaveRoom();
    rtOn();
    let open = null, host = null;
    try {
      open = (await fb.rtdb.ref('rooms/' + id + '/open').get()).val();
      host = (await fb.rtdb.ref('rooms/' + id + '/host').get()).val();
    } catch (e) { /* sala borrada */ }
    if (!host) { rtOff(); return { ok: false, error: 'Esa sala ya no existe.' }; }
    if (open !== true) { rtOff(); return { ok: false, error: 'La partida de esa sala ya ha empezado.' }; }
    // (Con las reglas de antes de rin no se puede escribir: se sigue igual.)
    await rinRef(id).set(true).catch(() => {});
    try { await fb.rtdb.ref('rooms/' + id + '/m/' + uid).set(memberInfo()); }
    catch (e) { rtOff(); return { ok: false, error: 'No se pudo entrar en la sala.' }; }
    const n = (await fb.rtdb.ref('rooms/' + id + '/m').get()).numChildren();
    if (n > MAX_PLAYERS) {
      await fb.rtdb.ref('rooms/' + id + '/m/' + uid).remove();
      rtOff();
      return { ok: false, error: 'La sala está llena (máximo ' + MAX_PLAYERS + ').' };
    }
    enterRoom(id, host);
    return { ok: true };
  }

  function enterRoom(id, host) {
    room = { id, host, isHost: host === uid, members: [], open: true, lost: false };
    watchRoom(id);
    emit('room');
  }

  function watchRoom(id) {
    detachRoom();
    const mref = fb.rtdb.ref('rooms/' + id + '/m');
    mref.on('value', s => {
      if (!room || room.id !== id) return;
      const m = s.val() || {};
      if (!m[uid]) { lostRoom(id); return; }          // tu plaza ya no está (corte)
      const prev = room.members;
      // El anfitrión siempre primero; el resto por orden de llegada.
      room.members = Object.keys(m).map(k => Object.assign({ uid: k }, m[k]))
        .sort((a, b) => (a.uid === room.host ? -1 : b.uid === room.host ? 1 : (a.at || 0) - (b.at || 0)));
      if (room.isHost && playing) keepMates(id, prev);
      emit('room');
    }, () => lostRoom(id));
    const href = fb.rtdb.ref('rooms/' + id + '/host');
    href.on('value', s => { if (room && room.id === id && !s.val()) lostRoom(id); }, () => lostRoom(id));
    const oref = fb.rtdb.ref('rooms/' + id + '/open');
    oref.on('value', s => { if (room && room.id === id) { room.open = s.val() === true; emit('room'); } }, () => {});
    // Tras un corte el servidor ya ha hecho el onDisconnect: hay que volver a dejarlo puesto.
    const cref = fb.rtdb.ref('.info/connected');
    cref.on('value', s => { if (s.val() === true && room && room.id === id) watchRoomDisconnect(); });
    roomRefs = [mref, href, oref, cref];
  }

  /** Si se cierra el navegador, la sala (anfitrión) o tu plaza (invitado) se borran solas. */
  function watchRoomDisconnect() {
    if (!room) return;
    const ref = room.isHost ? fb.rtdb.ref('rooms/' + room.id) : fb.rtdb.ref('rooms/' + room.id + '/m/' + uid);
    ref.onDisconnect().remove();
  }

  function detachRoom() {
    for (const r of roomRefs) r.off();
    roomRefs = [];
  }

  /*
   * Cortes de la Realtime Database (22-10-2026). Basta un corte de la conexión
   * (red del móvil, pestaña dormida, o el tope de 100 conexiones del plan
   * gratuito al reconectar) para que el servidor haga el onDisconnect: borra la
   * plaza del invitado (y al volver ya no le deja leer la sala) o la sala entera
   * si es el anfitrión. Antes eso era «La sala se ha cerrado» y fuera de la
   * partida, aunque el canal directo con los demás siguiera bien.
   * Ahora la sala no se da por cerrada a la primera: se recupera (el anfitrión
   * la vuelve a escribir con los que había; el invitado vuelve a poner su plaza)
   * y, durante una partida, nunca se cierra: la partida va por el canal directo.
   */
  const REJOIN_MS = 4000, REJOIN_TRIES = 3;

  function lostRoom(id) {
    if (!room || room.id !== id || room.lost) return;
    detachRoom();
    room.lost = true;
    room.tries = 0;
    rejoin(id);
  }

  const within = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(Error('timeout')), ms))]);

  async function rejoin(id) {
    if (!room || room.id !== id || !room.lost) return;
    const base = fb.rtdb.ref('rooms/' + id);
    try {
      const host = (await within(base.child('host').get(), 5000)).val();
      if (!room || room.id !== id) return;
      if (room.isHost) {
        // El servidor borró tu sala: se vuelve a escribir igual (misma id) con los que había.
        if (host !== uid) {
          if (host) throw Error('otra');
          const m = {};
          for (const x of room.members) m[x.uid] = { name: x.name, dex: x.dex, shiny: !!x.shiny, at: x.at || 0 };
          m[uid] = Object.assign(memberInfo(), m[uid] ? { at: m[uid].at } : {});
          await within(base.set({ host: uid, open: playing ? false : room.open, at: ts(), m }), 5000);
        }
      } else {
        if (!host) throw Error('sin anfitrión');
        const mine = room.members.find(x => x.uid === uid);
        await within(rinRef(id).set(true), 5000).catch(() => {});
        // Si no deja, los demás siguen jugando (la sala no admite a nadie hasta que acaben): a esperar.
        await within(base.child('m/' + uid).set(Object.assign(memberInfo(), mine && mine.at ? { at: mine.at } : {})), 5000)
          .catch(e => { throw Object.assign(e, { wait: e.message !== 'timeout' }); });
      }
    } catch (e) {
      if (!room || room.id !== id) return;
      // En partida se sigue intentando sin prisa; fuera, tras unos intentos, la sala se da
      // por cerrada (pero no mientras el anfitrión siga en ella con la partida en marcha).
      if (!playing && !e.wait && ++room.tries >= REJOIN_TRIES) { closedRoom(); return; }
      setTimeout(() => rejoin(id), playing || e.wait ? 2 * REJOIN_MS : REJOIN_MS);
      return;
    }
    if (!room || room.id !== id) return;
    room.lost = false;
    watchRoom(id);
    watchRoomDisconnect();
  }

  /**
   * Anfitrión en partida: si la plaza de un invitado desaparece pero sigue en
   * la partida (aunque se esté reconectando, ver coop.js), ha sido un corte suyo
   * con la base de datos: se le vuelve a poner. Sin plaza no podría ni leer la
   * sala ni contestar al anfitrión para volver a conectar.
   */
  function keepMates(id, prev) {
    for (const x of prev) {
      if (x.uid === uid || room.members.some(m => m.uid === x.uid)) continue;
      setTimeout(() => {
        if (!room || room.id !== id || !playing || room.members.some(m => m.uid === x.uid)) return;
        if (!G.Coop.keeps(x.uid)) return;
        fb.rtdb.ref('rooms/' + id + '/m/' + x.uid).set({ name: x.name, dex: x.dex, shiny: !!x.shiny, at: x.at || 0 }).catch(() => {});
      }, 3000);
    }
  }

  /** Anfitrión: quita a alguien de la sala (se cortó en partida y no volvió). */
  function dropMember(u) {
    if (room && room.isHost && u !== uid) fb.rtdb.ref('rooms/' + room.id + '/m/' + u).remove().catch(() => {});
  }

  function closedRoom() {
    if (!room) return;
    detachRoom();
    room = null;
    retractInvites();
    rtOff();
    emit('room-closed');
  }

  async function leaveRoom() {
    if (!room) return;
    const r = room;
    detachRoom();
    room = null;
    const ref = r.isHost ? fb.rtdb.ref('rooms/' + r.id) : fb.rtdb.ref('rooms/' + r.id + '/m/' + uid);
    ref.onDisconnect().cancel().catch(() => {});
    await ref.remove().catch(() => {});
    if (!r.isHost) rinRef(r.id).remove().catch(() => {});
    retractInvites();
    rtOff();
    emit('room');
  }

  /** El anfitrión cierra la sala a nuevos jugadores al empezar la partida. */
  function setOpen(open) {
    if (room && room.isHost) fb.rtdb.ref('rooms/' + room.id + '/open').set(!!open).catch(() => {});
  }

  /** Actualiza tu Pokémon en la sala (si cambias de compañero). */
  function refreshMember() {
    if (room && me) fb.rtdb.ref('rooms/' + room.id + '/m/' + uid).update(
      { dex: G.DB.save.partner, shiny: !!G.DB.save.partnerShiny && G.DB.ownsShiny(G.DB.save.partner) }).catch(() => {});
  }

  // ---------------- invitaciones ----------------

  async function invite(other) {
    const f = friends.get(other);
    if (!f || f.status !== 'ok') return { ok: false, error: 'Sólo puedes invitar a tus amigos.' };
    if (room && room.members.length >= MAX_PLAYERS) return { ok: false, error: 'La sala está llena.' };
    if (room && !room.isHost) return { ok: false, error: 'Sólo el anfitrión de la sala puede invitar.' };
    if (!room) await createRoom();
    // Acabas de invitarle a esta sala: ya la tiene (pulsar otra vez no escribe nada; 25-10-2026).
    const s = sentInv.get(other);
    if (s && s.room === room.id && now() - s.at < REINVITE_MS) return { ok: true, msg: 'Invitación enviada a ' + f.name };
    try {
      await fb.fs.collection('inv').doc(other + '_' + uid).set({ to: other, from: uid, room: room.id, name: me.name, at: fts() });
    } catch (e) { return { ok: false, error: 'No se pudo invitar (' + (e.code || 'error') + ').' }; }
    sentInv.set(other, { room: room.id, at: now() });
    return { ok: true, msg: 'Invitación enviada a ' + f.name };
  }

  /** Retira las invitaciones que mandaste (al salir de la sala). */
  function retractInvites() {
    if (!fb) return;
    // Sólo las que pueden seguir ahí: las caducadas ya no cuentan, y borrar las que
    // ya no están (aceptadas o rechazadas) lo rechazaban las reglas (~200 por hora).
    for (const [o, s] of sentInv) if (now() - s.at < INVITE_TTL) fb.fs.collection('inv').doc(o + '_' + uid).delete().catch(() => {});
    sentInv.clear();
  }

  function onInvite(ref, v) {
    // Las caducadas se borran; sólo se aceptan de amigos confirmados.
    if (!v || (v.at && now() - msOf(v.at) > INVITE_TTL)) { ref.delete().catch(() => {}); return; }
    const f = friends.get(v.from);
    if (f && f.status !== 'ok') return;
    invites.set(v.from, { from: v.from, name: v.name, room: v.room, at: msOf(v.at) || now() });
    emit('invites');
  }

  const invDoc = from => fb.fs.collection('inv').doc(uid + '_' + from);

  async function acceptInvite(from) {
    const inv = invites.get(from);
    if (!inv || now() - inv.at > INVITE_TTL) { invites.delete(from); emit('invites'); return { ok: false, error: 'La invitación ha caducado.' }; }
    invites.delete(from);
    invDoc(from).delete().catch(() => {});
    emit('invites');
    return joinRoom(inv.room);
  }

  function declineInvite(from) {
    invites.delete(from);
    invDoc(from).delete().catch(() => {});
    emit('invites');
  }

  // ---------------- perfil público ----------------

  /** Lo que se enseña de ti (también para tu vista previa, sin subirlo). */
  function profileData() {
    const s = G.DB.save, st = s.stats, prof = s.profile || {};
    const unlocked = G.AchDefs.LIST.filter(a => s.ach && s.ach[a.id]);
    const medals = unlocked.slice().sort((a, b) => (b.tier - a.tier) || (s.ach[b.id] - s.ach[a.id])).slice(0, 8).map(a => a.id);
    return {
      name: me ? me.name : G.DB.user,
      favs: (prof.favs || []).slice(0, 3).map(f => ({ dex: f.dex | 0, shiny: !!f.shiny })),
      title: prof.title || '',
      best: { solo: st.bestTime | 0, group: st.bestGroupTime | 0, level: st.bestLevel | 0, bosses: st.bossesTotal | 0,
              legends: Object.keys(s.legends || {}).length, kills: st.totalKills | 0, medals: unlocked.length },
      medals
    };
  }

  let pubT = 0, pubAt = 0, pubLast = '';
  /**
   * Sube tu perfil (con un poco de espera, por si cambias varias cosas
   * seguidas), pero SÓLO si ha cambiado algo de lo que se ve a primera vista:
   * récords de tiempo y nivel, legendarios, medallas, título o favoritos.
   * Los jefes y derrotados (que cambian en cada partida) se suben con lo demás
   * cuando toca, no por sí solos: el perfil se escribía 200.000 veces al día
   * (13-10-2026). Si cambias favoritos o título (force), al momento.
   */
  function publishProfile(force = false) {
    if (!me || !fb) return;
    if (!force && Date.now() - pubAt < 6 * 3600 * 1000) return;    // como mucho cada 6 h (2 h hasta el 25-10-2026; antes 30 min)
    clearTimeout(pubT);
    pubT = setTimeout(() => {
      if (!me || !fb) return;
      const d = profileData();
      // Para decidir si se sube (se recuerda entre sesiones): sin jefes ni derrotados.
      const key = JSON.stringify(Object.assign({}, d, { best: Object.assign({}, d.best, { kills: 0, bosses: 0 }) }));
      const lsKey = 'ps.pub.' + uid;
      if (!pubLast) { try { pubLast = localStorage.getItem(lsKey) || ''; } catch (e) { /* nada */ } }
      if (key === pubLast) return;
      pubLast = key; pubAt = Date.now();
      try { localStorage.setItem(lsKey, key); } catch (e) { /* nada */ }
      fb.fs.collection('profiles').doc(uid).set(Object.assign(d, {
        name: me.name, lower: me.name.toLowerCase(), at: firebase.firestore.FieldValue.serverTimestamp()
      })).catch(e => { pubLast = ''; console.warn('[Social] perfil:', e.code || e.message); });
    }, 800);
  }

  /** El perfil de otro jugador, limpio (ver G.U.int / str): sólo lo que el juego sabe pintar. */
  function cleanProfile(d) {
    const U = G.U, b = d.best || {};
    return {
      name: U.str(d.name, 24), title: U.str(d.title, 40),
      favs: U.list(d.favs, 3).filter(f => f && G.DEX_BY[U.int(f.dex)]).map(f => ({ dex: U.int(f.dex), shiny: f.shiny === true })),
      best: { solo: U.int(b.solo, 86400), group: U.int(b.group, 86400), level: U.int(b.level, 999), bosses: U.int(b.bosses, 1e9),
              legends: U.int(b.legends, 999), kills: U.int(b.kills, 1e12), medals: U.int(b.medals, 999) },
      medals: U.list(d.medals, 8).map(x => U.str(x, 40))
    };
  }

  /** El perfil público de otro jugador. */
  const profCache = new Map();
  async function getProfile(other) {
    if (!fb) return null;
    // El tuyo sale de tu partida (sin leer nada y siempre al día).
    if (other === uid && me) return Object.assign(profileData(), { name: me.name });
    const c = profCache.get(other);
    if (c && Date.now() - c.at < 10 * 60 * 1000) return c.v;     // lo leído vale 10 min
    const d = await fb.fs.collection('profiles').doc(other).get().catch(() => null);
    const v = d && d.exists ? cleanProfile(d.data()) : null;
    profCache.set(other, { at: Date.now(), v });
    return v;
  }

  // Al cerrar sesión o borrar la cuenta.
  G.DB.onLeave(why => stop(why));

  return {
    start, stop, claimNick, request, accept, remove, publishProfile, getProfile, profileData,
    createRoom, joinRoom, leaveRoom, setOpen, refreshMember, dropMember, setPlaying, ensureFriends,
    invite, acceptInvite, declineInvite,
    on(fn) { listeners.add(fn); }, off(fn) { listeners.delete(fn); },
    get me() { return me; },
    get started() { return started; },
    get friends() { return [...friends.values()]; },
    get invites() { return [...invites.values()]; },
    get room() { return room; },
    get uid() { return uid; },
    /** La hora real (corrige el reloj del aparato si va desfasado). */
    now,
    VALID, MAX_PLAYERS
  };
})();
