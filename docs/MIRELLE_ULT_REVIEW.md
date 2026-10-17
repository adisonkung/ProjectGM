# Mirelle — Ultimate Winterglass Field · provisional visual review

2026-10-17: user requested Ultimate next and supplied `mirelle-ult-source.zip`. This is individual visual production/review only. It does not infer final timing approval for S1/S2/Ult or create any final Timeline Sync Sheet.

## Original sources and audit

Byte-identical, read-only copies are under ignored `art/incoming/mirelle/ult/`:

| Source | Size | SHA256 |
|---|---|---|
| `ult_character.png` | 1881×836 | `6118fe98e4ea93d84a60b8bbc3b2d66cf9af9b078377eae6d99fa7a0eb8c5f23` |
| `ult_charge.png` | 2172×724 | `c1af412adbb3a43f104a4b4d45f3d540c9efbb813ebec4038bf694958365eefd` |
| `ult_main.png` | 2172×724 | `a2671d530c87b9a1e3674f1ccf283a368202641c05ec56665ac65fbeb00bd597` |
| `ult_impact.png` | 1774×887 | `4f12cf8ff1b67aa4121b321d24471b0f9f01099efdbd1286bf54f46b9b7ef36b` |
| `MIRELLE_ULT_UNIVERSAL_TIMELINE_V2.xlsx` | supplied draft | `f7afb63d911cc6bc623425a57da6f8d06f951625981259819892016797995bfc` |

The character actually has **20 poses, rows8+6+6**, unlike the workbook's 10 placeholders. Its proposed F5 activation and final-shatter suggestions are a draft, not final timing/gameplay authorization. Repository Mage skill IDs, 6-second field and existing cancellation policy remain authoritative.

There is no separate `ult_field.png` or residual/shatter source. For this review, the loop reuses only the formed Main poses7–8 (not the formation/explosion sequence). Residual uses the last four lower-row Main frames. Shatter uses eight breaking/scattering frames from the second/third Impact rows at medium size; the large growing pillar sequence in its first row is unused. No replacement approved art, new design, recolour, meteor or added burst damage is generated. A dedicated seamless field-loop source may improve the final production after review.

## Baking and review assets

- `mirelle.py`: add row7 with all20 character poses; body78px/root130,155, atlas20×8 at260×170 (5200×1360). Zero clipped pixels. Base/S1/S2 rows are pixel-identical to the previous atlas.
- `mirelle_ult.py`: shared alpha-aware chroma recovery, component-assigned frame cuts and ground-ring alignment. Character and all FX roles remain separate.

| Runtime strip | Frames | Cell | Role |
|---|---:|---|---|
| `fx-mirelle-ult-charge.png` | 10 | 76×170 | caster wind-up |
| `fx-mirelle-ult-main.png` | 8 | 204×283 | one formation at the fixed field centre |
| `fx-mirelle-ult-field.png` | 2 | 204×251 | formed-field loop, 3-cell width |
| `fx-mirelle-ult-shatter.png` | 8 | 124×93 | medium visual-only ending, 1.4-cell width |
| `fx-mirelle-ult-residual.png` | 4 | 154×121 | brief ground residue/fade |

```bash
python3 tools/sprites/mirelle.py
python3 tools/sprites/mirelle_ult.py
npm run sprites:optimize
```

This cloud uses `PYTHONPATH=/tmp/mirelle-python-deps` for the existing shared cutter dependency. Optimized assets/atlas are regenerated, never hand-edited. Originals and the supplied workbook stay unchanged.

## Provisional playback and preserved gameplay

- Character: uniform12FPS,20 poses (~1.667s), `CAST_START` at start, chargeF3, activationF15, recoveryF18. `DAMAGE` in clip data is the existing engine's FIELD activation scheduler marker; it causes no launch damage. Actual engine execution is quantized to the existing50ms step.
- Charge10×100ms; formation8×100ms; loop2×200ms begins after the formation's provisional800ms; shatter8×80ms; residue4×100ms plus250ms fade. These are playable review defaults, not final frame-perfect timing or a Sync Sheet.
- Ult cast-lock/activation differ from the previous base fallback and are gameplay-relevant under existing timeline debt. Mention this in the commit. No S1/S2 timing, kit, cooldown, rank, status value, other hero or stage was rebalanced.
- Existing field remains fixed3×3 (`ADJACENT_8`) for6 combat seconds, first light pulse after1s and six pulses total;15% magic ATK per occupant per pulse, movement×0.75 and attack-speed×0.90 for1.1s. No Chill/Root added by Ult. No launch burst or extra damaging finisher; shatter is presentation only. The last normal pulse may coincide with the visual ending.

## Generic field presentation

- `FieldSystem` end events now report `EXPIRED`, `SOURCE_DIED`, or `CLEARED`. This adds lifecycle metadata only; tick/duration/source-death/clear policies remain unchanged.
- `SheetDef.fieldFx` declares formation, loop and optional ending/residual for a caster's fields. `FieldFxPlayback` consumes existing field events, stores the fixed world centre independently of the original target, and reprojects it with the camera.
- Runtime-managed FX lifetimes use combat time. The field loop survives character recovery/animation end. Natural expiry removes the loop and emits ending visuals once; source death or stage clear removes formation/loop immediately with no ending. Duplicate end events are ignored.
- `FxView`/`PixiFx` runtime `managed` and `loop` flags: Pixi loops until owner removal, stops managed views immediately and does not restart completed managed one-shots; DOM uses an infinite loop instance and cancels its animation on destruction. Existing one-shot behavior and `FxDef.repeat` semantics remain unchanged. No raw-frame gameplay checks or hero-specific engine conditionals.
- Field textures and successful-status FX are preloaded with the source sheet. Field visuals create no gameplay effects and have no wall-clock cleanup timers.

## Preview and validation

`/sprite-lab?hero=mirelle&compare=kael,garrick&enemy=forest_slime&bg=forest-1&distance=4&formation=square&combat=1&render=pixi`

Select Winterglass Field. The isolated real-engine replay now runs long enough to observe actual field expiry and residue; its loop option waits for the replay to finish. High-HP training targets keep all four occupants visible; source stats/kit are real. Player saves are untouched.

Validation: app/spec typechecks, full Karma **650/650**, production build and Mirelle-team10-run/floor simulation passed. Tests cover six pulses without extra launch/shatter damage, lifecycle reasons, duplicate/cancel cleanup, world/camera anchoring, no activation after caster death, DOM infinite-loop cleanup, pure Pixi pose sampling and battle/lab field event wiring. `sprites:optimize`, source hashes, unchanged previous rows and zero clipped pixels confirmed.

Native-DPR2 PNG/MP4 recordings are in ignored `tmp/mirelle-ult-preview/`; prefer PNG/video for sharpness. The preview includes charge, formation, sustained field, actual damage/control pulses, expiry/shatter and cleared state; DOM, mirrored playback, reset and earlier actions are checked separately. Captures report zero page errors, zero managed field views after ending and zero DOM loops after reset. Video is native1792×562 at normal speed; the half-speed close-up crops960×562 without resizing.

Stop after this Ultimate preview for user review. All three skills' final timing/Timeline Sync remain pending. Icons/banner and a dedicated seamless field loop are not supplied; do not fabricate them or claim final hero-art production is complete.
