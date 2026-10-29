# Aegis Sentinel — Ascension integration

User request: replace the first Ascension guardian with ผู้พิทักษ์ตราปฐม, use the supplied Aegis.zip, allow all guardians on any weekday temporarily. This is a task-branch implementation; production deployment is not part of this request.

## Entry and compatibility

- `ASCENSION_BOSSES[0]` is now `aegis_sentinel`; tier variants `@1`, `@2`, `@3` share one kit and sheet. Default entry always selects Aegis while free choice is enabled.
- The menu selects Aegis / Moonblade Ronin / Astral Seraph and passes `boss` to `/battle?farm=ascension_N&boss=...`. `ascensionSelection` validates the query against the roster.
- `DEV_FLAGS.ascensionFreeChoice = true` suspends the weekday rotation. Turn it off explicitly only after all three replacement bosses are ready. Calendar retained as Aegis Mon–Tue / Ronin Wed–Thu / Seraph Fri–Sun.
- Floor unlocks, rewards, daily bonus pools, first-clear records and tier/enrage/time limits retain their existing rules. A different guardian does not create another first-clear reward for the same tier. No save migration is needed.
- Brass Shishi and its old tier definitions remain registered for compatibility and legacy tests; it is no longer a selectable Ascension guardian.

## Provisional kit and timeline

New kit/timings are content implementation requested by the user, not a global roster balance pass. Base tier-II HP 20,000 / ATK 85 / DEF 30 and tier multipliers retain the replaced guardian values. The boss remains one combat unit with one HP bar. User-approved logical footprint is now 3 columns × 2 rows, anchored at its lower centre (bottom lane 2 / column 11); zero leash prevents upward chasing. Other units stay outside all six cells and attack ranges measure to the body edge.

| Action | Behavior | Timing |
| --- | --- | --- |
| Basic attack | Reuses supplied S2 lowering/pointing poses; small baked forward thrust + cyan spear flash; one PHYSICAL melee hit ×1.1 | 12×50ms; semantic DAMAGE at 0.30s; existing 1.9s cooldown |
| S1 ตั้งโล่พิทักษ์ | Crouch on activation, then resume actions; damage received ×0.4, no invented shield HP or invulnerability | Cast 2.5s, buff 8s, recovery 0.3s, cooldown 20s |
| S2 ทวนแสงทะลวงแนว | Stationary horizontal beam; MAGIC ×1.2 across all three lanes ahead to the board edge, each recipient once | Cast 1.8s, cooldown 13s, recovery 0.96s |
| S3 คำพิพากษาแห่งประตู | Overhead windup → ground contact; PHYSICAL ×1.5 in FRONT_RECT_3X2 (six full cells directly ahead) | Cast 3s, Break 100, cooldown 18s, recovery 0.78s |
| BROKEN | Existing three-second action denial and ×1.25 damage received; supplied kneel-break clip + exposed-core effect | Optional `broken` cast clip, presentation only |
| Hurt / death | Recoil from held base art and existing contact flash; death source + shutdown VFX / fade | No new generated hurt art |

S2 uses the generic FRONT_BEAM_3 resolver with committed facing: all three playable lanes ahead to the board edge; it does not rotate to follow a target. S1 grants an eight-second defensive buff; its pose returns to idle after a 0.3-second recovery, allowing normal attacks, movement and other skills while the status remains active. Effects depend on semantic cast/activation/actual-damage/status events; texture sizes do not determine hitboxes.

## Asset preparation

Original 19 PNGs (15 from Aegis.zip + 2 from skill2.zip + 2 S3 charge sheets) are kept unchanged in `assets/bosses/Aegis/`. Rebuild with `python3 tools/sprites/aegis.py`, then `npm run sprites:optimize`.

