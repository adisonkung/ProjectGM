# Architecture — as it exists (2026-10-16)

> **Status: APPROVED** (user, 2026-10-16) as the descriptive reference. It follows the code; keep it updated when the code changes.
> **Descriptive** document: it describes the current code. When it disagrees with the code, the code wins and this file is updated (`docs/PROJECT_RULES.md` §2).

**Product identity (user decision, 2026-10-23): Eldervane / เอลเดอร์เวย์น.** `ProjectGM` remains the technical project name. Save identifiers remain backward compatible.

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
- **Owned state:** `GameState.heroes: OwnedHero[]` (star, level, exp, breakthroughTier, gear, skillRanks).
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

### Persistent combat fields

- `battle/engine/fields.ts`: `FieldSystem`, fixed cells, pulse interval/duration on the combat clock.
- Hero `FIELD` effects create fields at activation; pulse effects query current occupants via `SkillSystem`.
- Source death cancels; target death does not. Engine quiesce clears fields at wave advance/stage end.
- Engine emits generic `FIELD_STARTED` / `FIELD_ENDED` events. End metadata distinguishes `EXPIRED`, `SOURCE_DIED` and `CLEARED`, without changing pulses/damage/lifetime.
- `moveSpeedMultiplier` slows combat movement; status conditions snapshot pre-hit recipient status.
- Mirelle production states live in `core/data/mirelle-production.ts`. All three clips now link Final Timeline Sync under `docs/timelines/mirelle/` (user authorized2026-10-17). Existing `seq`/`steps` hold all10/20/20 poses with total0.9/1.8/1.8s. JSON/XLSX distinguish exact authored times from the50ms engine step; field/projectile lifetime is independent of character recovery. See `MIRELLE_FINAL_SYNC.md`.
- `square2Center()` shares the existing oriented 2×2 footprint between `resolveArea` and ground presentation, including bottom-lane handling; hit semantics are unchanged.
- Sylvara S2 uses `SheetDef.statusFx` and `battle/render/status-fx.ts` (`StatusFxPlayback`) for growth/stable-loop visuals tied to actual active status/source instances. Refresh does not replay growth; expiry/cleanse/target death/reset removes both views. The host receives the selected sheet so battle status FX resolve authored anchors and target facing. Battle and engine-backed sprite lab share this presentation owner. Engine review now supports projectiles and exports status source IDs; gameplay is unchanged. See `SYLVARA_S2_REVIEW.md`.
- Sylvara Phase A adds `RECT_3X2` / `rect3x2Center()` (three columns × two lanes, footprint shifted inside board edges). The existing FIELD scheduler delivers five current-occupant pulses; AI and damage share this geometry. Base/S1/S2/Ult art is integrated for provisional review in `core/data/sylvara-production.ts`; final timelines remain pending. See `SYLVARA_ULT_REVIEW.md`.

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

- `FxDef.groundArea: 'SQUARE_2'` places a target visual at the logical footprint centre via `groundFxCell`, independent of occupants or PNG bounds. The battle page converts grid cells to world/screen columns with formation origin/camera; captured cast aim covers a target that dies before activation.
- `SheetDef.appliedStatusFx` maps a caster's successfully applied status to a one-shot visual. The battle page consumes existing `buff` events after conditions/immunities, not damage or status guesses. No combat mechanic or hero-specific branch is involved.
- `FIELD_PULSED` reports already-resolved field pulses without changing scheduling/effects. `SheetDef.fieldFx.wave` optionally leads each pulse with rain and selects authoritative-pulse Impact art (six fixed cell contacts for `RECT_3X2`). `FieldFxPlayback` deduplicates pulses and cancels pending rain/owned effects on source death/clear/reset; natural expiry lets the last Impact finish. Pixi preloads field/status/wave textures; FIELD skills use actual-engine lab playback automatically. See `SYLVARA_ULT_REVIEW.md`.
- `SheetDef.fieldFx` selects start/loop/end/residual assets for a caster's fixed fields. `battle/render/field-fx.ts` (`FieldFxPlayback`) consumes field events, keeps the world centre fixed through camera motion, and advances owned visuals on the combat clock. Only natural expiry selects ending visuals; death/clear cancel them. It is shared by battle and the actual-engine sprite lab.
- Runtime `FxView` / `PixiFx` flags `managed` and `loop` keep a field looping until removed by its owner. Pixi removes managed views immediately (legacy one-shots retain their old finish behavior); DOM uses infinite iterations for loop instances and cancels the animation on component destruction. Standard FX repeat/frame data stays unchanged. Field visuals have no wall-clock cleanup timer.
- Sprite lab `?combat=1&formation=square&status=chill` can replay an isolated single INSTANT cast through the actual engine (`pages/sprite-lab/skill-review.ts`); only the first training target starts with the requested status. Automatic actions are frozen, training HP is high, source stats/kit are real and saves are untouched. This is distinct from the lab's older fixed-number visual playback.

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

