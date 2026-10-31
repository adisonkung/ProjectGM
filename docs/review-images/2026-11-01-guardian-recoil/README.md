# Guardian forward art / Aegis recoil review

Actual running-game captures: desktop1440×900, landscape mobile932×430. The fixture uses native actors/effects, HP5000/low-ATK/manual hero skills, with only the selected boss skill enabled to preserve the sequence. Temporary diagnostic overlays distinguish logical cells from art; they are not shipped UI.

- [Aegis closer Judgement impact](desktop-aegis-s2-slam.png), [mobile](mobile-aegis-s2-slam.png).
- [Aegis charge at forward baseline](desktop-aegis-s3-charge.png), [beam after recoil](desktop-aegis-s3-beam.png), [beam still firing at2s](desktop-aegis-s3-beam-held.png), [return walk](desktop-aegis-return.png), [restored baseline](desktop-aegis-restored.png).
- [Jade forward position](desktop-jade-standing.png), [logical cells](desktop-jade-cells.png).
- [Previous Aegis impact](../2026-11-01-boss-footprints-4x2/desktop-aegis-s2-slam.png), [previous beam](../2026-11-01-boss-footprints-4x2/desktop-aegis-s3-beam.png), [previous Jade](../2026-11-01-boss-footprints-4x2/desktop-jade-standing.png).

The 4×2 O cells are unchanged: Aegis lower third column, Jade lower fourth. Boss art now sits one cell forward of its O. The beam release moves only its drawn actor, not the logical reservation. Ground warnings/damage still use logical coordinates.

See verification JSON and checks.json for results; [implementation notes](../../GUARDIAN_RECOIL_REVIEW.md) describe timing and the longer recovery. No new sprite pixels were generated.

[Side-by-side comparison page](comparison.html).

[Video: charge → recoil → held beam → return walk](../../review-videos/2026-11-01-guardian-recoil/aegis-s3-recoil.mp4).
