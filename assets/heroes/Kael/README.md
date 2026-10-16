# KAEL ASHEN VANGUARD — UNIVERSAL TIMELINE SYNC V2

**Status:** Integration draft — user confirmed Skill 2 artwork with **14 frames, 2 rows × 7**. **Not** automated/visual QA-approved for sword path, slicing or continuity. 12 animation FPS is provisional.

## Priority and source authority
1. This turn's 14-frame Skill 2 image overrides prior 12-frame JSON.
2. Skill 2 is **impact VFX only** (two instances), not main VFX.
3. Skill 2 hit frames: **F5 horizontal cut**, **F10 rising reverse diagonal cut**, per user's requested timeline. Confirm visual correctness before declaring the frames finished.
4. Ultimate is **Ashen Rupture** (single heavy cut → 1×4 sword wave), never Ashen Breaker combo.
5. Skill 1 hit **F7**; Ultimate arrow/wave spawn **F8**; names Skill 1/2 are working labels pending gameplay metadata.

## Sheet list
- `Overview`: asset authority, parameters and QA gates.
- `Skill1_Timeline`, `Skill2_Timeline`, `Ultimate_Timeline`: one row per character frame with separate character, VFX, hit and runtime columns.
- `VFX_Runtime`: spawn/collision placement and duplication rules.
- `QA`: checklists and status.

## Time math
At example **12 animation FPS** each frame occupies 83.333 ms. Frame start is `(frame-1) / 12`. A 14-frame skill lasts 1166.67 ms, Skill1 and Ultimate 10-frame clips last 833.33 ms. These are **defaults**, NOT locked game data. Read actual fps from engine configuration; update all timestamps when different.

## Asset slicing warning
This source is a 1774×887 raster sheet arranged visually as 7 columns × 2 rows; visible negative space does **not guarantee** equally divided grid boundaries. Never divide into equal 253.43-pixel cells or warp to fit. Detect/crop actual character extents carefully, preserve sword and cape, then repack padded normalized equal cells; inspect every frame visually.

## Scale and rendering
Treat idle pose/body standing height as target and apply one correction per entire clip, not per frame. Full frame bounding rectangles including sword/cape cannot be compared as body height. Use unified Kael ground pivot and bow/sword socket anchors. Keep original approved PNGs untouched; render QA previews before applying changes.

## Delivery gate
No changes to combat asset references before sprite mapping, QA and user acceptance. See `QA_CHECKLIST.md` and `CLAUDE_INTEGRATION_PROMPT.txt`.
