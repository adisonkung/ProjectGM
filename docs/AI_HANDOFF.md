# Current Development State

Git is authoritative. Query current commit/tree with `git rev-parse HEAD HEAD^{tree}`; this note never records its containing commit as a sync base.

Last task:
Mirelle Frostglass — The Winter Scholar (Codex, 2026-10-17): Phase A, base art and S1 provisional review/readability revision complete. The user then requested S2 assets and supplied `mirelle-s2-source.zip` to continue. S2 character/Main/Bind and a real-engine review are integrated. Stop for individual S2 visual review. Final S1/S2 timing/Sync Sheets are still pending; no Ultimate production.

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
- `mirelle-production.ts` records review/pending states. Base sheet/portrait/basic projectile and supplied S1/S2 assets are registered. S1 uses uniform 12 FPS, release F7, recovery F9; S2 has 20 actual poses at provisional 12 FPS, activate F13, recovery F17. Ult still explicitly shares the original basic-attack object. No final timing or Sync Sheet.

Assets:
User uploaded `mirelle-source.zip`, accessible in this chat. Original PNGs copied byte-for-byte to `art/incoming/mirelle/{reference,base}.png` (read-only/gitignored). `tools/sprites/mirelle.py` uses the shared bake pipeline: 7×8 atlas, 260×170 cells/root 130,155, idle body 78 px, base rows 5/7/4/7/6. Portrait cropped from master close-up; free normal-attack ice shard separated from character. No redesign, source changes or new skill art.
- S1 follow-up: `art/incoming/mirelle/s1/{s1_character,s1_projectile,s1_impact}.png` plus supplied XLSX (read-only originals). Atlas now 10×8, row5 S1 has 10 frames; first five base rows pixel-identical. `mirelle_s1.py` cuts alpha-aware irregular projectile stages3–8 + blank terminal and separate 8-frame impact. No generated replacement art. Workbook is a provisional proposal, not final timing authority; see `docs/MIRELLE_S1_REVIEW.md` for hashes and known origin limitations.
- Runtime: `public/sprites/hero-mirelle.png`, `fx-mirelle-basic-crystal.png`, `public/portraits/mirelle.webp`, optimized copies and generated atlas.
- Pixi + DOM comparison: `/sprite-lab?hero=mirelle&compare=kael,garrick&enemy=forest_slime&bg=forest-1&render=pixi`. Generic optional lab parameters do not alter saves or combat.
- Real screenshots (gitignored): `tmp/mirelle-preview/mirelle-in-game-{pixi,dom}.png` at DPR 2; idle/move/attack/hurt/death checked, no page errors.
- S1 preview: add `distance=4` to that lab URL. Generic single-target PROJECTILE lab playback uses real board/projectile/FX renderers, primary-only arrival reaction, and clears pending visuals on reset. Existing fixed sample damage text is visual only. Real MP4/GIF/close-up/DOM/mirrored captures are in ignored `tmp/mirelle-s1-preview/`.
- User review correction: old GIF used CSS-resolution frames enlarged to a close-up, contributing blur. Character body still78px, optimized visible RGB/alpha are lossless and sampling is nearest. S1 projectile rebaked peak32→56px (×1.75), impact32→64px (×2); no character, timing or gameplay changes. New device-resolution DPR2 PNG/MP4 captures: `tmp/mirelle-s1-readable/`. Continue to wait for S1 review before final Sync.
- S2 originals in read-only `art/incoming/mirelle/s2/` (3 PNGs + supplied draft XLSX). Actual character20 poses versus workbook's hypothetical10; use art/repository values. Atlas now20×8, row6 S2; base/S1 pixels unchanged. `mirelle_s2.py` writes separate 8-frame Main/Bind, no fabricated assets. Runtime main is one ground2×2 visual; Bind is from successful Root buff events only. See `MIRELLE_S2_REVIEW.md` for hashes/details.
- New generic presentation: `FxDef.groundArea`, shared `square2Center`/`groundFxCell`, caster `appliedStatusFx` mapping consumed by existing successful buff events. No new gameplay mechanic or engine hero-specific conditional; area helper extraction preserves targeting. Battle ground FX use logical cells/world origin/camera and retain initial aim after target death.
- S2 real-engine lab: `?hero=mirelle&enemy=forest_slime&bg=forest-1&distance=4&formation=square&combat=1&status=chill&render=pixi` (optional compare). INSTANT-skill replay uses high-HP training foes, real source stats/kit, freezes automatic actions from the initial step, never writes saves. Only primary starts Chilled. Captures `tmp/mirelle-s2-preview/` are native DPR2 PNG/MP4, no-Chill/DOM/mirrored cases also checked.

Validation:
- App/spec typechecks pass. Full Karma: 631/631 passed (includes 20 new cases).
- Default `hero-sim -- 10` passed: F1–4/F6 100%; F5/F7/F9/F10 0%; F8 AUTO 0% / TACTICAL 50%. Known balance issues preserved.
- Production build passed after network access was restored; no font/build config workaround committed.
- Mirelle-team sim completed: `hero-sim 10 --team=bailong,yuezheng,mirelle,tangxun,linxue --stats`; no runtime errors. Mirelle contributes 30% of aggregate AUTO team damage with provisional token timing. This is not a balance conclusion.
- Base-art follow-up: 631/631 tests pass; app/spec typechecks and production build pass. Mirelle-team sim (10 runs/floor) completes after new base-clip timing. Sprite optimizer run; zero clipped pixels. Source PNG bytes match uploaded originals.
- S1 follow-up: app/spec typechecks pass, full Karma **635/635 passed**, production build and Mirelle-team 10-run/floor sim complete, sprites optimized. DPR2 Pixi/DOM/base actions/mirrored S1 have zero page errors. No engine change, kit retuning, or other hero rebalance.
- S2: app/spec typechecks, **640/640 Karma**, production build and Mirelle-team sim passed. Main once, four Chill/one Root with pre-Chill; four Chill/no Root without it. Pixi all7 units, DOM/mirror/base/S1 regressions have zero page errors. No DoT/field mechanic, kit/rank change, or final timing.
- Task commits are local only. Stop for S2 visual review; final S1/S2 Sync and Ultimate assets remain pending.

Details:
`docs/MIRELLE_PHASE_A.md`, `docs/MIRELLE_S1_REVIEW.md`, `docs/MIRELLE_S2_REVIEW.md`, `core/data/mirelle-production.ts`, `battle/engine/{fields,winter-scholar}.spec.ts`, `pages/sprite-lab/{skill-review,sprite-lab.component}.spec.ts`, `pages/battle/battle.component.spec.ts`.

Next agent must inspect:
- Git branch/status/history and fresh remote refs; fetch works, push still awaits the exact export approval noted above.
- Current `HEROES`, `HERO_DEFINITIONS`, status/field/rank systems and Phase A tests.
- Read-only original ZIP-derived PNGs before rebaking; S1/S2 sources are available, Ult art is still missing.
- Stop boundary: S1 production → user review → S1 Timeline Sync → S2 production/review/sync → Ult production/review/sync. Do not skip reviews or create final timing in Phase A.
- Latest user steering advanced to S2 source production; do not infer final S1 timing approval from that. Stop at S2 preview and await the remaining individual timing reviews.

Known pre-existing issues:
Balance remains deferred until the roster is complete; shipped-roster F5/F7–F10 issues remain. `DEV_FLAGS.fullUltAtStart` remains ON. Tang Xun ult surround positioning issue is unchanged.
