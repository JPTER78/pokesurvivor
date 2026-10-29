# Pokémon prestige

Implemented on `codex/pokemon-prestige`, based on the tested Mega Evolution branch.

In Upgrades, max every permanent upgrade for the selected Pokémon, then press
Prestige. The confirmation explains the reset and has a Cancel button (Escape
also cancels). Confirming resets only that Pokémon's purchased upgrade levels,
without refunding coins. Ownership, learned TMs, nature, ability, preferences,
existing shiny ownership, inventory and other Pokémon are retained. Upgrade
preferences remain inactive until the required upgrades are purchased again.

Each level adds 5% of base HP, physical/special attack, defense/special defense
and speed for Common, Uncommon and Rare species (rarities 1–3), up to 25%. Epic
and Legendary species (4–5) gain 2.5% per level, up to 12.5%. Bonuses are additive
and use the original species rarity even after transformation. Nature still applies; permanent
HP upgrades are added afterwards. Prestige-adjusted base HP is rounded to the
nearest whole number. The bonus applies to transformed forms too.
Five is the cap and also grants shiny ownership, celebrated with a shiny preview
popup after confirmation. The badge appears in the menu,
collection and detail view; Upgrades shows level, percentage and eligibility.

`save.prestige[dex]` is both level and upgrade generation. Save merge takes the
highest generation and only merges upgrade purchases within that generation, so
an older save cannot restore upgrades spent on prestige. Concurrent prestiges
from the same starting level do not stack. Legacy saves default to zero.
Prestige is restricted to the menu and validates eligibility and the expected
level again on confirmation. Co-op protocol 4 sends prestige in state field 21;
remote stats use the sender's level, not the receiver's collection.

Local debug test, after entering the menu at `dev.html?debug=1`:

```js
for (const u of G.Upgrades.LIST) {
  G.DB.upgradesOf(G.DB.save.partner)[u.id] = u.max;
}
```

Open Upgrades and use Prestige. Repeat five times to check the shiny reward.
Debug saves are temporary. Test a new run to inspect the boosted base stats.

Targeted tests: `tests/prestige.test.cjs`, `tests/db.test.cjs`,
`tests/mega-net.test.cjs`, `tests/net.test.cjs`, `tests/i18n.test.cjs`.
Browser: `node tools/test_prestige_browser.cjs` (same optional Playwright setup
as `tools/test_mega_browser.cjs`). Screenshots go to ignored `tools/cache/`.