- **Eldervane logo (2026-10-23):** transparent full/compact PNG masters and WebP delivery assets under `public/ui/branding/`. Welcome now uses the reviewed compact champagne wordmark over the citadel environment to match sheet12; shared navigation and summon heading also use the compact wordmark. Full floating-tower assets remain available. The generic crest/SVG and old summon wordmark are replaced, with semantic title/Home labeling preserved. The reviewed champagne/ivory delivery variants now serve these placements; original assets remain available. Header balances show exact comma-separated numbers below100k, then truncated decimal k/m/b with exact balances in accessible labels/tooltips. Formatting never changes saved currency. See `BRANDING.md`.

- **Refined Citadel presentation (2026-10-23):** replaces Jade Court after user-reviewed drafts. Charcoal panels, fine champagne-gold edges, crimson selected/actions and pale-blue magic accompany luminous Japanese/Korean fantasy environment assets. `styles.scss` and `shared/_fantasy-ui.scss` define typography, angled controls, surfaces and reduced-motion-safe UI transitions. Shared header is slim/full-width; phone navigation remains labeled. Real hero art/data are preserved. See `ELDERVANE_CITADEL_UI.md`; older feature notes below describe functional behavior and asset history.

- **Routes:** `app.routes.ts`. All game routes sit under `islandNamedGuard`.
- **Navigation:** `MAIN_NAV` retains island, heroes, team and summon on ordinary screens. Home, the summon sanctum, hero collection, standalone formation, armory, forge, tower and farm dungeons use `LOBBY_NAV`: Home, heroes, formation, equipment, summon and adventure, linking to existing F0 routes. Other features remain available through island buildings.
- **Home lobby:** the Home-only reference pass uses `home-chrome.scss`, responsive `CitadelFrameComponent` gold double contours and solid `CitadelIconComponent` glyphs. Existing City/classic maps render immediately; the static panorama/toggle are removed. Camera, plot actions, roaming heroes and progression layers remain active. A Home-only daytime sky grade runs inside the background canvas before creatures/islands; sealed tower stages remain sealed. Phones use a lower scene scale and extra top clearance to fit between the kingdom and party controls. Party order/levels/power, currencies, next floor and unlocks derive from real save/services. Desktop stacks the stage preview above the red hexagonal CTA and keeps the party-edit action below the roster; phones retain a six-item dock. CTA artwork is a blank generated skin with live DOM text/icons and normal button semantics. Other routes retain their previous chrome pending individual visual review. See `HOME_REFERENCE_REVIEW.md`; this task is local review only, with no deployment.
- **Lobby refinement:** the translucent kingdom panel keeps only tower progress/next unlock; readiness lives in the class-coloured party strip with real stars/levels. City labels counter-scale with the camera to remain 13 CSS px (14 on hover/focus), with ground halos and existing building-action icons. The existing rAF adds at most 6 px of background-only mouse parallax; world/front/hit transforms stay aligned. Five small tower motes are omitted in lite/reduced-motion modes. `enteringTower` acknowledges a press with a gate glow/focus for 480 ms, guards duplicate activation and cancels on Home destruction; reduced-motion/classic routes skip the delay. Floors are captured on press; the battle route and progression rules stay unchanged.
- **Hero collection / formation:** `/heroes` uses the luminous sanctum background with dark owned-portrait cards and a desktop filter sidebar, live class filters/sorts and grid/list controls. `/team` uses the luminous sanctum courtyard, compact saved presets and only the 18 legal ally cells as rectangular floor markers with clear `+` vacancy markers; a desktop sidebar lists actual deployed heroes; it has no stage/enemy selector. Reserve class filters sit at the left of the auto-arrange row (native select on phones), show reserve counts and never modify the deployed team or restrict automatic placement. `TeamPresetsComponent.compact` is opt-in; other preset consumers retain their existing layout. `PlacementComponent.allyOnly` opts into this view and vacancy-first selection; its default full battlefield/enemy preview remains for battle preparation. Both routes share lobby chrome without screen locking. Original saved formation coordinates, five-hero limit and TeamService actions remain unchanged.
- **Adventure UI:** `/tower` pairs a celestial spire vista with ten selectable floors and a live preview/entry card. Selection is read-only; locked previews show the prerequisite without an entry link, next floor is the default and cleared floors remain replayable. `/dungeons/:type` has four themed tabs, mission/rules, actual daily bonus counters and tier rewards/requirements; Hunt targets and daily guardian rotation retain their existing services. Both use scrolling lobby chrome and highlight Adventure. `shared/AdventureSceneComponent` supplies fixed background art, separate fog, swaying rays, soft glow and rising motes with pointer events disabled. CSS transforms/opacity drive motion; hidden tabs pause all layers, reduced-motion disables animations and phones show fewer motes. Shared adventure styling uses thin antique-gold edges, charcoal surfaces, crimson angled CTAs, floor medallions and static SVG dungeon sigils; these decorations never intercept input. Tower uses the citadel WebP; training/ascension/trial use the sanctum WebP; Hunt retains its vault artwork. Gameplay, unlock thresholds, economy, saves and battle routes are unchanged.
- **Equipment UI:** `/armory` pairs the selected hero's real three gear slots with selectable/sortable bag tiles, comparison and equip/unequip/lock/sell actions. `/forge` has a real-data crafting preview plus enhance/salvage tabs (including keyboard navigation and query deep links). The luminous sanctum background and fine gold/charcoal framing use shared scrolling lobby chrome; supplied legacy backgrounds remain in the repository. `shared/equipment-art.component.ts` contains temporary vector art for the six existing bases; actual rarity/upgrade level are read from the item. No mock items/stats enter saves. EquipmentService and pure equipment rules remain authoritative for all transactions.
- **Hero detail:** `/heroes/:uid` presents full uncropped key art (portrait fallback), live identity/progression, attack/skill shortcuts and overview/stats/skills/equipment tabs. Tab keys support Left/Right/Home/End; overview pairs star development/stats and the real three-slot gear/growth panels, stacking below 650px. Stats can expand base/gear/final values; all growth, memory, training, skill-up and equipment actions retain existing services/routes. Dark blue/gold decorative framing is local to this page; data, art and other themed scenes are unchanged.
- **Summon sanctum:** `/gacha` uses the shared immersive chrome, generated luminous sanctum and original card art, an original lead-hero banner showcase and smaller gold-aura cards with independent CSS motion and one 30fps/DPR≤1.5 light canvas (soft central shaft, altar flare and five open energy trails flowing inward; no coiled paths). Background is fixed while narrow screens scroll controls above the dock. Hidden/reduced-motion/destroy paths stop or clean up frame work. Native rate/pool/Memory dialogs retain existing config/pull/save services. A native confirmation dialog displays the actual cost/balance before spending; pending intent is consumed before the single transaction. A full-screen native cinematic uses the supplied hall/card art, a larger gold/blue beam for actual 3★ results, a smaller flash otherwise, and cards flying toward the camera in both variants. A sealed-card grid supports individual hero spotlights or reveal-all; Skip/Escape opens a full-screen result summary, with confirmed repeat pulls. Reduced motion skips flight/charge; timers and dialogs clean up on destruction. Repeat activation is blocked while pending/playing. The current empty-tier fallback (all roster templates are 3★) is disclosed in rates. `DEV_FLAGS.freeSummons` currently enables the user-requested temporary free testing: nominal100/900 prices remain visible, confirmations disclose no deduction, zero-gem pulls are allowed, and rewards/pity persist normally. The pure pull rule remains paid by default; disabling the flag restores normal affordability/debit and paid UI copy. `docs/SUMMON_SANCTUM_UI.md` records asset provenance and scope.
- **Theme:** Refined Citadel in `styles.scss`, with shared classes `gm-*` and `shared/_fantasy-ui.scss`.

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

