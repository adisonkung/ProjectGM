# Solar arena room review

Reference: committed actual-game screenshots in `../2026-10-31-solar/` (65e064b).

- `desktop-before-after.webp`: labelled, scaled side-by-side copies of the original actual S3 charge screenshots; original screenshots remain available.
- `desktop-s3-charge.png` / `mobile-s3-charge.png`: actual runtime, clean screenshots.
- `desktop-s3-grid.png` / `mobile-s3-grid.png`: the same runtime with a temporary diagnostic grid. Orange rectangle shows columns 10–12 and rows 1–2; O is the lower centre anchor (r2,c11). This overlay is not shipped in the game.
- Other action images and verification JSON cover actual S1/S2/S3, desktop Break/Death, all three arenas and both viewport sizes.

Fixture: only hero HP/ATK, manual skill controls and cooldowns are adjusted for review; Break and Death use real engine methods. Art, collision, movement and presentation run through the actual game. Screenshot pose/timing may differ slightly between runs.

Presentation changes: fixed-arena scenery uses spare desktop height; Solar reallocates .35 rows to sky and retains .45 below. Same square cells and 1.25 boss scale. Constant root +16 lowers the body; eye/muzzle origins move with it. Combat remains 16×3 with a 3×2 stationary boss.
