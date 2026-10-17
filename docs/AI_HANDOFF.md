# Current Development State

**Git is authoritative.** Query `git rev-parse HEAD` / `HEAD^{tree}` for current state; this note never stores its containing commit's hash.

Last task (Codex, 2026-10-17):
Sylvara S1 Emerald Piercer visual review. The user requested S1 and supplied `sylvara-s1-source.zip`:10 character poses,8-stage Main,8-stage Impact and a provisional workbook. S1 row5/projectile/Impact are integrated; S2/Ult and final S1 Timeline Sync remain pending. Details: `docs/SYLVARA_S1_REVIEW.md` (earlier foundation: `SYLVARA_PHASE_A.md`).

Branch:
`wip/codex-hero-sylvara`, created locally and on GitHub before the first edit from freshly fetched `origin/master`895369a (Mirelle merge). Initial tree was clean; no local `master` exists in this cloud clone. Shell pushes return403 for `webuilddeveloper`; publication uses the connected owner account `adisonkung`. Only this task branch is authorized for publication; no master merge or branch deletion. Connector commits may have different metadata/SHAs; require identical local/remote trees, preserve original local commits if remapping, and query Git for the published tip.

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
- `sylvara-production.ts`: S1 PROVISIONAL_REVIEW/AWAITING_REVIEW for final Sync; S2/Ult AWAITING_SOURCE. S1 trial12FPS: releaseF7=.5s/recoveryF9=.6667s/end.8333s, later than PhaseA.34/.595s (combat-relevant). Basic/S2/Ult retain oldtiming. No kit, status, rank or other hero change.
- New source copies are read-only under `/workspace/attachments/1db55958-a47f-4fab-9c75-c5f332813310/extracted/`; all4 hashes are in `SYLVARA_S1_REVIEW.md`. S1 source is required for future rebakes to prevent silent rollback.
- Source archive/copies and SHA-256 values: `SYLVARA_PHASE_A.md`. Byte-identical read-only copies: `/workspace/attachments/sylvara-originals/{base,reference}.png`; `art/incoming/**` untouched.

Validation:
- App/spec typechecks passed; optimizer's sim typecheck passed.
- Full Karma/Chromium **668/668 passed** after S1 (2 additional cases); one real-sprite projectile/contact, cancellation before release, pending slot timing and dead-target behavior verified. Temporary config `/tmp/karma-sylvara.cjs` supplies no-sandbox Chromium without changing project config.
- Production build passed; existing component-style/CommonJS warnings remain.
- Phase A default-team `npm run hero-sim -- 10`: completed. Default team F1–4/F6 AUTO/TACTICAL100%; F5/F7/F9/F10=0%; F8 AUTO0%/TACTICAL50%. No rebalance.
- Sylvara/Mirelle team after S1 (`bailong,yuezheng,sylvara,mirelle,linxue`),10 runs/floor/bot: completed; F1–3=100% both, F4 AUTO100%/TACTICAL60%, F6 AUTO30%/TACTICAL0%, other floors0%. Sylvara37% aggregate AUTO damage. Smoke only, not final balance.
- Native DPR2 Pixi/DOM idle/move/basic/hurt/death and mirrored basic: zero page errors/missing Sylvara assets. Actual WebGL canvas present. Captures + `verification.json` in ignored `tmp/sylvara-preview/`. Bake reports zero clipped character pixels; other hero sprite outputs are unchanged.

- S1 Pixi/DOM/right/left checks: one release/arrival each, zero page errors/missing assets; resetting during draw clears the log/projectiles. `tmp/sylvara-s1-preview/verification.json`. Native screenshot comparisons plus110 clock-controlled Pixi frames at1792×560 from a2× canvas produce normal/half-speed MP4 at60FPS. These are review recordings, not final Sync Sheets.

Next agent must inspect:
- Fresh remote refs, branch/status/history and registries before edits. Mirelle is merged and FINAL_SYNC; do not revert from historical provisional notes. See `MIRELLE_FINAL_SYNC.md` / `MIRELLE_REMOTE_HANDOFF.md`.
- `HEROES`, `HERO_DEFINITIONS.sylvara`, `sylvara-production.ts`, `sprites.ts`, `emerald-huntress.spec.ts`, `area.ts`, `fields.ts` and `SYLVARA_PHASE_A.md`.
- S1 integration is ready for visual review; final S1 Sync follows that review, then S2/Ult individually. Do not infer final timing or add physics/line-of-sight systems from workbook text. Exact arrow-nock rendering origin is not implemented; existing cell-centre origin remains. Preserve one upward launch and5 descending waves over3×2 for future Ult art.
- S2's2×2 size/Physical type/Root duration, Ult5s/1s interval, damage/cooldowns and3★ remain provisional. S2 resolves around homing-target arrival; Ult stays on its activation anchor. Future3×2 FX must use `rect3x2Center(anchor)` for its actual centre.
- No balancing until the full roster is complete. `DEV_FLAGS.fullUltAtStart` remains ON. Prior combat-timeline coupling and Tang Xun near-target surround issues remain deferred.
