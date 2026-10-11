# Multi-move combat: every move fires, fusions and elemental reactions

Date: 2026-10-11 · Status: draft for review

## 1. Goal

Turn PokéSurvivor's combat from "one active move at a time" into a Vampire
Survivors style loadout: every attack move the Pokémon knows fires on its own
cooldown, moves still evolve at max level, and combining moves produces
visible, powerful effects in two ways: automatic **elemental reactions** when
status effects meet, and hand-authored **fusion moves** bought with the bonds
that legendaries already grant.

Success looks like: a run at minute 8 fills the screen with 5-6 different
attacks going off at once, the player has chosen 4 passives that shape the
build, at least one reaction label pops every few seconds, and a legendary win
lets the player fuse two moves into something that feels like a reward.

Decisions already taken with the author:

| Question | Decision |
|---|---|
| Loadout | 6 attack moves + 4 passive boosts |
| Combos | Elemental reactions (automatic) **and** fusion moves via bonds |
| Keys 1-6 / Q / E | Focus a move: +25% damage and it drives targeting/facing |
| Balance | Scale enemy HP with how many attack moves the player holds |

## 2. Current state (what changes)

- `G.Player` keeps `moves`, `slots` (bond groups) and `active`. Only the active
  slot fires (`Combat.tick` → `pl.activeGroup()`). One shared `pl.aim`.
- Buff moves (Danza Espada, Agilidad, Fortaleza, Acua Aro, Danza Dragón) only
  make sense when a single move is active: they stack while selected.
- Bonds fuse up to 4 moves into one slot that fires together. With every move
  firing anyway this mechanic loses its meaning.
- `combat.js` (668 lines) holds all 14 move kinds in one switch plus fields,
  collisions and two separate damage paths (`hit` for instant kinds, inline
  code in `resolve` for projectiles).
- Coop puppets sync a single move id (`mv`/`ml`). Enemy status bits sent to
  guests cover burn (1), poison (2) and shield (4).
- Level-up stat cards (Vigor, Potencia…) are unlimited and tracked in
  `statsTaken` for evolution conditions.
- Enemy HP scales only with time (`hpK(t)`) and player count.

## 3. Design

### 3.1 Loadout

**Attacks.** `pl.moves`: up to **6** attack moves (`Player.MAX_MOVES = 6`).
Each has its own cooldown `m.t` and all tick every frame. `slots`,
`activeGroup()` and the old `fuse()` disappear. The 5 buff moves are removed
from the catalogue (their ids are not stored in saves; runs are not persisted).
Dragon loses Danza Dragón and would be left with a single attack, so one dragon
attack is added: **Dragoaliento** (`dragon-breath`, kind `cone`, slow 0.3,
evolves into Pulso Dragón, condition Reflejos). Attack move count goes from 47
to 48 evolvable moves; the achievement text and the EN dictionary stop
hard-coding "47".

**Passives.** `pl.passives`: up to **4** passive boosts
(`Player.MAX_PASSIVES = 4`), each with level 1-5. They replace the 8 stat
cards and live in a new data file `js/data/passives.js`:

| id | Name | Icon | Per level | Replaces card |
|---|---|---|---|---|
| hp | Vigor | heart | +20 max HP (and heals it) | Vigor |
| atk | Potencia | fist | +10% damage | Potencia |
| spd | Carrera | boot | +7% speed | Carrera |
| cd | Reflejos | clock | −8% cooldown | Reflejos |
| def | Coraza | shield | +6% damage reduction (cap 0.7) | Coraza |
| rgn | Síntesis | sprout | +0.9 HP/s | Síntesis |
| mag | Imán | magnet | +30% pickup radius | Imán |
| xp | Aprendizaje | book | +12% XP | Aprendizaje |

