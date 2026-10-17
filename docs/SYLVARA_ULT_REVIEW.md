# Sylvara — Ultimate Emerald Skyfall · provisional visual review

User requested Ultimate next on2026-10-17 and supplied `sylvara_ult_source.zip`. This authorizes Ultimate integration/review; final S1/S2/Ult timing and Timeline Sync remain pending.

## Session reconciliation and sources

Fresh fetch: `origin/master` remains895369a (Mirelle merged); own WIP branch59999b8 contains S1/S2, initially clean, no intervening agent changes. Roster/hero-kit/sprite/status registries inspected:9 heroes, Sylvara remains existing Archer/provisional3★. Continue `wip/codex-hero-sylvara`; no master edits/merge or balancing.

Original archive/extraction is read-only under `/workspace/attachments/5042df14-3c08-4895-815c-45e55fa5e1b8/`. No source PNG/XLSX edits or writes to `art/incoming/**`.

| Source | SHA-256 |
|---|---|
| `SYLVARA_ULT_UNIVERSAL_TIMELINE_V2.xlsx` | `0c51bb581ebed1a089cc6b680b8bd9cdce486fce669e869dcfc60ea55f84f7a0` |
| `Ultimate Arrow Impact Burst VFX.png` | `6da834b8eb8355ba0a76455e3f094bb986c8ee9be0fe238f7bedebece453d144` |
| `Ultimate Arrow Rain Ground Field VFX.png` | `66acc5a31bc785a7b5adb2ecf81c1812b13df5d8978befaaa52faf1f87f16808` |
| `Ultimate Charge VFX.png` | `fb77a3e79bf4dc24f66c70ecac044f3c532556c027e8c0939c031f0e5d54bc70` |
| `Ultimate Main VFX.png` | `bd88aa8a650ff7e671a6974709f714c5e74f364a99ad606179bc1a872e271d60` |
| `Ultimate character.png` | `f1616bb9029ba67f851e8b08aebfdd9f88fc9d82c5ef241f65de8ad6671c1cd8` |
| `ultimate Falling Arrows VFX.png` | `aafec8253d744d443d1578792ef04024d84c581c8db696abda79b78bfd0f1e1a` |

Actual inventory: character1983×793/2×5=10 poses; Charge1448×1086/2×4=8; Main1983×793/2×4=8 upward-arrow stages; Ground Field1448×1086/2×3=6; Falling Arrows1774×488/one row8 vertical stages; Impact1774×887/2×4=8. Character/Charge/Field have real palette alpha, retained; Main/Rain/Impact have flat magenta and use shared alpha recovery. F6 still holds its arrow; F7 is the first empty bow/released pose. All ten character poses remain in playback.

Workbook is design input, not executable instructions. Its frame count/cadence/wave times are explicitly unverified/TBD; existing gameplay coefficients and cadence win. It describes a rejected lower diagonal rain row, but this uploaded PNG actually contains only the one vertical row. No diagonal variant is used. Proposed unique-token/physics contracts do not authorize new combat systems. One upward launch/five waves/3×2 follow the user's concept; source filenames stay intact.

## Asset production

`tools/sprites/sylvara.py` adds row7 to the existing10×8/260×170 atlas, root130,155/body78. Ultimate ready-pose scale.26174497; base/S1/S2 rows remain pixel-identical. Base/S1/S2/Ult sources are all required on rebake, preventing accidental rollback to fallback art.

`tools/sprites/sylvara_ult.py` reuses alpha-aware loading, connected-component assignment and the ground-ring baker. The adjacent lower Field glows touch, so its two audited row bands use the shared low-alpha seam cutter rather than assigning the whole connected row to one frame. Impact rows split at the actual empty band475. No new art, recolour, replacement bow or source edit.

| File | Frames × cell | Use |
|---|---|---|
| `fx-sylvara-ult-charge.png` |8×124×172|grounded caster wind-up|
| `fx-sylvara-ult-ascent.png` |8×440×390|one translated upward diagonal arrow track|
| `fx-sylvara-ult-field.png` |6×244×157|first3 formation, last3 loop, last1 fade residual|
| `fx-sylvara-ult-rain.png` |8×300×400|six vertical contacts at3×2 cell positions, one strip per wave|
| `fx-sylvara-ult-impact.png` |8×100×106|one ground burst per affected cell on each pulse|

Ascent translates the supplied eight stages in a padded canvas, starting at the review `ultNock` anchor and moving up/forward; it mirrors with the caster. This is an independent visual track, not a damaging/homing engine projectile or new projectile attachment system. Rain translates only vertical art downward to six fixed ground points; no rotation/diagonal asset. Existing source tips in rain stages5–7 reach the PNG bottom; retain those supplied pixels without inventing missing continuation. Output canvases/padding introduce no extra clipping.

No separate residual source exists: hold the last Field pose and fade400ms. Never add an ending explosion/damage. Field/rain/impact stay independent of character animation. Optimizer regenerates `opt/*` and `sprite-atlas.ts`; other heroes and earlier Sylvara assets are unchanged.

