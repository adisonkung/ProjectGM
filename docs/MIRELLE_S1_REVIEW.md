# Mirelle — S1 Frost Needle · provisional visual review

Current status (2026-10-17): the user subsequently authorized Final Timeline Sync and slightly longer weighted motion. See `MIRELLE_FINAL_SYNC.md` and `docs/timelines/mirelle/`; provisional timing and stop notes below describe the earlier review stage.

User authorized S1 production and an in-game preview on 2026-10-17. This is the individual skill review step after Phase A, before final S1 Timeline Sync. S2 and Ultimate production remain out of scope.

## Sources and cuts

`mirelle-s1-source.zip` supplies the originals, copied byte-for-byte to read-only, gitignored `art/incoming/mirelle/s1/`:

| Source | Size | SHA256 |
|---|---|---|
| `s1_character.png` | 1448×1086 | `c5e2d730ae5c430bfda3c7f2c19333ebc937e26f0b86b598aab3d20aa48ecd99` |
| `s1_projectile.png` | 1448×1086 | `a380a8e1b912fb318a4afae26ee4a97574c765602b759e3dafd61f14785bf288` |
| `s1_impact.png` | 2508×627 | `731b4d4b672c803915cc33095dbbe63db632bbba9f3089f963c4996f71b58ae4` |
| `MIRELLE_S1_UNIVERSAL_TIMELINE_V2.xlsx` | supplied workbook | `b2f745f162d3b9df3b1acd9a066f6bfa3b54678f19b52ad1f0e3f90873b272a9` |

The workbook is a supplied proposal, not a final timing approval or an instruction to implement physics/miss/network systems. Its source filenames and missing-impact notes are stale relative to this ZIP. Repository combat and the user's review workflow remain authoritative.

- Character: `tools/sprites/mirelle.py`, 2×5 source poses → atlas row 5 with 10 poses. Match the approved base body height (78 px), root (130,155), shared torso stabilisation. Zero clipped pixels. The original five base rows are pixel-identical after padding to 10 columns. Atlas is now 2600×1360 (10×8, cells260×170); rows 6–7 stay empty.
- Projectile: `tools/sprites/mirelle_s1.py` respects existing alpha (hidden green RGB is not an opaque backdrop), removes faint isolated dust, assigns connected components to source centres instead of equal-grid slicing. Source stages 1–2 are circular buildup; review flight uses stages 3–8. Needle tip stays at the flight point. Six flight frames plus a transparent terminal frame prevent a duplicate contact burst. Output `fx-mirelle-s1-projectile.png`, 7×116×50 (56 px peak visible width).
- Impact: magenta-matte removal/unmix, 8 source stages, centred separate strip `fx-mirelle-s1-impact.png`, 8×68×68 (64 px peak visible width). No large explosion or additional generated VFX.
- No redesigned character, recoloured costume, invented approved art, skill icon, or new charge asset.

Bake from repository root (shared dependencies numpy/scipy/scikit-image/Pillow):

```bash
python3 tools/sprites/mirelle.py
python3 tools/sprites/mirelle_s1.py
npm run sprites:optimize
```

This cloud session uses `PYTHONPATH=/tmp/mirelle-python-deps` for the existing scikit-image dependency. No source pixels or source workbook were overwritten. No new Sync Sheet, final timeline JSON, or spreadsheet was generated.

## Review playback and gameplay boundary

