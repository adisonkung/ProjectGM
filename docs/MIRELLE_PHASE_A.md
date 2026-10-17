# Mirelle Frostglass — The Winter Scholar · Phase A

User-approved scope, 2026-10-17: hero/gameplay foundation only. Classic Western Fantasy / Kingdom Adventurers.

## Registration and scope

- ID `mirelle`, Thai name มิเรลล์ ฟรอสต์กลาส, existing `mage` class, provisional base rarity 3★.
- Added to `HEROES` and `HERO_DEFINITIONS`; gacha discovers her through `HEROES`.
- Uses Mage stats, equipment, positioning and magic-bolt basic action. No starter/bench grant.
- No other hero kit, class stats, rank table, stage or balance value was changed.
- `core/data/mirelle-production.ts` records pending clip, asset and semantic-event slots. It is NOT a runtime sprite/FX registration.

## Provisional gameplay (R1, not final balance or animation timing)

| Slot | Skill | Foundation behavior |
|---|---|---|
| S1 | Frost Needle / เข็มเหมันต์ | Single-target MAGIC 120% ATK projectile. Slow 2 s: movement ×0.75, or ×0.55 if already Chilled on arrival. Mage cooldown 7 s. |
| S2 | Glassbind / พันธนาการแก้วเยือกแข็ง | MAGIC 80% ATK to all occupants of a 2×2 area. Previously Chilled recipients Root 1 s; every damaged survivor gets Chill 4 s. Mage cooldown 14 s. |
| Ult | Winterglass Field / อาณาเขตแก้วเหมันต์ | Fixed 3×3 field for 6 combat seconds. First pulse after 1 s, then once per second through second 6: MAGIC 15% ATK per occupant; movement ×0.75 and attack speed ×0.90 for 1.1 s. No launch burst or damaging finisher. |

The 6 s duration and 1 s pulse interval are gameplay parameters, not a character/VFX timeline. Production may revise them explicitly; no final skill frame counts, per-frame timings, Sync Sheets, or VFX delay values are authored here.

- Existing Mage skill IDs remain `soul_curse`, `bone_hand`, `soul_beam`, preserving existing rank tables.
- Ranks scale pulse DAMAGE on a copy. Glassbind inherits the class Root duration upgrades (R3/R5: 1.65/1.8 s); R1/R2 stay 1 s. Existing rank tables are unchanged.
- No dedicated interrupt, Break, forced crit or burst shatter damage.
- `chill` is a refreshable setup marker, not a movement/action lock; S1 and Ult do not add Chill.
- Status conditions snapshot each recipient before this hit's effects. Newly applied Chill cannot Root on that same hit, regardless of effect ordering.
- `slow` opts into MINIMUM modifier refresh: one instance, stronger Slow retained until that refreshed instance expires, no multiplication on refresh.
- Existing immunity/Unstoppable rules govern Root; brief control never implicitly interrupts.

## Generic engine additions

- `moveSpeedMultiplier` and `effectiveMoveSpeed`: voluntary movement intervals for heroes and monsters, plus combat glide. Base stats and wave-transition movement are untouched.
- Negative attack-speed factors slow the data-driven monster cooldown clock. Its existing positive-haste handling is preserved; no unrelated haste fix/rebalance was included.
- `APPLY_STATUS.when`: recipient status-present/absent condition before this hit's effects.
- `SQUARE_2`: primary cell plus one column toward the enemy; two lanes from the primary lane. At the bottom lane use the previous lane. No wrapping at board edges; every stacked occupant is considered.
- `FIELD` and `FieldSystem`: independent fixed center, current-occupant queries on pulses, combat-clock lifetime, start/end events. No art dependency or wall-clock timer.
- Field keeps working if the original target moves/dies. Source death cancels it. Wave advance and stage end clear it. No pulses during transitions or after completion.
- Control refreshes on each field pulse; after leaving, its last control application can linger at most 1.1 s. No follow-target aura or portable DoT substitution.
- Rank traversal and the skill detail text include nested field effects.

## Approved images and missing production assets

Approved references shown in chat:

1. `ChatGPT Image Oct 17, 2026, 12_38_47 AM.png` — Master Character Reference.
2. `ChatGPT Image Oct 17, 2026, 12_39_00 AM.png` — Base Combat Sprite Sheet.