- **Empty/recovery presentation:** `StateEmblemComponent` provides decorative vector seals for hero search/not-found and Armory bag/filter-empty states. Scoped `_list-empty-reference.scss` keeps the approved five-column grid and 2×2 equipment presentation; state/action data remains in existing services.

- **Summon information:** `_summon-information-reference.scss` scopes sheet17 chrome to the pool/rates/Memory dialog only. Memory uses an optimized hero-memory-bailong.webp illustration generated with the canonical Bai Long portrait/banner as identity references; original hero assets remain unchanged. Data comes from current registries/rules. `openInfo` resets the shared body scroll when changing information. Campaign/confirmation/results/cinematic services retain existing behavior.

### Localization

- **None.** Thai strings are inline in data (`HeroTemplate.name`, skill `name`) and templates. There are no localization keys.

### Asset loading

- **Sprites:** `core/data/sprite-files.ts` (`spriteUrl`, `stripGrid`) maps through the generated `sprite-atlas.ts` to `public/sprites/opt/*.webp|png`.
- **Pixi:** `Assets.load` plus `preloadFx` when a unit appears.
- **Island:** `PreloadService` decodes island art at app start.
- **Home detail windows:** `IslandDetailArtComponent` crops existing City layers or resolves the current classic `buildingDraw` as a still SVG; actual state/actions come from `IslandComponent`. `_island-details-reference.scss` isolates reference16 windows, CDK focus traps and internally scrolling mobile content. Hero Skills shortcut uses the existing HeroDetail tab through `tab=skills`; no save schema or island rules changed.

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


