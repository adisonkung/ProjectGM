# Jadecrest actual-game visual review — 2026-10-31

- Desktop1440×900; mobile landscape932×430, DPR1, real Angular battle/Pixi renderer.
- `references/`: the exact approved standalone S1 V4, S2 V5 and S3 V6 preview stills. They are not gameplay screenshots.
- `01-placement`, `02-s1-charge`, `03-s1-impact`, `04-s2-flight`, `05-s2-landing`, `06-s3-charge`, `07-s3-roar`: actual game captures, with corresponding mobile captures.
- `08-break` / `08-break-held` / `09-recovered` / `10-death`: isolated browser validation through real engine status/damage paths. Break100 and fatal damage were injected for presentation checks; this does not assert that a particular hero skill has Break100.
- `11-reference-game-comparison.webp`: approved preview on the left, actual game on the right. Full images retain their own proportions. Frames are nearby moments of each sequence, not identical animation timestamps.

Browser fixture uses a disposable context, unlocks dungeons, disables hero automatic skills, raises fixture hero HP and lowers their ATK. Only fixture memory is affected, not production stats/save data. Cooldowns are selected one skill at a time to capture the actions. The verification JSON records cast state, travel, positions, FX names, offsets, layers and application page errors.

Visual differences retained: the supplied source camera angle changes between idle/stomp and walk/pounce/roar/death. Runtime art is normalized to a shared feet anchor, but no replacement art was generated to hide that angle change. The original landing sprite has some clipped cell edges; feathered boundaries and code-generated full ellipse replace the hard cutoff. Effect size in the real board follows the documented provisional logical areas, not the illustrative 240px preview grid.

Validation: source hashes and strip dimensions in `asset-validation.json`; build/tests in `checks.json` after completion. Gameplay data/timings are in `docs/JADECREST_INTEGRATION.md`.