Preserve face, hairstyle, proportions, costume, book, floating crystal focus, navy/ice-blue/muted-silver palette and silhouette. No redesign or Chinese/wuxia/xianxia motifs.

The initial Phase A used token fallback. The subsequent user-uploaded `mirelle-source.zip` supplies byte-identical PNGs now copied into the source slots below. The Mac Downloads path is still not mounted; the ZIP resolves that dependency.

- No approved source was fabricated, redrawn or overwritten.
- Runtime registrations point only to baked assets; pending skill slots are not registered as FX.
- Base-art follow-up: approved ZIP is now accessible. Mirelle uses the real base sheet and reference-cropped portrait. At the Phase A boundary, S1/S2/Ult used the basic attack provisionally. The subsequent user-authorized S1 review is recorded in `MIRELLE_S1_REVIEW.md`; S2/Ult retain their base fallback.
- Do not create an empty atlas or copy another hero's art as Mirelle.
- Source slots are `art/incoming/mirelle/reference.png` and `base.png` (read-only originals when available).
- Base cutting/normalization, portrait crop and runtime registration are complete. Run `sprites:optimize` after any PNG bake.
- S1 character/projectile/impact sources are now supplied for visual review. S2/Ult sheets/VFX, icons and banner remain missing; their slots are requirements only.
- Do not register or synthesize final skill clips, final field art, or final shatter timing during Phase A.

## Production order after Phase A

Hero foundation → S1 action/VFX → user review → S1 Timeline Sync → S2 action/VFX → user review → S2 Timeline Sync → Ult action/VFX → user review → Ult Timeline Sync.

Character, Charge, Main, Impact, Projectile, Field and Residual assets stay separate. No raw-frame gameplay checks. S1 semantic release/contact requirements are separate because damage/statuses land on projectile arrival. Ult field pulse and lifecycle events are gameplay events independent of the future character recovery/clip end.

## Validation

`winter-scholar.spec.ts` covers registration, pending assets, conditional Slow/Root, projectile arrival, geometry, immunities, movement, attack-speed reduction, field occupancy/lifetime and ranks. `fields.spec.ts` covers scheduler boundaries, cancellation and invalid periods. Roster expectations include Mirelle without requiring nonexistent art.

Confirmed validation:

- `npx tsc -p tsconfig.app.json --noEmit` and `npx tsc -p tsconfig.spec.json --noEmit`: passed.
- Full Karma/Chromium: **631/631 passed**, including **20 new cases**. A temporary no-sandbox launcher was used outside the repository because `karma.ci.cjs` is absent and the execution sandbox cannot bind Karma's local port.
- `npm run build -- --configuration development`: passed.
- `npm run build`: passed after network recovery; existing size/CommonJS warnings remain.
- `npm run hero-sim -- 10`: completed, default team F1–4/F6 100%; F5/F7/F9/F10 0%; F8 AUTO 0% / TACTICAL 50%. Existing balance issues remain deferred.
- `node dist/sim/tools/dev/hero-sim.js 10 --team=bailong,yuezheng,mirelle,tangxun,linxue --stats`: completed without runtime errors. Mirelle contributes 30% of aggregate AUTO team damage. Token timing/placeholder numbers make this a smoke check, not a final balance assessment.
- Base-art follow-up changes sprite PNGs; `sprites:optimize` was run.
- Branch `wip/codex-hero-mirelle` exists locally. Network is restored and production build passed on retry; push remains pending explicit user approval after automatic approval review rejected the export.

Base-art follow-up: approved source integration is complete. Full Karma remains 631/631 passed, app/spec typechecks and production build pass, and the Mirelle-team 10-run/floor simulation completed after base timing integration (smoke only; no rebalance). Real Pixi/DOM previews use `/sprite-lab?hero=mirelle&compare=kael,garrick&enemy=forest_slime&bg=forest-1&render=pixi` (DPR 2). Comparison options reuse real hero, monster and stage-art registries, without save changes. No browser errors during idle/move/attack/hurt/death checks.

Each skill's production/review/sync remains a separate later step. No final S1/S2/Ult timing was introduced. Base-attack fallback length changes provisional skill timing compared with tokens; do not interpret the new simulation as final balance.
