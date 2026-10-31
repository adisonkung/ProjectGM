# Aegis Judgement: spear-centred larger impact — 1 November2026

User requested a slightly wider/larger S2 Judgement explosion, with the spear tip at its centre.

The native ae-s3-wave (legacy asset name for current S2) grows from3.6×2.4 to4.2×2.8 visual cells, about17% on each axis. It now spawns at the physical contact-frame spear-tip anchor, instead of the logical attack rectangle centre. The atlas contact point is264,252 in the340×280 actor cell; its scaled anchor is188%,0.5% from the default cell centre at displayScale1.6. Facing mirrors x. The effect's bright core pivot is(.5,.76), keeping the contact at the explosion centre as its art grows. It is frozen in world space after spawning and stays under the spear/actor.

The previous bottom-edge alignment and per-frame bottom compensation are replaced by this contact-centred pivot. Extra lower scenery accommodates the larger lower edge. The warning/damage region remains the existing six forward cells; larger visual glow does not add damage cells. No charge timing, recoil, beam timing, cooldown, base stats or native PNGs changed.

Actual-game review: [images and comparison](review-images/2026-11-01-aegis-impact-centre/README.md). Desktop1440×900 and landscape mobile932×430. Controlled high-HP/manual-skill fixture, native sprites and effects. Regression checks project the authored spear tip using the same sprite geometry and check the native effect origin in both facing directions; component tests keep logical warnings separate from physical impact anchoring. Full validation is in checks.json.