Each passive defines `apply(pl)` for one level, same numbers as today. Taking a
passive the first time occupies a slot; later cards level it. Evolution
conditions keep their meaning: a move at max level evolves if the player
**holds** the passive named in `EVO` (any level). `statsTaken` is replaced by
`pl.hasPassive(id)`. If the passive row is full and the needed passive is not
held, the evolution is unreachable this run; the move's up-card tag says
"Evoluciona con Potencia" so the player learns the rule.

**Baya Zidra** (heal 45%) stays as a free card that takes no slot, and a new
**Pokémonedas** card (+40 coins) joins it. Both are the fallback once every
attack and passive is maxed, so level-ups never offer an empty hand.

### 3.2 Firing and targeting

`Combat.tick(dt, pl)` loops over `pl.moves`. For each move it computes its own
target and aim with `Combat.aimFor(pl, m)`:

- Ranged kinds (projectile, beam, cone, chain, meteor, boomerang, turret):
  boss within 330 > enemy touching the player > nearest within 520.
- Melee kinds (melee, dash, aura, nova, mine, trail, orbit): touching > boss >
  nearest.
- No enemies: nearest breakable prop within 200.

The result is stored on the move (`m.target`, `m.aim`) and every kind
implementation reads `m.aim` instead of `pl.aim`. Reach checks use `m.target`.
`Player.update` still sets `pl.target`/`pl.aim` for facing and animation, but
from the **focused** move's rule.

**Focus.** `pl.focus` (index into `moves`, default 0) replaces `active`.
Keys 1-6, Q/E and tapping an icon change it. The focused move deals ×1.25
damage (`Player.FOCUS_MUL`). Changing focus no longer clears orbs: all orbit
moves keep their orbs (the orbit code already keys them by move id). Cinta
Elección keeps its identity: +40% damage, cannot change focus.

**Casting feedback.** `pl.cast(m)` keeps the animation guard. Shot sounds are
throttled to one per 80 ms per player so six moves do not turn into noise.
Camera kicks from beams and dashes are halved when more than 3 attacks are
held. Vidasfera's per-cast HP cost is divided by the number of attack moves so
the item costs the same per second as before.

### 3.3 Fusion moves (bonds)

Winning a legendary rift still grants a **bond** (`pl.bonds++`). Spending one
now opens a screen with:

- One gold-pink card per **fusion recipe** whose two source moves the player
  holds (any level). Picking it removes both sources, adds the fusion move at
  level `max(lvlA, lvlB)`, keeps the focus sensible, and frees one attack slot.
- One fallback card, **Impulso**: raise any held attack move to level 5. Shown
  only when no recipe is available, so a bond is never wasted (replaces the
  current "bond saved until later" behaviour).

Recipes live in `js/data/fusions.js` as `{ pair: [idA, idB], id, name, type,
kind, desc, …params }` and register themselves in `G.Moves.BY_ID` with
`fused: true`, so instance/levelUp/ghostCast/icons/HUD all work unchanged.
Fusions use the existing ladder of their `kind` for levels 2-5, do not evolve
(they are already the top of the tree) and draw with a gold-pink border. Each
recipe is reachable by at least one Pokémon pool (checked by the data test in
§5). Initial set of 16:

