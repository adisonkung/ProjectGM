# Current Development State

Git is authoritative. Query current commit/tree with `git rev-parse HEAD HEAD^{tree}`; this note never records its containing commit as a sync base.

Last task:
Mirelle Frostglass — The Winter Scholar, Phase A (Codex, user-approved 2026-10-17): existing Mage, Control DPS, hero/kit registration, generic Slow/conditional status/2×2 area/persistent fields, provisional presentation slots and tests. No final S1/S2/Ult timing, skill art or Timeline Sync Sheet. Stop after Phase A.

Branch:
`wip/codex-hero-mirelle`, created from cached `origin/master`. Fetch and initial branch push failed because the configured proxy could not connect. Latest GitHub state and the user's local clone cannot be verified here. No master branch was edited or pushed. No other task branch was changed.

Last confirmed local commit (previously verified base, unchanged):
`3a61ffba88f1004661f73e06d271adb6569d2396`

Last confirmed common tree (previously verified base, unchanged):
`fc3456568a99d3b449a21fce552f4b3b0800b83c`

Implementation:
- `HEROES` now has 8 shipped templates; Mirelle is `mirelle`, Mage 3★, no starter/bench grant.
- Class IDs/rank tables retained. R1: Frost Needle 120% magic + Slow 25% (45% if Chilled); Glassbind 2×2 80% magic + Chill, previous Chill → Root 1 s; Winterglass Field 3×3, 6 s, 15% magic per second + Slow 25% / attack-speed reduction 10%.
- All values are provisional gameplay parameters. No new class or existing hero/stage rebalance.
- Generic `FIELD` / `FieldSystem`: fixed center, current occupants, combat-clock pulses, source-death cancellation, target-death independence, cleared on advance/end. Short control lingers at most 1.1 s after exit.
- Negative attack-speed modifiers now slow the monster cooldown clock; legacy positive-haste behavior is preserved.
- `mirelle-production.ts` contains pending asset/clip/event requirements only. Runtime uses existing token timing; no missing sprite/FX URLs are registered.

Assets:
User approved Master Character Reference and Base Combat images in chat. Neither original file is available in this cloud filesystem; `/Users/webuild/Downloads/...` is not mounted. Preserve the exact approved Western fantasy design. No replacement art was generated. Base-sprite cutting/portrait/runtime art registrations remain pending source access. No sprites changed, so optimizer is not required for this phase.

Validation:
- App/spec typechecks pass. Full Karma: 631/631 passed (includes 20 new cases).
- Default `hero-sim -- 10` passed: F1–4/F6 100%; F5/F7/F9/F10 0%; F8 AUTO 0% / TACTICAL 50%. Known balance issues preserved.
- Development build passed. Production build blocked at Google Fonts inlining by unavailable network/proxy; no source/build config workaround was committed.
- Mirelle-team sim completed: `hero-sim 10 --team=bailong,yuezheng,mirelle,tangxun,linxue --stats`; no runtime errors. Mirelle contributes 30% of aggregate AUTO team damage with provisional token timing. This is not a balance conclusion.
- No PNG changes; sprite optimizer not needed.
- Task commits are local only: pushes fail at the environment proxy. Phase A is complete within available assets; stop here.

Details:
`docs/MIRELLE_PHASE_A.md`, `core/data/mirelle-production.ts`, `battle/engine/{fields,winter-scholar}.spec.ts`.

Next agent must inspect:
- Git branch/status/history and fresh remote refs; remote availability is unresolved.
- Current `HEROES`, `HERO_DEFINITIONS`, status/field/rank systems and Phase A tests.
- Approved source-image availability before baking any asset.
- Stop boundary: S1 production → user review → S1 Timeline Sync → S2 production/review/sync → Ult production/review/sync. Do not skip reviews or create final timing in Phase A.

Known pre-existing issues:
Balance remains deferred until the roster is complete; shipped-roster F5/F7–F10 issues remain. `DEV_FLAGS.fullUltAtStart` remains ON. Tang Xun ult surround positioning issue is unchanged.
