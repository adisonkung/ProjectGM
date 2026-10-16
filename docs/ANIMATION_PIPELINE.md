# Animation & VFX Pipeline

> **Status: CANONICAL** · approved by the user on 2026-10-16 (after review). Change only with the user's approval.

## Principles

1. **Separate runtime assets.** Each of these is its own strip:
   - character animation (one atlas row per clip);
   - Charge VFX;
   - Main VFX;
   - Impact VFX;
   - Projectile;
   - Persistent field or aura;
   - Residual VFX.

   Do not bake VFX into the character sheet unless explicitly required.
   - Legacy exception: Aurel v2 baked charge and slam into the ult row. Aurel is no longer shipped; `aurel_v2.py` remains only as the shared cutting library.
2. **Animation pixels are visual data.** Gameplay range, area and collision come from gameplay config:
   - `range`, `AreaPattern`, `GROUND_SHAPES`, `breakRequired`, …
   - Never from PNG sizes.
3. **Semantic events drive gameplay.** Never write gameplay as `if frame == 8: dealDamage()`.

## Data model (`src/app/core/data/sprites.ts`)

### `SheetDef`

One per sprite file. It holds:

- `cellW` / `cellH`, `cols`, `rows` and the root point;
- `anims: Record<kind, AnimDef>`;
- `fx: Record<kind, string[]>`;
- `projectile`, `anchors`, `pixelated`.

### `AnimDef`

| Field | Meaning |
|---|---|
| `row`, `frames`, `ms` | atlas row, frame count, default ms per frame |
| `seq`, `steps` | frame order and per-step ms. **`steps` is ignored without `seq`.** |
| `events` | semantic events, as a step index (fractions allowed) or an array for multi-hit |
| `hit`, `move` | legacy damage and blink frames, used when there are no events |
| `impact` | per-hit hit-stop / shake / flash / zoom |
| `eventFeel` | feel on a named event |
| `root` | runtime root motion: `[step, dx, dy]` |
| `opacity` | runtime fade: `[step, alpha]` |
| `pace` | walk ground speed |

### `FxDef`

One per FX key. Fields:

- **Strip:** `file`, `frames`, `w`, `h`, `frameMs`.
- **Placement (`at`):**
  - `self`, `target`, `allies`;
  - `dx`, `dy`, `pivot`, `anchor`, `scale`, `fitCells`, `angle`, `orient`, `mirror`.
- **Trigger:**
  - `on`: cast / vfx / impact;
  - `event` + `eventIndex`;
  - `hitIndex`, `perHit`, `exceptPrimary`.
- **Timing:** `delayMs`, `repeat`, `fadeOutMs`, `from` / `stripFrames`.
- **Look:**
  - `layer`: `under` | default over;
  - `blend: 'add'`, `pixelated`, `particles`.
- **Attachment:** `attach` (follow the unit).
- **Projectiles:** `angle0`, `noRotate`, `overshoot`.

## Semantic events in use

| Event | Meaning |
|---|---|
| `CAST_START` | start of the cast |
| `ANTICIPATION_PEAK` | peak of the wind-up |
| `CHARGE_START` / `CHARGE_PEAK` | charge begins / peaks |
| `SKILL_ACTIVATE` | the skill takes effect |
| `VFX_SPAWN` | main VFX appears |
| `PROJECTILE_SPAWN` | projectile leaves the caster |
| `STRIKE_START` | strike begins |
| `DAMAGE` | damage is applied (array for multi-hit) |
| `IMPACT` | hit lands |
| `FINAL_ANTICIPATION` | wind-up before the last hit |
| `VANISH_START` / `REAPPEAR_START` | blink out / in |
| `RECOVERY_START` | recovery begins |
| `ANIMATION_END` | clip ends |

- Monsters declare clip frame numbers (1-based) in `MonsterDefinition.animation`. `monsterSheet()` and `castTimeline` turn them into events.
- `DEATH_FINAL` (user baseline) is **not implemented** — see *Planned / not fully implemented* below.

### Gameplay timing — KNOWN ARCHITECTURAL / BALANCE DEBT (deferred until the roster / balance pass)

- Gameplay reacts to semantic events, never to raw frame checks (principle 3).
- But the event **times** come from clip data (`steps`, `events`), so changing a clip's timing changes when damage lands and how long the caster is locked — i.e. combat performance.
- Do not redesign the timeline system now. Treat clip-timing changes as balance-relevant and mention them in the commit message. (`docs/COMBAT_RULES.md`, `docs/ARCHITECTURE.md` issue 2.)

## Mapping: canonical design intent → current implementation

The left column is **CANONICAL DESIGN INTENT** (the baseline concepts). The right column is the **CURRENT IMPLEMENTATION**. Rows marked *planned* are not (fully) implemented — see the next section.