| Pair | Fusion | Kind | Hook |
|---|---|---|---|
| Ascuas + Tornado | Tormenta Ígnea (fire) | orbit | 5 big flaming tornados, burn, knock |
| Pistola Agua + Impactrueno | Marea Voltio (electric) | chain | 8 jumps, slow 0.3, sets wet |
| Rayo Hielo + Lanzarrocas | Alud Glacial (ice) | meteor | 5 meteors, slow 0.6, knock |
| Residuos + Ascuas | Llama Tóxica (fire) | trail | burn 1 + poison 1 patches |
| Confusión + Bola Sombra | Golpe Umbrío (ghost) | projectile | 3 homing, pierce 3 |
| Látigo Cepa + Mordisco | Cepo Mandíbula (grass) | melee | 360°, knock 160, slow 0.5 |
| Rayo + Infortunio | Maldición Voltio (electric) | chain | 8 jumps, hex ×2 |
| Hoja Afilada + Psicocorte | Filos Pétalo (grass) | boomerang | 5 blades |
| Onda Ígnea + Vozarrón | Rugido Ígneo (fire) | nova | 24 shots, pierce 2, burn |
| Ataque Rápido + Golpe Aéreo | Picado Extremo (flying) | dash | radius 200, width 60 |
| Púas + Púas Tóxicas | Campo de Púas (poison) | mine | 6 mines, poison 2 |
| Fuego Fatuo + Sustituto | Señuelo Fatuo (fire) | turret | 3 turrets, burn |
| Burbuja + Nieve Polvo | Burbujas Gélidas (ice) | aura | radius 110, slow 0.7, sets wet |
| Golpe Kárate + Garra Metal | Puño Férreo (steel) | melee | dmg 45, knock 150 |
| Hidrobomba + Furia Dragón | Cañón Draco (dragon) | beam | width 60, radius 320 |
| Disparo Lodo + Terratemblor | Onda Sísmica (ground) | nova | 16 shots, slow 0.5, knock |

A `fuse` progress event feeds two achievements (Fusión: 1, Alquimista: 10) and
the end-of-run move list shows fusions with their icon.

### 3.4 Elemental reactions

Reactions trigger inside the unified damage function (§3.6) when the attack
type meets a status already on the enemy. A new status **wet** (`e.wet`,
2.5 s) is set by any water-type hit or by a move that declares `wet: 1`
(Marea Voltio, Burbujas Gélidas). Each enemy has a 0.5 s reaction cooldown
so a cone of 7 bubbles does not fire 7 reactions. Reaction damage scales like
burn does today (`× (1 + pl.level × 0.06)`).

