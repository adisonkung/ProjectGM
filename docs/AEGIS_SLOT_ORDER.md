# Aegis slot correction and board-cell review — 1 November 2026

The user expected the discussed S2/S3 swap to be implemented. It is now applied to the actual skill registry, every tier's ordered kit, priority, charge timing and Break ownership.

| Slot | Current action | Charge | Cooldown / first delay | Effect |
|---|---|---|---|---|
| S1 | Aegis Guard | 2.5s | 20s /4s | Existing finite protection; interrupt exposes core |
| S2 | Gate Judgement | 1.8s | 13s /2s | Physical×1.2, six cells in the forward3×2 rectangle; not Breakable |
| S3 | Light Lance | 3s | 18s /14s | Magic×1.5, all three playable lanes ahead to the board edge; Break100 removes Guard and exposes core4s/+75% |

Stable IDs remain `aegis_judgement` for the ground slam and `aegis_lance` for the beam. `skills` now orders Guard→Judgement→Lance and priority is Lance→Guard→Judgement. Cast labels explicitly display S1/S2/S3. Existing saves, sources and tier variants remain compatible.

The slam's75-frame ground/tip charge and tip-motion track are retimed from3s to1.8s; the beam's charge delay/frames are retimed from1.8s to3s. Release recovery still follows each action's existing authored clip (.78s slam/.96s beam). The beam's glow height is4.5 visual cells around the enlarged spear-tip origin, so it extends into decorative scenery; damage is still exactly the three playable lanes. No additional combat rows, HP/ATK/DEF changes or new hero tuning.

Legacy artwork keys `ae-s2-*` (beam) and `ae-s3-*` (slam) retain their filenames. They are asset IDs, not the current slot order. Native PNGs are unchanged; no atlas optimizer is required.

## Requested grid pictures

Actual-game screenshots under `docs/review-images/2026-11-01-boss-cells/` show a temporary diagnostic DOM/SVG overlay, not new product UI:

- Orange rectangle: actual boss footprint3 columns×2 rows. O is its lower-centre anchor.
- Colored hero rectangles: actual1×1 logical cells. Labels use zero-based R/C (R0 is the upper playable lane; C0 the leftmost column).
- 1BL=Bai Long,2YZ=Yuezheng,3MY=Moye,4TX=Tang Xun,5LX=Lin Xue.
- Dots show the common authored foot plane, with a dashed connector from the logical cell centre. Melee contact can approach within a lane without changing the logical cell. Large character artwork can extend beyond its collision cells.
- Jade is captured both standing and after a real committed pounce, so the orange body region moves with its actual occupied cells. The visual fixture positions the marked archer at r2,c7 to show the landing clearly; this is not a default-formation balance result.

Existing videos under `2026-11-01-guardian-skills` show the **previous** S3 ground slam at source45e7bc1. They are retained as historical review artifacts, not relabelled as the new S3.

Validation: app/spec typechecks,926/926 Karma specs, production build,180 targeted Aegis battles,20 actual desktop/mobile captures, and a full-decode checked updated S3 MP4 with diagnostic cells. The shared-cell Jade landing capture retains both hero names/nested outlines instead of shifting them apart. No general roster rebalance is claimed.

Updated S3 video: `docs/review-videos/2026-11-01-aegis-s3-swap/aegis-s3-beam-cells.mp4`.
