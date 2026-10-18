# Character scale and vertical registration review — 2026-10-18

User requested an audit of newly added heroes, then authorized correcting the reported size/vertical movement. All10 roster heroes were screened. The original automated scan was a candidate list; feature-matching ratios are not safe correction factors on their own.

## Reconciliation and branch

Fresh origin/master72a3f34. Elira published branchba8eac4 contains the same tree as localb1f9152. Clean tree before changes. This cross-roster review branches from published Elira on fix/hero-scale-registration, which already contains latest master. Elira remains an unmerged dependency. Publish only this task branch; no master merge and no new canonical-local synchronization claim.

## Confirmed correction

Elira had two independent faults:

- Idle F3/F4 same-size character details moved down8.06/6.70 atlas pixels relative to F1, while feature scale stayed1.006/1.012. Translate those two frames up8/7px in the generator. Other Idle pixels and all action pose motion remain.
- S1 and Ultimate normalized the first pose's entire opened alpha extent to78px. Thick detached staff ornaments survive opening and extend the measurement above the head. Ultimate F1's opened extent was370 source pixels; the largest connected body extent was304. Nominal78px therefore produced a visibly smaller body.

Elira's generator now measures the largest connected opened character component. It calibrates the median of equivalent first/last standing poses against the Idle reference body, then applies **one scale per clip**. Raised-arm middle frames do not influence scale. This is a hero-local correction; shared cutters and other heroes' established measurements retain their behavior.

| Clip | Previous source scale | New source scale | Before feature scale vs Idle | After |
| --- | --- | --- | --- | --- |
| S1 | 0.2307692308 | 0.2621803776 | 0.866 | 0.980 |
| Ultimate | 0.2108108108 | 0.2621803776 | 0.794 | 0.985 |
| S2 control | 0.2644067797 | unchanged | 0.990 | 0.990 |

First/last connected extents:Idle F1=196; S1=294/295; Ultimate=304/285. Base scale78/198 remains. After silhouette endpoint ratios are.994 for S1 and.987 for Ultimate, consistent with the improved feature measurements. These are approximate image measurements, not new gameplay stats.

Pixel checks confirm only Idle F3/F4, S1 row5 and Ultimate row7 change. Walk/hurt/basic attack/death/S2, unused cells, other nine hero atlases, projectile/VFX/portraits/UI art remain identical. No gameplay timing, cast lock, events, stats, fields, effects or renderer scale behavior changed. Final Sync/balance statuses remain pending as before.

## Review of all10 heroes

The 5px opened silhouette can disconnect hair, hems or feet, so its bottom is not an annotated foot. SIFT can match costume details at a different scale even when full standing body height is comparable. Head-only matching also becomes unreliable when hair, facing or clothing changes. All-frame contact sheets and fixed-size before/after trials were used to reject automatic corrections that visibly make an existing standing clip taller or shorter.

| Hero | Reviewed result / action |
| --- | --- |
| Elira | Correct Idle translation and S1/Ultimate scale as above. S2 is the unchanged control. |
| Mirelle | S1~.912 feature candidate disagrees with its silhouette/standing height; +8% trial makes the whole standing figure too tall. Retain original calibration. Idle detail motion~2px, no Elira-style sink. |
| Sylvara | Ultimate~1.100 candidate has medium confidence and inconsistent head matches; a.90 whole-clip trial makes the standing figure too short. S1~.960 candidate does not justify enlarging its already comparable standing height. Retain original. Idle motion~1.4px. |
| Bai Long | S2~.879 whole-body feature candidate includes differing head/body proportions; +14% whole-clip trial increases standing height above Idle. S1 is a bent-leg thrust stance. Preserve those poses and the authored airborne Ultimate. |
| Yuezheng | S1/S2~.920 whole-body candidates disagree with standing silhouette ratios near1.0; S1 first-pose head match~.990. Uniform enlargement produces taller figures. Preserve bracing, dash and landing poses. |
| Lin Xue | S1/Ultimate feature candidates have medium confidence and different dress/pose proportions; +10/+12% trials overshoot standing height. Retain planted feet/head-lock calibration and ceremonial arm movement. |
| Kael | S1/Ultimate crouching and sword swings explain lower silhouettes; sword/glow can fragment the mask. Preserve authored poses. S2/Ultimate feature estimates remain inconclusive; no guessed enlargement. |
| Garrick | Raised hammer enters the opened silhouette; Ultimate height cannot stand in for body size. Preserve the original clips. |
| Mo Ye | Comparable endpoints within roughly3% by feature screening; preserve crouches/vanish/airborne motion. |
| Tang Xun | Comparable endpoints within roughly3%; retain existing normalization config and authored root motion. |

This review does not certify identical anatomy or costume proportions across independently drawn sources. Those differences remain in the approved art. It corrects the supported scale/registration faults without redrawing poses or stretching individual body parts.

## Pipeline and verification

Rebuild with tools/sprites/elira.py and the same original Base/reference/S1/S2/Ultimate sources documented in the Elira reviews, then npm run sprites:optimize. Scaling now happens from original source pixels in the normal bake, avoiding repeated enlargement of an already baked atlas. Repeated bakes must produce identical output; source files remain untouched.

Checks: app/spec typechecks, optimizer,707/707 Karma and production build pass. The first Karma run passed706 tests with one WebGL-dependent test pending; rerun with explicit software-WebGL support passed all707, including the renderer test. Geometry/source checks cover exact protected-pixel equality, zero clipped source pixels, idempotent rebake, unchanged originals and lossless visible character RGBA in optimized WebP. No combat simulation repeat is required because timeline/config/gameplay code is identical.

Native before/after DPR2 Pixi/DOM reviews exercise Idle and all3 skills, both facings, return to Idle and effect cleanup. The before browser receives the exact published pre-fix WebP; the after browser receives generated optimized art. Source frames/contact sheets and verification records live in ignored tmp/hero-scale-audit and tmp/hero-scale-fix. The60FPS character-only transition video samples the actual UnitClip clock using the original and regenerated atlases; native app keyframe checks are separate. these remain provisional visual review artifacts.
