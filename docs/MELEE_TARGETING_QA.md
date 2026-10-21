# Melee targeting: regression and gameplay checklist

This change addresses cases where a distant boss takes targeting priority while
a nearby enemy is within the active melee move's reach.

## Scope

- Melee targeting considers the enemy's physical collision radius.
- Each fused melee move checks its own reach before casting and temporarily
  adjusts the aim without changing the aim of the other fused attacks.
- Automatic melee attacks do not spend a full cooldown on targets outside their
  actual impact range.
- Manual aim, ranged boss priority and the existing wall rules are preserved.

No changes are intended to enemy statistics, weapon damage, attack frequency,
level scaling or reward calculations.

## Automated tests

On Windows PowerShell, from the branch checkout:

```powershell
node --check js/entities/player.js
node --check js/systems/combat.js
node --test tests/melee-targeting.test.cjs tests/melee-collision.test.cjs
node --test tests/*.test.cjs
```

The combat tests execute the actual `player.js` and `combat.js` files inside
a deterministic Node.js VM with lightweight substitutes for rendering, input
and world systems. They cover:

- Collision boundaries, enemy hitbox sizes, target death and movement between
  aiming and casting.
- Moving toward/away from an enemy, blocked movement and immobilization.
- Switching between ranged and melee slots, manual aim changes, target loss
  and recovery, and cooldown cadence.
- Fused attacks, cooperative aim messages, exceptions, and crowd stress.

These are **logic-level tests**, not browser end-to-end tests. Passing them
does not establish real FPS, multiplayer reliability or absence of all gameplay
regressions.

## Manual guest-mode smoke test

Run `py -m http.server 8000` and open
`http://localhost:8000/dev.html` in your browser. Use guest mode.

1. With a melee Pokémon, approach and back away from ordinary enemies.
   Confirm attacks resume immediately when a target enters range.
2. Encounter a boss with nearby enemies. Confirm melee attacks the nearby
   targets while ranged moves retain their existing boss preference.
3. Walk into map obstacles and move around corners. Check that melee doesn't
   repeatedly attack distant enemies while the player is blocked.
4. Switch between melee and ranged slots while moving, including quick
   changes of direction.
5. Toggle manual aiming and then return to automatic targeting.
6. If available, repeat with fused melee/ranged moves and in cooperative play.
7. Watch for stopped attacks, unexpectedly shortened cooldowns, repeated
   empty swings and new FPS hitches during crowded encounters.

## Deliberately unchanged

Melee attacks currently use an area/arc overlap check without the beam's
wall-blocking logic. This PR does not add wall occlusion to melee damage;
that would be a separate gameplay change rather than a targeting bug fix.
