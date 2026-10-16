# Architecture — as it exists (2026-10-16)

> **Status: REVIEWED DRAFT** · generated / reviewed 2026-10-16 · **pending final user approval.** Not canonical yet.
> **Descriptive** document: it describes the current code. When it disagrees with the code, the code wins and this file is updated (`docs/PROJECT_RULES.md` §2).

## Folder map

```
src/app/
  core/
    models/      types only (combat, monster, unit, stage, hero, game-state, economy, equipment, progression, skill-rank, island)
    data/        static game data + generated tables (heroes, hero-skills, sprites, monsters*, stages, status-effects, …)
    rules/       pure formulas (stats, stars, leveling, rewards, equipment, skill-ranks, team, account, island, slash-trace)
    services/    Angular services over SaveService.state (save, roster, team, gacha, progression, equipment, island, account, preload)
  battle/
    engine/      combat engine — pure TS, NO Angular (runs in node sims)
      stage/     Stage / Wave / Transition state machine (stage-flow, rules, formation, party, types)
      bots/      TacticalBot (simulated tactical player)
    render/      Pixi renderer + pure clip math (unit-clip, fx-clip, particles, unit-look, tex-chunks, renderer-pref)
    board/       BoardComponent (DOM board + rAF loop + Pixi host)
    unit-sprite/ fx-sprite/ projectile/ impact-feel/ party-bar/ cast-bar/ focus-mark/ slash-trace/ field/ placement/
    battle-session.ts   createBattle() — the only place UI builds an engine
  pages/         routed screens (battle = /battle and /lab, sprite-lab, island, heroes, hero-detail, team-builder, tower, dungeons, gacha, armory, forge, account, welcome)
  island/        Home Island + Sky City scenes and sims
  shared/        icon, hero-portrait, team-presets, save-import
src/testing/legacy-roster.ts   test fixture (old heroes) — tests / sims only
tools/
  sprites/       per-hero bake scripts (Python), optimize.py, normalize.py, ult_sync_sheet.py
  dev/           node sims: hero-sim, balance, trace, economy*, sprite-dump
  island/        island art generator + Sky City build
  simulate.ts    legacy-roster win-rate sim
public/          sprites (+ opt/), portraits, skills, banners, island, backgrounds
art/incoming/    user source art (gitignored)    assets/heroes/Kael/  canonical Kael source (tracked, read-only)
```

## Systems

### Combat engine

- **Purpose:** deterministic battle simulation. It is a fixed 50 ms step driven by the page.
- **Primary files:**
  - `battle/engine/battle-engine.ts` (`BattleEngine`)
  - `skill-system.ts`
  - `damage-resolver.ts`
  - `buffs.ts` (StatusSystem)
  - `area.ts`
  - `targeting.ts`
  - `positioning.ts`
  - `monster-controller.ts`
  - `pathfinding.ts`
  - `grid.ts`
  - `metrics.ts`
  - `rng.ts`
- **Data ownership:**
  - `BattleUnit` runtime state lives in the engine.
  - Definitions are read from `core/data`.
- **Dependencies:** `core/data`, `core/models`, `core/rules`. **No Angular.**
- **Public interfaces:**
  - `engine.step()`, `subscribe(fn)`;
  - `setFocus`, `requestSkill`, `setSkillMode`, `setInterruptMinPriority`;
  - `reviveHero`, `useSpecial`;
  - `metrics`, `stageResult`.

### Stage / Wave flow

- **Purpose:** the phase state machine. `PREPARATION → WAVE_START → COMBAT → WAVE_CLEAR → ADVANCING / REGROUPING → … → STAGE_CLEAR / STAGE_FAILED`.
- **Files:** `battle/engine/stage/{stage-flow,rules,formation,party,types}.ts`.
- **Data:**
  - `StageDef` in `core/data/stages.ts` and `legacy-stages.ts`;
  - farm stages in `core/data/economy.ts`;
  - `wavesOf(stage)`.
- **Interfaces:**
  - `StageBattleRules` presets: `story`, `arena`, `defense`;
  - `StageModeRules` (special modes);
  - UPPERCASE `BattleEvent`s.

### Entity / hero system

