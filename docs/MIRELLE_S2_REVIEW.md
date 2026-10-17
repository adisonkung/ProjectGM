# Mirelle — S2 Glassbind · provisional visual review

2026-10-17: the user requested the S2 asset checklist and then supplied `mirelle-s2-source.zip` to continue production. This task prepares the individual S2 preview. It does not infer final S1 timing approval, create a final S1/S2 Sync Sheet, or start Ultimate art/timing.

## Read-only sources

Byte-identical copies live under ignored `art/incoming/mirelle/s2/`:

| Source | Size | SHA256 |
|---|---|---|
| `s2_character.png` | 1881×836 | `dae7e2012983989c72e5d8e8d120cfb4e46e44d8beb7131ba892b5bdb093c082` |
| `s2_main.png` | 2172×724 | `42f2730e783f8e1e64aeb4ab8f9bf21ee951ac77be99272da83bfe00e95aa79a` |
| `s2_bind.png` | 1672×941 | `446439a82eb35e21dd9cf7fa85592d5a18ab6c48e831e9a448f7bbc3287b2a23` |
| `MIRELLE_S2_UNIVERSAL_TIMELINE_V2.xlsx` | supplied draft | `d7cb5a6de14dc23c80d2f2cd587982c062397e8db0561fd763ff3bba5ce22602` |

Actual character art has **20 poses, 2 rows × 10**, unlike the workbook's hypothetical 10-frame mapping. The workbook's proposed ID, F7 activation, persistent-field ideas and unverified timing are contextual drafts, not changes to approved runtime IDs or gameplay. No approved art was generated, redesigned, recoloured or replaced.

## Baking and registration

- `tools/sprites/mirelle.py` adds 20 S2 poses to row6. Atlas 20×8 (5200×1360), cell260×170, root130,155 and body78px. No clipped pixels. All base and S1 pixels are identical to the earlier atlas after right-hand padding. The existing Pixi chunking handles the wider sheet.
- `tools/sprites/mirelle_s2.py` reuses S1's alpha-aware source loading and connected-component cuts. Main is magenta-unmixed; Bind preserves supplied alpha. Ground rings share a baseline instead of centring each frame by changing crystal height.
- Main: `fx-mirelle-s2-main.png`, 8 frames, cells148×193, pivot[0.5,0.870466]. `mf-s2-main` uses `groundArea:'SQUARE_2'`, `fitCells:2`, under-unit layer, no attachment/repeats. This visual does not define hit geometry.
- Bind: `fx-mirelle-s2-bind.png`, 8 frames, cells64×84, pivot[0.5,0.869048]. `mf-s2-bind` is a one-shot on the successfully Rooted unit, from the existing `buff` event. It is not emitted on every impact or Chill application.
- Run bake → `npm run sprites:optimize`. Sources remain read-only; generated atlas/optimized files are never hand-edited. This cloud uses `PYTHONPATH=/tmp/mirelle-python-deps` for the shared character cutter dependency.

```bash
python3 tools/sprites/mirelle.py
python3 tools/sprites/mirelle_s2.py
npm run sprites:optimize
```

## Provisional playback and generic presentation

- Uniform **12 FPS**, 20 poses (~1.667s); `CAST_START` at start, `SKILL_ACTIVATE` / `VFX_SPAWN` / `DAMAGE` / `IMPACT` at F13, `RECOVERY_START` F17, clip end derived normally. Main and Bind use provisional 100ms per frame. These are playable review defaults, not final timing.
- This changes Mirelle S2's effective cast-lock/activation from the previous base fallback; mention it in the commit. S1 events/assets and Ultimate's explicit base fallback stay unchanged. No damage/cooldown/rank/status value or other hero balance changed.
- Existing SQUARE_2 damage, pre-hit Chill snapshot, conditional Root, immunity and ranks are reused. Root is applied only to previously Chilled surviving recipients. There is no added DoT, field lifetime, repeating damage, projectile or persistent S2 field mechanic.
- Generic visual metadata only: `FxDef.groundArea` plus `groundFxCell` positions Main from the same `square2Center` geometry as targeting, including orientation/bottom edge. Battle presentation converts grid to screen using formation origin/camera. The captured initial aim is retained for target death during wind-up, matching the existing area fallback.
- Generic `SheetDef.appliedStatusFx` / `appliedStatusFx()` chooses a visual from a successful status event, after immunity/condition handling. Missing mappings/assets skip normally. No hero-ID conditionals were added to the engine/rendering.
- Bind animation is a brief status-application visual, not the authoritative Root timer. Root remains governed by actual status duration and its existing UI icon.

## Preview and checks

With pre-existing Chill on the primary only:

`/sprite-lab?hero=mirelle&compare=kael,garrick&enemy=forest_slime&bg=forest-1&distance=4&formation=square&combat=1&status=chill&render=pixi`

Remove `status=chill` for the no-Chill case. `combat=1` is an isolated, actual-engine replay for INSTANT skills. It uses the real hero stats/kit and four high-HP training monsters, freezes automatic actions from the initial combat step, and never accesses saves. Existing fixed-number visual mode stays available outside this option. Main spawns once at the 2×2 centre; successful Root gets one Bind; actual damage and status icons come from engine results.

Recordings in ignored `tmp/mirelle-s2-preview/`: native DPR2 PNG frames (1792×562), unscaled PNG close-up, normal-speed full-map MP4, half-speed close-up MP4/GIF, no-Chill, DOM and mirrored captures. Prefer PNG/MP4 to assess sharpness; GIF reduces colours. All seven units rendered through Pixi; zero page errors. Logs confirm four Chill applications and one Root with pre-Chill, four Chill applications and zero Root without it.

Validation: app/spec typechecks passed; full Karma **640/640 passed**; production build passed (existing CSS/CommonJS warnings); Mirelle-team 10-run/floor sim completed without errors. Tests cover conditional status/damage, single-cast scheduling, immunity, cast-target death, logical area positioning, orientation/bottom edge, reset cleanup and original kit behavior. Original ZIP source hashes and unchanged base/S1 pixels verified. No final timeline/spreadsheet generated.

Stop for user S2 visual review. S1/S2 final timing and Timeline Sync remain pending; Ultimate art remains pending.
