/* Pantalla de código de regalo: reutilizable entre cuentas, una vez por cuenta. */
G.GiftsUI = (() => {
  'use strict';
  const $ = G.UI.$;
  let busy = false;

  function init() {
    $('gift-close').onclick = () => G.MenuUI.open();
    $('gift-code').addEventListener('input', () => {
      $('gift-code').value = G.GiftCodes.normalize($('gift-code').value).replace(/[^A-Z0-9]/g, '').slice(0, 5);
      $('gift-status').textContent = '';
    });
    $('gift-form').onsubmit = async e => {
      e.preventDefault();
      if (busy) return;
      const status = $('gift-status');
      const code = G.GiftCodes.normalize($('gift-code').value);
      if (!G.GiftCodes.validFormat(code)) { status.textContent = 'El código debe tener 5 letras o números.'; return; }
      busy = true; $('gift-redeem').disabled = true; status.textContent = 'Verificando el regalo…';
      try {
        const result = await G.DB.redeemGift(code);
        if (result.already) {
          status.textContent = '¡Ya tienes a Mao Mao en tu colección!';
        } else {
          status.textContent = '¡Mao Mao se ha unido a tu colección! Puedes elegirla como compañera en Pokémon.';
          G.Audio.sfx('shinyGet');
          G.UI.toast('¡Recibiste a Mao Mao ★5!', 4500);
        }
        $('gift-code').value = '';
        showReward();
      } catch (err) {
        status.textContent = (err && err.code === 'permission-denied')
          ? 'Firebase rechazó el canje. Las reglas del regalo aún no están activas en este proyecto.'
          : 'No se pudo canjear: ' + (err && err.message || 'Error desconocido');
      } finally {
        busy = false;
        $('gift-redeem').disabled = false;
      }
    };
  }

  function showReward() {
    const owned = !!(G.DB.save && G.DB.save.owned[G.GiftCodes.MAOMAO_DEX]);
    $('gift-owned').classList.toggle('hidden', !owned);
    $('gift-redeem').textContent = owned ? 'Ya conseguido' : 'Canjear regalo';
    $('gift-redeem').disabled = owned;
    $('gift-code').disabled = owned;
    if (owned) {
      $('gift-stage').classList.remove('hidden');
      G.UI.sprite($('gift-stage'), G.GiftCodes.MAOMAO_DEX, { lively: true, scale: 3, hero: true });
    } else {
      $('gift-stage').classList.add('hidden');
    }
  }

  function open() {
    if (!G.DB.save || G.DB.guest) {
      G.UI.toast('Inicia sesión para canjear códigos de regalo.', 4500);
      return;
    }
    if (G.Game.state !== 'ui') return;
    $('gift-status').textContent = G.DB.mode === 'local'
      ? 'Modo de prueba: el regalo se guardará sólo en este navegador, no en Firebase.'
      : 'El regalo se guardará en tu cuenta de Firebase Tiliko.';
    $('gift-code').value = '';
    G.UI.show('scr-gifts', true);
    showReward();
  }

  return { init, open };
})();
