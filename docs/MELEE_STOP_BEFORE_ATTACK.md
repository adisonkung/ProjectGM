# Stop before a basic melee swing

User request: melee actors still slide while attacking; finish approaching before starting the swing.

Two causes existed: physical contact could be valid before the actor finished travelling to its current column (notably monsters/wider melee reaches), and the board's smoothing could continue trailing the settled engine position after the attack event. The existing range and half-lane contact rules alone did not stop either case.

## Change

- Hero/legacy melee basics and native melee monster attacks share an arrival check before emitting attack or spending the attack cooldown. Exact-duration displacement must finish first. Horizontal travel must reach the current column within the existing0.05-cell settle tolerance; the sampling remainder is then planted exactly at that column.
- Real vertical contact remains the existing half-lane rule. A valid contact stance holds its current y rather than repeatedly chasing the opponent's changing fractional stance. This preserves two approaching melee units' ability to engage each other.
- Range is checked again after planting and still checked at the actual hit event. A target that moves out of reach can still cause a miss. Rooted/stunned actors do not receive a new forced vertical approach.
- A planted melee windup uses the board's exact contact snapshot instead of trailing interpolation/stack-offset easing. Both DOM and Pixi read the same drawn coordinates. Movement grace no longer asks the planted actor to keep walking.
- Ordinary walking remains smoothed. Ranged/heal-bolt actions, skill/ultimate cast rules, dedicated interrupt behavior, authored root-motion lunges, damage, attack cadence, range, cooldown and clip timings are unchanged. This does not freeze the actor for a newly extended recovery period.

## Verification

The first new regression run reproduced four failures before the fix: hero swing at x5.75 while its destination was6; monster swing at7.15 while its destination was7; normal swing before an active dash completed; and a drawn board position remaining570% instead of the planted600%.

Targeted tests cover those cases plus ranged basics during repositioning, physical range after the final planting correction, existing vertical contact/root/miss rules and full-body boss contact. Run:

```
CHROME_BIN=/usr/bin/chromium npm test -- --watch=false --karma-config=karma.ci.cjs --include=src/app/battle/engine/melee-contact.spec.ts --include=src/app/battle/board/board.component.spec.ts
```

Final full test/build/typecheck and shipped-roster simulation results are recorded in [the review folder](review-videos/melee-stop-before-attack/README.md). The3-seed ×10-floor ×AUTO/TACTICAL simulation is60 battles; it is a movement regression run, not a roster balance certification. Existing difficulty walls are not retuned.

The actual-game before/after fixture preserves Bai Long's native range1 and uses a stationary first-floor monster; training HP and disabled skills keep the approach visible. This also checks the rendering case where engine contact was already correct but the displayed actor continued easing. Native sprite assets are unchanged.