| Reaction | Trigger | Effect |
|---|---|---|
| ¡Vapor! | water hit on burning enemy | consumes burn; steam burst r 60: 6 × burn stacks damage, slow 0.5 for 1.5 s |
| ¡Rotura! | rock/steel/fighting/ground hit on enemy with slow ≥ 0.4 | that hit ×1.6, consumes the slow |
| ¡Detonación! | fire hit on poisoned enemy | consumes poison; explosion r 70: 8 × poison stacks, burn 1 to neighbours |
| ¡Conducción! | electric hit on wet enemy | arcs to 3 nearest within 120 for 50% of the hit, sets them wet |
| ¡Congelación! | ice hit on wet enemy | consumes wet; frozen 1.2 s (slow 1.0, can't act) |

Each shows a coloured label above the enemy (`FX.dmgText`, translatable) and a
ring. Data and logic live in `js/systems/reactions.js`. In coop, guests
evaluate reactions with the synced status bits, extended to: 1 burn, 2 poison,
4 shield, 8 slow, 16 wet. Guest reactions send their damage through the
existing `Coop.hit` path.

### 3.5 Balance

Enemy HP at spawn is multiplied by `powerK = 1 + 0.4 × (attacks − 1)` where
`attacks` is the average number of attack moves across living players (host
decides). Bosses use `1 + 0.3 × (attacks − 1)`. XP per enemy is unchanged, so
the level curve stays roughly where it is. Fusions count as one move; their
strength is the reward for the legendary.

### 3.6 Code structure

- **`js/systems/move-kinds.js`** (new): one entry per kind
  `{ run(pl, m), reach(m), ranged: bool, anim, snd }` plus the field updaters
  and drawers for mines, meteors, turrets and patches. `combat.js` shrinks to
  orchestration: `tick`, `aimFor`, `damage`, `resolve`, ghost helpers.
- **`Combat.damage(pl, e, dmg, src)`**: the single place that applies type
  multipliers, hurts the enemy, applies statuses, triggers reactions, and
  feeds items (Cascabel Concha) and stats. Both melee kinds and projectile
  collisions call it.
- **`js/data/passives.js`**, **`js/data/fusions.js`**,
  **`js/systems/reactions.js`** (new data/logic files, loaded in `dev.html`
  after `moves.js` / before `combat.js`).
- `Player`: `moves`, `passives`, `focus`, `bonds`; `addMove`, `addPassive`,
  `levelPassive`, `hasPassive`, `setFocus`, `cycle`, `fuse(recipe)`,
  `fusionOptions()`.
- `LevelUp.candidates` builds: new attack (w 10, if < 6), new passive (w 6,
  if < 4), attack up (w 8), passive up (w 7), evolution (gold, always shown),
  Baya Zidra (w 3), Pokémonedas (w 2). Passives that unlock a waiting
  evolution get the gold tag as today.
- Coop state packs attacks as `"id:lvl:flags,…"` in place of `mv`/`ml`
  (flags bit 1 = evolved). Puppets rebuild their `moves` when the string
  changes; `ghostOrbit` iterates all orbit moves.
- Items: Cinta Elección text → "+40% de daño, pero no puedes cambiar el
  movimiento enfocado". Vidasfera cost per cast divided by attack count.

### 3.7 HUD and screens

- Attack row (bottom centre): 6 slots, empty ones drawn as dim outlines. Icon
  54 px on desktop, 44 px on touch. Focused slot is raised with its name;
  evolved = gold border, fused = gold-pink border. Cooldown shade and level
  pips as today. Tapping a slot focuses it.
- Passive row: 4 small slots (26 px) centred directly above the attack row,
  with level pips. Empty ones dim.
- Bond token indicator stays to the right of the attack row.
- Level-up cards: passive cards use a slate chip "Pasiva" (gold when they
  unlock an evolution); fusion cards reuse the `.card.bond` style.
- Bond screen (`scr-bond`): title "Fusión", cards per recipe with both source
  icons and the result, or the Impulso card. Keys 1-6.
- Pause and guide text: "1-6 / Q / E enfocar movimiento".
- Reaction labels appear as damage text in the reaction's colour.

### 3.8 Texts and docs

Every new player-facing Spanish string gets an English entry in
`js/data/lang-en.js`. GDD §3 (Combate), §7.2 and §7.2c are rewritten; the
README controls table and the guide text in `tools/make_seo_pages.py` change
"cambiar movimiento" to "enfocar". `tools/export_data.js` exports fusions and
passives so the static moves page can list them. The GDD decision log gets a
2026-10-11 entry.

## 4. Error handling

- A fusion recipe that references an unknown move id fails the data test and
  is skipped at runtime (logged once), never crashes.
- `aimFor` with no target leaves `m.aim` at the player's facing so kinds that
  do not need a target (nova, aura, trail, mine) still fire.
- Reactions never run on dead or remote-without-status enemies; status bits
  missing from an older host are treated as "no status".
- Coop puppet state strings that fail to parse keep the previous move list.

## 5. Testing

- **Data tests** (`node tools/test.js`, new): loads the data files in a vm
  sandbox like `tools/export_data.js` does and checks: every move kind has a
  ladder and an evolution entry; every fusion pair exists and is reachable by
  at least one Pokémon in `G.DEX` through `poolFor`; passive ids are unique and
  match `EVO` conditions; every Spanish string introduced in the new files has
  an EN entry. Run before every commit of this work.
- **Logic tests** in the same runner with a stub `G`: `aimFor` priority for
  ranged vs melee; `LevelUp.offer` never returns an empty hand and never
  exceeds 6 attacks / 4 passives; `powerK` values; reaction table triggers and
  per-enemy cooldown; coop state string round-trip.
- **Playtest** in the browser pane with `dev.html`: 10-minute solo run
  checking six moves firing, focus switching, a reaction label, a bond fusion
  (force a rift via the dev tools if available), passive row, mobile layout at
  phone width.
- `node tools/build.js` regenerates `index.html` and `js/app.min.js` at the
  end; both are committed.

## 6. Out of scope

Set bonuses, manual ultimates, new projectile artwork, per-Pokémon move
lists, changes to gacha or ranking.
