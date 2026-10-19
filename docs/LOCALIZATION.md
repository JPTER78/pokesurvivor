# Unified game localization

Based on upstream `e4ba0e173cb7e415f9815c924a48c5c25f516962`, including the
latest controller, collection filters, combat statistics and security fixes.
Spanish and English remain available. Added game languages:
French, Italian, Brazilian Portuguese, Simplified Chinese and Traditional Chinese.

## Contributions and provenance

This integration reuses existing contributors' work, rather than claiming their
translations as new. Source revisions:

| Language / component | Contributor | Original PR | Revision |
| --- | --- | --- | --- |
| French dictionary and names | KamelAkar | [#67](https://github.com/JPTER78/pokesurvivor/pull/67) | `4ea617c89c3d00eeef13c8914cfb39a2b82764a2` |
| Italian dictionary | Matteo Ruggiero | [#82](https://github.com/JPTER78/pokesurvivor/pull/82) | `ead8ea14c9e78af8c7383e0274d811d8b102b651` |
| Brazilian Portuguese dictionary | Ayablack | [#108](https://github.com/JPTER78/pokesurvivor/pull/108) | `007608505557a114331a9c28b5dc2e4a3beba0ec` |
| Simplified Chinese dictionary and names | Xiao Hou | [#88](https://github.com/JPTER78/pokesurvivor/pull/88) | `a23065deefa1dd4d23557c7b10f6d8d99af42dbc` |
| Traditional Chinese dictionary, names, contextual translation and UI adaptations | Zhe Xi Huang | [#74](https://github.com/JPTER78/pokesurvivor/pull/74) | `d52e25651bf47a9963f6af6a13001b173d25357a` |

The Chinese contributions use PokéAPI names. The Traditional Chinese contributor
documents comparison against the Taiwan Pokédex and the Kingambit correction
(`仆斬將軍`) in the original PR's documentation. That linguistic verification is
attributed to the original contribution, not repeated by this integration.
No runtime translation or Pokémon-name service is introduced. The repository's
existing license files remain unchanged. Other Traditional Chinese alternatives
(#148, #166, #191) are not silently merged into this dictionary.

## Cómo funciona en el juego (19-10-2026)

- Español e inglés van dentro del juego (`js/app.min.js`), como siempre.
- Francés, italiano, portugués y chino van aparte, uno por idioma: `js/lang/<idioma>.js`.
  Lo genera `tools/build_langs.js` (lo llama `tools/build.js`) a partir de los
  `js/data/lang-*.js` de esos idiomas y de `js/data/lang-updates.js`.
  `js/core/locales.js` descarga sólo el del jugador, antes que el juego.
- Si a un idioma le falta un texto, sale en **inglés** (nunca en español).
- **Textos nuevos del juego**: además de `lang-en.js`, se añaden en
  `js/data/lang-updates.js` en los cinco idiomas (una fila por texto).
  `node tools/build_langs.js --faltan --todo` lista lo que falta;
  `node --test tests/i18n.test.cjs` falla si falta algo.
- Los avisos al entrar (`login.js`) y la frase del ranking quedan como estaban
  en español e inglés; en los demás idiomas se traducen enteros.

## Architecture

- `js/core/locales.js` is shared by the early loading screen and the runtime. It
  uses external scripts compatible with the upstream CSP and exposes only locale
  metadata, never the game's `G` or player state.
- Saved preference takes precedence over `/en/`, then the browser language.
  Unsupported languages fall back to English. Spanish browser languages retain
  Spanish. `pt` aliases Brazilian Portuguese; `zh-CN`/`zh-SG` map to `zh-Hans`,
  `zh-TW`/`zh-HK`/`zh-MO` to `zh-Hant`. Explicit script subtags win over region.
- Select a language in Settings → Graphics → Language. Only `ps.lang` changes;
  the game reloads through its existing language-setting behavior.
- `G.I18n.add(dict, language, context)` registers only the active language.
  `lang-updates.js` contains integration additions and the new save UI texts.
- Spanish source keys and game IDs remain unchanged. `{x}` translates embedded
  labels; `{name}` preserves user-supplied names. Known social-message templates
  also protect names in older dictionaries. More specific templates precede
  catch-all patterns, and later definitions replace earlier ones.
- DOM `translate="no"` and `rawCanvas` protect player names. Pokémon names may
  be translated for display/search; title options keep explicit source values.
- `G.T(label, 'move')` distinguishes the move Psychic from the Psychic type.
- Chinese uses installed CJK fallback fonts for both measurement and drawing.
- The save and leaderboard notices keep the owner's wording (including "every
  10 minutes") and are translated whole, with their bold text. No database
  timers, cloud rules or endpoints change.

## Scope and limitations

This localizes the playable game; it does not add five sets of public SEO pages.
External guide/support pages retain their Spanish/English content. Historical
release notes without a complete translation use their existing English version;
the October 18–19 gameplay/security/save/ranking/localization notes are translated in all five new
languages. Future unknown strings retain source text outside the news fallback.

Tests enforce coverage of the current English dictionary keys, including identity
translations and protected-name equivalents. This is a technical coverage check,
not proof that every dynamically composed UI sentence is linguistically perfect.
Native-speaker review remains useful, especially for terminology and grammar.

## Validation

```
node --test tests/i18n.test.cjs
node tools/build.js
node tools/export_data.js
python tools/make_seo_pages.py
```

Tests cover all seven languages, current-key coverage, placeholder counts, script
and region selection, storage failure, dictionary isolation, template precedence,
Chinese names and move context, player-name preservation, and the save notice.
They exercise the real login module with a local DOM stub. They do not validate
live Google authentication, Firebase synchronization or multiplayer.

The normal protected build is required; do not submit `--expose` output. Browser
checks can use a loopback address outside the production host allowlist, e.g.
`127.0.0.2`, to use the existing local-save mode without contacting Firebase.

Validation on 19 October 2026: all 18 tests passed, and the normal protected
build, data export and SEO generation completed. Browser checks used a disposable
local account: all five added languages in development, then the protected build
in Traditional Chinese and Italian, translated collection search, controller
labels, current release notes and `/en/` preference precedence. The account name,
600 coins and owned Pokémon remained intact across language reloads.
The browser automation emitted keyboard events without `code`/`key`, producing
errors in the unchanged upstream `Input.code` handler; physical gamepad input,
live cloud accounts and multiplayer were not exercised.
