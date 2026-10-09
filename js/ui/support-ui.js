/* ============ support-ui.js — "Apoyar el proyecto" ============
 * Botón con un corazón en la barra del menú (sólo si hay cuenta de Ko-fi en
 * js/data/funding.js) y una ventana que explica, con números, a qué va el
 * dinero. No se cobra nada dentro del juego: el pago es en Ko-fi.
 */
G.SupportUI = (() => {
  const $ = G.UI.$;
  const F = G.Funding;
  const val = v => typeof v === 'number'
    ? (Math.round(v * 100) / 100).toLocaleString(G.I18n.lang === 'en' ? 'en' : 'es', { style: 'currency', currency: 'EUR' }) + ' / mes'
    : v;

  function init() {
    const b = $('btn-support');
    if (!F.url) return;                       // aún sin cuenta de Ko-fi: no sale
    b.classList.remove('hidden');
    b.innerHTML = G.Icons.html('heart', 18) + ' <span>Apoyar</span>';
    b.onclick = open;
    $('sup-close').onclick = close;
  }

  function open() {
    const rows = F.costs.map(([c, v]) => `<tr><td>${c}</td><td class="num">${val(v)}</td></tr>`).join('');
    $('sup-body').innerHTML = `
      <p>PokéSurvivor es y será <b>gratis</b>, sin anuncios ni compras. Si quieres ayudar a que siga en línea, puedes hacer una
      <b>donación voluntaria</b>: todo el dinero se usa para los <b>servidores y el dominio</b>, nada más.</p>
      <p class="sub">Donar no da ninguna ventaja en el juego.</p>
      <h3>Lo que cuesta mantenerlo</h3>
      <table class="sup-tab">${rows}</table>
      <p class="sub">Cuanta más gente juega, más cuestan los servidores. Lo que sobre se guarda para los gastos de los meses siguientes.</p>
      <div class="row wrap" style="gap:8px;justify-content:center;margin-top:10px">
        <a class="btn gold" href="${F.url}" target="_blank" rel="noopener">${G.Icons.html('heart', 18)} Donar en Ko-fi</a>
        ${window.PS_PAGES ? `<a class="btn" href="${G.I18n.lang === 'en' ? 'en/support/' : 'apoyar/'}" target="_blank">Más información</a>` : ''}
      </div>`;
    $('scr-support').classList.remove('hidden');
  }
  function close() { $('scr-support').classList.add('hidden'); }

  return { init, open, close };
})();
