# Solar Oculus — third Ascension guardian

User approved Solar V2 (stronger eye charge and a continuous beam that exits the frame), then requested actual integration and a large boss silhouette. Work continues from the approved Jadecrest task commits, based on origin/master `6f38f3c`; master is unchanged by this task.

## Content and presentation

- `solar_oculus` replaces the third selectable guardian. All three tier variants share its kit and reviewed art. Legacy `astral_seraph` and its three tier IDs remain registered for compatibility.
- Solar holds the lower-centre anchor of a 3-column × 2-row logical body. It is stationary and attacks at range. Pixel size never determines targeting or collision.
- HP 20,000, ATK 95, DEF 34 and shared tier scaling are retained from the outgoing third guardian. The new kit numbers remain provisional; other heroes/bosses were not rebalanced.
- User size follow-up: `displayScale:1.25`, with a lower floating registration in the source cell, corrected eye/muzzle anchors, larger attached charge/emitter layers and a slightly larger ground ring. The logical body remains 3×2. No opaque character pixels touch the runtime cell edges in the reviewed action rows.
- Two original 56-frame eye sheets are registered with one fixed transform per source bank. Repeated holds are cut/retimed. Eight separate physical halo parts are baked into the character's physical poses; charge, ground, projectile, beam and impact art remain separate FX strips. Native tiny gold sparks already present in the second eye source are retained.
- Nine character rows: Idle, Move fallback (stationary boss), Hurt, Death, Normal Attack, Seals, Sweep, Eclipse, Broken. Hurt/Break/Death reuse the supplied eye poses and procedural physical-part movement. Death uses a compact physical-part shutdown and a 2.2-second runtime clip so it completes during the existing result outro.
- All 13 uploaded VFX sources are used by the baker, producing 12 separate runtime FX strips. Formation/held rings share a calibrated ground pivot, and low-alpha matte haze is removed. Stronger eye spirals, three light arcs and orbiting glints are included. The shaft texture is tiled with overlap; only the shaft changes length, and it fades without collapsing vertically. Its endpoints extend beyond the viewport.
- All three uploaded maps are retained unchanged under `assets/backgrounds/ascension`; runtime WebP copies use a fixed arena background, without a repeating/parallax split. Other tower/farm backgrounds retain their original rendering path.

## Actual combat mechanics

- **Normal:** one travelling magic projectile, emitted at the attack's `PROJECTILE_SPAWN` semantic event (0.95 s). Native charge and physical recoil are synced to that event.
- **S1 Solar Seals:** 2.7 s cast. After 0.8 s, lock up to two distinct valid enemy cells; native warning rings remain on those cells. On activation, hit their current occupants once each, including a replacement occupant. A hero who leaves the marked cells avoids the hit. Detonation VFX still appears at the marked ground even if no hero remains there.
- **S2 Ring Sweep:** 2 s cast, then three lane pulses separated by 0.95 s. Each pulse hits valid occupants of that lane only. The next completed cast reverses order, bottom→middle→top. Source death and battle/wave teardown cancel remaining scheduled pulses. Recovery covers the beam sequence. Each beam shares the eye origin with its separate emitter, extends offscreen and uses a game-clock fade.
- **S3 Eclipse Judgement:** 3 s wind-up with a native circle beneath the floating boss and a charged eye. Activation deals the provisional team-wide magic hit. Explicit Break power 100 cancels release and applies the existing 3 s BROKEN state. Plain damage does not interrupt.
- Optional `groundTargets` and `laneSweep` data extend the common monster-skill executor; no monster-ID-specific gameplay branch was added. Warning/release VFX are emitted through semantic events and sampled on the shared visual clock. Existing skills retain their original path.

## Lifecycle correction required by the new death presentation

The combat simulation stops at victory. Previously the board retained that final simulation snapshot throughout the existing 2.4-second outro, freezing a newly started death clip. The board now uses its already-supported presentation clock during `ending`, as it already did on the result screen; combat does not advance. Pause/hit-stop still freeze it. Death FX now resolves the sprite's named anchor. Other death definitions without named anchors retain their offsets.

## Reproduce / inspect

- Originals + SHA256: `assets/bosses/Solar/manifest.json`.
- Bake: `python3 tools/sprites/solar.py`, then `npm run sprites:optimize`.
- Cut/registration metadata: `docs/art/solar/bake.json`.
- Kit: `src/app/core/data/solar-oculus.ts`; presentation: `solar-presentation.ts`.
- Behaviour regression tests: `src/app/battle/engine/solar-oculus.spec.ts`.
- Real desktop/mobile evidence and approved preview references: `docs/review-images/2026-10-31-solar/`.

The standalone preview used placeholder target markers; actual screenshots use the real game heroes and board. The approved pose/VFX direction is preserved, with runtime scale, cell placement, UI, tight death spread and encounter timing adapted to the game. This is not a claim of pixel-identical screenshot composition.

Validation: app/spec typechecks, 916/916 Karma specs, production build, sprite optimizer, native-source SHA256 checks and real Pixi screenshots on desktop/mobile passed. Calendar free-choice remains in its existing development setting; stage selection/data changes do not enable the schedule flag.

## Arena room follow-up

The combat grid remains 16×3; Solar still occupies 3×2 cells at lower-centre anchor (r2,c11), with stationary ranged AI. Its physical pose now uses a constant +16 source-pixel root offset in every clip; eye and muzzle anchors move by the corresponding +25% of a cell. Its 1.25 display scale is retained.

Solar allocates 0.35 decorative rows above and 0.45 below the grid, replacing the former 0.8 below. This preserves square-cell size, actor size and viewport fit. Fixed arenas can also use the existing bounded spare desktop scenery space (up to 0.65 rows), which was previously suppressed by the parallax crop limit. Ordinary tiled maps and lab layout retain their prior path. No playable lanes, melee contact rules or balance values change. Melee units can still approach the upper edge of the boss footprint; they do not move toward its painted eye.

Actual game evidence: `docs/review-images/2026-10-31-solar-arena-room/`. The optional grid screenshot is a diagnostic overlay on the actual running game, not production UI.

Follow-up validation: both typechecks, 917/917 Karma specs and production build passed. Actual desktop/mobile Pixi action captures report zero page errors.
