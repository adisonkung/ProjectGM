# Elira — Hearthlight Sanctuary Ultimate visual review

Status: PROVISIONAL_REVIEW; Final Sync and balance approval pending. User supplied elira_ult.zip and requested Ultimate next. Workbook timing suggestions are design references, not instructions or approved balance.

## Reconciliation

Fresh origin/master72a3f34; task91101f6. Preserved original local S2cc0ed98 on wip/codex-hero-elira-s2-local, rebased onto identical-tree published S2. Existing roster10/registries and Elira healer kit retained. Publish only wip/codex-hero-elira; no master merge or new confirmed canonical-local sync.

## Sources and reproducible extraction

Unmodified extracted sources are in this session's attachments/ef1a9a1d-8322-44d4-b01f-f20e3d47cf4d/extracted directory. Supply these originals again when rebuilding elsewhere; source files are not committed under read-only art/incoming.

| File | SHA256 |
| --- | --- |
| Ultimate Character Action Only.png | b1ef7e730a2a546b5fe072a77ce6e1994be7c6d6d9b25edba0281460cf834269 |
| Ultimate Charge VFX only.png | 5ecaeacb411d9dee13bfe7e77ceb73a402e84fe1b5ca0774f41c794627906c5f |
| Ultimate Dome Formation VFX.png | ac490d48bcc57db07582de9c2fc03d8e525feec0f9a69dc3ae3d09da2f0639ec |
| Ultimate Field Dome Loop VFX.png | b78787d793806934829bbf56fc3dfd0bd886e9595bfdeafac35212bd33f0c4a1 |
| Ultimate Dome Dissolve VFX.png | 87d0bb33c2d1de65c7741717e9522e1887d21379e7c6a82885e592c59d2f2630 |
| ELIRA_ULT_UNIVERSAL_TIMELINE_V2.xlsx | e3b8ed82e24ddfc401ff881d1136761a05986eb654db1832c2a83a67c3d6375b |

With Pillow/numpy/scipy/skimage dependencies, run elira.py with positional base/sprite/portrait/S1/S2/Ultimate directories; run elira_ult.py with Ultimate source and sprite output directories; then npm run sprites:optimize. Combined character bake requires all supplied skill sources. Character10poses2×5 becomes row7 of10×8/260×170 atlas,body78px,scale.21081081081,root130,155. Earlier seven rows are pixel-identical.

Charge10 stages preserves real transparency (including indexed tRNS); Formation/Loop8 stages preserve true alpha. Dissolve8 uses existing magenta recovery. Hidden RGB is not keyed green. Derived-only segmentation removes tiny fragments and alpha<16 noise. No originals edited or new art invented.

Portrait source domes are projected with separate horizontal/vertical scales into the wide board footprint. Formation uses full final stage as reference; Dissolve uses first full stage; Loop normalizes the full envelope per stage to hold size. All share520×440 padded frames/root260,335; visible target484×330,fit6cells,dy35%cell. This is a runtime derivative, not a claim that source frames already match the proposed1024×704 export. Every derived stage fits transparent guards; source bounds are printed by the generator. Charge112×157,pivot.5,.89172,fit1.5cells,dy27.25%;10×40ms.

## Timeline and gameplay

Trial12FPS/F7 activation replaces base fallback.34s nominal/.35s engine with.50s:engine activation+0.15s. RecoveryF9=.6667s,end.8333s(engine.85s),cast lock+0.2383s. Basic/S1/S2 unchanged. ChargeF2 is observed at.10s on fixed50ms step and ends.50s.

Formation starts once at actual FIELD_STARTED.50s;8×100ms,Loop begins1.30s and persists independently of character animation until actual expiry6.50s. Dissolve8×100ms plus300ms final fade ends7.60s. Generic opt-in loopAfterStart preserves other heroes' concurrent field playback. RECT_6X3 presentation uses exact midpoint2.5/12.5,centre lane.

Existing6×3 home zone,6s,20%incoming damage reduction retained. No heal/revival/shield/launch/tick/end damage added. Six FIELD_PULSED lifecycle notifications have empty effect lists. DAMAGE animation marker remains the generic activation clock, not a damage event. Aura applies immediately on occupancy queries; movement/death/expiry remove protection. Natural expiry plays Dissolve once; source death,stage clear and reset cancel all owned effects/pending Loop immediately under existing engine policy.

Mirrored lab swaps fixture side,wave and required-enemy membership together,preventing stage completion from cancelling the left-facing cast. Four allied targets show the home-zone footprint. No save data touched.

## Validation

App/spec/sim typechecks,optimizer,707/707 Karma,production build and Elira-team10-run/floor/bot smoke are recorded in the latest handoff. Tests cover sequential ownership/true midpoint/duplicate events/expiry/source death/reset,actual F7 field lifecycle in both home zones,no damage/healing/shield/projectile,plus prior healer and field regressions. Native DPR2 Pixi/DOM captures test both facings,expiry and reset during Charge/Formation/Loop. Review artifacts and verification.json live in ignored tmp/elira-ult-preview; recordings remain provisional visual reviews.

Current character-size correction supersedes earlier source scale numbers: see [HERO_SCALE_REVIEW.md](HERO_SCALE_REVIEW.md). Timing/VFX and Final Sync status are unchanged.

Current targeting supersedes the home-zone behavior above: lowest-HP% living ally is selected; the fixed field centres on their activation-time position. See [ELIRA_ULT_TARGETING.md](ELIRA_ULT_TARGETING.md).
