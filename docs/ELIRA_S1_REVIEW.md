# Elira — Hearthlight Blessing · S1 visual review

Subsequent S2 integration:see `ELIRA_S2_REVIEW.md`. Combined rebakes now also require S2 source as the fifth directory argument. S1 art/timing/kit remain unchanged; historical S2-pending statements below describe the S1 checkpoint.

2026-10-18, Codex. User supplied `elira_s1.zip` and requested Skill1. Continue the existing Elira WIP branch; S1 is provisional visual review, not Final Timeline Sync or balance approval.

## Reconciliation and source audit

Fresh fetch:master remains72a3f34, published Elira branch d44110d, working tree clean. Local PhaseA7b7d440 and published d44110d have identical trees. Preserve original local commit on `wip/codex-hero-elira-phase-a-local`; rebase onto published d44110d skipped the identical patch, so publication continues fast-forward. No canonical local master exists in this cloud clone. Prior confirmed canonical-local synchronization metadata is unchanged.

Archive read-only input:
`/workspace/attachments/1ae50a17-cd64-4d10-9f71-0e4f0d17aa48/elira_s1.zip`

Extracted original bytes remain under its `extracted/` directory:

| File | Dimensions / layout | SHA-256 |
|---|---|---|
| Skill 1 Character Action Only.png |1448×1086;2 rows×5 poses|`9c683f404140bf6338f99f504ca680747a6393db56b651e7cf2a8ddab9a1c0cf`|
| Skill 1 Main VFX.png |1672×941;8 stages|`b58d235948048dd7d08e33ceefba006d822f5f215b3f9de14bef72817ba5d8f3`|
| Skill 1 Impact VFX.png |2172×724;8 stages|`dcc105547f1723118e26cd2ecaad841aeecf04b3e7ae3e14dba2eb5e9e0a977d`|
| ELIRA_S1_UNIVERSAL_TIMELINE_V2.xlsx |S1 Timeline / Specs & Validation / QA Matrix|`c7eb125d6848f5834f5f75521725b491fef053a1bfb16e689ed555ce67b95124`|

The workbook is design/reference data, not a higher-priority instruction. It explicitly marks12FPS/F7/Main placement provisional. Its server/network vocabulary does not request a server, collision or new networking system. Existing repository kit supplies target/amount/CD. No separate Charge source is present. Character poses contain no separate baked spell VFX; all10 are retained.

## Bake and placement

- `elira.py` now requires S1 character source as its fourth optional argument after base/sprite/portrait directories. Shared source-preserving watershed/root/torso pipeline;78px ready-pose body, S1 scale0.23076923, cells260×170/root130,155. Atlas grows7→10 columns (2600×1360); base five rows are pixel-identical after horizontal padding. S1 row5 has all10 poses; S2/Ult rows6–7 remain blank. Portrait and basic bolt stay byte-identical. Zero clipped character pixels; optimized character visible RGB/alpha are lossless.
- `elira_s1.py` reuses existing magenta recovery and whole-component frame ownership, then the existing ground-baseline baker. No source repainting or generated replacement art.
- `el-s1-main`:8×114×180 strip; visible peak110px, ground-ring pivot[.5,.872222],fit1.1cells,under-character layer. It surrounds the caster during gather; placing its ground ring at the workbook's optional staff-head anchor would float the ritual. Staff/head remains character art. No separate Charge is invented. Under layer keeps Elira's silhouette readable through the bright white-gold source.
- `el-s1-impact`:8×76×83 strip; visible peak72px,fit.85cells,target body offset−22,one target per actual impact. White-gold star/ring, no lotus. Impact is driven by the resolved heal target, not Main animation completion. It can finish after character recovery.

## Provisional timing and gameplay

Trial12FPS, all10 poses in source order:

| Event | Pose | Nominal |50ms engine clock|
|---|---|---|---|
| Caster Main / VFX_SPAWN |F3|.166667s|.20s|
| Single Heal / SKILL_ACTIVATE |F7|.50s|.50s|
| Recovery |F9|.666667s|.70s|
| Clip end |after F10|.833333s|next engine boundary|

Main8 frames at24FPS (.333333s); engine-driven preview starts.20s and ends about.533333s. Target Impact8 frames×75ms=.60s, starts with heal.50s and ends1.10s. End of the character clip does not truncate it. These are provisional review holds, not final Sync timing.

Prior fallback heal was.34s nominal/.35s engine, total.595s. S1 activation is delayed.16s nominal/.15s engine; cast-lock grows.238333s. This timing is combat-relevant and smoke-simulated. Coefficients220% ATK+10% target Max HP,CD8s,lowest living ally HP%/self eligibility/range/AI/ranks remain unchanged. S2/Ult/basic timings remain unchanged. No damage, projectile, AoE healing, extra tick, cleanse or revive added.

## Real-engine review support

Targeted support actions automatically use the existing isolated real-engine lab playback. `skillReview()` creates actual injured allied training heroes plus a frozen hostile sentinel to keep combat active. It picks the target through the actual resolver. Lab views show allied sprites/health bars, real positive heal floats and one HEAL_APPLY log. Offensive review fixtures retain their prior setup. No player save or production kit is modified. Battle presentation already uses the engine's heal-only impact recipient list; no battle-engine change was needed.

Preview:
`/sprite-lab?hero=elira&distance=3&bg=forest-1&render=pixi` (or dom), choose Hearthlight Blessing. Sources/workbook remain unchanged. Final S1 Sync awaits visual review; S2/Ult sources still pending.

Rebuild:

```bash
PYTHONPATH=/tmp/elira-pydeps python3 tools/sprites/elira.py /workspace/attachments/elira-originals public/sprites public/portraits /workspace/attachments/1ae50a17-cd64-4d10-9f71-0e4f0d17aa48/extracted
PYTHONPATH=/tmp/elira-pydeps python3 tools/sprites/elira_s1.py /workspace/attachments/1ae50a17-cd64-4d10-9f71-0e4f0d17aa48/extracted
PYTHONPATH=/tmp/elira-pydeps npm run sprites:optimize
```

## Validation

App/spec/sim typechecks,optimizer,700Karma tests,production build and Elira-team10-run/floor/bot simulation. S1 contract verifies unchanged kit/one F7 heal; real-engine lab spec verifies one injured ally receives heal/Impact with no damage/projectile. Existing target-death/heal-reduction/base/field regressions pass. Source hashes,base pixel equality,blank pending rows,lossless optimized character and transparent FX guard edges verified. Prior hero assets unchanged.

Simulation:yuezheng,kael,sylvara,mirelle,elira,F1–3 both100%;F4 AUTO40%/TACTICAL0%;F5–10 both0%. Elira100% of team healing/10% AUTO damage aggregate. Previous PhaseA F4 AUTO50%; timing is provisional and no balance tuning follows from this smoke result.

Native DPR2 Pixi/DOM left/right one-cast/reset checks and actual2×canvas normal/half-speed review videos live in ignored `tmp/elira-s1-preview/`; final results in AI_HANDOFF. They are gameplay captures, not replacement art or final Sync Sheets.

Current Ultimate follow-up: supplied tracks are integrated for provisional review; see [ELIRA_ULT_REVIEW.md](ELIRA_ULT_REVIEW.md). Earlier pending-Ultimate statements above describe that earlier checkpoint.