### Spatial field auras (Elira Phase A, 2026-10-17)

`FieldDefinition.anchor: HOME_ZONE` selects a fixed source-side home-zone anchor through shared `fieldAnchor()`. `RECT_6X3` resolves18 board cells; even-width integer anchors use columns−2 through+3. FieldSystem stores source side and resolves `aura` team/modifiers against current logical occupancy and living source on each query. Units expose `Buffable.auraModifiers`, composed with timed buffs by `modifier()`/`dodgeChance()` and the existing DamageResolver. No buff instance is copied to recipients, so entry/exit, source death and field clear leave no timed residue. Positive-field AUTO checks use the same anchor/area. Existing pulse damage fields keep their scheduler behavior; aura protection does not wait for a pulse. Elira now uses the supplied Charge/Formation/Loop/Dissolve tracks. Its current targeting is described below.


### Support-only impacts and review vitals (Elira S2,2026-10-18)

`SkillSystem` records positive SHIELD recipients alongside healed/revive-selected allies for support-only impact metadata. Grant amounts/counts remain on the existing shield host; presentation can target actual recipients including self. Sprite-lab `ReviewSample.vitals` snapshots real HP/shield percentages so one-shot ceremonies are independent of actual shield-bar expiry. Reset clears this lab state.

### Persistent support-field presentation

SheetDef.fieldFx.loopAfterStart optionally defers Loop until the start clip finishes; default retains existing simultaneous playback. FieldFxPlayback owns the pending transition and cancels it on field removal/reset. RECT_6X3 presentation uses the geometric midpoint (home2.5/enemy12.5,centre lane),independent of inclusive cell enumeration. Mirrored support-field fixtures run the same real-engine aura field in sprite lab.

### Targeted protective fields (Elira,2026-10-18)

Elira Ultimate selects LOWEST_HP_ALLY with unlimited range,self included. The recipient is selected when casting starts; the field snapshots that recipient's current cell at activation and stays fixed. A dead recipient during anticipation cancels targeted ally-field creation; it does not redirect. Source death still cancels an active field; recipient movement/death afterwards does not move/remove it.

