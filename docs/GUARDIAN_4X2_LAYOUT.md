# Guardian 4×2 layout — 1 November 2026

User-requested logical footprints, all three ascension tiers:

```
Aegis                Jadecrest
x x x x              x x x x
x x O x              x x x O
```

Both spawn at O = row 2, column 11. Aegis occupies rows 1–2 / columns 9–12 (anchor 2,1); Jade rows 1–2 / columns 8–11 (anchor 3,1). Solar remains 3×2. These are occupancy cells, independent of sprite pixel size. Top-row melee contact remains at row 0.5; increasing width does not lower it.

Aegis has 1.4 decorative sky rows, increased from 0.3, to accommodate the raised Judgement spear. The existing 0.8 lower decorative rows remain. The playable board still has three lanes. Cells stay square; fitting the extra empty room makes the board's cells smaller on height-limited screens. Relative boss/hero sprite scales remain unchanged.

## Skills and effects

Forward ground attacks now originate at the leading occupied column, rather than O, so their damage does not fall inside the enlarged reserved body. The cast-time facing remains locked. Warning rectangles and native ground effects use the same origin.

- Aegis S2 Judgement: forward 3×2 hits columns 6–8, rows 1–2 at the initial left-facing spawn. Its wave grows from 3×2 to 3.6×2.4 visual cells.
- Jade S1 stomp and S3 roar: forward 2×3 hits columns 6–7, rows 1–2 at the initial spawn (the nominal third row clips to the board). Stomp visual origin is one cell ahead of the body front, with its existing floor pivot and texture direction.
- Jade pounce still lands the complete reserved body on free cells. Radius-2 landing damage measures distance from that body, so an adjacent victim can be struck at either end when landing near a board boundary.
- Aegis contact impacts, barrier hit and beam muzzle are larger. Jade stomp, landing/rim/ripple, roar and contact impacts are larger. Larger glow does not enlarge a skill's damage cells.
- Aegis slot order remains S1 Guard, S2 Judgement, S3 Light Lance. Base stats, multipliers and cooldowns are unchanged.

## Fractional 4×1.5 question

Feasible as a separate continuous contact/hit region alongside integer 4×2 occupancy. The existing grid, free-cell search and reservation logic require whole cells; setting rows to 1.5 directly would produce inconsistent cell keys and collision checks. A proper version must define melee stand positions, range and AoE intersection consistently. This revision implements the requested 4×2 diagrams only; fractional contact and lower top-lane stand positions are not implemented.

## Actual-game review

[Review images and verification](review-images/2026-11-01-boss-footprints-4x2/README.md): 13 actual game captures per viewport, desktop 1440×900 and landscape mobile 932×430; no console/page errors. Diagnostic grids are temporary review overlays, not game UI. Controlled fixture uses the existing five heroes with high HP and manual skills to preserve the cast for inspection.

Regression tests cover all-tier footprints, leading columns, unchanged top-lane contact, forward damage recipients, pounce reach on both body ends, and warning/native-effect agreement. Existing movement/blink fixtures were moved outside the new reservation. Targeted combat simulation covers 360 battles across both guardians, three tiers, three equipment profiles, two parties, AUTO/TACTICAL and five seeds. It is a spatial regression sample, not a balance certification. Native sprite PNGs are unchanged.
