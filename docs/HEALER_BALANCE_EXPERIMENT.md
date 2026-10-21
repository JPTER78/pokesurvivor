# Healer balance experiment

## Summary

Groups of support Pokémon can repeatedly heal the same enemy, sometimes faster than the player can deal damage. This change caps **combined healing from normal enemy healers at 12% of each target's maximum HP per 3.5 seconds of gameplay**.

A single healer still applies its standard healing when below the shared limit. At sufficiently high player attack multipliers, the cap can also reduce a single healer's heal. Bosses keep their existing damage-per-second-based healing limit.

Enemy health, damage, spawn frequency, experience and rewards are not changed.

## Verify the changes

From the repository directory on Windows PowerShell:

```powershell
git fetch origin
git switch fix/healer-stacking-benchmark
git pull --ff-only origin fix/healer-stacking-benchmark

node --test tests/*.test.cjs
node tools/bench-healers.cjs --baseline=origin/main --iterations=20000
```

Use `node tools/bench-healers.cjs --help` to view the benchmark options. Its output reports healed HP for 1, 2 and 3 healers at three attack multipliers, plus median CPU time per healer cast. **These are not gameplay FPS or survival-rate measurements.** CPU timing differences at the nanosecond scale can be noisy.

## Try it as a guest

1. Run `py -m http.server 8000` from the repository directory.
2. Open `http://localhost:8000/dev.html` and use guest mode, not your official cloud account.
3. Compare against the unmodified `main` version, playing sequentially with the same Pokémon, moves, upgrades and graphics settings.
4. Record survival time, level, enemies and bosses defeated, average FPS, and whether groups of healers can be killed.

Suggested checkpoints: minutes 3, 5, 6 and 10. Several runs per version are recommended because enemy spawns and upgrades vary.

## Benefits and trade-offs

**Benefits:** Multiple healers no longer multiply recovery without a shared target limit. Pausing does not advance the healing window. Boss healing behavior remains unchanged.

**Trade-offs:** Support-heavy groups may become easier, potentially increasing XP gain and survival time. The 12% cap is an initial tuning value, not a final balance target. Regular enemies still have substantial HP scaling near minutes 5–6, so this adjustment alone may not resolve every difficulty spike.

The proposed change does not require any changes to cloud saves, rankings, or Firebase rules.
