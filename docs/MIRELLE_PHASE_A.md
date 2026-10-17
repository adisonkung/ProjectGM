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

These files are visible in chat but not present in the cloud filesystem. The user's `/Users/webuild/Downloads/...` paths are not mounted here. Therefore:

- No approved source was fabricated, redrawn or overwritten.
- No `HeroTemplate.sprite`, `SHEETS`, `HERO_ART` or `FX` entry points to a missing file.
- Mirelle currently uses the existing class-token/portrait fallback and `TOKEN_TIMING`; this is explicitly provisional.
- Do not create an empty atlas or copy another hero's art as Mirelle.
- Source slots are `art/incoming/mirelle/reference.png` and `base.png` (read-only originals when available).
- Base sheet cutting/normalization, portrait crop and actual runtime registrations remain pending source access. Run `sprites:optimize` after any PNG bake.
- Skill character sheets, separate VFX, icons and banner are not supplied yet. Slot filenames in `mirelle-production.ts` are requirements only.
- Do not register or synthesize final skill clips, final field art, or final shatter timing during Phase A.

## Production order after Phase A

Hero foundation → S1 action/VFX → user review → S1 Timeline Sync → S2 action/VFX → user review → S2 Timeline Sync → Ult action/VFX → user review → Ult Timeline Sync.

Character, Charge, Main, Impact, Projectile, Field and Residual assets stay separate. No raw-frame gameplay checks. S1 semantic release/contact requirements are separate because damage/statuses land on projectile arrival. Ult field pulse and lifecycle events are gameplay events independent of the future character recovery/clip end.

## Validation

`winter-scholar.spec.ts` covers registration, pending assets, conditional Slow/Root, projectile arrival, geometry, immunities, movement, attack-speed reduction, field occupancy/lifetime and ranks. `fields.spec.ts` covers scheduler boundaries, cancellation and invalid periods. Roster expectations include Mirelle without requiring nonexistent art.

Run app/spec typechecks, full Karma and `hero-sim -- 10` (also a team including Mirelle). Record results without rebalancing.