RECT_6X3_CENTERED uses the exact activation cell as geometry and visual centre. It does not use the legacy RECT_6X3 midpoint/clamping. Half-open column bounds[c−3,c+3) and lane bounds[r−1.5,r+1.5) retain18 cells at interior integer centres; edges clip instead of shifting the centre. FieldSystem aura checks and healNeed AI checks share resolveArea. The existing home-zone/clamped pattern remains available and unchanged. Formation/Loop/Dissolve now align their common root to the recipient's feet at dy27.25%cell. Sprite lab formation=field puts the40%-HP recipient away from the full-health caster with inside/outside witnesses.

The `/heroes` collection review reuses CitadelFrame/Icon with original sanctum/portrait assets, a class sidebar (compact mobile grid), search/sort toolbar and two-column mobile cards. The shared reference header now applies to Home and the exact `/heroes` route; hero-detail keeps its current header pending review. Formatting/filters/routes use real data and do not mutate saves. See HERO_COLLECTION_REFERENCE_REVIEW.md.

Hero detail overview reuses CitadelFrame/Icon and the reviewed shared header on `/heroes/:uid`. Original banner/identity remain stable across tabs; basic overview stats can expand to the full six-row breakdown, with star development, actual equipment slots and growth actions retained. See HERO_DETAIL_REFERENCE_REVIEW.md for review scope.

Hero detail banner follow-up uses one full-width Citadel frame with the original artwork inside and a lower-left glass identity overlay; it replaces the earlier soft-mask/standalone plate composition. Source assets, callbacks and save data are unchanged.

The selected hero poster banner uses poster-banner.scss after the shared overview mixin: typography over a fading image shadow replaces the rejected glass identity box. It preserves all live identity/level/power actions and adds modest font/contrast increases.

Hero detail stats tab uses stats-reference.scss for a responsive breakdown table with an adjacent live progression sidebar. Both use existing statRows/starView/progress services; source art, formulas and save serialization remain unchanged.


### Citadel material across routed UI (24 Oct 2026 review batch)

The reviewed Home chrome is shared by all named game routes. Explicit `CitadelFrameComponent` children own the metal/lacquer face of controls and panels. `shared/_citadel-material.scss` clears superseded component surface backgrounds; global `shared/_citadel-pages.scss` supplies scoped layout/material refinements without increasing hero-detail's component stylesheet budget. Forge enhancement selection is presentation state with filter fallback and previews through the existing equipment rules. Armory sale and forge dismantle present native confirmation dialogs before invoking the unchanged equipment services. Sprite Lab gives its board host the same container-derived cell size as its stage. See ALL_PAGES_REFERENCE_REVIEW.md for pending user review; this architectural description does not authorize deployment.

Formation review correction adds an opt-in rectangular Citadel contour for square panels. Standalone formation uses compact fixed presentation rows for its unchanged3×6 grid, and compact presets reserve44px save/edit targets in a horizontal tool row. See FORMATION_REFERENCE_REVIEW.md; no game coordinates or save models change.

Armory reference review uses optional original hero banner/portrait fallback in its equipment column, with unchanged service-backed inventory and comparison. Its responsive grids and shallow square-cut artwork controls are presentation-only; see ARMORY_REFERENCE_REVIEW.md for pending approval.

Forge reference review presents enhancement items as single-button cards using the existing selectedEnhanceId/filter fallback and rule-derived preview. Craft and salvage continue through existing services; material/status/row framing is presentation-only. See FORGE_REFERENCE_REVIEW.md for pending approval.

User-requested Forge behavior update: EquipmentService.craftRandom delegates to a pure rarity/slot roll over existing definitions/legal mains and then existing craft costs/rolls; explicit-base craft remains a lower-level helper. EquipmentService.dismantleMany applies one immutable all-or-error batch result with deduplicated ids. Forge keeps selection/confirmation ids in signals, excludes locked items and derives totals through dismantleRewards. See FORGE_REFERENCE_REVIEW.md; no deployment or Relic implementation.

### Tower presentation review (24 Oct2026)

TowerComponent derives preview mode/time from STAGES and first-clear item labels from ITEMS/TOWER_REWARDS. Ascending floor buttons retain locked preview, next-floor entry and completed-floor replay. Static citadel artwork is decorative, not a floor-specific battle background. No progression/reward/save logic changes.