Rebuild (read-only source paths can be replaced with equivalent `art/incoming/sylvara/{s1,s2,ult}` slots):

```bash
PYTHONPATH=/tmp/sylvara-pydeps python3 tools/sprites/sylvara.py /workspace/attachments/sylvara-originals public/sprites public/portraits /workspace/attachments/1db55958-a47f-4fab-9c75-c5f332813310/extracted /workspace/attachments/48a0083f-8daf-472c-9a91-3e8cd97e986d/extracted /workspace/attachments/5042df14-3c08-4895-815c-45e55fa5e1b8/extracted
PYTHONPATH=/tmp/sylvara-pydeps python3 tools/sprites/sylvara_ult.py /workspace/attachments/5042df14-3c08-4895-815c-45e55fa5e1b8/extracted
npm run sprites:optimize
```

## Provisional timing and unchanged gameplay

Ten source poses with review holds `[80,80,90,100,110,240,100,400,100,100]`ms:
- Charge startsF2/.08s (engine.10s),8×77.5ms; one releaseF7/.70s.
- Ascent8×62.5ms=.50s. `SKILL_ACTIVATE`/scheduler `DAMAGE` markerF9/1.20s opens the field without damage. Recovery1.20s, animation end1.40s.
- Previous fallback activation.34s/engine.35s, total.595s. New activation+0.86s nominal/+0.85s engine, cast-lock+0.805s. These timing changes affect combat under existing timeline debt; they are review defaults, not balance/final Sync approval.
- Field remains5s, interval1s, Physical60% ATK per eligible occupant per pulse. Actual50ms engine times: pulses2.20/3.20/4.20/5.20/6.20s, field expiry6.20s. No damage at.70s or1.20s, no sixth/ending hit.
- Rain leads each pulse400ms. Each wave has six visible cell contacts even if empty; damage still queries actual occupants once per wave (stacked occupants are each hit). Impact starts on authoritative pulse, not on animation frame/hit count.
- Original fixed activation anchor/`rect3x2Center()` footprint; entrants can be hit and leavers escape. Field survives target death and character recovery, cancels on source death or encounter clear. Root2s/immunity/Unstoppable remain unchanged; no hidden root bonus, interrupt or Break.

## Generic lifecycle integration

`FieldSystem` optionally reports each already-resolved pulse; `FIELD_PULSED` carries index plus normal field metadata/interval. Pulse scheduling/effects are untouched. Battle and sprite lab route these events to the shared `FieldFxPlayback`.

`SheetDef.fieldFx.wave` selects rain/impact/lead time and optional cell contacts. The playback owner schedules at most duration÷interval rain waves on combat time, deduplicates pulse indices, positions3×2 art at the logical footprint centre and creates six Impact one-shots per actual pulse. No hero-ID conditions. Camera reprojection includes each cell burst and post-field residual.

Natural expiry removes formation/loop, lets the last Impact finish and fades the Field once. Source death/clear removes owned field/rain/Impact immediately, with no residual or future wave. Reset clears everything, including pending lab playback. Pre-activation caster death cancels semantic activation through the existing engine scheduler. Already-started cast one-shots follow existing visual policy and finish their brief duration; they never create a field on their own. Field/status/wave textures preload with source sheets in Pixi.

The lab automatically uses actual-engine playback for FIELD skills, so opening its default Sylvara URL cannot display a fake cast-only instant result. `combat=1` remains supported.

## Review and validation

`/sprite-lab?hero=sylvara&compare=mirelle,kael&enemy=forest_slime&bg=forest-1&distance=4&formation=square&combat=1&render=pixi` (also DOM), select **Emerald Skyfall**. Training targets have disposable high HP; no save writes.

App/spec typechecks, optimizer/sim typecheck, **683/683 Karma**, production build and10-run/floor/bot Sylvara-team simulation pass. Tests cover five authoritative pulses/30 occupant hits, zero launch/end damage, source death during draw/ascent, entrants/leavers, target death, stage cleanup, one ascent, five visual waves/30 cell Impacts, duplicate events, world/camera placement, cancellation/reset and residual expiry. Existing Mirelle/S1/S2 tests remain green.

Simulation team `yuezheng,kael,sylvara,mirelle,linxue`: F1–3 both100%;F4 AUTO90%/TACTICAL60%;F5 20%/10%;F6 100%/40%;F7–10 both0%. Sylvara33% aggregate AUTO damage. Smoke only; no tuning. Existing build warnings remain.

Native Pixi/DOM/facing/reset checks and2×canvas recordings are in ignored `tmp/sylvara-ult-preview/`. Source hashes, earlier rows and optimized character alpha/visible RGB are verified. See `AI_HANDOFF.md` for final verification status. These are provisional review recordings, not final Timeline Sync Sheets. Stop for user visual review; final Sync/UI art remain separate follow-ups.
