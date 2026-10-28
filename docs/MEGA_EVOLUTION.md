# Mega Evolution

Lucario receives Lucarionite and automatically becomes Mega Lucario after winning
an enhanced red rift. Its normal held item remains equipped. Ineligible players
and players already carrying a Mega Stone receive the existing Bond reward.
Everything resets with the next run; collection ownership and upgrades still use
the original species identity.

## Architecture

- `tools/forms.json` is the form registry source. `generate_forms.py` produces
  `js/data/forms.js` using the same conversion helper as `fetch_pokedex.py`.
  Official Mega Lucario stats total 625; game stats before nature are HP 102,
  speed 125, physical attack 1.50, special attack 1.47, defense 88, special defense 70.
- `G.Forms.transform(player, id, options)` mutates the existing player. It retains
  moves, slot arrays, cooldown timers, nature, resources, counters and arbitrary
  runtime properties. Base stat differences are added to the current values,
  keeping run upgrades; HP keeps its proportion. `revert(player)` restores the
  initial form and ability without rewinding run progress. Registered forms and
  existing Pokédex names/numbers can be targets; gameplay evolution rules are out
  of scope. `baseSpecies`/`dex` retain collection identity; `mon.dex`, `formId` and
  `spriteKey` describe the current runtime Pokémon.
- Ability initialization hooks now return an inverse for their own persistent
  modifiers. `clearAbility()` runs that inverse and removes the ability's cooldown
  multiplier. Reapplying the same ability is a no-op. Combat already implements
  Adaptability as **+25% damage for matching types**; the feature reuses it without
  adding mainline STAB or another multiplier.
- `G.Rift` remains the single portal/arena manager. Each threshold (900, 1200,
  1500 seconds) has independent waiting/queued/spawned/attempted/won/lost/expired
  state. Queued events take priority, retry failed placement once per second,
  and wait for existing portals, arenas and world bosses. Portal lifetime is 60s.
  Difficulty is in `G.Rift.ENCOUNTERS`: HP ×2.5, damage/projectiles ×1.5, speed
  ×1.1, attack cooldown rate ×1.2; telegraph timing stays readable. Existing time
  and co-op HP scaling apply first. Arena duration remains 120s.
- Red portal frames use a second palette in the existing pixel painter and its
  cache. HUD arrows, banners, arena clock, entry/exit flashes and particles use
  red accents. Judgment waits for queued enhanced encounters; entering Judgment
  clears the world portal without resetting the run's schedule.
- `G.Hotbar.layout()` supplies HUD and touch-layout editor geometry, including
  safe areas and narrow viewports. The Mega slot registers no input handler and
  does not participate in move selection. Keyboard and gamepad continue selecting
  only moves. The stone name uses the same always-visible label as the held item.
- Co-op protocol **2** is advertised in the existing capability handshake and
  start message. Hosts refuse to start with incompatible peers; updated guests
  reject an older host. State fields 17–20 carry form, stone, ability and nature.
  The host schedules/spawns/resolves; each client awards its own player once.
  Encounter IDs reject duplicate or stale victory messages. Remote sprites and
  abilities are reconstructed from the trusted form registry.

## Assets and extending forms

See [MEGA_ASSETS.md](MEGA_ASSETS.md) for pinned sources and attribution.

```sh
python tools/generate_forms.py
python tools/fetch_sprites.py --forms
python tools/fetch_mega_items.py
```

Sprite conversion writes only `assets/pokemon/<dex>/forms/...` and
`js/data/sprites-forms.js`. It retains anchors, directions and animation timing.
Shoot uses Attack and Faint uses Hurt because the upstream set lacks those names.
Normal and shiny Mega sprites are included; missing shiny form sets fall back to
normal form sheets. Base Lucario sprites and generated Pokédex data are untouched.

To add a form, add its definition, sprite source/path and stone name to the
registry, run the generators, add the icon mapping and localized text/credits.
No Lucario-specific transformation or rift code needs changing.

## Repeatable development workflow

Serve the repository locally, then open `http://127.0.0.1:8000/dev.html?debug=1`:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

After the start screen, the browser console can run:

```js
G.DB.playAsGuest();
G.DB.grant(448, 'test');
G.DB.save.partner = 448;
G.Game.startRun();
G.Rift.debugOpenMega();          // walk into the red portal
// Or G.Rift.debugMegaArena() to skip walking.
G.Rift.debugWin();               // kills the arena boss through normal damage
// Resolve any level/item choices, collect the rewards and return to the world.
```

Other shortcuts: `G.Forms.debugMegaEvolve()`, `G.Game.debugSetTime(899)`;
`G.Rift.schedule` shows whether a crossed threshold is waiting behind a world
boss/portal. Starting again with `G.Game.startRun()` must produce normal Lucario.
Repeat with partner 25 to verify Bond fallback.

Debug controls require **both localhost and `?debug=1` on the source page**.
That session disables cloud initialization, database writes, achievement events
and leaderboard submission. Production builds keep `G` private and remove the
new hooks, even if the URL includes `?debug=1`. Changes to the guest save remain
in memory only. Automated co-op tests use simulated peers, not live accounts.

## Automated checks

The Node test suite has no new dependencies. On PowerShell (which does not expand
globs for Node), run:

```powershell
$tests = Get-ChildItem tests -Filter *.test.cjs | ForEach-Object { $_.FullName }
node --test $tests
```

Restricted Windows environments that block Node's realpath lookup can add
`--preserve-symlinks --preserve-symlinks-main` before `--test`.

Optional browser automation uses Playwright only in the ignored tools cache:

```sh
npm install --prefix tools/cache/browser --no-save --package-lock=false playwright
node tools/test_mega_browser.cjs
```

It launches installed Edge in an isolated profile (set `PLAYWRIGHT_CHANNEL=chrome`
for Chrome), serves the local repository, blocks external requests, and verifies
portal entry, boss death, state preservation, the stone, reset, fallback, touch
layout, clock crossing and production privacy. Screenshots and JSON results go to
`tools/cache/mega-browser/`. Build production first for the final privacy check:

```sh
node tools/build.js
node tools/export_data.js
python tools/make_seo_pages.py
```

Coverage includes all persistent ability inverses, generic form/reversion behavior,
normal and shiny PNG geometry, every scheduled event, failed placement, arena
queueing, cached red pixels, normal-rift regression, defeat, idempotent rewards,
host authority, real co-op frame serialization and remote Player updates.

Browser automation covers a local guest and simulated keyboard/touch/gamepad
inputs; real-device touch/gamepad behavior and live WebRTC latency remain manual
playtest checks. Balance multipliers are first-pass tuning, not a full balance study.
