/* ============ social.js — apodo, amigos, en línea, invitaciones y salas ============
 * Sólo funciona con cuenta en la nube (G.DB.online). Usa:
 *
 *   Firestore
 *     names/{apodo en minúsculas}  { uid }               apodos únicos
 *     profiles/{uid}               { name, lower, at }   apodo público
 *     friendships/{uidA_uidB}      { users, from, to, status: 'pending'|'ok', names, at }
 *
 *   Realtime Database (cambia al instante y sabe cuándo alguien se desconecta)
 *     status/{uid}        { on, at, name, room, play }   quién está en línea
 *     inv/{para}/{de}     { room, name, at }             invitaciones a una sala
 *     rooms/{id}          { host, open, at, m: { uid: { name, dex, shiny } }, q: ... }
 *                         la sala; q/ son los mensajes de net.js
 *
 * El resto del juego escucha los cambios con G.Social.on(fn).
 */
G.Social = (() => {
  const VALID = /^[A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]{3,16}$/;
  const MAX_PLAYERS = 4;
  const INVITE_TTL = 3 * 60 * 1000;

  let fb = null, uid = null;
  let me = null;                    // { uid, name }
  let friends = new Map();          // otherUid -> { uid, name, pid, status: 'ok'|'in'|'out', online, play }
  let unFriends = null;
  const presence = new Map();       // otherUid -> ref escuchada
  let statusRef = null, connRef = null, invRef = null;
  let serverOffset = 0;
  let room = null;                  // { id, host, isHost, members: [{ uid, name, dex, shiny }] }
  let roomRefs = [];
  const invites = new Map();        // fromUid -> { from, name, room, at }
  const listeners = new Set();
  let started = false;

  function emit(what) { listeners.forEach(fn => { try { fn(what); } catch (e) { console.warn(e); } }); }
  const ts = () => firebase.database.ServerValue.TIMESTAMP;
  const now = () => Date.now() + serverOffset;
  const pidOf = (a, b) => (a < b ? a + '_' + b : b + '_' + a);

  // ---------------- arranque ----------------

  /** Tras iniciar sesión. → 'ok' | 'need-nick' | 'off' (sin nube) */
  async function start() {
    if (!G.DB.online) return 'off';
    if (started) return me ? 'ok' : 'need-nick';
    fb = G.DB.fb; uid = fb.uid;
    started = true;
    const prof = await fb.fs.collection('profiles').doc(uid).get().then(s => s.exists ? s.data() : null).catch(() => null);
    if (prof) { me = { uid, name: prof.name }; if (G.DB.user !== prof.name) G.DB.setName(prof.name); }
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
    G.DB.setName(name);
    if (started && !statusRef) online();
    publishProfile();
    return { ok: true };
  }

  /** Conecta la presencia, los amigos y las invitaciones. */
  function online() {
    if (!fb.rtdb) return;
    fb.rtdb.ref('.info/serverTimeOffset').on('value', s => { serverOffset = s.val() || 0; });
    statusRef = fb.rtdb.ref('status/' + uid);
    connRef = fb.rtdb.ref('.info/connected');
    connRef.on('value', s => {
      if (!s.val()) return;
      statusRef.onDisconnect().remove().then(writeStatus);
      if (room) watchRoomDisconnect();
    });
    listenFriends();
    invRef = fb.rtdb.ref('inv/' + uid);
    invRef.on('child_added', onInvite);
    invRef.on('child_changed', onInvite);
    invRef.on('child_removed', s => { invites.delete(s.key); emit('invites'); });
  }

  let playing = false;
  function writeStatus() {
    if (!statusRef || !me) return;
    statusRef.set({ on: true, at: ts(), name: me.name, room: room ? room.id : '', play: playing }).catch(() => {});
  }
  function setPlaying(p) { playing = !!p; writeStatus(); }

  async function stop(why) {
    if (!started) return;
    await leaveRoom().catch(() => {});
    if (unFriends) { unFriends(); unFriends = null; }
    for (const ref of presence.values()) ref.off();
    presence.clear();
    if (invRef) { invRef.off(); invRef = null; }
    if (connRef) { connRef.off(); connRef = null; }
    if (fb && fb.rtdb) fb.rtdb.ref('.info/serverTimeOffset').off();
    if (statusRef) { await statusRef.remove().catch(() => {}); statusRef = null; }
    if (why === 'delete') await deleteAll().catch(e => console.warn('[Social] borrar:', e));
    friends.clear(); invites.clear();
    me = null; started = false; fb = null; uid = null; playing = false;
    emit('stop');
  }

  /** Al borrar la cuenta: amistades, marcas del ranking, perfil y apodo. */
  async function deleteAll() {
    // Cada paso por separado: si uno falla, los demás se borran igual.
    const step = async (what, fn) => { try { await fn(); } catch (e) { console.warn('[Social] no se pudo borrar ' + what + ':', e.code || e.message); } };
    const del = async q => { const s = await q.get(); await Promise.all(s.docs.map(d => d.ref.delete().catch(() => {}))); };
    await step('amistades', () => del(fb.fs.collection('friendships').where('users', 'array-contains', uid)));
    await step('marcas', () => del(fb.fs.collectionGroup('e').where('uids', 'array-contains', uid)));
    await step('partida en curso', () => fb.fs.collection('runs').doc(uid).delete());
    await step('apodo', async () => {
      const prof = await fb.fs.collection('profiles').doc(uid).get();
      const lower = prof.exists ? prof.data().lower : me && me.name.toLowerCase();
      if (lower) await fb.fs.collection('names').doc(lower).delete().catch(() => {});
      if (prof.exists) await fb.fs.collection('profiles').doc(uid).delete();
    });
  }

  // ---------------- amigos ----------------

  function listenFriends() {
    unFriends = fb.fs.collection('friendships').where('users', 'array-contains', uid).onSnapshot(snap => {
      const next = new Map();
      snap.forEach(d => {
        const f = d.data();
        const other = f.users[0] === uid ? f.users[1] : f.users[0];
        const prev = friends.get(other);
        next.set(other, {
          uid: other, pid: d.id, name: (f.names && f.names[other]) || '???',
          status: f.status === 'ok' ? 'ok' : f.to === uid ? 'in' : 'out',
          online: prev ? prev.online : false, play: prev ? prev.play : false
        });
      });
      friends = next;
      // Presencia sólo de los amigos confirmados.
      for (const [o, ref] of presence) if (!friends.has(o) || friends.get(o).status !== 'ok') { ref.off(); presence.delete(o); }
      for (const f of friends.values()) if (f.status === 'ok' && !presence.has(f.uid) && fb.rtdb) watchPresence(f.uid);
      emit('friends');
    }, e => console.warn('[Social] amigos:', e.code || e.message));
  }

  function watchPresence(o) {
    const ref = fb.rtdb.ref('status/' + o);
    presence.set(o, ref);
    ref.on('value', s => {
      const f = friends.get(o);
      if (!f) return;
      const v = s.val();
      f.online = !!(v && v.on);
      f.play = !!(v && v.play);
      f.room = v ? v.room : '';
      emit('presence');
    }, () => {});
  }

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

  async function createRoom() {
    if (room) return room;
    const id = fb.rtdb.ref('rooms').push().key;
    await fb.rtdb.ref('rooms/' + id).set({ host: uid, open: true, at: ts(), m: { [uid]: memberInfo() } });
    enterRoom(id, uid);
    return room;
  }

  async function joinRoom(id) {
    if (room && room.id === id) return { ok: true };
    if (room) await leaveRoom();
    let open = null, host = null;
    try {
      open = (await fb.rtdb.ref('rooms/' + id + '/open').get()).val();
      host = (await fb.rtdb.ref('rooms/' + id + '/host').get()).val();
    } catch (e) { /* sala borrada */ }
    if (!host) return { ok: false, error: 'Esa sala ya no existe.' };
    if (open !== true) return { ok: false, error: 'La partida de esa sala ya ha empezado.' };
    try { await fb.rtdb.ref('rooms/' + id + '/m/' + uid).set(memberInfo()); }
    catch (e) { return { ok: false, error: 'No se pudo entrar en la sala.' }; }
    const n = (await fb.rtdb.ref('rooms/' + id + '/m').get()).numChildren();
    if (n > MAX_PLAYERS) {
      await fb.rtdb.ref('rooms/' + id + '/m/' + uid).remove();
      return { ok: false, error: 'La sala está llena (máximo ' + MAX_PLAYERS + ').' };
    }
    enterRoom(id, host);
    return { ok: true };
  }

  function enterRoom(id, host) {
    room = { id, host, isHost: host === uid, members: [], open: true };
    watchRoomDisconnect();
    const mref = fb.rtdb.ref('rooms/' + id + '/m');
    mref.on('value', s => {
      if (!room || room.id !== id) return;
      const m = s.val() || {};
      // El anfitrión siempre primero; el resto por orden de llegada.
      room.members = Object.keys(m).map(k => Object.assign({ uid: k }, m[k]))
        .sort((a, b) => (a.uid === room.host ? -1 : b.uid === room.host ? 1 : (a.at || 0) - (b.at || 0)));
      emit('room');
    }, () => closedRoom());
    const href = fb.rtdb.ref('rooms/' + id + '/host');
    href.on('value', s => { if (room && room.id === id && !s.val()) closedRoom(); }, () => closedRoom());
    const oref = fb.rtdb.ref('rooms/' + id + '/open');
    oref.on('value', s => { if (room && room.id === id) { room.open = s.val() === true; emit('room'); } }, () => {});
    roomRefs = [mref, href, oref];
    writeStatus();
    emit('room');
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

  function closedRoom() {
    if (!room) return;
    detachRoom();
    room = null;
    writeStatus();
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
    // Retira las invitaciones que mandaste a esa sala.
    for (const f of friends.values()) fb.rtdb.ref('inv/' + f.uid + '/' + uid).remove().catch(() => {});
    writeStatus();
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
    await fb.rtdb.ref('inv/' + other + '/' + uid).set({ room: room.id, name: me.name, at: ts() });
    return { ok: true, msg: 'Invitación enviada a ' + f.name };
  }

  function onInvite(s) {
    const v = s.val();
    if (!v || now() - (v.at || 0) > INVITE_TTL) { s.ref.remove().catch(() => {}); return; }
    // Sólo se aceptan invitaciones de amigos confirmados.
    const f = friends.get(s.key);
    if (f && f.status !== 'ok') return;
    invites.set(s.key, { from: s.key, name: v.name, room: v.room, at: v.at });
    emit('invites');
  }

  async function acceptInvite(from) {
    const inv = invites.get(from);
    if (!inv) return { ok: false, error: 'La invitación ha caducado.' };
    invites.delete(from);
    fb.rtdb.ref('inv/' + uid + '/' + from).remove().catch(() => {});
    emit('invites');
    return joinRoom(inv.room);
  }

  function declineInvite(from) {
    invites.delete(from);
    fb.rtdb.ref('inv/' + uid + '/' + from).remove().catch(() => {});
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

  let pubT = 0;
  /** Sube tu perfil (con un poco de espera, por si cambias varias cosas seguidas). */
  function publishProfile() {
    if (!me || !fb) return;
    clearTimeout(pubT);
    pubT = setTimeout(() => {
      if (!me || !fb) return;
      const d = profileData();
      fb.fs.collection('profiles').doc(uid).set(Object.assign(d, {
        name: me.name, lower: me.name.toLowerCase(), at: firebase.firestore.FieldValue.serverTimestamp()
      })).catch(e => console.warn('[Social] perfil:', e.code || e.message));
    }, 800);
  }

  /** El perfil público de otro jugador. */
  async function getProfile(other) {
    if (!fb) return null;
    const d = await fb.fs.collection('profiles').doc(other).get().catch(() => null);
    return d && d.exists ? d.data() : null;
  }

  // Al cerrar sesión o borrar la cuenta.
  G.DB.onLeave(why => stop(why));

  return {
    start, stop, claimNick, request, accept, remove, publishProfile, getProfile, profileData,
    createRoom, joinRoom, leaveRoom, setOpen, refreshMember, setPlaying,
    invite, acceptInvite, declineInvite,
    on(fn) { listeners.add(fn); }, off(fn) { listeners.delete(fn); },
    get me() { return me; },
    get started() { return started; },
    get friends() { return [...friends.values()]; },
    get invites() { return [...invites.values()]; },
    get room() { return room; },
    get uid() { return uid; },
    VALID, MAX_PLAYERS
  };
})();