- S1 uses uniform 12 FPS for its 10 poses. Semantic `CAST_START` at start; `PROJECTILE_SPAWN` / `DAMAGE` launch marker at pose F7; recovery at F9; end derived from clip length (~0.833 s). These are provisional review settings, not approved final timings.
- Existing engine convention: `DAMAGE` in projectile clip data schedules launch. Actual damage and Slow resolve at target arrival; `IMPACT` presentation also comes from arrival. No raw frame checks were added.
- The existing hero projectile scheduler uses `0.1 + 0.06 × cell distance` seconds. No new physics/hitbox/collision/miss mechanic or hero-specific engine conditional was introduced. Projectile launch still uses the renderer's existing cell-centre origin; exact hand/focus origin refinement remains part of review.
- Impact starts from the real engine impact event, not a separate `hitFx` timer. One projectile, one damage application, one Slow, one contact effect. A dead target receives no damage/status or target impact.
- The kit, damage coefficient, cooldown, Slow values and Chill condition remain unchanged. Chill is checked on arrival. S2 and Ult explicitly reuse the same `AnimDef` object as normal attack, preserving their earlier timing instead of inheriting the new S1 fallback. Their assets remain pending.
- S1 clip length/release changes affect Mirelle's cast-lock and performance relative to the base fallback. Mention this in the commit; do not interpret simulations as a balance decision.

## Preview

`/sprite-lab?hero=mirelle&compare=kael,garrick&enemy=forest_slime&bg=forest-1&distance=4&render=pixi`

The existing sprite lab now supports data-driven single-target PROJECTILE previews with the same board/projectile/FX renderers. It shows only the primary target's reaction at arrival, cancels scheduled visuals when switching/resetting, and can mirror/slow playback. `distance=1..5` is lab-only; fallback clips sharing the basic-attack object are omitted from produced-skill buttons. No save or combat changes.

The lab is a visual demo, not a combat simulation; its floating damage number is an existing fixed sample. Gameplay correctness is checked in engine specs. Actual recordings in ignored `tmp/mirelle-s1-preview/` include normal-speed MP4/GIF, half-speed close-up GIF, and Pixi/DOM/right/left screenshots. Clips were captured from the running game, with no generated replacement scene.

### Readability revision after user review

The user reported blur and an undersized skill. The original close-up GIF came from CSS-resolution screenshots (896×281) despite a DPR2 browser; cropping and enlarging that raster plus GIF palette reduction made it a poor sharpness reference. The game character is still genuinely a small ~78 px body sprite; the preview cannot restore source-art face/costume detail lost in that established downsample. Visible RGB and alpha in the optimized character WebP are identical to the baked PNG (lossless), and the renderer uses nearest sampling for this sheet. No character redesign, global renderer change or character scale change was made.

Rebake supplied S1 art at projectile peak width 56 px (previous32, ×1.75) and impact64 px (previous32, ×2). Existing runtime scale, frame count, event/recovery timing, projectile flight, kit and statuses are unchanged. New captures in `tmp/mirelle-s1-readable/` use device-resolution DPR2 PNG frames and native-resolution PNG close-ups/MP4, avoiding the old CSS-raster enlargement. Final S1 timing remains pending review.

## Validation and stop point

- App and spec typechecks passed; full Karma/Chromium **635/635 passed**.
- Tests cover one real-sprite projectile/contact, no damage/Slow at launch, Chill arriving during flight, dead-target behavior, unchanged unproduced fallback timing, and lab single-target scheduling/reset/mirroring.
- `sprites:optimize` completed; production build passed (existing CSS budget/CommonJS warnings).
- Mirelle-team `hero-sim -- 10 --team=bailong,yuezheng,mirelle,tangxun,linxue --stats` completed. Balance remains deferred; logs are smoke evidence only.
- Playwright at DPR2: all five units use Pixi, DOM fallback also checked, base actions and mirrored S1 checked, zero page errors.

Stop here for user review of S1 action, projectile identity/size and impact. Final S1 timing/Timeline Sync comes only after that review; do not proceed to S2 or Ultimate production.

Subsequent user steering requested S2 assets and supplied `mirelle-s2-source.zip`; S2 provisional production is recorded separately in `MIRELLE_S2_REVIEW.md`. The shared atlas expands to 20 columns with base/S1 pixels unchanged. No final S1 timing approval or Sync Sheet is inferred from that progression.
