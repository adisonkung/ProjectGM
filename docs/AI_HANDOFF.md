# Current Development State

**Git is authoritative.** Query `git rev-parse HEAD` / `HEAD^{tree}` for current state; this note never stores its containing commit's hash.

Last task (Codex, 2026-10-17):
UI-art follow-up: `sylvana_icon.zip` supplies portrait/S1/S2/Ult/banner. All five WebP outputs registered under existing `sylvara`; dedicated portrait replaces reference crop. New `sylvara_art.py` is reused by the combined baker so rebakes cannot restore the old crop. User explicitly authorized push and merge to master before the next hero. Branch `feature/codex-sylvara-ui-art` starts at freshly fetched master2ab8ebd; source hashes/rebuild/validation in `SYLVARA_UI_ART.md`. App/spec checks,684Karma/build and full combined byte-identical character/UI rebake pass; disposable-account desktop/mobile art check passes. No combat changes. Final Timeline Sync/balance remain pending.

Previous combat publication review:
Final publication review requested by user after the visual revision. Reviewed the complete Sylvara diff against freshly fetched origin/master; no new blocking finding. Re-ran app/spec typechecks,684/684 Karma, production build and10-run/floor/bot Sylvara-team simulation on the4618bbe content checkpoint; all passed and simulation results match the prior run. Native Pixi/DOM/facing/reset checks confirm one release/five pulses and cleanup. Publication remains on `wip/codex-hero-sylvara`; final Timeline Sync/UI art scope is unchanged.

Sylvara Ultimate Emerald Skyfall provisional visual review from `sylvara_ult_source.zip`. Character/Charge/one upward ascent/fixed3×2 Field/five vertical rain waves/cell Impacts and fade residue are integrated. User explicitly requested Ultimate next; final S1/S2/Ult Timeline Sync remains pending. Details: `docs/SYLVARA_ULT_REVIEW.md`.

Branch:
`wip/codex-hero-sylvara`, created locally and on GitHub before the first edit from freshly fetched `origin/master`895369a (Mirelle merge). Initial tree was clean; no local `master` exists in this cloud clone. Shell pushes return403 for `webuilddeveloper`; publication uses the connected owner account `adisonkung`. That original publication scope was the hero task branch. The user subsequently authorized its master merge (master2ab8ebd), then the UI-art feature branch and its master merge. No branch deletion is authorized. Connector commits may have different metadata/SHAs; require identical local/remote trees, preserve original local commits if remapping, and query Git for the published tip.

Last confirmed local commit (canonical local clone, prior verified base, unchanged):
`3a61ffba88f1004661f73e06d271adb6569d2396`

Last confirmed common tree:
`fc3456568a99d3b449a21fce552f4b3b0800b83c`

These are prior confirmed sync metadata for the user's canonical local clone, not this cloud branch's current commit/tree. That local clone has not been re-verified in this session.