- **Templates:** `core/data/heroes.ts` (`HEROES`, `HERO_BY_ID`), with the starter team and bench in `core/data/starter.ts`.
- **Kits:**
  - `core/data/hero-skills.ts`: `CLASS_KITS` holds the class defaults; `HERO_DEFINITIONS` holds per-hero kits.
  - Look kits up with `kitOf(heroId, cls)`.
  - Ranks come from `rankedKit()` (`core/rules/skill-ranks.ts`).
- **Stats:** `core/rules/stats.ts` (`heroStats`, `LEVEL_GROWTH`) and `core/data/classes.ts` (`HERO_CLASS_BASE`, `STAR_STAT_MULTIPLIER`, gauge constants).
- **Owned state:** `GameState.roster: OwnedHero[]` (star, level, exp, breakthroughTier, gear, skillRanks).
- **Art:** `core/data/hero-art.ts` (`HERO_ART`).

### Skill system

- **Purpose:** the `SkillSystem` handles:
  - target choice (`TargetRule` plus fallback);
  - the AI layers (EMERGENCY → INTERRUPT → HEAL → HIGH_VALUE → NORMAL);
  - delivery (INSTANT, PROJECTILE, BLINK…);
  - repeat hits;
  - effects (DAMAGE, HEAL, APPLY_STATUS, INTERRUPT, KNOCKBACK, SHIELD, REVIVE, CLEANSE).
- **Timing:** comes from the clip's semantic events (`animEvents`) when the sheet has them, otherwise from `animTiming().hit`.
- **Interface:** `SkillHost` is implemented by the engine.

### Status system

- **Data:** `core/data/status-effects.ts` (`STATUS_EFFECTS`), plus the legacy monster `BUFFS` in `monsters.ts`.
- **Logic:** `battle/engine/buffs.ts`:
  - stack policies;
  - DoT / HoT;
  - modifiers;
  - flags `stun`, `root`, `silence`, `untargetable`, `broken`, `unstoppable`;
  - `counterStatus`.

### Monsters

- **Data:**
  - `core/data/monsters.ts`
  - `monsters-stage4-10.ts`
  - `monsters-dungeon.ts`
  - `monsters-farm.ts`
  - `monsters-trials.ts`
- **Merged into:** `MONSTERS` / `MONSTER_SKILLS`.
- **Runtime:** `MonsterController` state machine and `targeting.ts`.
- **Visuals:** mock visuals in `core/data/visuals.ts`.

### Animation system

- **Data:** `core/data/sprites.ts`:
  - `SHEETS` (per sheet: cell size, rows, `AnimDef` with `seq` / `steps` / `events` / `impact` / `eventFeel` / `root` / `opacity` / `pace`);
  - `FX`;
  - `fxFor()`;
  - `animEvents()`, `animTiming()`.
- **Monster sheets:** built from clip data with `monsterSheet()`.
- **DOM renderer:** `battle/unit-sprite` (Web Animations).
- **Pixi renderer:** `battle/render/unit-clip.ts`, a pure "frame at time t" function with the same rules.

### VFX system

- **Data:** `FX` in `sprites.ts` (`FxDef`). Fields include:
  - `at`, `on`, `event`, `hitIndex`, `perHit`, `delayMs`, `repeat`, `fadeOutMs`;
  - `layer`, `blend`, `mirror`, `pivot`, `anchor`, `attach`, `particles`, `overshoot`.
- **Particles:** `core/data/particles.ts`.
- **Spawning:** the page `battle.component.ts` (`addFx`) and `sprite-lab`.
- **Drawing:**
  - DOM: `battle/fx-sprite`, `projectile`;
  - Pixi: `render/pixi-units.ts` with `render/fx-clip.ts` and `particles.ts`.

### Rendering / board

- **`BoardComponent`:**
  - one rAF loop with interpolation;
  - `vclock` (game seconds) and `idleClock`;
  - `.cam` wrapper for impact zoom;
  - hosts the Pixi canvas (`PixiUnitLayer`), lazy-loaded with `pixi.js` and `pixi-filters`.
- **Renderer choice:** Pixi is the default. DOM is the fallback. See `render/renderer-pref.ts`.
- **Kept in DOM:** HP bars, cast bars, damage numbers, focus marks and zones.
- **Impact feel:** `battle/impact-feel/impact-feel.ts` (hit-stop, shake, flash, zoom).

### UI / pages