| Baseline concept | Current implementation |
|---|---|
| Character Renderer | DOM `app-unit-sprite` / Pixi `PixiUnitLayer` (pure `unit-clip.ts`) |
| Main / Impact / Field / Residual Renderer | One FX layer: `app-fx-sprite` / Pixi FX, split by `layer: under/over` and z order |
| Projectile Renderer | `app-projectile` / Pixi bolts (`projectilePoseAt`) |
| Ground Renderer | `layer: 'under'` FX (shockwaves, rings) |
| FOLLOW_OWNER | `FxDef.attach` (default for `repeat` / `fadeOutMs` FX on a unit) → `FxView.follow` |
| FOLLOW_ANCHOR | *Partial / planned.* `FxDef.anchor` resolved once at spawn (`fxOffset`). It does **not** keep following the anchor. |
| WORLD_SPACE | Default: FX placed at the spawn cell |
| FOLLOW_PROJECTILE | *Planned.* Not implemented as an attachment mode. Projectiles are one strip with an impact frame. |
| Anchors | `SheetDef.anchors`: feet, bodyCenter, weaponTip, skillOrigin, ultimateChargeOrigin, ultimateForwardOrigin, plus per-hero extras such as ultTip1..3 and ultAir. There is no shieldFront or targetContactPoint key; FX use `dx`/`dy` offsets on the target instead. |

## PLANNED / NOT FULLY IMPLEMENTED

Documentation only — do not implement these as part of unrelated work; each needs its own task and the user's go-ahead.

| # | Concept (design intent) | Current implementation |
|---|---|---|
| 1 | **Persistent FOLLOW_ANCHOR tracking** — an FX keeps following a moving anchor (weapon tip, shield front) for its whole life. | `FxDef.anchor` is resolved **once at spawn** (`fxOffset`). The FX does not follow the anchor afterwards. (Following the whole unit is available via `FxDef.attach` / FOLLOW_OWNER.) |
| 2 | **FOLLOW_PROJECTILE** — a general attachment mode for FX riding on a projectile. | **Not implemented** as an attachment mode. Projectile visuals use the existing projectile system (`app-projectile` / Pixi bolts, flight frames + impact frame, `hitFx`, `overshoot`). |
| 3 | **`DEATH_FINAL` semantic event** — a final event at the end of the death clip. | **Not implemented.** The `die` clip plays and holds its final frame; no event is emitted. |

## Clocks and feel

- **One game clock.** The board's `vclock` runs at game speed and stops on pause and hit-stop. Pixi samples poses from it.
- **Idle clock.** `idleClock` runs in real time and does not speed up at x2 / x4.
- **Impact feel** (`battle/impact-feel`): hit-stop pauses the engine step, plus shake, flash and zoom on `.board > .cam` with a focus cell.
- **Slowing a skill while keeping sync:** multiply the anim `steps` **and** every FX `frameMs` / `delayMs` of that skill by the same factor (example: Tang Xun ult ×1.15).

## Art pipeline (per hero)

1. **Source art.**
   - Location: `art/incoming/<hero>/…` (gitignored), or `assets/heroes/Kael/` for Kael (canonical, tracked, read-only).
   - Format: magenta-keyed sheets plus a reference.
2. **Base and clip rows:** `python3 tools/sprites/<hero>.py` writes `public/sprites/hero-<id>.png` (cell 260 × 170, root 130,155, idle body ~78–80 px). It handles:
   - keying and despill;
   - frame split (watershed, k-means seeds, `comp_frames`, `CELL_SPLIT`);
   - foot / chest / head stabilisation and scale matching.
3. **Skill VFX:** `python3 tools/sprites/<hero>_<s1|s2|ult>.py <out>` cuts and unmixes the VFX, then writes:
   - a 60 FPS preview (mp4 / gif);
   - a timeline JSON with a `sheet` block;
   - the game FX strips `public/sprites/fx-<hero>-*.png`;
   - the numbers to put in `sprites.ts` (`gameFx`, `game`).
4. **Sync sheet:** `python3 tools/sprites/ult_sync_sheet.py <json> <mp4> <out>` builds the PNG + xlsx reviewed by the user.
5. **Size normalisation** (when needed): `python3 tools/sprites/normalize.py run <id> [--write]`.
   - Tang Xun **must** be re-normalised after every `tangxun.py` run.
6. **Optimise (always last):** `npm run sprites:optimize` writes:
   - `public/sprites/opt/*.webp|png`;
   - the generated `sprite-atlas.ts`;
   - grid repacks for strips wider than 4096 px.
7. **Update `sprites.ts`** (anim steps, events, FX defs) and the hero spec timings. Then visually check `/sprite-lab?hero=<id>&render=pixi` at DPR 2.

## Conventions

- Characters face **right**. Enemies are flipped at runtime.
- Art drawn facing left: use `FxDef.mirror`, or flip it during the cut.
- Painted VFX are unmixed alpha, not pixelated. Pixel-art sheets set `pixelated: true`.
- The user reviews one skill at a time (preview + sync sheet) before the next skill.
- Approved assets are never silently replaced by older versions.
