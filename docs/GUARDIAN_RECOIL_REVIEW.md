# Guardian forward art and Aegis beam recoil — 1 November 2026

User correction after viewing the 4×2 Judgement impact: bring both Aegis and Jade one cell forward; recoil Aegis art two cells on beam release, hold during firing, then walk back without moving its logical target. Follow-up: increase firing duration to read as an ultimate.

## Implemented presentation

- Aegis and Jade actor art is one cell forward along facing. Logical 4×2 footprints, O cells, engine x/y, reservations, melee contact and target selection do not move.
- Aegis S3 release: ease out into a two-cell backward recoil over 0.16s; hold until 2.55s after release; walk the two cells back over 0.7s. It returns to the new forward art baseline at 3.25s. Release facing stays locked.
- Full beam: 2.4s, followed by 0.15s fade. Shaft height increases from 4.5 to 5 visual cells; muzzle from 4.6 to 5. Both follow the actor; shaft length updates to keep its far end at the board edge while the boss recoils.
- Native firing pose is held for 2.55s, then the existing walk clip plays during the return. The presentation clock uses simulation time, so pause/hit-stop and battle speed apply.
- Beam recovery extends from 0.96s to 3.25s so another action cannot interrupt firing/return. Cast charge stays 3s, cooldown18s, damage1.5× once at release and all three lanes as before. This is not a continuous damage channel.
- Judgement's logical forward impact and warning retain the body-front origin. Moving Aegis art forward brings its downward spear nearer that existing impact. Jade attached floor/mouth effects move with its art.
- Logical warning/grid coordinates remain separate from actor coordinates. No engine displacement or chase event is emitted for recoil. The render helper also leaves Solar and every hero unchanged.

## Review and validation

[Actual-game images and video](review-images/2026-11-01-guardian-recoil/README.md). Desktop 1440×900 and mobile932×430 fixtures use the shipped actors/native effects; high hero HP and manual hero skills preserve the full sequence for inspection. Previous screenshots remain in the earlier 4×2 review folder for comparison.

The component regression exercises the real release event, held pose, changing beam length, walking return and unchanged boss/hero logical cells. Pure presentation tests check continuous recoil/hold/return boundaries and shared beam/muzzle/recovery timing. Full test/build results are recorded in the review checks.json. Native PNGs are unchanged.