Done:
- Roster9: bailong,yuezheng,moye,tangxun,linxue,garrick,kael,mirelle,sylvara. Sylvara is Archer, provisional3★; class stats/ranks/equipment and starter team/bench unchanged.
- S1 one Physical220% arrow/CD6s; S2 Physical80%/2×2+Root2s/CD11s on arrival; Ult fixed3×2 field,5 waves/5s at Physical60% per wave. Values are provisional. No inherited Rapid Shot repeats, interrupt/Break, launch damage or ending burst.
- Generic `RECT_3X2` geometry in `area.ts`, FIELD typing and3×2 skill-detail label. Existing scheduler handles current occupants, source death and wave/stage cleanup. No hero-specific engine branch.
- Phase A base5/7/4/7/6 →7×8 atlas,260×170 cells/root130,155/body78px. Separate basic arrow18×5, temporary portrait from reference, `sw-basic-arrow`, generated optimizer outputs. No source PNG modified or replacement art generated.
- S1 follow-up: atlas10×8/row5 has10 poses; base five rows remain pixel-identical. `sw-s1-projectile` is Mainstages2–8 plus blank terminal (8×132×33,visible64px); separate `sw-s1-impact`8×68×70,visible64px. Main alpha retained, Impact magenta unmixed; zero strip-edge clipping. No separate Charge asset.
- `sylvara-production.ts`: S1/S2/Ult PROVISIONAL_REVIEW, final Sync AWAITING_REVIEW. S1 unchanged. S2 row6 has10 source poses; sequence `[0,1,2,3,4,5,5,7,8,9]` holds F6 instead of showing source F7 baked volley. Explicit ownership keeps its detached arrowheads out of recovery. Trial12FPS: releaseF5=.3333s (engine.35s as before), recovery.5833s/end.8333s; cast-lock+.2383s vs PhaseA. Basic retains oldtiming; Ult now uses the review timing below. No kit/status/rank changes.
- S2 files: projectile8×148×31 (Main3–9+blank), Impact8×116×116 at one logical2×2 centre, Root10×84×100/pivot.5,.92. Growth1–5 then stable loop6–10; `StatusFxPlayback` follows real status/source, refresh does not replay growth, expiry/cleanse/death/reset removes views. No extra damage/field/dissolve. Battle and lab share it; area-projectile lab playback uses actual engine events/snapshots, not an instant demo.
- Read-only S2 originals: `/workspace/attachments/48a0083f-8daf-472c-9a91-3e8cd97e986d/extracted/`; five source hashes in `SYLVARA_S2_REVIEW.md`. Combined bake requires both S1/S2 sources. Base+S1 pixels exact; other heroes, portrait/basic/S1 FX unchanged.
- Ultimate: row7/10 poses, weighted1.4s, releaseF7/.7s, independent ascent.5s, activation/recovery1.2s. Previous fallback activation.34s/engine.35s/end.595s; new activation+0.86s nominal/+0.85s engine and cast-lock+0.805s. This is combat-relevant provisional review timing; no coefficient/area/status/cooldown changes. Field pulses2.2/3.2/4.2/5.2/6.2s; no launch or ending damage.
- Ultimate strips: Charge8×124×172; ascent8×440×390 translated up/forward; Field6×244×157(first3 formation,last3 loop,last1 fade); rain48×300×500/30 staggered scattered downward arrows per800ms wave; Impact8×100×106 per cell/pulse. Real alpha retained where supplied, magenta recovered elsewhere. Source rain stages5–7 already touch the original PNG bottom; no missing pixels invented. No separate residual source, so last Field pose fades400ms.
- Generic field pulse metadata (`FIELD_PULSED`, index/interval) preserves existing scheduling/effects. `SheetDef.fieldFx.wave` + `FieldFxPlayback` lead each actual pulse800ms with rain, deduplicate impacts, use logical `rect3x2Center()`, reproject camera and cancel all owned waves/effects on source death/clear/reset. Natural expiry lets final Impact finish and emits residue once. No hero-ID checks or new projectile physics. Field/status/wave textures preload; FIELD lab playback automatically uses real engine events.
- Read-only Ult originals: `/workspace/attachments/5042df14-3c08-4895-815c-45e55fa5e1b8/extracted/`; seven hashes in `SYLVARA_ULT_REVIEW.md`. Combined bake now requires all three skill sources. Base/S1/S2 pixels exact and optimized character visible RGBA lossless; zero output edge clipping. Actual source F6 still holds its arrow, F7 is released.
- S1 source copies are read-only under `/workspace/attachments/1db55958-a47f-4fab-9c75-c5f332813310/extracted/`; all4 hashes are in `SYLVARA_S1_REVIEW.md`. S1 source is required for future rebakes to prevent silent rollback.
- Source archive/copies and SHA-256 values: `SYLVARA_PHASE_A.md`. Byte-identical read-only copies: `/workspace/attachments/sylvara-originals/{base,reference}.png`; `art/incoming/**` untouched.

