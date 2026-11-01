# Expanded sprite lab — actual game review

Desktop1440×1100, landscape mobile932×430. Actual Angular room, existing native game sprites and effects, DOM renderer. No image generation or compositing.

- [Before: existing room](desktop-before.png), [new default room](desktop-default.png).
- [Boss caster and position controls](desktop-aegis-setup.png), [mobile](mobile-aegis-setup.png).
- [Aegis beam](desktop-aegis-beam.png), [Jade landing](desktop-jade-landing.png), [Solar beam](desktop-solar-beam.png).
- [Hero versus selected boss target](desktop-hero-vs-boss.png), [mobile](mobile-hero-vs-boss.png).

The Jade impact fixture holds the live native effect/pose for inspection; it does not alter sprite pixels. Full-page captures retain the setup panel, enlarged arena and action controls. Mobile intentionally scrolls vertically to provide room for the enlarged map; browser QA verifies no horizontal overflow.

Reference design: [Sheet15](../../design/eldervane-ui/15-development-labs.png). The user's new controls and expanded map are intentional departures from that original layout. The prior actual-game capture above supplies the direct before/after comparison.

Verification JSON records browser errors, selected actors, native beam FX and successful numeric/grid placement. checks.json records final tests/build. See [implementation](../../SPRITE_LAB_EXPANDED.md). No save writes or deployment occurred.
