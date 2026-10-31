# Aegis / Jadecrest presentation size follow-up

User feedback on the full-size game captures: both bosses were still too small. Jade's charge and landing rings also need to remain proportionate to its enlarged body.

- Aegis display scale: **1 → 1.6** (+60%). Shield-core, normal spear-tip and raised Judgement-tip anchors follow the enlarged source geometry. Judgement's existing tip-motion track scales with the spear. Barrier and core effects grow with the body.
- Jadecrest display scale: **1.25 → 1.8** (+44% from the reviewed image). Mouth, roar charge, jade core, claw and air-trail offsets remain registered to their physical points.
- Charge circle: **4.8 → 5.8 cells**. Landing and rim: **5 → 6.2 cells**. Landing ripple: **4 → 5.2 cells**. Ground pivots stay fixed at the reviewed floor anchors; the boss stays at the circle centre. The small target-selection ring stays hero-sized.
- Aegis receives **0.3 decorative sky rows** with its existing **0.8 ground rows** retained, to fit its raised spear charge on short phones. Square cells still fit the viewport; this is scenery space, not another playable lane. Hero/boss relative scale is preserved when the viewport constrains cell size.
- Both logical boss bodies remain **3×2**. Attack areas, damage, cast times, tier scaling and specialist mechanics are unchanged. Visual glow/rims can extend beyond the damage cells.
- Real review exposed a presentation bug in the new landing warning: the caster's interpolated start position was applied to an already-committed destination. Fixed ground events now use world cell + formation origin − camera; following target warnings still track the target. A component regression covers a caster still travelling from a different cell.
- Native PNGs and generated atlases are unchanged. This scales original pixel art; it does not invent extra source detail. New point-registration tests compare the same authored source pixel through unit geometry, and preserve the feet at desktop/mobile cell sizes.

Actual unretouched runtime screenshots and verification JSON: `docs/review-images/2026-10-31-guardian-size/`. Reference screenshots: `../2026-10-31-ascension-mechanics/` within review-images. Captures of the landing impact wait for its real FX age, rather than assuming wall-clock time equals simulation time.

The user's question about swapping Aegis S2/S3 was answered as a recommendation: Guard → ground Judgement → charged beam, with the Break/exposure check on the beam. **That swap was not applied in the size-only review. It is now applied by the subsequent user correction; see [AEGIS_SLOT_ORDER.md](AEGIS_SLOT_ORDER.md).**

Known boundary limit: enlarged Jade can overhang the left field mask after a legal corner pounce. Corner captures are retained explicitly. The separately controlled bottom-row landing fits the lower floor margin; this does not claim every possible corner effect is unclipped. No combat destination restriction or collision change was introduced just to conceal the overhang.

Validation completed: app/spec typechecks, 925/925 Karma specs, production build and 30 actual desktop/mobile screenshots. No page errors. Main and controlled bottom-row landings reviewed; the corner overhang remains explicitly documented.