- **Routes:** `app.routes.ts`. All game routes sit under `islandNamedGuard`.
- **Main nav (`MAIN_NAV`):** island, heroes, team, summon. Other features are reached from buildings on the island.
- **Theme:** "Arcane Noir" in `styles.scss`, with shared classes `gm-*`.

### Save / load

- **`core/services/save.service.ts`:**
  - one `signal<GameState>` auto-saved to `localStorage`;
  - version 6, with `migrate()`;
  - repairs on load;
  - backup key for import undo.
- **Export / import:** `core/rules/account.ts` (`SaveEnvelope`, `ST1Z.` code).

### Configuration

- `core/data/dev-flags.ts` (`DEV_FLAGS`).
- Rule presets: `stage/rules.ts`.
- Economy tables: `core/data/economy.ts`, `progression.ts`, `equipment.ts`, `skill-ranks.ts`, `stars.ts`.

### Localization

- **None.** Thai strings are inline in data (`HeroTemplate.name`, skill `name`) and templates. There are no localization keys.

### Asset loading

- **Sprites:** `core/data/sprite-files.ts` (`spriteUrl`, `stripGrid`) maps through the generated `sprite-atlas.ts` to `public/sprites/opt/*.webp|png`.
- **Pixi:** `Assets.load` plus `preloadFx` when a unit appears.
- **Island:** `PreloadService` decodes island art at app start.

### Scene / state management

- **Angular signals:** `SaveService.state` is the single source. Services derive from it.
- **Battle page:**
  - owns the `BattleEngine` instance through `createBattle()`;
  - drives the fixed-step loop;
  - turns engine events into FX, impact feel and floating text.
- **Island:** `island-sim.ts` / `city-sim.ts`.

## Dependency flow

```
core/models ← core/data ← core/rules ← battle/engine ← battle/battle-session ← pages/battle
                       ↖ core/services (SaveService.state) ← pages/*
core/data/sprites.ts ← battle/render, battle/unit-sprite, battle/fx-sprite, engine (animTiming/animEvents for timing)
tools/dev/* (node) → core/* + battle/engine (via tsconfig.sim.json)
tools/sprites/*.py → public/sprites/*.png → optimize.py → public/sprites/opt + sprite-atlas.ts
```

## Runtime ownership

| Who owns it | What |
|---|---|
| Engine | combat truth: HP, statuses, positions, timers |
| Board | visual interpolation only |
| Page | FX lifetime, hit-stop pause, speed, UI state |
| SaveService | persistent state |

Engine results become progression through `ProgressionService`.

## Known architectural issues

1. **Two renderers.** DOM and Pixi both exist, with duplicated FX and projectile rules. Parity is kept by specs that compare boxes. DOM is to be removed once Pixi is proven on the user's devices.
2. **Animation data drives gameplay timing.** — **KNOWN ARCHITECTURAL / BALANCE DEBT · DEFERRED UNTIL THE ROSTER / BALANCE PASS.** Do not redesign the timeline system before then.
   - Damage and cast-lock timing come from clip events, frames and steps (`animTiming` / `animEvents`). Slowing or lengthening a clip changes DPS.
   - hero-sim showed F5 0 % because clips are long; it reaches 100 % with `--nosprite`.
   - This uses semantic events, not frame checks, but it is still a gameplay dependency on art data. See `docs/COMBAT_RULES.md`.
3. **Very large files** are conflict hotspots: `sprites.ts`, `battle-engine.ts`, `battle.component.ts`, `hero-skills.ts`.
4. **Legacy data still in the app** (kept on purpose, used by tests and sims):
   - `CLASS_KITS` keeps the comments and names of old heroes (Aurel / Morgan / Ragnar …);
   - `src/testing/legacy-roster.ts`;
   - `ENEMIES` / `enemy-skills.ts` and `legacy-stages.ts`.

   Unused legacy art tools, the Bai Long ult v2 FX and stray debug images were removed on 2026-10-16.
5. **No localization layer.** Text is inline in Thai.
6. **No lint config. No CI.** Tests run only through Karma with Chrome.
7. **Most source art is outside git** (`art/incoming/`). Re-baking a hero other than Kael needs the user's local files, so a cloud agent and the local machine may hold different copies. Kael's source (`assets/heroes/Kael/`) has been tracked since 2026-10-16.
8. **`DEV_FLAGS.fullUltAtStart` is ON** in the committed code.
