# Ascension V1 — before/after simulation

Baseline `fef69f1` versus specialist mechanics `0da23aa`. Each side: 3,600 battles, 360 combinations, 10 seeds each; same shipped roster, star/profile stats and native animation timings. No development-only full-ultimate start. AUTO is the default formation/hero AI; TACTICAL is the existing general-purpose bot, not a boss-specific policy or the best possible human play.

## Starter AUTO (same five heroes)

Bai Long / Yuezheng / Moye / Tang Xun / Lin Xue. Entries show old wins → V1 wins; V1 average elapsed time (losses included).

| Profile / dungeon | Aegis | Jadecrest | Solar |
|---|---|---|---|
| Lv5 Basic, Tier II | 10/10 → 10/10; 68.9s | 10/10 → 10/10; 119.8s | 10/10 → 0/10; 38.5s |
| Lv5 Basic, Tier III | 10/10 → 10/10; 82.5s | 10/10 → 0/10; 142.4s | 0/10 → 0/10; 36.9s |
| Lv8 Mid, Tier III | 10/10 → 10/10; 72.3s | 10/10 → 10/10; 106.5s | 10/10 → 10/10; 128.8s |
| Lv10 Epic+10/rank5/3★, Tier III | 10/10 → 10/10; 55.4s | 10/10 → 10/10; 83.7s | 10/10 → 10/10; 71.2s |
| Lv10 Epic+10/rank5/6★, Tier III | 10/10 → 10/10; 57.6s | 10/10 → 10/10; 69.7s | 10/10 → 10/10; 57.8s |

## Lv8 Mid / Tier III — composition sensitivity

Ten AUTO runs each. These are diagnostic sample parties, not certified optimal specialist builds.

| Party | Aegis | Jadecrest | Solar |
|---|---|---|---|
| starter | 10/10 | 10/10 | 10/10 |
| break | 10/10 | 10/10 | 0/10 |
| ranged | 0/10 | 0/10 | 0/10 |
| sustain | 10/10 | 10/10 | 10/10 |
| burst | 0/10 | 0/10 | 0/10 |

## Interpretation and remaining balance work

- Aegis can become faster for an interrupt-capable starter party because it correctly earns the new core-exposure reward. This is intentional counterplay, not a universal boss-stat increase.
- The low-level starter party no longer automatically clears Jade/Solar Tier III; its existing interrupt tools still answer Aegis.
- The developed starter party keeps AUTO farming across all three Tier III encounters. This does not imply that every max-equipment composition can farm every boss: the ranged sample still struggles with Solar's sustained party damage.
- **Lv8 Mid starter still clears all three in this sample.** Thus this pass differentiates mechanics and responses, but does not prove the stricter design target that newly unlocked content always requires roster swaps. Further pressure/cooldown/hero-roster calibration remains open. No hidden level gate or named-hero requirement was introduced to manufacture that result.
- Ten seeds per combination show reproducible trends, not a production player win-rate estimate. Potential is B throughout; NEAR_MAX is the existing gear simulation profile, not an exhaustive search over every affix/potential. Simulations start encounters directly and do not model resource farming/unlock journeys.
- Generic TACTICAL can perform worse than AUTO; its choices are not treated as optimal human decisions.

Raw data: `baseline.json` and `mechanics-v1.json`. Reproduce the current audit with `npx tsc -p tsconfig.sim.json` then `node tools/dev/ascension-mechanics-audit.cjs dist/ascension-mechanics-results.json`.
