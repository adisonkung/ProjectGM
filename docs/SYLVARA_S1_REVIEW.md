# Sylvara — S1 Emerald Piercer · provisional visual review

User authorized S1 integration from `sylvara-s1-source.zip` on2026-10-17, continuing the existing `wip/codex-hero-sylvara` branch. Fresh fetch confirms `origin/master`895369a and the published Sylvara Phase A checkpoint. Working tree was clean; no other agent changes were present. This step produces an in-game S1 review, before final Timeline Sync or S2/Ult production.

## Source audit

Original archive: `/workspace/attachments/1db55958-a47f-4fab-9c75-c5f332813310/sylvara-s1-source.zip`. Byte-identical read-only extracted files are in its sibling `extracted/` directory. No `art/incoming/**` or original PNG/XLSX was edited. Other clones may provide them under `art/incoming/sylvara/s1/`.

| Source | Size | SHA-256 |
|---|---|---|
| `s1_character.png` |1448×1086,10 poses in2×5|`4d9730519063f532c0434d1469c64d380ffe06020dd36cfe1d86ba686670907b`|
| `s1_main.png` |2172×724,8 irregular stages, real alpha|`2f3aa75de4d89f495e3f3504ab17f603a310e4d3fc8311882a6bdfacfb7e98e4`|
| `s1_impact.png` |1672×941,8 stages, magenta matte|`084b3258da3dee1e351a38cfcca60b4e22f939c5cd4cef19fe31d46cb96ea9ab`|
| `SYLVARA_S1_UNIVERSAL_TIMELINE_V2.xlsx` |Overview/Timeline/Runtime Events/Anchors/QA|`14c9e9ad420d6383d8f6ab31642060370492a3d4501ab2badc2333d25650d520`|

The workbook explicitly calls10 frames/12FPS/F7 release provisional. Its name matches the proposed runtime label Emerald Piercer. F6 still holds the arrow on the string; F7 opens the drawing hand/releases the arrow, so F7 is suitable for review. The workbook is design input, not user approval of final timing or an instruction to add physics/line-of-sight/event-ID systems. Existing range, delivery, target rules and progression remain authoritative.

## Bake and runtime mapping

- `tools/sprites/sylvara.py`: approved base rows stay pixel-identical after horizontal padding; new row5 has all10 supplied poses. Atlas10×8, cells260×170/root130,155, idle body78px. One scale per clip (base.3768116/S1.2005141), shared body/feet/torso pipeline. Zero clipped character pixels. Base/basic-arrow/portrait unchanged; rows6–7 remain transparent.
- S1 source is now required when rebaking, so missing sources fail instead of silently restoring an empty/base-only row.
- `tools/sprites/sylvara_s1.py`: respect Main alpha rather than keying away green artwork. Remove its isolated background specks outside the actual strip; assign whole connected components to audited frame centres, not an equal-width grid.
- Main stage1 is a round buildup sparkle, not a flying arrow. Stages2–8 provide7 flight poses plus a transparent terminal cell: `fx-sylvara-s1-projectile.png`,8×132×33,64px peak visible width, tip at flight point. No extra contact burst is baked into the projectile.
- Impact is separately unmixed from magenta and centred: `fx-sylvara-s1-impact.png`,8×68×70,64px peak visible width. It spawns only on the actual primary target's successful arrival event; no extra damage.
- No separate Charge source was supplied; no Charge strip, icons, banner, replacement artwork or fabricated final Sync Sheet is introduced.
- FX keys `sw-s1-projectile` / `sw-s1-impact`; basic attack and S2 still use `sw-basic-arrow`. Other hero outputs are unchanged. `sprites:optimize` generates the atlas/optimized assets.

Rebuild in this workspace:

```bash
PYTHONPATH=/tmp/sylvara-pydeps python3 tools/sprites/sylvara.py /workspace/attachments/sylvara-originals public/sprites public/portraits /workspace/attachments/1db55958-a47f-4fab-9c75-c5f332813310/extracted
python3 tools/sprites/sylvara_s1.py /workspace/attachments/1db55958-a47f-4fab-9c75-c5f332813310/extracted
npm run sprites:optimize
```

## Timing and gameplay boundary

- Provisional12FPS/10 poses: one `PROJECTILE_SPAWN` and launch-scheduling `DAMAGE` marker at F7/.5s; recovery F9/.6667s; clip ends.8333s. `IMPACT` data marker is resolved at actual projectile arrival by the existing engine/lab, not at launch.
- Base fallback was.34s release/.595s total. S1 now releases.16s later and extends cast-lock by about.2383s. This affects provisional combat timing and is explicitly part of the review, not a DPS rebalance.
- Existing flight duration is.1+.06×cell distance, independent of VFX animation speed. One projectile, one Physical damage application to its target, one arrival impact. Dead target/caster-before-release produce no ghost damage/late shot. No new debuff, penetration, splash, interrupt or Break.
- Engine kit coefficient220%, cooldown6s, focus/lowest-HP targeting, class skill ID/rank tables remain unchanged. S2 and Ult retain their prior basic fallback poses/timing (.34/.595s); no skill art/timing work is done for them.
- Known presentation limitation: projectile launch uses the existing renderer's cell-centre origin rather than the workbook's exact arrow-nock anchor. Impact uses the target's existing hit centre. Neither introduces source-pixel collision/hitboxes; refinement can follow visual review without assuming new gameplay rules.

## Preview, validation and stop point

`/sprite-lab?hero=sylvara&compare=mirelle,kael&enemy=forest_slime&bg=forest-1&distance=4&render=pixi` (or DOM). Select **Emerald Piercer**. The single-projectile lab uses actual board/projectile/FX renderers, but floating damage text is an existing visual sample; engine tests verify actual damage.

Native DPR2 captures/videos and logs live in ignored `tmp/sylvara-s1-preview/`. The preview checks right/left, Pixi/DOM, one release/contact and switching to Idle before release. No player save/starter changes are made (only a disposable browser profile).

Confirmed checks: app/spec/sim typechecks, optimizer, **668/668 Karma**, production build and Sylvara/Mirelle-team10-run/floor smoke simulation pass. Base five rows are pixel-identical, optimized character alpha/visible RGB are lossless, all4 source hashes unchanged and all strips have zero outer-edge clipping. Pixi/DOM right/left each show one release/contact with no page errors or missing assets; switching to Idle before release leaves no stale projectile/log. Review MP4s use110 actual Pixi frames at1792×560, captured with a controlled browser clock and encoded at60FPS (normal and half speed). They are neither generated replacement art nor final Timeline Sync. Exact results are also recorded in `AI_HANDOFF.md`.

Stop for S1 visual review. Final S1 timing/Sync remains pending; do not proceed to S2/Ult from the S1 workbook's embedded suggestions. Any future upward launch/five-wave rain remains specific to Ult.
