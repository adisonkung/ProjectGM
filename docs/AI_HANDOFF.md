# Current Development State

Git is authoritative. Query current commit/tree with `git rev-parse HEAD HEAD^{tree}`; this note never records its containing commit as a sync base.

Last task:
Mirelle Frostglass — The Winter Scholar, Phase A (Codex, user-approved 2026-10-17): existing Mage, Control DPS, hero/kit registration, generic Slow/conditional status/2×2 area/persistent fields, provisional presentation slots and tests. Follow-up user request integrates approved base art and shows an actual in-game comparison. No final S1/S2/Ult timing or Timeline Sync Sheet. Stop before skill production.

Branch:
`wip/codex-hero-mirelle`. Fresh fetch now succeeds; origin/master remains the original base. No master or other task branch changed. Push was rejected by automatic approval review pending explicit confirmation of code export to adisonkung/ProjectGM. Do not bypass/retry that export until user approval.

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
- `mirelle-production.ts` records pending skill slots/events. Approved base sheet/portrait and separate basic-attack crystal projectile are now registered. No final skill clips; existing basic-attack fallback is provisional and affects timing compared with the old tokens.

Assets:
User uploaded `mirelle-source.zip`, accessible in this chat. Original PNGs copied byte-for-byte to `art/incoming/mirelle/{reference,base}.png` (read-only/gitignored). `tools/sprites/mirelle.py` uses the shared bake pipeline: 7×8 atlas, 260×170 cells/root 130,155, idle body 78 px, base rows 5/7/4/7/6. Portrait cropped from master close-up; free normal-attack ice shard separated from character. No redesign, source changes or new skill art.
- Runtime: `public/sprites/hero-mirelle.png`, `fx-mirelle-basic-crystal.png`, `public/portraits/mirelle.webp`, optimized copies and generated atlas.
- Pixi + DOM comparison: `/sprite-lab?hero=mirelle&compare=kael,garrick&enemy=forest_slime&bg=forest-1&render=pixi`. Generic optional lab parameters do not alter saves or combat.
- Real screenshots (gitignored): `tmp/mirelle-preview/mirelle-in-game-{pixi,dom}.png` at DPR 2; idle/move/attack/hurt/death checked, no page errors.

Validation:
- App/spec typechecks pass. Full Karma: 631/631 passed (includes 20 new cases).
- Default `hero-sim -- 10` passed: F1–4/F6 100%; F5/F7/F9/F10 0%; F8 AUTO 0% / TACTICAL 50%. Known balance issues preserved.
- Production build passed after network access was restored; no font/build config workaround committed.
- Mirelle-team sim completed: `hero-sim 10 --team=bailong,yuezheng,mirelle,tangxun,linxue --stats`; no runtime errors. Mirelle contributes 30% of aggregate AUTO team damage with provisional token timing. This is not a balance conclusion.
- Base-art follow-up: 631/631 tests pass; app/spec typechecks and production build pass. Mirelle-team sim (10 runs/floor) completes after new base-clip timing. Sprite optimizer run; zero clipped pixels. Source PNG bytes match uploaded originals.
- Task commits are local only. Base-art integration complete; stop before S1 production.

Details:
`docs/MIRELLE_PHASE_A.md`, `core/data/mirelle-production.ts`, `battle/engine/{fields,winter-scholar}.spec.ts`.

Next agent must inspect:
- Git branch/status/history and fresh remote refs; remote availability is unresolved.
- Current `HEROES`, `HERO_DEFINITIONS`, status/field/rank systems and Phase A tests.
- Read-only original ZIP-derived PNGs before rebaking; skill-specific art is still missing.
- Stop boundary: S1 production → user review → S1 Timeline Sync → S2 production/review/sync → Ult production/review/sync. Do not skip reviews or create final timing in Phase A.

Known pre-existing issues:
Balance remains deferred until the roster is complete; shipped-roster F5/F7–F10 issues remain. `DEV_FLAGS.fullUltAtStart` remains ON. Tang Xun ult surround positioning issue is unchanged.
