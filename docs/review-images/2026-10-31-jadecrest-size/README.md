# Jadecrest +25% character-size review

User requested a larger boss and actual in-game shots of the casting ring with heroes present.

- `desktop-s1-charge.png`, `desktop-s3-charge.png`: real 1440×900 battle screenshots, DPR1.
- `mobile-s1-charge.png`, `mobile-s3-charge.png`: real 932×430 landscape battle screenshots, DPR1.
- These are not composited previews. The fixture uses a disposable browser save and changes only hero HP/ATK, automatic skill modes and cooldowns so the party can stand near the charging boss safely.
- Only Jadecrest has `displayScale:1.25`. Every character pose is enlarged around its original feet position. No PNG upscaling/cropping/replacement was applied, so source and atlas hashes remain unchanged.
- Both Pixi and the DOM fallback share `unitGeometry`. Body-attached mouth/charge/core/contact offsets and the airborne trail lift follow the larger body; ground rings keep their approved size/position.
- Regression: feet stay at the same coordinate at cell44/80/100 while the sprite width/height grow exactly25%; default-size Aegis is unaffected. Full suite909/909 and both TypeScript checks pass.