### Premium Tower presentation

Tower preview/row thumbnails resolve STAGES.background through BACKGROUNDS registry (same art as battle). The scene background assettower-palace.webp is decoration only. TowerOrnamentComponent is a local noninteractive CSS/SVG contour/corner/lacquer renderer; buttons/links retain semantics/focus. Tower owns its responsive CSS rather than old shared page overrides. No stage/save/economy changes.

### Tower lighting follow-up

TowerOrnamentComponent now draws continuous gradient SVG outline strokes sized by a cleaned-up ResizeObserver; CSS supplies translucent faces/corner engraving/lacquer. The outline no longer fills the entire panel with an opaque metallic layer. Tower page uses the existing palace art with warm lighting and blurred transparent list panel; actual-map preview remains unchanged. No game or save logic changes.

### Tower CTA typography

The challenge-only ornament variant scopes lacquer/end engraving; gold sword SVG/centered label/right chevron remain native anchor children. Tower CTA uses local Trirong700 Thai/Latin WOFF2 subsets under isolated Eldervane Trirong @font-face, with OFL/provenance inpublic/fonts/trirong; this avoids failed remote font requests without changing other pages' font families. No gameplay changes.

### Dungeons reference review

DungeonsComponent resolves map accents fromstage.background/BACKGROUNDS and item glyphs fromITEMS.kind. Mode labels are presentation only; ids/pools and original services remain authoritative. The view iterates bonusDrops chances/items and firstClearBonus items/firstClearItem, hides claimed first-clear rewards and derives bonus/repeat multipliers from dungeon definitions. Four decorative emblems are a transparent2×2CSS sprite with no gameplay identity. The pure TowerOrnamentComponent decoration is reused without importing TowerComponent/page state. Local Trirong @font-face declarations now live in shared/_adventure-fonts.scss imported by globalstyles; lazy Tower and Dungeons share those unchanged localfont files.

### Dungeons compact reward presentation

DungeonRewardIconComponent is stateless SVG art derived from existing ITEMS kinds/ids. Compact tier previews show selected main rewards with actual quantities and accessible labels. Native details retain the full objective and all reward lists/chances/first-clear data. No gameplay data or persistent state is added. Optional CSS variables on TowerOrnamentComponent let Dungeons specify cool panel fills/gold outline widths; other consumers use existing fallbacks.

### Ornament metal palette and mock material art

TowerOrnamentComponent accepts inherited optional gradient-stop, inner-line, engraving/filter variables; defaults preserve Tower appearance. Dungeons supplies antique-gold overrides and enables the optional grooved input. The duplicate dark outline is rendered only when requested, without affecting layout. Material art status is documented indocs/art/material-icons with real ITEMS ids; no planned asset paths are wired into gameplay.

### Summon presentation (2026-10-24 review)

`GachaComponent` uses the existing Bai Long banner and `SummonSanctumComponent` background with a campaign banner opening information on click and separate pity/actions. The gate owns vertical scrolling while the shared app shell locks document scrolling. Information dialogs scroll `.modal-body`; native results and cinematic dialogs own their viewport scrolling. `SummonSanctumComponent.showFloatingCards` defaults to true and is disabled on the main gate and the summon cinematic (which owns its own physical flight). `_antique-ornament.scss` supplies scoped presentation variables for TowerOrnament on Summon and its reveal scene; small portrait frames remain CitadelFrame. This is presentation only: gacha transaction/reveal state logic and save schema are unchanged.

### Campaign banners and procedural summon VFX (review revision)

`SummonCampaignComponent` is presentation-only metadata and a details output; Gacha currently configures exactly one standard campaign. Kind themes prepare future banner art but do not introduce pool selection, rates or new gameplay rarity. The banner details state reuses the native information dialog and can switch to pool/rates/Memory without reopening an already-modal dialog.

