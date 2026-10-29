# Fractional cross-lane melee contact — 2026-10-29

User request: melee units in middle/lower lanes look too far apart when attacking diagonally; close by roughly one-quarter to one-half cell before attacking. This explicitly refines the former rule where any diagonal neighbor counted as melee contact. The grid remains the source for placement, occupied cells and skill areas.

Implementation:

- Basic melee reach (range ≤1.5) checks continuous world body bounds as well as logical range. Horizontal gap retains authored reach; vertical surface gap must be ≤0.5 lane, plus 0.01 sampling tolerance.
- A unit can approach up to half a lane inside its existing cell. Against a stationary adjacent-lane opponent it closes half a lane; when both approach, they typically close around a quarter each. Both destination calculations use the same pre-glide positions.
- Hero basic attacks and monster melee attacks wait for contact; both recheck at the scheduled hit event. A target moving away during windup produces a miss. Monster horizontal hit tolerance is preserved; it does not permit a full-lane diagonal hit.
- Root/stun and active attack/cast clips prevent new fractional approaches. Dash/blink motion keeps its dedicated handling. Ranged movement/reach, healer bolts, skill shapes/range, logical occupancy, damage stats and authored clip timing are unchanged. Close-combat skills already waiting for the body to settle now settle at the contact stance; this is not a general retargeting/reach rewrite for skills.
- Multi-cell bosses retain their authored anchor; contact and approach use their nearest occupied body edge, so attackers need not converge on the boss's bottom anchor lane.

Validation:

- App/spec TypeScript checks and production build pass (existing warnings retained).
- 900/900 Karma specs pass, including 12 new geometry/engine cases: top and bottom lanes, moving and stationary opponents, roots, same-lane attacks, world-position lag, boss footprint, ranged preservation and misses during either side's windup.
- Three existing tests corrected: Vaelric's forced contact-hit test now sets up same-lane physical contact; slime death-cancel test waits for actual first contact instead of assuming a two-second approach; Sylas projectile-speed test measures distance at release instead of after subsequent chasing/kiting. No damage/skill expectations weakened.
- Shipped-roster simulation: 3 seeds × floors 1–10 × AUTO/TACTICAL = 60 battles complete. [Report](melee-contact-review/hero-sim.txt). This is a movement regression run, not a balance certification; existing roster difficulty walls remain, no rebalance performed.
- Actual Chromium game, `/lab?floor=1&render=dom`,1440×900,DPR2: isolated Bai Long/Slime setup in browser memory, other units hidden and slime stunned. Hero stays in logical cell `{r:1,c:6}` while y progresses 1→1.09→1.18→1.27→1.36→1.45→1.5. No attack until y=1.5 against target y=2.0. No page errors. [Positions](melee-contact-review/positions.json).

[Before approach](melee-contact-review/before-approach.png) · [At first permitted attack](melee-contact-review/at-contact.png) · [Cropped comparison](melee-contact-review/compare.png)

These are two moments from the same running implementation, not a fabricated before/after code comparison. Source screenshots are unretouched; the comparison only crops and arranges their battlefield region. Reference for behavior is the user's quarter/half-cell instruction, not a supplied UI design.

Branch `fix/combat-melee-lane-contact` starts at freshly fetched master f85731d. Earlier UI commits remain on `fix/lobby-profile-customization`. No merge/deploy/push; previous GitHub export approval is still pending. Confirmed canonical-local sync base is unchanged.
