/* ============ main.js — arranque ============ */
(() => {
  // Si un archivo no llega a cargarse (conexión móvil que se corta), mejor
  // avisar que arrancar a medias.
  const NEED = ['U', 'I18n', 'Settings', 'Challenges', 'DB', 'Audio', 'Input', 'Touch', 'Sprites', 'Camera', 'Moves', 'Enemies', 'Upgrades', 'Items',
                'World', 'FX', 'Projectiles', 'EnemyMgr', 'Pickups', 'Player', 'Combat', 'Spawner', 'LevelUp', 'Gacha',
                'Rift', 'Weather', 'Progress', 'Hazards', 'Social', 'Net', 'Coop', 'Ranking', 'Icons', 'UI', 'HUD',
                'MenuUI', 'RunUI', 'SettingsUI', 'Funding', 'SupportUI', 'Game', 'Flow'];
  function broken() {
    // (En la versión publicada G no está en window: va encerrado, ver tools/build.js.)
    const miss = NEED.filter(k => typeof G !== 'object' || !G[k]);
    if (!miss.length) return false;
    const el = document.getElementById('boot');
    el.innerHTML = 'No se pudo cargar todo el juego (¿se cortó la conexión?).<br><button class="btn gold" style="margin-top:12px" onclick="location.reload()">Recargar</button>';
    console.warn('[Arranque] faltan:', miss.join(', '));
    return true;
  }

  // Mantenimiento (mudanza a servidores nuevos): no se entra ni se inicia
  // sesión, así no se escribe nada mientras se copian las cuentas y partidas.
  // Para probar en local: añade ?dev a la dirección.
  const MAINTENANCE = false;
  function maintenance() {
    if (!MAINTENANCE || /[?&]dev\b/.test(location.search)) return false;
    const en = typeof G === 'object' && G.I18n ? G.I18n.lang === 'en' : !/^es/i.test(navigator.language || '');
    const el = document.getElementById('boot');
    el.setAttribute('translate', 'no');
    el.innerHTML = '<div class="boot-in"><h1>PokéSurvivor</h1>' + (en
      ? '<p><b>We are under maintenance.</b></p><p>We are moving the game to new servers so it can stay free for everyone. ' +
        'Your account, your save and your Pokémon are safe. Please come back in a few hours!</p>'
      : '<p><b>Estamos en mantenimiento.</b></p><p>Estamos mudando el juego a servidores nuevos para que siga siendo gratis para todos. ' +
        'Tu cuenta, tu partida y tus Pokémon están a salvo. ¡Vuelve en unas horas!</p>') +
      '<button class="btn gold" style="margin-top:12px" onclick="location.reload()">' + (en ? 'Try again' : 'Volver a intentarlo') + '</button></div>';
    return true;
  }

  function boot() {
    if (maintenance()) return;
    if (broken()) return;
    G.I18n.startDom();
    // Espera a la fuente pixel para que la UI no salte al cargarla.
    const ready = document.fonts && document.fonts.load ? document.fonts.load('16px Pixelify') : Promise.resolve();
    ready.catch(() => {}).then(() => G.Flow.boot());
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
  else boot();

  // Instalable como app (PWA). Sólo con http(s): abierto con doble clic (file://) no hace falta.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('[PWA]', e.message)));
  }
})();