- Palette-alpha character sheets are cropped at native grid coordinates, scaled together (body around 180 atlas pixels, excluding spear), canonicalized to face right and foot-anchored. Runtime flips the enemy left. Corrected 24-frame walk is used.
- RGB VFX have a baked checkerboard. The script keys/unmixes neutral white backgrounds; pure white light on a white background is not fully recoverable. Native-alpha impact/death sheets retain their alpha. No square checkerboard is shipped intentionally.
- Barrier formation uses the first five panels. Idle uses one stable dome from the supplied sheet plus a 64-frame / 2.56-second light animation clipped to the painted VFX: three interior light trails and 40 large travelling sparkles. The extra procedural dome outline and external base/orbit ring have been removed. No drifting generated idle-frame sequence. Real `aegis_guard` status presence owns the visual lifetime, including refresh/expiry/death.
- Beam ornament and body are separate assets from the two native-alpha PNGs in skill2.zip; the crescent remains proportionate while only the beam body changes length. The normal attack is a much shorter thrust and does not reuse the full S2 blast.
- All eight supplied VFX families are wired: formation/idle barrier, barrier contact, spear charge, beam muzzle, target impact, ground shockwave, exposed core and death shutdown.
- `docs/art/aegis/bake-report.json` records selected source frames and output dimensions.

## Generic presentation additions

`SheetDef.monsterFx` binds cast/activation FX by monster clip, `damageFx` binds rate-limited real-hit visuals to active guarding statuses, `deathFx` adds an optional shutdown. `preloadFx` warms extra contacts; the Pixi loader also warms monster, guard-contact and death assets so the first short beam can appear on time. Cast layers are runtime managed and removed immediately on activation/interrupt/Break/cancel/death. Optional `casts.broken` uses a supplied break pose. Holder-defined status art can take precedence over the caster's art (needed for BROKEN applied by a hero). Large actors may cap contact white-flash strength; other actors retain their original default.

## Slow-frame synchronization fix

Real-game capture exposed an existing clock drift: the engine could advance up to 200 ms in a slow frame while the board independently capped its visual delta at 100 ms, so cast poses fell behind their damage events. Battle boards now sample the authoritative engine snapshot time and interpolation fraction (`visual-clock.ts`); pause/hit-stop still freeze presentation, speed scales the snapshot interval, and a restarted run retains a monotonic local clock. Standalone views keep their previous clock. Combat damage/timing values are not changed by this rendering fix. Tests cover slow-frame jumps, interpolation bounds, speed and preparation.

## Verification and review

Automated: app/spec TypeScript, full Karma suite, optimized atlases and production build. Aegis tests check tier/kit registration, actual eight-second guard lifecycle without shield HP, attacks and S2 activation while the guard remains active, one S2 release with unique recipients and no caster movement during the cast, matching guard clip timing and status-owned loop refresh/cleanup. Dungeon tests exercise all three bosses across all seven weekdays and invalid-query fallback.

Real local-game captures are under `docs/review-images/2026-10-28-aegis/` (desktop 1440×900; mobile menu 390×844; combat 932×430). Test browser only: named island, floor 10 unlocked, starter heroes Lv8; hero active skills set MANUAL so the boss sequence can be seen. This fixture does not modify a player's save. Source-reference comparisons are compositions of supplied art and actual screenshots, not generated screenshots.

Remaining review limits: reconstructed RGB alpha can differ from the original glow; final art-direction approval is the user's. The other two guardians still use their existing assets/kits. Aegis now has the user-requested 3×2 logical footprint; other guardians retain their existing single-cell shapes.

## Isolated clip review / source-grid correction

The isolated preview exposed an incorrect grid assumption for supplied VFX 05 (impact) and 06 (ground shockwave): both are 4×2 / 8 frames, not 5×2 / 10. The bake and three FxDef entries now use the correct grid; hitboxes, damage and character/cast timing are unchanged. Preview-only exports under /workspace/aegis-isolated-preview use current runtime assets and the actual clip/FX samplers, at ×1, with no other units/HUD. This is an isolated asset view, not a combat simulation or a gameplay screenshot. Source art stays unchanged.

## S1 active-buff revision (user request)

