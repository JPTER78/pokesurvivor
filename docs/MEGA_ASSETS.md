# Mega Evolution asset provenance

The source-code license does not relicense this art. Pokémon names and designs
remain the property of Nintendo, Creatures Inc. and GAME FREAK.

## Mega Lucario sprites

- Source: [SpriteCollab, sprite/0448/0001](https://github.com/PMDCollab/SpriteCollab/tree/18c8a218537b984839803b95d588382624a8301a/sprite/0448/0001).
- Revision: `18c8a218537b984839803b95d588382624a8301a`.
- Normal art: **baronessfaron**. Shiny palette: **Emmuffin**
  ([artist contact](https://twitter.com/Ernmuffin)). Names resolved using the
  repository's `credit_names.txt`; original credits are retained beside the PNGs.
- License: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), as
  stated by SpriteCollab's submission/use policy and each imported credits entry.
- Conversion: existing `fetch_sprites.py` converter, lossless indexed PNG storage,
  ground-anchor metadata from shadow sheets. Shoot aliases Attack; Faint aliases
  Hurt. No new art or shiny recolors were synthesized.
- Destination: `assets/pokemon/448/forms/mega/` and its `s/` shiny directory.

## Lucarionite and Mega Bracelet

- Source: **Pagefault Games / PokéRogue asset contributors**, unmodified
  [Lucarionite](https://github.com/pagefaultgames/pokerogue-assets/blob/8250b23677d4918801fc6fc1e95b6dd1c30ef6c4/images/items/lucarionite.png)
  and [Mega Bracelet](https://github.com/pagefaultgames/pokerogue-assets/blob/8250b23677d4918801fc6fc1e95b6dd1c30ef6c4/images/items/mega_bracelet.png).
- Revision: `8250b23677d4918801fc6fc1e95b6dd1c30ef6c4`.
- The upstream [README license section](https://github.com/pagefaultgames/pokerogue-assets/blob/8250b23677d4918801fc6fc1e95b6dd1c30ef6c4/README.md)
  declares **CC BY-NC-SA 4.0 to the extent its assets are licensable/applicable**,
  unless overridden. Neither icon has an overriding match in the root or
  `images/REUSE.toml`, or a `.license` sidecar at this revision. No individual
  creator is identified for these files in those notices; this attribution does
  not imply Pagefault Games owns the underlying Pokémon artwork.
- The upstream CC BY-NC-SA license text and underlying Pokémon rights/fair-use
  notice are retained in `assets/licenses/`. The latter is an upstream statement,
  not a new license grant from this project. These files retain their art terms,
  separately from PokéSurvivor's code license; no endorsement is implied.
- Destination: `assets/items/lucarionite.png`, `assets/items/mega_bracelet.png`.

Both repositories were inspected on 2026-10-28. Regeneration commands and runtime
fallback behavior are documented in [MEGA_EVOLUTION.md](MEGA_EVOLUTION.md).
