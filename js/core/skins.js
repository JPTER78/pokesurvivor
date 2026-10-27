/* ============ skins.js — disfraces de bruja (Halloween 2026) ============
 * Una skin es un disfraz pintado en las propias hojas de sprites del Pokémon:
 * sombrero de bruja en la coronilla y capa siguiendo el cuerpo, en cada
 * fotograma y cada dirección (tools/make_skins.py). Están en
 *   assets/pokemon/{dex}/k-{id}/{Anim}.png      (y k-{id}/s/ las shiny)
 * con un margen de PAD_X a los lados y PAD_T arriba para el sombrero.
 *
 *   Animator.skin = id    (core/sprites.js usa esas hojas)
 *   SKINS[id]             las que se compran con caramelos en la Tienda Kecleon
 *   'hat'                 sólo el sombrero (Kecleon, en la tienda esos días)
 *
 * Se guardan en la partida: save.skins { id: fecha } (compradas, para siempre)
 * y save.pskin { dex: [id, fecha] } (la que lleva puesta cada Pokémon; '' = ninguna).
 */
G.Skins = (() => {
  const PAD_X = 8, PAD_T = 16;          // (los mismos que en tools/make_skins.py)

  const SKINS = {
    'bruja-gengar':  { dex: 94,  name: 'Gengar bruja' },
    'bruja-pikachu': { dex: 25,  name: 'Pikachu bruja' },
    'bruja-umbreon': { dex: 197, name: 'Umbreon bruja' }
  };
  const HAT = { dex: 352, name: 'Kecleon bruja' };
  const LIST = Object.keys(SKINS);

  /** La skin de un id para ese Pokémon; null si no hay o no es suya (no tiene hojas). */
  function get(id, dex) {
    const s = id === 'hat' ? HAT : SKINS[id];
    return s && s.dex === +dex ? s : null;
  }

  // ---------------- en la partida guardada ----------------

  const owns = (s, id) => !!(s && s.skins && s.skins[id]);
  /** La skin que lleva puesta un Pokémon ('' si ninguna o si no es suya). */
  function worn(s, dex) {
    const e = s && s.pskin && s.pskin[dex];
    const id = e && e[0];
    return id && SKINS[id] && SKINS[id].dex === +dex && owns(s, id) ? id : '';
  }
  function wear(s, dex, id) {
    s.pskin = s.pskin || {};
    s.pskin[dex] = [id || '', Date.now()];
  }

  return { PAD_X, PAD_T, SKINS, LIST, get, owns, worn, wear };
})();