S1 recovery is now 0.3s rather than the whole eight-second buff. Guard artwork uses 11 frames (five windup, activation crouch, reverse back to standing); the cast-driven pose lasts 2.8s total. All other character cells are unchanged. Atlas columns are 24, matching the largest remaining row. Reduction stays ×0.4 for eight seconds; no shield HP is added. This intentionally increases combat uptime during the buff, as requested; HP/ATK/DEF, normal attack, other skills and rewards retain their current values. The separate normal-thrust V2 preview is not installed by this revision.

Barrier formation and loop are about 28% wider (4.06 / 4.6 cells); base art is held stable. Lighting is clipped to an expanded alpha mask of the supplied image, with no additional geometric shell, perimeter line or external orbit. Three short interior ribbons and 40 larger stars circulate/rise over the hex surface on a periodic 64-frame cycle.

Verification: app/spec TypeScript, sprite optimization, 874/874 Karma and production build pass. Browser capture confirms ATTACKING with 7.6s of guard remaining and S2 CASTING with 6.6s remaining. In the isolated browser fixture only, S2 is made ready after the first guarded basic attack so both paths can be inspected promptly. Real desktop/mobile captures and source comparison are in docs/review-images/2026-10-28-aegis-s1-active/. Isolated S1 playback in /workspace/aegis-s1-v3 uses current assets and clip/FX samplers, with four illustrative basic attacks during the buff; it is not an AI-combat recording.

## S2 straight-beam revision (2026-10-29, first checkpoint; superseded below)

User asked for a brief charge, light spiralling into the spear tip, a horizontal three-lane beam to the left screen edge, and a lower boss position. Cast is deliberately 1.8s (was 1.2s); cooldown 13s, recovery 0.96s and multiplier ×1.2 remain. S2 body row holds source F17 after lowering the spear, through charge and release, before lifting it back. Other body rows are unchanged. New code-drawn inward spiral strip is separate from S3 charge. Cast ownership cancels it on release/cancellation/death.

FRONT_BEAM_3 uses locked facing, excludes the caster column and behind, includes stacked units once and clamps to the three playable lanes. FxDef.toBoardEdge / edgeBeamStretch sizes the shaft from weaponTip to the visible board edge without changing height; separate emitter ornament keeps its proportions. Telegraph covers the forward three-lane corridor. Aegis is anchored on bottom lane 2, column 11 in all dungeon tiers with holdArena leash 0; no change to other guardian positions. This is a single-anchor placement change, not a new four-cell collision/targeting system.

PENDING SOURCE IMPORT: Cyan Energy Beam Loop Sprite Sheet.png and Crescent Energy Beam Sprite Sheet.png are visible in chat, but their C:/Users/... paths are unavailable in the cloud workspace. Requested a ZIP containing the originals. Until supplied, previews explicitly retain the original muzzle and procedural shaft as temporary fallback; they do not claim to use the new art.

Validation for this WIP checkpoint: app/spec TypeScript, sprite optimization, production build and 877/877 Karma pass. Under concurrent browser/build load, the default Karma launcher disconnected before executing tests; reran with a temporary local config extending browser/ping timeouts, with all assertions unchanged. Real desktop/mobile screenshots in docs/review-images/2026-10-29-aegis-s2 verify charge, bottom position, zero beam angle, tip-anchor-to-edge width and five contact recipients. New supplied PNG import remains blocked as described above.

## Supplied S2 art and lower-centre 3×2 footprint (2026-10-29, current)

Both native RGBA originals from skill2.zip are installed unchanged as 09-fx-aegis-s2-beam-loop.png and 10-fx-aegis-s2-emitter.png (SHA256 in source-manifest.json). They are 1774×887, 4×2 / 8 frames each. The runtime bake drops effectively invisible alpha≤2 black noise, uses a common beam crop centred on the white core, canonicalizes both rightward, and feathers the beam's near edge under the separate emitter to remove a rectangular seam. Native art replaces the procedural beam and old emitter; no new AI-generated art or drawn crescent is substituted. Emitter: 8×90ms +120ms fade, fixed core pivot (source 356,222). Beam: 8×45ms twice +120ms fade, three-cell visual height, shaft alone stretches to the left edge. Spear-tip anchor is [186,-110] cell percent, aligned to the baked held-aim pose. The 1.8s cast and inward charge lights remain. Character atlas is byte-identical to the prior checkpoint.

