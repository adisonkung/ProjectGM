# Current Development State

Git/current registries are authoritative. Query `git rev-parse HEAD` / `HEAD^{tree}`; this note never stores its containing commit or tree hash.

## Latest follow-up — reference-inspired fantasy Home lobby (Codex, 2026-10-19)

User requested the surrounding menus from the supplied Dawnmere lobby reference, keeping the existing floating island. Fresh master `455de5b` contains the explicitly authorized Elira merge (PR #1). Clean checkout; `feature/codex-fantasy-lobby` starts from that master. Publish this new task branch for visual review, with no new master-merge authorization or canonical-local synchronization claim. Prior confirmed sync metadata below is unchanged.

- Gilded Home-only six-tile `LOBBY_NAV`, individual real gem/gold counters, kingdom/progression panel, live five-slot saved party/power, actual next-stage preview and large existing tower CTA. Other pages retain compact `MAIN_NAV`. Added shortcuts are existing F0 routes. No fabricated event, quest, mailbox, currency or rewards; existing building unlock/actions and save values preserved.
- Desktop/tablet/phone/short-landscape layouts; mobile progress disclosure and bottom dock. Original City/classic art/renderer/pan/roam remain; quality toggle moves to the right. New original decorative vector: `public/ui/lobby-frame.svg`; styling: `pages/island/lobby.scss`. Hero/building taps close the theme sheet so new party controls cannot leave stacked sheets.
- App/spec checks,712/712 Karma and production build pass. Native DPR2 responsive and interactive checks/artifacts described in `docs/FANTASY_LOBBY_UI.md`; `/workspace/scratch/fantasy-lobby-review/`. CSS size warnings remain; budgets unchanged. No combat, sprite, save-schema, final Sync or balance changes.
- Next: review screenshots and new task branch before merging; inspect `app.component.*`, `pages/island/island.component.*`, `pages/island/lobby.scss`. The older note's "Elira unmerged" statements describe its earlier task state; PR #1 is now merged.

## Previous follow-up — Elira supplied UI art (Codex, 2026-10-19)

User supplied `Elira_icn.zip` and requested portrait, skill icons and banner. Fresh master `72a3f34`, clean tree; `feature/codex-elira-ui-art` was created from master then fast-forwarded to published targeted-Ultimate dependency `b3c6c04`. Elira remains unmerged. Publish this task branch only; preserve prior local branches. No master merge or new canonical-local synchronization claim; last confirmed metadata below remains unchanged.

- Five supplied opaque PNGs, no embedded documents/instructions. Dedicated portrait 288², S1/S2/Ult icons 160², banner 1400×788 via Lanczos/WebP92, no crop/repaint. `HERO_ART.elira` and production inventory updated. `elira_art.py` handles standalone UI; combined `elira.py` requires the dedicated sources before writing and no longer restores the reference portrait. Inputs/hashes/rebuild: `docs/ELIRA_UI_ART.md`.
- App/spec checks, 711/711 Karma and production build pass. Combined bake reproduces five UI outputs plus character/basic projectile byte-for-byte, zero clipping. DPR2 roster/team/detail/three skill icons on desktop/mobile: zero errors, missing images or detail overflow. Review captures: `/workspace/scratch/elira-ui-preview/`. Source bytes preserved. No gameplay, scale, final Sync, optimizer or balance changes.
- Next: review supplied art and existing provisional animations; current Ult behavior remains in `ELIRA_ULT_TARGETING.md`. Older pending-UI statements below are historical and superseded by this entry. The cancelled overall UI redesign was not applied.

## Previous follow-up — Elira targeted Ultimate (Codex,2026-10-18)

User requested lowest-HP ally targeting and recipient-centred Ultimate,then explicitly chose a fixed field at the recipient position when activation occurs. Fresh origin/master72a3f34; published scale fix27edd69 has identical content to localaa76744. Clean tree; fix/elira-ultimate-target starts from published scale fix,including unmerged Elira and latest master. Publish only this task branch; no master merge or new canonical-local synchronization claim.

- Ultimate LOWEST_HP_ALLY/Infinity,self included; HP% and normal distance/ID ties. AUTO health thresholds unchanged. Select recipient at cast start,snapshot current recipient cell at F7=.5s; later HP changes do not redirect. If recipient dies during anticipation,no field; after creation recipient movement/death leaves the fixed field intact. Source death/expiry/clear policies unchanged.
- New generic RECT_6X3_CENTERED uses exact target point; full6×3 interior,clips at edges with half-open horizontal bounds. Aura,AI occupancy and visual centre agree; legacy home-zone geometry unchanged. Same6s/20%reduction,cast lock,FX phase timings and art. Dome dy35→27.25 aligns shared root to recipient feet. UI describes target; formation=field lab separates recipient from caster.
- Validation:app/spec checks,711/711 Karma,production build and10-run/floor/bot Elira-team smoke pass. Native Pixi/DOM both facings centre exactly on40%-HP target(7/8),away from caster(3/12),one lifecycle.5→6.5s,zero errors/missing/stale FX. No art changes/optimizer needed. Details:docs/ELIRA_ULT_TARGETING.md. Scale corrections from previous checkpoint remain. Historical home-zone references below describe the superseded behavior. Confirmed canonical-local sync metadata remains unchanged.

## Previous follow-up — character scale/registration review (Codex,2026-10-18)

User authorized fixing the cross-roster audit findings. Fresh origin/master72a3f34, published Eliraba8eac4 (tree identical to localb1f9152), clean tree; fix/hero-scale-registration starts from published Elira and includes latest master. Only this task branch publication; Elira is an unmerged dependency. No new canonical-local sync claim.

- All10 heroes reviewed with full-frame galleries, same-size before/after trials, body and head feature registration. Initial audit ratios were candidate estimates; trials on other heroes overshot comparable standing height because pose/costume proportions affect matching. Preserve their approved clips; docs/HERO_SCALE_REVIEW.md records every decision and remaining source-proportion limits.
- Confirmed Elira: IdleF3/F4 shift up8/7atlas px. S1/Ultimate measure largest connected opened character body,median first/last standing extent vs Idle; one source scale per clip. Both now.2621803776 (was.2307692308/.2108108108); feature size ratios improve.866→.980 and.794→.985. S2 control.990 unchanged. Shared cutters/renderer/timelines/gameplay untouched.
- Validation:app/spec typechecks,optimizer,707/707 Karma with software WebGL and production build pass; detached-ornament invariance,source rebake byte equality and optimized visible RGBA lossless checks pass.
- Pixel guard: only IdleF3/F4 and rows5/7 change. Source art, all other heroes, remaining Elira clips, UI, projectile/VFX unchanged. Zero source clipping; repeated source bake/optimized lossless checks and native before/after validation recorded in HERO_SCALE_REVIEW.md/session artifacts. Final Sync/balance status unchanged.

## Previous follow-up — Elira Ultimate visual review (Codex,2026-10-18)

Fresh origin/master72a3f34 remains authoritative; task baseline91101f6,clean tree. Preserved local S2cc0ed98 on wip/codex-hero-elira-s2-local and rebased identical-content published S2. Only fast-forward task publication; no canonical-local synchronization claim or master merge.

- Supplied elira_ult.zip:10 character poses,Charge10,Formation8,Loop8,Dissolve8 and provisional Excel. Row7 completes combat atlas; prior base/S1/S2 pixels retained. Real alpha preserved; only opaque magenta tracks use chroma recovery. Derived dome uses common520×440/root260,335 and wide board projection; originals untouched. Rebuild/source hashes:docs/ELIRA_ULT_REVIEW.md.
- Trial12FPS:chargeF2,fieldF7=.5s,recoveryF9/end.8333s. Existing RECT_6X3/HOME_ZONE/20%reduction/6s retained; no heal/revive/damage/shield/new balance values. Generic field playback defers Loop until Formation ends,keeps it after cast,then Dissolve on natural expiry. Source death/clear/reset cancel immediately. Even-width field centre corrected to2.5/12.5; mirrored real-engine lab supports home-zone field and four allies.
- App/spec/sim typechecks,optimizer,707/707 Karma and production build pass. Elira-team10 runs/floor/bot:F1–3 both100%,F4 AUTO40%/TACTICAL0%,F5–10 both0%,no tuning. Native DPR2 Pixi/DOM both facings verify one field .5→6.5s,expiry,Charge/Formation/Loop reset,zero errors/missing assets. Recordings30FPS actual canvas and half-speed:ignored tmp/elira-ult-preview.
- Final Sync/balance approval remain pending. See Ultimate review for validation and native preview artifacts. Prior S1/S2 notes below are historical,including references to an unavailable Ultimate.

## Previous follow-up — Elira S2 visual review (Codex,2026-10-18)

User supplied elira_s2.zip and requested Skill2 next. Fresh master72a3f34/task1104816;clean tree. Preserve S1 local a905265 on wip/codex-hero-elira-s1-local;rebase onto identical-content published1104816 skipped duplicate. Continue fast-forward task-branch publication only;no master merge/deletion or new canonical-local sync claim.

- Supplied S2 character10 poses,Main16 stages,Impact8 stages,provisional workbook. Row6/scale.26440678/body78px/260×170/root130,155;base+S1 pixels identical,Ult blank,other heroes/portrait/basic/S1FX unchanged. Combined bake now requires S1+S2 sources. Guide dividers removed only from derived strips;pastel matte recovery retains ivory/peach/lavender and gold instead of whitening the whole effect. Source PNG/XLSX hashes unchanged;docs/ELIRA_S2_REVIEW.md.
- Trial12FPS:F7shield.50s,recovery.6667/end.8333(.85s engine). Prior fallback.34s nominal/.35s engine/end.595s;activation+.15s engine/cast-lock+.2383s. Kit15%casterMaxHP/4s/CD15,class cooldown/ranks/gear and all S1/Ult/basic timings/values unchanged.
- Main16×118×148/pivot.5,.905405/fit1.25cells,recipient feet,under character/follow;Impact8×80×103/fit.85/body−22/follow. Both spawn only from actual positive shield recipients at activation. Main1.333s/Impact.6s are one-shot ceremonies,not stable loops or shield lifetime;no Charge/DR/field/extra grant invented.
- Generic support-only impact metadata includes positive shield recipients,self included,alongside existing heal/revive recipients. Shield host/amount/grant count unchanged. Lab snapshots real HP/shieldPct,uses realistic recipient HP for shield fixtures,shows actual positive shield floats and one PROTECTION_APPLY. Reset clears vitals/views/timers. No player save change.
- App/spec/sim checks,optimizer,703/703Karma and production build pass. New tests cover one F7 grant/self impact/dead target/dead caster,actual recipient/expiry beyond Main,no damage/heal/projectile;existing S1/healer/field/absorption regressions pass. Source/base+S1/lossless optimized character/blank Ult/FX guard checks pass;older optimized files unchanged.
- Elira-team10-run/floor/bot smoke completed;results in ELIRA_S2_REVIEW.md/current session logs. No balance tuning. Native DPR2 Pixi/DOM left/right and reset-during-anticipation capture verifies one PROTECTION_APPLY,target shield still active after flare,zero after expiry,zero errors/missing assets/stale reset views. Normal/half-speed actual-canvas videos and verification.json:ignored tmp/elira-s2-preview. These are provisional visual recordings,not final Sync Sheets.

Next:review S2 visuals before final S1/S2 Sync;Ultimate/dedicated UI sources remain pending. Inspect elira-production.ts,ELIRA_S2_REVIEW.md,skill-system.ts,skill-review.ts and sprites.ts;do not restore historical base fallbacks.

## Previous follow-up — Elira S1 visual review (Codex, 2026-10-18)

User supplied elira_s1.zip and requested Skill1. Fresh master remains72a3f34; task branch was clean at published d44110d. Preserved original local PhaseA7b7d440 on wip/codex-hero-elira-phase-a-local and rebased onto identical-content published d44110d (duplicate patch skipped). Continue wip/codex-hero-elira; only its fast-forward publication is authorized. Canonical-local confirmed synchronization metadata below stays unchanged.

- S1 supplied10 poses plus Main/Impact8-stage strips and provisional workbook. Character atlas10×8,base five rows pixel-identical,S2/Ult rows still blank,portrait/basic/other heroes unchanged. Bake now requires S1 source. Source hashes/rebuild/placement rationale:docs/ELIRA_S1_REVIEW.md.
- Trial12FPS:MainF3 nominal.1667s/engine.20s,single HealF7.50s,recoveryF9.6667s,end.8333s. Previous heal.34/.35s,end.595s; activation+.16s nominal/+.15s engine,cast-lock+.2383s. Kit heal220%ATK+10%targetMaxHP/CD8/ranks/targeting unchanged; S2/Ult/basic timing unchanged. Provisional review,not final Sync.
- Main8×114×180/pivot.5,.872222/fit1.1cells,under-character caster ritual with ground ring; optional workbook staff-head would float that ring. Impact8×76×83/fit.85/bodyoffset−22,one real healed target,lasting.6s independently of character end. No separate Charge,damage,projectile,lotus or invented art.
- Generic real-engine skillReview supports LOWEST_HP_ALLY using actual injured allied training heroes and frozen hostile sentinel. Lab automatically uses it,shows allied sprites/positive heal float and one HEAL_APPLY; actual impact recipients drive the burst. Production battle already supports heal-only impact lists. No production engine or player-save change.
- App/spec/sim typechecks,optimizer,700Karma/build pass. Elira-team10-run/floor/bot smoke:F1–3 both100%,F4 AUTO40%/TACTICAL0%,F5–10 both0%;Elira100%healing/10%AUTOdamage. No tuning. Source hashes,zero clipping,base equality and lossless optimized visible character pixels checked.
- Native DPR2 Pixi/DOM left/right checks and reset-during-gather verify one heal/Impact,zero errors/missing assets and no stale views; captures,verification.json and actual2×canvas normal/half-speed MP4s in ignored tmp/elira-s1-preview. These are provisional review recordings,not Final Timeline Sync Sheets.

Next:review S1 visuals before final Sync; S2/Ult and dedicated UI sources remain pending. Current production metadata in elira-production.ts supersedes historical base-only S1 statements below.

## Previous checkpoint — Elira Phase A (Codex, 2026-10-17)

User authorized the reported foundation plan. Branch `wip/codex-hero-elira` starts from freshly fetched `origin/master`72a3f34 (Sylvara supplied UI art). Initial cloud branch work/e29bc20 was clean,19 commits behind; no local master exists here. Read current rules,15 remote commits, other-agent changes/registries before editing. Created the local and remote task branch before edits. Shell push as webuilddeveloper returns403; use connected owner adisonkung to publish this branch. Connector-created commits may differ in metadata/SHA: verify identical local/published trees and preserve the original local commit. No master merge or branch deletion is authorized.

Last confirmed canonical-local commit (prior verified base, unchanged):
`3a61ffba88f1004661f73e06d271adb6569d2396`

Last confirmed common tree (canonical local/cloud copies):
`fc3456568a99d3b449a21fce552f4b3b0800b83c`

The user's canonical local clone has not been re-verified in this session. The Elira cloud base is not a new confirmed cross-copy sync point.

## Done

- Roster10:bailong,yuezheng,moye,tangxun,linxue,garrick,kael,mirelle,sylvara,elira. Existing healer/ID elira, Thai name เอลิรา ดอว์นเมียร์, provisional3★. Star/class/equipment/rank tables and starter team/bench unchanged. No inherited Heal Bolt conversion or revive.
- S1 one lowest-ally-HP% heal220% caster ATK+10% recipient Max HP/CD8s. S2 one lowest-ally-HP% shield15% caster Max HP/4s/CD15s, existing additive shield semantics. Self allowed; unlimited target range. Ult fixed source-side home6×3,6s,20% incoming damage reduction through the existing DamageResolver for current allied occupants. Values/names/rarity remain provisional. Class progression IDs reused; class HEAL/REVIVE rank modifiers do not invent missing effects or scale shield/aura, S2 cooldown rank upgrades remain.
- Generic RECT_6X3 geometry, HOME_ZONE field anchor and live FieldDefinition.aura. Buffable.auraModifiers queries current occupancy/living source on each modifier calculation, avoiding lingering statuses and pulse latency. Normal multiplicative modifier composition, immediate entry/exit/death, natural expiry/wave-stage clear, mirrored teams. AUTO defensive-field need checks only occupants; manual cast stays available. Existing damage fields unchanged.
- Approved base5/7/4/7/6 poses,7×8 atlas/260×170/root130,155/78px body, shared keying/body/root/torso pipeline, separate16×16 source-star basic bolt and temporary reference portrait. Zero clipping; optimized visible RGB/alpha lossless; older sprite/optimizer outputs unchanged. Source hashes unchanged.
- Support clips explicitly use base row3 poses with activation.34s nominal/.35s engine, end.595s. Skill rows5–7 blank, no fieldFx/skill FX registered. Missing sources are not claimed complete. Metadata:elira-production.ts. Details/source inventory/rebuild/progression caveats:docs/ELIRA_PHASE_A.md.

## Validation

- App and spec TypeScript checks passed; optimizer includes sim typecheck.
- Full Karma/Chromium **698/698 passed** (14 new tests). Covers heal target/activation/reduction/death, shield/expiry/absorption,18-cell geometry, actual damage/status composition, entry/exit/source movement/death/expiry/clear/mirror, AUTO/manual occupancy and rank-copy isolation; existing Mirelle/Sylvara tests pass.
- Production build passed (existing style/CommonJS warnings).
- Default-team10-run/floor/bot simulation completed:F1–4/F6=100% both,F5/F7/F9/F10=0%,F8 AUTO0%/TACTICAL50%; matches prior default smoke. Elira team(yuezheng,kael,sylvara,mirelle,elira):F1–3=100% both,F4 AUTO50%/TACTICAL0%,F5–10=0%. Elira100% of team healing/11% AUTO damage aggregate. Smoke only, no tuning or final balance claim.
- Native DPR2 Pixi(canvas present)/DOM base idle/move/basic/hurt/death, facing right/left, with Mirelle/Kael comparisons:zero page errors or missing assets. Captures/verification.json in ignored tmp/elira-preview. Temporary disposable browser saves only. Skill mechanics verified in engine specs; dome visual review is pending.
- Temporary tools outside repo:/tmp/elira-pydeps,/tmp/karma-elira.cjs. Source ZIP/copies remain read-only inputs; paths/hashes in ELIRA_PHASE_A.md.

## Pending / next agent must inspect

1. Fresh fetch/status/history and real registries. Inspect ELIRA_PHASE_A.md,elira-production.ts,hearthlight-keeper.spec.ts,fields.ts,buffs.ts,skill-system.ts and sprites.ts before edits.
2. ZIP contains only master reference/base; obtain S1 character/Healing Burst and optional Charge, S2 character/Veil, and Ult Charge/Formation/Loop/Dissolve actual source files. User says created, but they were not attached. Preserve ivory/white-gold stars/no lotus; S2 pastel pink/lavender/gold. Dedicated UI portrait/icons/banner and final Timeline Sync also pending.
3. Review/produce S1 then S2 then Ult individually. Dome6×3/6s lifecycle is independent of character recovery; no instant burst.1024×704 export target must be checked against current renderer projection. No replacement approved art or fabricated final timing.
4. Mirelle remains merged/FINAL_SYNC; see MIRELLE_FINAL_SYNC.md. Sylvara UI art complete; S1/S2/Ult final Timeline Sync remains pending. Preserve those implementations and original source bytes.
5. No balancing until roster complete. DEV_FLAGS.fullUltAtStart remains unchanged. Prior combat-timeline coupling/Tang Xun close-target surround issues remain deferred.
