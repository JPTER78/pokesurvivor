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

## Lucarionite, Mega Bracelet and DNA Splicers

The same pinned PokéRogue source also supplies the unmodified
[DNA Splicers](https://github.com/pagefaultgames/pokerogue-assets/blob/8250b23677d4918801fc6fc1e95b6dd1c30ef6c4/images/items/dna_splicers.png)
icon at `assets/items/dna_splicers.png`; `fetch_mega_items.py` includes it.

- Source: **Pagefault Games / PokéRogue asset contributors**, unmodified
  [Lucarionite](https://github.com/pagefaultgames/pokerogue-assets/blob/8250b23677d4918801fc6fc1e95b6dd1c30ef6c4/images/items/lucarionite.png)
  and [Mega Bracelet](https://github.com/pagefaultgames/pokerogue-assets/blob/8250b23677d4918801fc6fc1e95b6dd1c30ef6c4/images/items/mega_bracelet.png).
- Revision: `8250b23677d4918801fc6fc1e95b6dd1c30ef6c4`.
- The upstream [README license section](https://github.com/pagefaultgames/pokerogue-assets/blob/8250b23677d4918801fc6fc1e95b6dd1c30ef6c4/README.md)
  declares **CC BY-NC-SA 4.0 to the extent its assets are licensable/applicable**,
  unless overridden. None of these three icons has an overriding match in the root or
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

## Black Kyurem and White Kyurem sprites

- Source: [Black, sprite/0646/0001](https://github.com/PMDCollab/SpriteCollab/tree/18c8a218537b984839803b95d588382624a8301a/sprite/0646/0001)
  and [White, sprite/0646/0002](https://github.com/PMDCollab/SpriteCollab/tree/18c8a218537b984839803b95d588382624a8301a/sprite/0646/0002),
  at the same SpriteCollab revision as Mega Lucario above. Shiny assets are each
  form's `0001` subgroup.
- Artist for both forms and shiny variants: **Top_Kec** (`@topkec.bsky.social`),
  resolved from the pinned `credit_names.txt` entry `<@!276369635304275968>`.
- Original `credits.txt` files are included for all four sets. Black's entries
  identify `CC_BY-NC_4`; White's entries retain the legacy `PMDCollab_1` designation.
  These source notices are preserved verbatim rather than relicensed by this repo.
- Converted with the existing lossless importer into
  `assets/pokemon/646/forms/black/` and `assets/pokemon/646/forms/white/`, with `s/`
  subdirectories for shiny. Idle, Walk, Attack, Shoot, Charge and Hurt come from
  their source animations; Faint uses the existing Hurt fallback. No recolors or
  replacement sprites were generated. Ground anchors and durations are imported.