The user changed the requested footprint to 3 columns ×2 rows, with O in the lower middle:

```
x x x
x O x
```

Aegis occupies logical columns 10–12 / lanes 1–2, anchored at (r=2,c=11), across all Ascension tiers. MonsterStats.footprint is explicit data (cols,rows,anchorC,anchorR); no gameplay geometry comes from sprite pixels. Body-blocking keeps both teams outside those cells. Walking, retreat, knockback destinations, summoned placements and blink/dash landing checks respect the reservation. Blink searches for a free cell just outside the perimeter, instead of inside the boss. One actor / one HP bar is retained.

Range checks use Chebyshev distance between body edges, so melee can attack across the reserved front/rear cell and the boss can strike back. Heroes/monsters without a footprint retain their previous point-to-point distance. Area queries intersect all body cells then deduplicate recipients; a main ground cell still chooses the main multiplier. Projectiles retain their authored presentation travel to their target anchor. This is the user-requested Aegis spacing/geometry change; HP/ATK/DEF, cooldowns, damage multipliers, other bosses and rewards are not retuned.

Validation: 881/881 Karma; app/spec TypeScript; sprite optimization; production build. New tests cover exact lower-centre layout, unchanged point-unit distances, area deduplication/main-cell contact, real melee damage both ways without entering the reserved cells, and Moye S2 blinking behind the perimeter and damaging the boss. Actual desktop/mobile captures in docs/review-images/2026-10-29-aegis-s2-native verify no incursions across the observed sequence, the charge, native beam and stable bottom position. Source/game comparison includes the two supplied sheets and the user's 3×2 diagram. Isolated S2 MP4/HTML uses current runtime clip/FX samplers and assets, not a combat recording. No merge or deployment.

## S3 supplied charges, moving light and forward impact (2026-10-29, current)

The two native palette-alpha charge sources are preserved unchanged as 11-fx-aegis-s3-tip-charge.png and 12-fx-aegis-s3-ground-charge.png. Both are 1774×887 / 4×2 / 8 panels. The generator converts palette alpha correctly, normalizes the tip aura's bright core, plays formation then holds the mature art, and adds moving short light trails clipped to the painted aura. Tip trails follow the circular spiral; ground trails follow its projected ellipse. Art and moving light mirror together with facing. S2's inward spiral also gains connected light streaks. The superseded original 03 charge source/raw strip remains archived; its unreferenced optimized copy is no longer shipped.

S3 charges are each 75×40ms (3 seconds), driven by existing FxTrack presentation on SheetDef.monsterFx bindings. Measured spear-tip points from the supplied windup poses become a generated hold-at-pose motion curve; the aura follows the raised weapon rather than a fixed point above the body. This is bounded authored choreography for the current three-second cast, not a general live skeletal-anchor system. Ground aura stays beneath the character, tip aura above it. Both are removed on activation, Break, interrupt, cancellation or death. The mature ground aura's baseline is stable as lights circulate.

User confirmed the impact area:

```
x x x | x x
x x x | O x
```

FRONT_RECT_3X2 covers three full columns immediately ahead of O and O's row plus the row above. For O=(r2,c11), the six nominal cells are rows1–2 / columns8–10. All six take the same authored multiplier, including stacked recipients once; O's own column, behind and the top playable lane are excluded. This is relative to the anchor, as confirmed, rather than shifted beyond the previously reserved boss body. The mirrored orientation is supported. Telegraph and impact share this logical shape. The impact's placement anchor is its lower middle (r2,c9 when facing left), width three cells so each outer column gets its full half-cell extent; height two cells.

