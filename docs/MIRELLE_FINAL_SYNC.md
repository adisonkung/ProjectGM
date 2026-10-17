# Mirelle — Final Timeline Sync

2026-10-17, Codex. The user authorized Final Timeline Sync from the previously supplied workbooks, then explicitly allowed slightly longer motion for smoother playback. Final character/action and VFX timing is now authored for all three skills. Gameplay coefficients/status values remain provisional pending the roster balance pass.

## Source reconciliation

The supplied workbooks are the design sequence/event reference, not a literal copy of every draft frame number. Original XLSX files remain unchanged under read-only `art/incoming/mirelle/{s1,s2,ult}/`.

| Skill | Original workbook | Final character mapping |
|---|---|---|
| Frost Needle | Actual10 poses; proposed releaseF7 at500ms | All10 poses; releaseF7 at500ms, recoveryF9 at665ms, end900ms |
| Glassbind | Hypothetical10-pose sequence; proposed activationF7 | Actual20 poses; activationF13 at1000ms, recoveryF17 at1360ms, end1800ms |
| Winterglass Field | Explicit10 placeholders; proposed activationF5 | Actual20 poses; chargeF3 at160ms, activationF15 at1200ms, recoveryF18 at1490ms, end1800ms |

S2/Ult activation mapping follows the actual source poses and the reviewed implementation. Final weighted holds retain every supplied pose and add readable anticipation/recovery. Relative to the reviewed uniform12FPS clips, total cast-lock increases by about67/133/133ms. S1/S2 activation times are unchanged; Ult nominal activation moves1166.667→1200ms, matching its already-observed1200ms engine activation. This is an authorized timing change, not a DPS retuning or a change to another hero.

The source workbooks' collision/network vocabulary, optional S2 persistent field, stale missing-impact notes and hypothetical skill IDs are reconciled to the existing repository. No new collision/miss/network system, S2 DoT, new skill IDs or burst Ult is introduced.

## Semantic timing and independent effects

The Sync Sheets sample at60FPS. Exact authored milliseconds are stored in `sprites.ts`, JSON and the Character/Game ms table. The existing combat engine resolves scheduled events in50ms steps; the workbook's **Nominal vs Runtime** tab shows both clocks. A60FPS sample is not an instruction to retime the engine.

- S1: `PROJECTILE_SPAWN` at500ms. The legacy clip `DAMAGE` marker schedules launch, not health/status application. Actual damage/Slow/Impact is on arrival. At the documented distance4 fixture, flight is340ms and actual combat contact is850ms. Variable range changes contact time; the fixed contact row in this example is not a global hard-coded hit time.
- S2: one authoritative2×2 application at1000ms, Main at the same event, Bind only on successful Root of a previously Chilled target. Main/Bind strips each last800ms; actual status duration remains independent. No field loop/periodic damage.
- Ult: charge nominal160ms, observed200ms; charge lasts1000ms, handing off to the field at1200ms. Formation lasts800ms; supplied8-pose field loop starts at2000ms, cycles every800ms and remains until natural expiry at7200ms. Character recovers/returns idle at1800ms while the field continues.
- Ult pulses at2200/3200/4200/5200/6200/7200ms in the fixture, six light pulses. Natural expiry removes the loop and plays the large640ms shatter plus650ms residue/fade. Neither opening nor ending adds burst damage. Source death/clear policies remain unchanged.
- Larger Charge/Impact, new Portrait/icons/Banner, source pixels, pivots and visual sizes from prior review are retained. No sprite rebake is needed for this timing pass.

## Deliverables and reproduction

Generated and committed under `docs/timelines/mirelle/`:

- `mirelle_s1_final_sync.{png,xlsx,json}`
- `mirelle_s2_final_sync.{png,xlsx,json}`
- `mirelle_ult_final_sync.{png,xlsx,json}`

Each workbook includes per-frame sampling, exact character holds, VFX tracks, actual combat events, layers, source reconciliation and nominal-versus-observed times. JSON includes source workbook SHA256, runtime clip/FX definitions and the isolated real-engine event trace. The scene uses distance4 and a pre-Chilled primary training target to exercise synergy; it does not alter a save or the kit.

```bash
PYTHONPATH=/tmp/mirelle-python-deps npm run mirelle-sync
```

`tools/dev/mirelle-sync.ts` reads runtime data and uses the existing pure FX/projectile samplers plus `skillReview` real-engine casts. `mirelle_sync.py` renders60FPS asset-verification videos and calls the existing `ult_sync_sheet.py` for PNG/XLSX. Videos under ignored `tmp/mirelle-final-sync/` are synchronized asset playback on a verification grid, not claimed as in-game screenshots. The shared sheet tool now accepts font paths and per-sheet layer notes; defaults for older heroes are retained. Without Loma, the generator merges installed Noto Latin/Thai fonts temporarily (fontTools) to avoid missing-glyph squares.

Other requirements: Pillow, openpyxl, ffmpeg, source XLSX files and the already-baked public sprites. No source art or source workbook is edited, no replacement approved art is generated, and no generated sheet is hand-edited.

## Validation

App/spec/sim typechecks, **652/652 Karma**, production build and Mirelle-team10-run/floor simulation passed. New contracts verify authored event/total times, exact pose sequences, distance-dependent projectile contact, one S2 hit and six Ult pulses beyond character end. No other hero, rank table, class, gameplay coefficient or engine mechanic changed. Existing balance issues are deferred.

Native DPR2 actual-game captures are in ignored `tmp/mirelle-final-sync-game/`: complete Ultimate replay, Pixi/DOM S1/S2 and mirrored/reset checks, zero page errors and zero leftover field views. Source workbook hashes, all pose sequences, runtime hold totals, FX paths, workbook tabs and the field-loop visibility windowT120–T431 were verified. Only previously baked approved art is used; no sprite pixels changed in this pass.

`mirelle-production.ts` now marks all three clips `FINAL_SYNC` and links these sheet stems. Prior Phase A/review notes are historical; this document and current runtime data supersede their provisional timing/stop notes.
