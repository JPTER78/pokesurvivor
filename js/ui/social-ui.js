/* ============ social-ui.js — apodo, amigos, sala e invitaciones ============ */
(() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** ¿Se puede usar lo online? Si no, explica por qué. */
  function needOnline() {
    if (G.DB.online) return true;
    G.UI.toast(G.DB.guest ? 'Crea una cuenta para jugar con amigos y salir en el ranking.'
      : 'Esto necesita la versión online del juego (con la nube).', 3200);
    return false;
  }

  // ======================= APODO =======================

  G.NickUI = (() => {
    let then = null, skipped = false;

    function init() {
      $('nick-form').onsubmit = async e => {
        e.preventDefault();
        $('nick-err').textContent = '';
        $('nick-ok').disabled = true;
        const r = await G.Social.claimNick($('nick-in').value);
        $('nick-ok').disabled = false;
        if (!r.ok) { $('nick-err').textContent = r.error; G.Audio.sfx('error'); return; }
        G.Audio.sfx('confirm');
        G.UI.toast('Tu apodo es ' + G.Social.me.name);
        const cb = then; then = null;
        if (cb) cb(); else G.MenuUI.open();
      };
      $('nick-later').onclick = () => { skipped = true; then = null; G.MenuUI.open(); };
    }

    /** @param next  qué abrir después de elegirlo */
    function open(next) {
      then = next || null;
      G.UI.show('scr-nick');
      $('nick-err').textContent = '';
      $('nick-in').value = '';
      setTimeout(() => $('nick-in').focus(), 50);
    }

    return { init, open, get skipped() { return skipped; } };
  })();

  /** Abre `fn` si tienes apodo; si no, pide el apodo primero. */
  function withNick(fn) {
    if (!needOnline()) return;
    if (G.Social.me) { fn(); return; }
    G.Social.start().then(r => { if (r === 'ok') fn(); else G.NickUI.open(fn); });
  }

  // ======================= AMIGOS =======================

  G.FriendsUI = (() => {
    function init() {
      $('fr-add').onsubmit = async e => {
        e.preventDefault();
        const name = $('fr-name').value;
        msg('');
        const r = await G.Social.request(name);
        msg(r.ok ? r.msg : r.error, !r.ok);
        if (r.ok) $('fr-name').value = '';
      };
      $('fr-room').onclick = () => G.LobbyUI.open();
      G.Social.on(() => { if (G.UI.isOpen('scr-friends')) render(); });
    }

    function msg(t, bad) {
      $('fr-msg').textContent = t || '';
      $('fr-msg').style.color = bad ? '#ffb0b8' : '';
      if (t) G.Audio.sfx(bad ? 'error' : 'confirm');
    }

    function open() { withNick(() => { G.UI.show('scr-friends', true); msg(''); render(); }); }

    function stateText(f) {
      if (f.status === 'in') return 'Quiere ser tu amigo';
      if (f.status === 'out') return 'Solicitud enviada';
      if (!f.online) return 'Desconectado';
      return f.play ? 'Jugando' : 'En línea';
    }

    function render() {
      const room = G.Social.room;
      $('fr-me').innerHTML = 'Tu apodo: <b class="gold">' + esc(G.Social.me ? G.Social.me.name : '') + '</b> · dáselo a tus amigos para que te añadan.';
      $('fr-room').classList.toggle('hidden', !room);
      const list = G.Social.friends.sort((a, b) => {
        const rank = f => f.status === 'in' ? 0 : f.status === 'ok' ? (f.online ? (f.play ? 2 : 1) : 3) : 4;
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });
      const box = $('fr-list');
      box.innerHTML = '';
      if (!list.length) {
        box.innerHTML = '<p class="sub">Aún no tienes amigos añadidos. Escribe arriba el apodo de un amigo.</p>';
        return;
      }
      for (const f of list) {
        const el = document.createElement('div');
        el.className = 'fr-row';
        const dot = f.status !== 'ok' ? 'pend' : !f.online ? 'off' : f.play ? 'play' : 'on';
        const inRoom = room && room.members.some(m => m.uid === f.uid);
        el.innerHTML = `<i class="dot ${dot}"></i><b>${esc(f.name)}</b><span class="st">${inRoom ? 'En tu sala' : stateText(f)}</span><span class="grow"></span>`;
        const btn = (txt, cls, fn) => {
          const b = document.createElement('button');
          b.className = 'btn small ' + cls; b.textContent = txt; b.onclick = fn; el.appendChild(b); return b;
        };
        if (f.status === 'in') {
          btn('Aceptar', 'gold', async () => { const r = await G.Social.accept(f.uid); msg(r.ok ? r.msg : r.error, !r.ok); });
          btn('Rechazar', 'ghost', () => G.Social.remove(f.uid));
        } else if (f.status === 'out') {
          btn('Cancelar', 'ghost', () => G.Social.remove(f.uid));
        } else {
          if (f.online && !f.play && !inRoom && (!room || room.isHost)) {
            btn('Invitar', 'gold', async () => {
              const r = await G.Social.invite(f.uid);
              msg(r.ok ? r.msg : r.error, !r.ok);
              if (r.ok) G.LobbyUI.open();
            });
          }
          btn('Quitar', 'ghost', () => { if (confirm('¿Quitar a ' + f.name + ' de tus amigos?')) G.Social.remove(f.uid); });
        }
        box.appendChild(el);
      }
    }

    return { init, open, render };
  })();

  // ======================= SALA =======================

  G.LobbyUI = (() => {
    let membersKey = '';

    function init() {
      $('lobby-leave').onclick = async () => {
        await G.Social.leaveRoom();
        G.Net.close();
        G.MenuUI.open();
      };
      $('lobby-menu').onclick = () => G.MenuUI.open();
      $('lobby-start').onclick = start;
      $('lobby-start').dataset.sfx = 'confirm';
      // Conecta / desconecta la red al entrar o salir de una sala.
      G.Social.on(what => {
        const room = G.Social.room;
        if (room) {
          G.Net.open(room.id, room.isHost, room.host);
          G.Net.syncMembers(room.members.map(m => m.uid));
        } else if (G.Net.open_) G.Net.close();
        if (what === 'room-closed') {
          G.UI.toast('La sala se ha cerrado', 2600);
          if (G.UI.isOpen('scr-lobby')) G.MenuUI.open();
        }
        if (G.UI.isOpen('scr-lobby')) render();
      });
      G.Net.onPeer(() => { if (G.UI.isOpen('scr-lobby')) render(); });
    }

    function open() {
      if (!G.Social.room) { G.MenuUI.open(); return; }
      G.Social.refreshMember();
      G.UI.show('scr-lobby', true);
      membersKey = '';
      render();
    }

    function close() { G.UI.hide('scr-lobby'); }

    function connText(m, room) {
      if (m.uid === room.host) return 'Anfitrión';
      if (!room.isHost) return m.uid === G.Social.uid ? 'Tú' : 'En la sala';
      const mode = G.Net.mode(m.uid);
      return mode === 'direct' ? 'Conectado' : mode === 'relay' ? 'Conectado (por servidor)' : 'Conectando…';
    }

    function render() {
      const room = G.Social.room;
      if (!room) return;
      const ms = room.members;
      $('lobby-sub').textContent = room.isHost
        ? 'Eres el anfitrión. Invita a tus amigos (hasta ' + G.Social.MAX_PLAYERS + ') y empezad cuando estéis.'
        : 'Estás en la sala de ' + ((ms.find(m => m.uid === room.host) || {}).name || '…') + '. El anfitrión empezará la partida.';

      // Las tarjetas sólo se rehacen si cambian los miembros (los sprites no parpadean).
      const key = ms.map(m => m.uid + ':' + m.dex + ':' + (m.shiny ? 1 : 0)).join('|');
      const box = $('lobby-members');
      if (key !== membersKey) {
        membersKey = key;
        box.innerHTML = '';
        for (let i = 0; i < G.Social.MAX_PLAYERS; i++) {
          const m = ms[i];
          const c = document.createElement('div');
          c.className = 'lob-card' + (m ? '' : ' empty');
          if (m) {
            c.style.setProperty('--pc', G.Coop.COLORS[i]);
            c.appendChild(G.UI.spriteCanvas(m.dex, 120, 96, { scale: 2, lively: true, shiny: !!m.shiny }));
            c.insertAdjacentHTML('beforeend', `<b>${esc(m.name)}</b><small>${esc((G.DEX_BY[m.dex] || {}).name || '')}</small><span class="conn" data-u="${m.uid}"></span>`);
          } else c.innerHTML = '<span>Libre</span>';
          box.appendChild(c);
        }
      }
      box.querySelectorAll('.conn').forEach(el => {
        const m = ms.find(x => x.uid === el.dataset.u);
        if (!m) return;
        const t = connText(m, room);
        el.textContent = t;
        el.className = 'conn' + (t === 'Conectando…' ? ' wait' : '');
      });

      // Invitar (sólo el anfitrión y si queda sitio).
      const canInvite = room.isHost && ms.length < G.Social.MAX_PLAYERS;
      $('lobby-inv-title').classList.toggle('hidden', !canInvite);
      const inv = $('lobby-invite');
      inv.classList.toggle('hidden', !canInvite);
      if (canInvite) {
        inv.innerHTML = '';
        const free = G.Social.friends.filter(f => f.status === 'ok' && f.online && !ms.some(m => m.uid === f.uid));
        if (!free.length) inv.innerHTML = '<p class="sub" style="margin:0">Ningún amigo en línea ahora mismo.</p>';
        for (const f of free) {
          const el = document.createElement('div');
          el.className = 'fr-row';
          el.innerHTML = `<i class="dot ${f.play ? 'play' : 'on'}"></i><b>${esc(f.name)}</b><span class="st">${f.play ? 'Jugando' : 'En línea'}</span><span class="grow"></span>`;
          const b = document.createElement('button');
          b.className = 'btn small gold'; b.textContent = 'Invitar';
          b.onclick = async () => { const r = await G.Social.invite(f.uid); G.UI.toast(r.ok ? r.msg : r.error); };
          el.appendChild(b);
          inv.appendChild(el);
        }
      }

      const btn = $('lobby-start');
      btn.classList.toggle('hidden', !room.isHost);
      const connecting = ms.some(m => m.uid !== room.host && G.Net.mode(m.uid) === 'connecting');
      btn.disabled = !room.isHost || ms.length < 2 || connecting;
      btn.textContent = 'Empezar partida (' + ms.length + '/' + G.Social.MAX_PLAYERS + ')';
      $('lobby-note').textContent = !room.isHost ? 'Cuando el anfitrión empiece, entraréis todos a la vez.'
        : ms.length < 2 ? 'Necesitas al menos un amigo en la sala.'
        : connecting ? 'Conectando con tus amigos…' : 'La partida empieza para todos a la vez.';
    }

    function start() {
      const room = G.Social.room;
      if (!room || !room.isHost || room.members.length < 2) return;
      const cfg = {
        k: 'start', seed: Math.floor(Math.random() * 1e6), host: room.host,
        members: room.members.map(m => ({ uid: m.uid, name: m.name, dex: m.dex, shiny: !!m.shiny }))
      };
      G.Social.setOpen(false);
      G.Net.broadcast(cfg);
      G.Flow.startCoop(cfg);
    }

    return { init, open, close, render };
  })();

  // ======================= INVITACIONES =======================

  G.InvitePop = (() => {
    let cur = null;

    function init() {
      $('inv-yes').onclick = async () => {
        if (!cur) return;
        const from = cur.from;
        hide();
        const r = await G.Social.acceptInvite(from);
        if (!r.ok) { G.UI.toast(r.error, 3000); return; }
        G.LobbyUI.open();
      };
      $('inv-no').onclick = () => { if (cur) G.Social.declineInvite(cur.from); hide(); };
      G.Social.on(what => { if (what === 'invites' || what === 'room') refresh(); });
    }

    function hide() { cur = null; $('invite-pop').classList.add('hidden'); }

    /** Enseña la invitación más antigua si estás en los menús (no en plena partida). */
    function refresh() {
      const room = G.Social.room;
      const list = G.Social.invites.filter(i => !room || i.room !== room.id).sort((a, b) => a.at - b.at);
      if (!list.length || G.Game.state !== 'ui' || !G.DB.loggedIn) { hide(); return; }
      if (cur && cur.from === list[0].from) return;
      cur = list[0];
      $('inv-text').innerHTML = `${G.Icons.html('friends', 22)} <b class="gold">${esc(cur.name)}</b> te invita a jugar en su sala`;
      $('invite-pop').classList.remove('hidden');
      G.Audio.sfx('shiny');
    }

    return { init, refresh };
  })();

  G.SocialUI = {
    init() { G.NickUI.init(); G.FriendsUI.init(); G.LobbyUI.init(); G.InvitePop.init(); },
    withNick, needOnline
  };
})();