Visible lower alpha bounds author each ground frame's pivot: aura and impact bottom edges land at the feet plane (dy27.25%), not the PNG centre. Moving glints cannot extend below or bob the held ground aura. Character atlas remains byte-identical. Cast time 3s, cooldown18s, recovery0.78s, Break100 and damage ×1.5 remain; the area change is explicitly user requested.

Generic corrections: monster casts commit their facing through resolution, then release it at cast end. A missed DAMAGE skill reports no hit recipients, so a SELF aim cannot create a false contact burst on the boss. Support/buff skills still report their intended targets.

Validation: 884/884 Karma; app/spec TypeScript, sprite optimization and production build pass. Tests cover both directions of the exact six-cell area, stacked targets, excluding under/beyond/behind O, a target moving behind during charge, true whiffs with no caster contact, all ground-frame foot pivots, full three-cell half-widths, moving tip presentation and charge lifetime. Actual desktop/mobile captures and source comparison are in docs/review-images/2026-10-29-aegis-s3-cast. Mobile uses a fresh context at its own viewport. A separate fixture injects 100 Break through the real interrupt path and verifies both charge layers disappear with no impact. Isolated S2/S3 MP4s use current runtime assets and samplers, not a full combat recording. All 19 original SHA256 values and the unchanged character atlas are checked. No merge or deployment.

### S3 ground placement and supplied slam revision — 2026-10-29

The replacement `s3_impact.png.zip` is preserved unchanged as source 13. It is RGB (the pale checkerboard is baked into its pixels), not native transparency. `aegis_s3.py` prepares an eight-panel 4×2 runtime strip, removes the neutral matte, and feathers bounded white energy cores. Pale edge/dust reconstruction is approximate; a native RGBA original would preserve those pixels more faithfully.

The charge's projected ellipse centre (runtime pixel 180,162) now sits on Aegis's feet instead of anchoring its outer bottom there. The held aura moves down about 0.425 cells. The new forward impact remains centred on column 9 for O=(2,11), spans columns 8–10, and its visible lower edge meets the very bottom of row 2 (`dy:50`). It is rendered under the boss and spear so dust cannot cover them. The old neutral white contact dust baked into the Ultimate source is masked out in runtime preparation (left of source x250, below y190; neutral bright pixels only), preserving coloured weapon/armour and the original source. This prevents two overlapping impact effects. No cast timings, damage, area, collision, or pose sequence changed.

Validation for this revision: app/spec typechecks, 884/884 Karma tests, optimizer and production build passed. Real desktop 1440×900 and fresh mobile 932×430 captures are in `docs/review-images/2026-10-29-aegis-s3-position/`; source13 and actual-game side-by-side included. Only character atlas row 7 changed (white contact-dust cleanup); other eight rows are pixel-identical. All 20 supplied source hashes verified. Isolated S3 clip: `/workspace/aegis-s3-position-review/06-s3.mp4`.

### Stable charge registration and decorative floor — 2026-10-29

The supplied ground-charge sheet has its second row's ellipse roughly 40 source pixels higher than the first row. Its gold left/right rim gems now register each source frame to one fixed ground centre, preserving a shared scale; the 360×320 runtime canvas retains the entire aura. Registration rounding error is below 0.5 runtime pixels. Moving light arcs share that centre. Aegis's feet, logical lower-centre anchor, and pose sequence stay unchanged.

Real battle viewports reserve 0.8 decorative floor rows between the last lane and party dock. Board/Pixi render bounds and the background continuation include this margin. It is not a new combat row and cannot hold units, targets or placements; standalone/lab boards default to no margin. Square cells still fit short phone viewports, so very short screens trade a little actor size for unclipped ground effects. No map collision, skill range, damage or timing changes.

Final verification: 886/886 Karma tests, app/spec TS checks, sprite optimizer and production build passed. Desktop/mobile actual screenshots and forming-versus-held crops: `docs/review-images/2026-10-29-aegis-floor/`. Character atlas is byte/pixel-identical to the prior revision. The floor extends the terrain layer vertically below its fixed horizon; sky/trees keep their original projection and no mirrored/repeated strip is used.