Validation:
- App/spec typechecks passed; optimizer's sim typecheck passed.
- Full Karma/Chromium **684/684 passed** after the Ultimate visual revision (8 additional cases): five pulses/30 occupant hits/no launch-end damage, death during draw/ascent, one visual launch/five rain waves/30 cell Impacts, duplicate-event/camera/cancel/residual/reset checks. Earlier S1/S2/Mirelle regression checks pass. Temporary config `/tmp/karma-sylvara.cjs` supplies no-sandbox Chromium without changing project config.
- Production build passed; existing component-style/CommonJS warnings remain.
- Phase A default-team `npm run hero-sim -- 10`: completed. Default team F1–4/F6 AUTO/TACTICAL100%; F5/F7/F9/F10=0%; F8 AUTO0%/TACTICAL50%. No rebalance.
- Sylvara/Mirelle team after S2 (`bailong,yuezheng,sylvara,mirelle,linxue`),10 runs/floor/bot: completed; F1–3=100% both, F4 AUTO100%/TACTICAL60%, F6 AUTO80%/TACTICAL0%, other floors0%. Sylvara37% aggregate AUTO damage. Smoke only, not final balance.
- Ult simulation (`yuezheng,kael,sylvara,mirelle,linxue`),10 runs/floor/bot: F1–3 both100%;F4 AUTO90%/TACTICAL60%;F5 20%/10%;F6 100%/40%;F7–10 both0%. Sylvara33% aggregate AUTO damage. Different team from the previous S2 smoke; do not compare as an isolated balance measurement. No tuning.
- Native DPR2 Pixi/DOM idle/move/basic/hurt/death and mirrored basic: zero page errors/missing Sylvara assets. Actual WebGL canvas present. Captures + `verification.json` in ignored `tmp/sylvara-preview/`. Bake reports zero clipped character pixels; other hero sprite outputs are unchanged.

- S1 Pixi/DOM/right/left checks: one release/arrival each, zero page errors/missing assets; resetting during draw clears the log/projectiles. `tmp/sylvara-s1-preview/verification.json`. Native screenshot comparisons plus110 clock-controlled Pixi frames at1792×560 from a2× canvas produce normal/half-speed MP4 at60FPS. These are review recordings, not final Sync Sheets.

- S2 Pixi/DOM right/left previews: one release/contact, no errors/missing assets; reset while in flight leaves no visuals. Stable-root check shows4 loops normally,3 when primary is Unstoppable,then0 after expiry. `tmp/sylvara-s2-preview/verification.json`. Actual2×canvas210-frame video covers formation/loop/expiry; normal/half-speed MP4s in the same directory. Original5 hashes unchanged, all strips have zero edge clipping, optimized character visible pixels/alpha lossless.

- Ult native DPR2 Pixi/DOM right/left: one release/five pulses, zero errors/missing assets, no FX after expiry and empty log/projectiles after reset. `tmp/sylvara-ult-preview/verification.json`. Final video uses a clean single-cast2×canvas capture; warm-up and recording share the controlled browser clock to avoid old native timers leaking into the capture. Review videos, not final Sync Sheets.

- User visual revision: Charge1.45cells (+16%); one ascent unchanged, Pixi completed-one-shot ownership fix prevents replay during host cleanup. Rain uses30 seeded scattered arrows/48frames/.8s per wave, drop height240px (+50%) and800ms lead; damage/activation/cast-lock unchanged. Generator repacks optimized rain as13×4WebP (old opt PNG removed by optimizer). App/spec checks,684Karma/build pass; no combat sim rerun for this visual-only change. Fresh review captures under `tmp/sylvara-ult-rain-review/`; final Sync pending.

- UI art is now complete: portrait288×288/icons160×160/banner1400×788. `HERO_ART` and production metadata updated. Combined `sylvara.py` takes UI source as its last argument; see `SYLVARA_UI_ART.md`. Source hash verification and full rebake prove existing combat atlas is unchanged.

Next agent must inspect:
- Fresh remote refs, branch/status/history and registries before edits. Mirelle is merged and FINAL_SYNC; do not revert from historical provisional notes. See `MIRELLE_FINAL_SYNC.md` / `MIRELLE_REMOTE_HANDOFF.md`.
- `HEROES`, `HERO_DEFINITIONS.sylvara`, `sylvara-production.ts`, `sprites.ts`, `emerald-huntress.spec.ts`, `area.ts`, `fields.ts` and `SYLVARA_PHASE_A.md`.
- All three skill integrations are ready for provisional visual review; final Timeline Sync remains pending. Do not infer final timing or add physics/line-of-sight systems from workbook text. S1/S2 use the existing cell-centre projectile origin; Ult uses the review-only `ultNock` FX anchor and one independent baked ascent, not a damaging projectile. Preserve one upward launch/five descending waves over3×2.
- S2's2×2 size/Physical type/Root duration, Ult5s/1s interval, damage/cooldowns and3★ remain provisional. S2 resolves around homing-target arrival; Ult stays on its activation anchor. Current3×2 FX use `rect3x2Center(anchor)` for the actual centre.
- No balancing until the full roster is complete. `DEV_FLAGS.fullUltAtStart` remains ON. Prior combat-timeline coupling and Tang Xun near-target surround issues remain deferred.
