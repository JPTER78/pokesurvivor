# Healer balance experiment

Scope: only normal-enemy stacked healing. A single healer keeps its current 7% base heal (up to the 12% shared cap). Multiple healers share one 12%-of-max-HP budget per target per 3.5 seconds of gameplay time. Bosses retain the existing received-DPS cap. Enemy HP, damage, spawn frequency, coins and XP are unchanged.

## Try locally

1. Check out `fix/healer-stacking-benchmark`.
2. Run `python -m http.server 8000` (or `py -m http.server 8000` on Windows).
3. Open `http://localhost:8000/dev.html` and select guest mode. Avoid your real cloud account.
4. Test your usual Pokemon and moves on the 3-, 5-, 6- and 10-minute marks. Keep the same equipment and settings for before/after. Use the unmodified `main` branch for the baseline.
5. Record death time, level, kills, boss kills, mean FPS and any healer groups that were impossible to kill.

## Automated verification

```sh
node --test tests/*.test.cjs
node tools/bench-healers.cjs --baseline=main --iterations=20000
```

Benchmark output compares both *actual versions* of `Enemy.healAround()` in a deterministic sandbox; numbers describe healing and the routine's CPU cost, **not real FPS or win-rate changes**. Run it on the same computer without other heavy load, ideally multiple times.

## Trade-offs

Benefits: fewer immortal support groups, supports normal gameplay clock and pause, boss balance remains intact.
Risks: support squads become easier and XP gain may accelerate; the 12% cap is an experimental tuning value. The HP scaling at minutes 5-6 is deliberately untouched, so surviving longer is not guaranteed.
