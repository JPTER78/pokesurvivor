# Traditional Chinese name sources

`js/data/lang-zh-TW.js` contains the display translations used by the game. `docs/zh-TW-names.json` audits every one of the 966 game Pokédex entries by National Pokédex number, plus all 64 base move names and 59 evolved-move display labels.

The reproducible generator is `python tools/sync_zh_names.py`. It downloads the CSV exports from the immutable PokeAPI commit recorded in the manifest, selects language id 4 (`zh-hant`, Taiwan), and rewrites only the audited Pokémon and move labels while retaining the rest of the existing UI dictionary. PokeAPI is community-maintained; these names are source-backed, not officially audited by The Pokémon Company.

Move names match the game’s English display label to PokeAPI’s English move name, then use the Traditional Chinese name for that canonical move ID. This intentionally follows display semantics where a game slug differs: `leaf-storm` is displayed as “Petal Blizzard” and uses that move’s source name; `giga-drain` is displayed as “Grass Knot” and uses that move’s source name. The evolution label “Enjambre” (“Swarm”) derives from canonical ability ID 68 (`swarm`). Its Chinese name comes from PokeAPI’s ability names, and it remains marked `custom_or_unmatched` because it is not a canonical move.

The Spanish source key `Psíquico` is shared by the Psychic type and the Psychic move. The dictionary entry follows the move display (`精神強念`). The `G.U.TYPE_NAME.psychic` getter returns the type label `超能力` in Chinese so type chips, missions and events retain their proper type name; other languages keep their original labels. Both meanings are covered by regression checks.

The official Taiwan Pokémon Pokédex was spot-checked for #0001 妙蛙種子 and #0025 皮卡丘, which agree with the generated names: [妙蛙種子](https://tw.portal-pokemon.com/pokedex/0001/) and [皮卡丘](https://tw.portal-pokemon.com/pokedex/0025/). These examples validate those records only; the full set comes from the pinned PokeAPI dataset.