`SummonVfxComponent` is a noninteractive Canvas layer for ambient/charge/burst/cards/spotlight. It reads only presentation inputs, uses no RNG or save APIs, paints outside Angular at ≤30fps and DPR≤1.5, uses Resize/Intersection observers, respects visibility/reduced-motion/paused state, and cleans all lifecycle resources. The 3★ intro is 2.6s charge +2.6s burst; reduced motion still skips directly to cards. Optional CitadelFrame gradient CSS variables preserve original fallback colors everywhere outside Summon. New effects use existing hero/banner/card assets; no hero or material art was regenerated.

### Summon flight/card art revision (25 October 2026)

`SummonFlightComponent` renders one physical-style card per committed result during charge/burst, replacing legacy image spokes and the Sanctum floating-card overlay. Native WAAPI receives64-segment cubic3D trajectories: quintic gather settling, accelerating release, depth-dependent scale and banking, plus tangent-oriented wakes. Gather end/release start poses match exactly; all Animation handles cancel on replacement/destruction, and reduced motion never starts them. Lighting is separate masked foil, static card shadow, moving ribbons and floor light. No runtime physics engine, frame loop, RNG or save access is introduced.

`summon-card-art.ts` maps existing1/2/3★ to newly generated alpha WebP backs, shared by flight and sealed cards. Steel/silver and bronze ordinary assets remain ready for existing tiers without adding hero templates. The live roster/fallback remains all3★. See `docs/art/summon-cards/manifest.json` for generation/optimization provenance. Hero artwork and material icon backlog are untouched; no deployment.

### Flexible card surface (25 October 2026 review)

`SummonCardSurfaceComponent` supplies ten connected textured bands within each flight card. Native periodic hinge/twist waves travel toward the tip; a separate rig sways continuously. UV bands/glints use the existing rarity texture, so no card art is regenerated. Surface animations belong to this child and persist through parent gather/release; the parent still owns trajectory/wake animations. Each child owns21 Animation handles, one common document-timeline start, reduced-motion listener and cancellation on replacement/destroy. Prefixed global component CSS avoids per-card Shadow DOM stylesheet copies and preserves nested3D transforms by omitting a parent filter. No gameplay/timeline/save changes.

Hero detail follow-up adds a fifth `growth` tab while keeping the approved overview poster and existing actions. Non-overview stats/skills/gear/growth use the scoped global `_hero-detail-panels.scss` and TowerOrnament chrome; original services, six stats, three equipment slots, skill costs and save serialization are unchanged. See HERO_PANELS_REFERENCE_REVIEW.md for actual browser states and visual-review status.

Battle visual review scopes `_battle-reference.scss` to real tower/farm `.reference-battle` runs. Existing map art backs field chrome and result headers; preparation has decorative zone headings and compact saved presets below the field. CDK focus capture/trapping covers pause and real result dialogs. Item glyphs derive from registered item kinds; reward counts/EXP still come from the existing RunReward view. No engine, field coordinates or transaction changes. See BATTLE_REFERENCE_REVIEW.md.

Battle reference matching adds opt-in Placement.battleLayout with projected preset/start controls and a shared ng-template reserve/field view; Formation/lab retain their original layout. TeamPresets.tabs defaults false and offers native options for the battle tab variant. The real-run party dock uses a separate framed foot tray; results expose two main actions and expandable hero EXP/additional actions with a display-only EXP aggregate. BattleEmblem uses a transparent three-cell UI atlas; no outcome/transaction/engine change. UI work now follows mandatory UI_REFERENCE_RULES.md/PROJECT_RULES §21 and paired reference/actual evidence.

Battle viewport presentation keeps sheet11B proportions: battleViewport derives square cell size and a cell-relative party dock, with at most0.65 extra upper-crop rows. Board.sceneryExtraRows defaults0 and shifts its common .cam (DOM/Pixi/FX/hit targets). Field reveals previously cropped pixels without scaling either image layer; Battle caps extension to the map zoom crop, so zoom1 maps receive none. Placement uses the same bounded preview. Core BOARD_ROWS/SCENERY_ROWS, engine coordinates, renderer clock and saves are unchanged. PartyBar.referenceChrome defaultsfalse; real battle opts into individual metal frames and responsive portrait/skill proportions. The result masthead groups emblem/title/subtitle, and a thin shared reward ribbon contains the first-clear badge, still controlled by the existing TOWER_FIRST kind. See BATTLE_PROPORTIONS_REVIEW.md; the previous3-row expansion was rejected.

