# Basic melee arrival review

[Before: DOM](before.mp4) · [After: DOM](after.mp4) · [After: Pixi](after-pixi.mp4). Actual running game at1440×900, existing Bai Long and first-floor monster; no composited actor art. Frames are retimed against the sampled simulation clock to remove capture slowdown.

The controlled fixture hides other units, disables skills/monster actions, uses durable trainingHP50000 and heroATK1, and starts the hero one cell behind its current logical column. Its native range1 remains unchanged. It runs only in the lab browser's memory, not the save.

Before/after verification JSON records engine positions at attack events. The Pixi capture additionally records the shared drawn contact position during planted frames, and whether the real Pixi layer initialized. The wider-melee and moving-monster early-start cases are covered separately by engine regressions, not by changing the shipped hero's range in this video.

checks.json records final tests/build/typechecks and visual verification. hero-sim.txt records60 shipped-party battles across floors1–10/AUTO/TACTICAL/3seeds; wins are not a balance guarantee and no roster tuning was performed. See [implementation notes](../../MELEE_STOP_BEFORE_ATTACK.md).
