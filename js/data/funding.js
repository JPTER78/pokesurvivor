/* ============ funding.js — donaciones (transparencia) ============
 * Las donaciones son voluntarias, no dan ninguna ventaja en el juego y se
 * usan sólo para mantenerlo en línea: servidores (Firebase) y dominio.
 * Este archivo es la fuente de lo que se enseña en el juego (botón "Apoyar")
 * y en la página /apoyar/. Se actualiza a mano:
 *
 *   kofi      usuario de Ko-fi (vacío = el botón no sale todavía)
 *   sponsors  usuario de GitHub Sponsors (para quien entra al repositorio)
 *   costs     gastos actuales [concepto, euros al mes]
 *   raised    lo recaudado en total y lo gastado, con la fecha de la última cuenta
 */
G.Funding = {
  kofi: '',
  sponsors: 'JPTER78',
  costs: [
    ['Servidores (Firebase, plan gratuito)', 0],
    ['Alojamiento web (GitHub Pages)', 0],
    ['Dominio pokesurvivor.com (≈12 € al año)', 1]
  ],
  raised: { total: 0, spent: 0, updated: '2026-10-09' },
  get monthly() { return this.costs.reduce((a, c) => a + c[1], 0); },
  get url() { return this.kofi ? 'https://ko-fi.com/' + this.kofi : ''; }
};
