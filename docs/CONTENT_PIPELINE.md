# Content Pipeline — adding content safely

> **Status: CANONICAL** · approved by the user on 2026-10-16 (after review). Change only with the user's approval.

## Always first: inspect the current state

Never infer "the next entity" from memory. Another agent may have added one.

```bash
git log --oneline -20 --format='%h %an %s'
grep -n "id: '" src/app/core/data/heroes.ts            # current heroes
grep -n "^  [a-z_]*: {" src/app/core/data/status-effects.ts | head -50
grep -rn "'<new-id>'" src/                              # ID must not exist yet
ls public/sprites | grep <new-id>                      # file names must not exist yet
```

IDs and file names follow **`docs/PROJECT_RULES.md` §8 (Naming)** exactly. That is the same convention for Claude and Codex: hero IDs are short lowercase (`kael`), everything else is `snake_case`, and there are no numeric IDs.

## NEW HERO

A new hero is a **long task**: create `wip/<agent>-hero-<id>` **before the first edit** and commit a checkpoint after each finished step (`docs/PROJECT_RULES.md` §5). Start from `HEROES` (`core/data/heroes.ts`), never from memory.

| # | Step | Real location |
|---|---|---|
| 1 | Choose a stable ID and check it is unused | `core/data/heroes.ts` (`HEROES`), `grep -rn` |
| 2 | Inspect the current roster and the latest hero commits | `HEROES`, `git log -- src/app/core/data/heroes.ts` |
| 3 | Hero template: id, name, cls (one existing primary class — see *Hybrid role labels*), base star, sprite | `core/data/heroes.ts` → `HEROES` (`HERO_BY_ID` is derived) |
| 4 | Localization | **No i18n layer.** The Thai name is in `HeroTemplate.name`; skill names are in the kit. Nothing else to register. |
| 5 | Base stats | From the class: `core/data/classes.ts` (`HERO_CLASS_BASE`, `HERO_3STAR_LV1`). There are no per-hero stat overrides today. |
| 6 | Star data | Global `STAR_STAT_MULTIPLIER`, `STAR_UP_COST`, `STAR_PERKS`. Nothing per hero. |
| 7 | Kit: normal attack (class), Skill 1, Skill 2, Ultimate | `core/data/hero-skills.ts` → `HERO_DEFINITIONS[id]`. Reuse the class skill **ids** so `SKILL_RANK_TABLES` (`core/data/skill-ranks.ts`) apply. A new skill id needs its own rank table. |
| 8 | New mechanic needed? | Add a **generic** effect or flag in `core/models/combat.ts`, `battle/engine/skill-system.ts` / `battle-engine.ts` / `buffs.ts`, with a spec. Never use hero-specific `if`s. |
| 9 | Statuses used by the kit | `core/data/status-effects.ts` (see NEW STATUS) |
| 10 | Animation sheet | `public/sprites/hero-<id>.png` from `tools/sprites/<id>.py`, then the `SHEETS['hero-<id>.png']` entry in `core/data/sprites.ts` (anims, events, impact, root, projectile) |
| 11 | VFX | `tools/sprites/<id>_{s1,s2,ult}.py` writes `public/sprites/fx-<id>-*.png`, then `FX` entries + `SheetDef.fx` in `sprites.ts` (see `docs/ANIMATION_PIPELINE.md`) |
| 12 | Optimise sprites | `npm run sprites:optimize` (regenerates `core/data/sprite-atlas.ts`) |
| 13 | Portrait, skill icons, banner | `public/portraits/<id>.webp`, `public/skills/<id>-{s1,s2,ult}.webp`, `public/banners/<id>.webp`, then `core/data/hero-art.ts` → `HERO_ART[id]` |
| 14 | AI behaviour | In kit data: `SkillDefinition.ai`, `useMode`, `TargetRule`. Role behaviour comes from the class (`ROLE_BEHAVIOR`). |
| 15 | Unlock / gacha | The gacha pulls from all of `HEROES` by base star (`core/rules/stars.ts`). Starter team or bench: `core/data/starter.ts` (`STARTER_TEAM`, `STARTER_BENCH`; `addMissingStarters` gives the hero to old saves). |
| 16 | Tests | Add the ID to `SHIPPED_*` expectations in `core/data/roster-remodel.spec.ts`. Add a per-hero engine spec `battle/engine/<hero-theme>.spec.ts` for the kit mechanics, plus clip timing / FX trigger tests. |
| 17 | Save compatibility | New IDs are safe. **Removing or renaming** a hero needs `dropRemovedHeroes` / `migrate` handling + `save.service.spec.ts`. |
| 18 | Validate | No duplicate IDs. No missing FX file (`sprite-files.spec.ts`). Typecheck app + spec. Full Karma run. `npm run hero-sim -- 10` smoke run (record numbers, don't rebalance). |
| 19 | Docs | `CLAUDE.md` hero section + claude.ai project doc `claude/hero-<id>-<identity-slug>.md` (Claude) + `docs/AI_HANDOFF.md`. |

Remodel order so far: bailong → yuezheng → moye → tangxun → linxue → garrick → kael. **Check `HEROES` for the real current list before choosing anything.**

### Hybrid role labels

A design label such as **Fighter / Assassin**, **Tank / Support** or **Mage / Controller** does **not** create a new gameplay class.

Before implementing a hybrid-role hero, inspect:

1. the class model — `HeroClass` in `core/models/hero.ts` (currently `tank`, `fighter`, `assassin`, `archer`, `mage`, `healer`);
2. class stat ownership — `HERO_CLASS_BASE` / `HERO_3STAR_LV1` in `core/data/classes.ts`;
3. `ROLE_BEHAVIOR` (leash, safe range, focus chase) in `core/data/classes.ts`;
4. skill-kit lookup — `kitOf(heroId, cls)` / `CLASS_KITS` / `HERO_DEFINITIONS` in `core/data/hero-skills.ts`;
5. class-based progression and ranks — `SKILL_RANK_TABLES` / `SKILL_PRIORITY_BY_CLASS` (`core/data/skill-ranks.ts`), `WEAPON_GROUP_OF` / `CLASS_BUILDS` (`core/data/equipment.ts`).

Unless the user explicitly approves a new gameplay class, **use one existing PRIMARY class** (the one whose stats, leash and weapon group fit best) and express the hybrid identity through:

- the hero kit (`HERO_DEFINITIONS`), skill effects and damage pattern;
- mobility (`BLINK_BEHIND`, `CHARGE`, `DASH_THROUGH`, ground shapes);
- targeting (`TargetRule`) and AI (`SkillDefinition.ai`, `useMode`);
- statuses and utility.

Do **not** automatically add a `HeroClass` value, create a combined class, duplicate class tables, or change global class progression because of a design label. If a new gameplay class seems genuinely necessary, report the architectural impact (every `Record<HeroClass, …>` table above, save data, equipment, ranks, sims) and ask before implementing.

## NEW ENEMY / BOSS

1. Check that the ID is unused in the `MONSTERS` merge:
   - `core/data/monsters.ts`
   - `monsters-stage4-10.ts`
   - `monsters-dungeon.ts`
   - `monsters-farm.ts`
   - `monsters-trials.ts`
2. Add a `MonsterDefinition` (stats, attack, targeting, ai, animation clips with frame numbers, `phases` for bosses) and any `MONSTER_SKILLS` / `PROJECTILES` / `BUFFS`.
3. **Art:** either a mock visual in `core/data/visuals.ts`, or a sprite via `tools/sprites/monster_sheet.py` / `sheet_cut.py` with `animation.sheet`. `monsterSheet()` builds the `SHEETS` entry.
4. **Variants:** use `<new>@<base>` IDs. Compare IDs with `baseMonsterId()`.
5. **Tests:** `battle/engine/monsters.spec.ts`, `stage4-10.spec.ts` or `dungeon-monsters.spec.ts`.

## NEW SKILL (hero)

- Add it to `HERO_DEFINITIONS[hero]`, reusing a class skill ID when possible (so rank tables apply). Otherwise add `SKILL_RANK_TABLES[newId]`.
- The R1 numbers in `hero-skills.ts` are the base. Never edit them through rank code.
- Clip timing: the DAMAGE events in `AnimDef.events` must match `repeat.count`.
- Spec: the effect, its targets, and the event times.

## NEW STATUS

1. Add an entry to `core/data/status-effects.ts` (`STATUS_EFFECTS`). Fill in:
   - `buff` true or false;
   - stack policy;
   - modifiers and flags.
2. New flags or modifiers go into `core/models/combat.ts`, with handling in `battle/engine/buffs.ts` and a spec.
3. Optional UI: an icon in `core/data/visuals.ts` (`STATUS_ICONS`).

## NEW STAGE

| Kind | Where |
|---|---|
| Tower floor | `core/data/stages.ts` (`STAGES`): waves via `enemies` / `rounds` / `waveDefs`, `rulePreset`, `background`, `recommendedLevel`, `monsterTuning` (within `MONSTER_TUNING_LIMITS`) |
| Farm, special or dungeon stage | `core/data/economy.ts` (`FARM_DUNGEONS`, `StageDef.special`) |

Rewards: `TOWER_REWARDS` / `baseRewards` in `economy.ts`.

Tests: `stage-flow.spec.ts`, `special-modes.spec.ts`, `encounter.spec.ts`.

## NEW ITEM / EQUIPMENT

- **Items:** `core/data/economy.ts` (`ITEMS`). Fragments need a combine rule.
- **Equipment:** `core/data/equipment.ts` (`EQUIPMENT_DEFS`, `AFFIXES`, stat caps). Rules are in `core/rules/equipment.ts`.
- **Save:** item IDs live in the inventory. Renaming one needs a migration.
- **Tests:** `core/rules/equipment.spec.ts`, `leveling.spec.ts`.

## Pre-commit checklist (content)

- [ ] IDs are unique (grep).
- [ ] Asset file names are unique, and `sprites:optimize` has run.
- [ ] Every FX key referenced in `SheetDef.fx` exists in `FX`.
- [ ] Specs updated. Karma passes. Both typechecks pass.
- [ ] `CLAUDE.md` + project doc + `docs/AI_HANDOFF.md` updated.
- [ ] Only intended paths staged (`git add <paths>`). Names follow PROJECT_RULES §8. No new FX prefix collides with an existing one.