Victory result now uses a unified transparent tower/laurel/Thai-title artwork (victory-title.webp, provenance alongside), with accessible h2 title and live floor/run subtitle. Defeat/pause retain atlas emblems. _victory-inset.scss scopes a central radial shadow, a reward ribbon inside the outer frame with positive padding, and taller reward tiles to real win dialogs only. See BATTLE_VICTORY_INSET_REVIEW.md.

Welcome/account reference UI uses _account-reference.scss, existing champagne wordmark/citadel panorama, and shared frame/ornament chrome. Account rename opens a trapped modal, preserving AccountService.setName/name rules. SaveImportComponent uses an external template, existing decode preview, and UI-only pending confirmation; only the final button invokes the same AccountService.apply. Cancel/Escape leave the save untouched; backup/restore and transfer format remain in the original services. See ACCOUNT_REFERENCE_REVIEW.md.

Lab UI uses _labs-reference.scss under reference-lab/reference-sprite-lab. Real battle retains reference-battle styling. Lab opts into Placement.battleLayout; only unused upper scenery is cropped (1row for placement,0.75row for sprite preview), leaving square combat cells/model/hit areas/anchors intact. simStats is display-only output of the existing seeded simulation loop. SpriteLab external template adds selected-clip metadata from animOf/clipClock (idle renderer default), existing log and controls. GameAccessService reads temporary DEV_FLAGS.allPlayersAreGm=true per user; GM gets8 actions/debug controls, false policy getsS1/S2/ULT and an entry guard in play(). No identity/role field, login or codec change. See LABS_REFERENCE_REVIEW.md.

### Explicit monster footprints (Aegis, 2026-10-29)

`MonsterStats.footprint` optionally declares a logical rectangle and its anchor cell. The runtime unit carries that data; `battle/engine/footprint.ts` supplies occupied cells, bounds, occupancy tests and Chebyshev body-edge distances. Aegis alone opts into a 3×2 body with a lower-centre anchor. Grid occupancy still tracks actor anchors; body-blocking / landing validation reserve the additional footprint cells. Living multi-cell bodies reserve space for both teams. Standard pathing, retreat, knockback, summon and blink/dash landing checks use the reservation; blink picks a free perimeter cell. Normal attacks, skill reach and threat calculations use body edges. AreaResolver expands a multi-cell recipient into logical cells then deduplicates back to one real actor; ground-cell main/splash classification checks the same footprint. Single-cell actors keep their existing distance rules. All geometry is authored gameplay data, independent of PNG dimensions.

### Monster cast presentation tracks and forward 3×2 ground area (2026-10-29)

SheetDef.monsterFx may provide per-FX cast tracks, reusing existing FxTrack motion/alpha and game-clock cleanup. Aegis S3 uses a generated authored spear-tip curve and a separate ground charge; it does not implement general live FOLLOW_ANCHOR. FxDef.ground values pin source-visible lower edges to the feet plane. FRONT_RECT_3X2 is three columns strictly forward, the caster row and the row above; its impact uses a lower-middle presentation anchor. Monster cast facing is committed until resolution. DAMAGE skills with zero hits report an empty skillActivated.targets list; SELF support skills retain their intended target list.

Battle presentation: `battleViewport` reserves 0.8 decorative floor rows below the three playable lanes; `BoardComponent.groundExtraRows` defaults to zero for standalone/lab views. The added CSS/Pixi bounds and `FieldComponent` ground continuation do not translate unit coordinates or extend the logical grid.

### Fractional melee contact (user request 2026-10-29)
`battle/engine/melee-contact.ts` owns basic-contact geometry against real world footprint bounds. `BattleEngine` glides melee units toward a within-cell vertical contact stance (up to half a lane) using pre-glide opponent positions. Logical cells/occupancy and area resolution remain grid-based. `SkillSystem.basic` and the melee hit callback, plus `MonsterController` attack start/hit, require half-lane vertical contact. Ranged positioning is unchanged. See MELEE_CONTACT_REVIEW.md for semantics, tests and actual-game evidence.
