# Project Rules — Summon Tower (ProjectGM)

> Canonical since 2026-10-16 (approved by the user). It applies to **every** agent: Claude, Codex and future agents. Change it only with the user's approval.

## 1. Project overview

Summon Tower is a gacha, team-building and auto-battle game in the style of TFT.

- **Board:** horizontal, 5 rows × 16 columns. The top 2 rows are scenery; units stand on the 3 bottom lanes.
- **Zones:** our zone is columns 0–5, the neutral zone is 6–9 (no placement), the enemy zone is 10–15.
- **Team:** 5 heroes.
- **Stack:** Angular 19 (standalone components, signals) and TypeScript, with a Pixi v8 board renderer (a DOM renderer is kept as fallback) and a Python art pipeline under `tools/`.
- **Language:** the UI and most project notes are in Thai.
- **Owner:** CaraMelz. Built as a personal game.
- **Design archive:** the claude.ai project "Game Demo" (`claude/*.md`).

## 2. Source of truth

Precedence, from highest to lowest:

1. The user's explicit instruction in the current task.
2. Approved docs: `docs/COMBAT_RULES.md` → `docs/ANIMATION_PIPELINE.md` → `docs/CONTENT_PIPELINE.md` → this file → `docs/ARCHITECTURE.md` → `CLAUDE.md` (per-feature notes).
3. The current repository implementation.
4. Current Git history.
5. Current tests.
6. Previous conversation context. This is advisory only.
7. Agent preference.

Rules:

- **Git wins over memory.** Conversation memory, `docs/AI_HANDOFF.md` and the claude.ai docs never override the repository.
- **Newer approved data wins.** When a document and the code disagree, the newer approved value is canonical. Report the difference as CURRENT / CANONICAL / DIFFERENCE. Never silently change gameplay.
- **The canonical repository** is the user's local clone: `/Users/webuild/ProjectGM`, branch `master`. A cloud copy (Claude) is never the source of truth.

## 3. Multi-agent development

- Agents hand work over **through Git**: commits plus `docs/AI_HANDOFF.md`. Never through chat.
- Content from any agent is first-class. Change it only for:
  - a confirmed bug;
  - a canonical-rule violation;
  - a failing test;
  - a user request;
  - a requirement of the new task.
- **One agent at a time on a given file set.** Hotspots touched by almost every hero task:
  - `core/data/sprites.ts`
  - `core/data/hero-skills.ts`
  - `core/data/heroes.ts`, `core/data/starter.ts`, `core/data/hero-art.ts`
  - `battle/engine/battle-engine.ts`, `battle/engine/skill-system.ts`
  - `pages/battle/battle.component.ts`
  - `core/data/sprite-atlas.ts` (generated)
  - `core/data/roster-remodel.spec.ts`
  - `CLAUDE.md`, `docs/AI_HANDOFF.md`
- **Conflicting approaches** → write a `CONFLICT DETECTED` report: current implementation, previous implementation, affected files, risk, recommended resolution.
  - Small obvious bugs: fix them.
  - Architectural disagreements: ask first.

## 4. Session start protocol — SESSION RECONCILIATION

Run these before any change:

```bash
git branch --show-current
git status --short --untracked-files=all
git log --oneline -15 --format='%h %ad %an %s' --date=short
git branch -a --list 'wip/*' 'feature/*'       # unfinished / parallel work
git diff --stat HEAD                           # uncommitted work
git log --since='3 days' --name-status --format='--- %h %an %s'
```

Then:

1. **Read the rules.** Read `AGENTS.md`, this file, and the doc for the system you will touch. Read `docs/AI_HANDOFF.md` as a hint; Git wins.
2. **Read other agents' work.** If any commit or `wip/*` branch was made since your last session by another agent, check the `Co-Authored-By` trailer or the handoff note, then read it (`git show <hash> --stat`, then the diff) **before** continuing.
3. **Check the registries.** Inspect the registries and tests of the system (`docs/CONTENT_PIPELINE.md`). For example, before a new hero, read `HEROES` in `core/data/heroes.ts`.
4. **Uncommitted changes you did not make:** never reset, clean, stash-drop or overwrite them. Work out whose they are; if unclear, report before touching overlapping files.
5. **"Continue from the previous agent"** means: find that work in Git (`master`, then `wip/*`). Never assume context.

## 5. Git workflow (decided 2026-10-16)

### Model: trunk-based, one active agent, a clean handoff commit

This model was chosen because Claude and Codex usually **take turns**, for example when one hits its usage limit.

- **Trunk.** `master` is the trunk and is always green: tests pass and every completed task is committed. The next agent always starts from `master`, so it automatically sees everything the previous agent finished.
- **Normal case (sequential).** Work directly on `master` in small finished commits.
  - Example: Claude finishes hero #7 → commits → stops. Codex reconciles, sees #7 in `HEROES` and in the log, builds #8 → commits. Claude reconciles, sees #8, builds #9.
  - No long-lived branches means no merge drift. This is why it works better than a branch per hero when agents alternate.
- **Interrupted case** (limit hit or session cut mid-task):
  1. Commit whatever exists to **`wip/<agent>-<task>`**, e.g. `wip/claude-hero-vaelric-s2`, with a `wip:` subject.
  2. Add the state to `docs/AI_HANDOFF.md` on that branch: what is done, what is left, how to test.
  3. Never leave half-finished work on `master`.
  4. The next agent either finishes it on that branch and fast-forward merges it into `master`, or leaves it alone and works on something else.
- **Parallel case** (both agents at once, only when the user asks):
  1. Each works on `feature/<task>` with **disjoint files**.
  2. Two new heroes are *not* disjoint, because both touch `sprites.ts`, `hero-skills.ts` and `heroes.ts`. Do them one after the other.
  3. Merge one branch, then rebase the other onto `master`, re-run its tests, then merge.
- **Merging into `master`:** fast-forward when possible. Delete the `wip/` or `feature/` branch after merging.
- **Do not push** unless the user asks.
- **Destructive commands need explicit user approval:**
  - `git reset --hard`, `git clean -fd`, `git checkout -- .`, force checkout;
  - `git stash drop`, `git branch -D`, force push;
  - `rm` of tracked files outside an intended cleanup commit.

### Claude (cloud) ↔ local repository

Claude works in a cloud copy, so commit hashes differ from local: `git am` re-commits them. **Compare tree hashes, not commit hashes.**

1. **Start of session:** compare local `master` with the cloud copy (`git rev-parse HEAD^{tree}`).
   - If local has newer commits (for example from Codex), export them on the local machine with `git format-patch --binary <base>..master -o "Claude outputs/sync"`, where `<base>` is the last commit already in the cloud.
   - Apply them in the cloud with `git am --3way`.
   - Do not start until the tree hashes match.
2. **Delivery:**
   1. Run `git format-patch --binary` and write the patch to `Claude outputs/<task>/` (gitignored).
   2. Apply it locally with `git am --3way`.
   3. Verify that the tree hash equals the cloud tree hash.
   4. If `git am` fails: `git am --abort`, then report. Never force it.
3. Lock files left by an interrupted `git am` may only be removed after confirming that no git process is running.

### Local agents (Codex, etc.)

Commit directly in `/Users/webuild/ProjectGM`. Then stop.

## 6. Commit rules

- **One task per commit.** Do not bundle unrelated work.
- **Subject:** `type(scope): summary`.
  - types: `feat`, `fix`, `refactor`, `test`, `docs`, `art`, `chore`, `wip`;
  - scope examples: `hero`, `combat`, `render`, `fx`, `ui`, `island`, `tools`.
- **Body:** what changed, with the key numbers and the reason. Follow the existing descriptive style.
- **Trailers:** each agent adds its own attribution trailer. Claude adds `Co-Authored-By: Claude … <noreply@anthropic.com>` and `Claude-Session: …`. Codex should add a `Co-Authored-By: Codex …` trailer, so the next agent can see who made the commit.
- **Before committing:**
  - read the diff;
  - remove debug code and stray files;
  - **stage explicit paths** (`git add <paths>`);
  - run the relevant tests (§13);
  - verify registrations, unique IDs and unique file names;
  - run `npm run sprites:optimize` if `public/sprites/*.png` changed;
  - update `CLAUDE.md`, the related claude.ai project doc (Claude) and `docs/AI_HANDOFF.md`.

## 7. Code style

- TypeScript strict, Angular standalone components and signals.
- `core/data` holds data only; `core/rules` holds pure functions.
- **`battle/engine` must not import Angular.** It also runs in node sims through `tsconfig.sim.json`.
- Comments are short, in English or Thai. Data entries note their source: sync sheet, user request and date.
- There is no lint config. Follow the surrounding style: 2 spaces, single quotes, long lines allowed in data tables.

## 8. Naming — one convention for every agent

These are the conventions already used in the repository. Codex, Claude and future agents must follow them exactly.

### IDs (data keys)

| Thing | Convention | Examples |
|---|---|---|
| Hero ID | lowercase, no separators, from the hero's short name | `bailong`, `yuezheng`, `moye`, `tangxun`, `linxue`, `garrick`, `kael` |
| Monster ID | `snake_case` · variants `<new>@<base>` · tiers `<boss>@1..3` | `forest_wolf`, `brass_shishi`, `crossbow_dummy@goblin_archer` |
| Skill ID | `snake_case`. A hero kit reuses its **class** skill IDs so rank tables apply. | `piercing_thrust`, `spinning_sword`, `holy_resurrection` |
| Status ID | `snake_case` | `open_wound`, `taunt_guard`, `brace_counter`, `gate_ward` |
| Item ID | `snake_case`; fragments follow their family's existing pattern | `skill_tome_2`, `skill_tome_frag_2`, `bt_stone_1`, `bt_fragment_1`, `enhancement_ore` |
| Stage / dungeon ID | floors are numbers; dungeons `<type>_<tier>` | `hunt_4`, `training_2` |
| Events | `UPPER_SNAKE` | `VFX_SPAWN`, `WAVE_STARTED` |

**Never use sequence IDs** such as `hero8`. The remodel number (#7) is only a label in docs.

### Files

| Thing | Path / name |
|---|---|
| Hero sprite sheet | `public/sprites/hero-<id>.png` (cell 260 × 170, root 130,155) |
| Hero FX strip | `public/sprites/fx-<id>-<s1\|s2\|ult>-<part>.png` (e.g. `fx-tangxun-ult-surround.png`, `fx-kael-s1-impact.png`) |
| Hero projectile | `public/sprites/fx-<id>-<thing>.png` (e.g. `fx-tangxun-knife.png`) |
| Enemy sheet / FX | `public/sprites/enemy-<id-with-dashes>.png`, `fx-<skill-name>.png` |
| Portrait / icons / banner | `public/portraits/<id>.webp` (288) · `public/skills/<id>-{s1,s2,ult}.webp` (160) · `public/banners/<id>.webp` (1400 w) |
| Source art | `art/incoming/<id>/…` (gitignored); UI art in `art/incoming/<id>/art/{portrait,s1,s2,ult,banner}.png`. Exception: Kael uses `assets/heroes/Kael/` (tracked, read-only). |
| Base-sheet script | `tools/sprites/<id>.py` |
| Skill VFX / sync-sheet scripts | `tools/sprites/<id>_s1.py`, `<id>_s2.py`, `<id>_ult.py` |
| Normalize config | `tools/sprites/normalize/<id>.json` |
| Engine spec for a hero kit | `src/app/battle/engine/<theme>.spec.ts`, named after the hero's identity (`ashen-vanguard`, `iron-bell`, `lotus-physician`, `severing-chain`). Roster and clip tests go in `core/data/roster-remodel.spec.ts`. |
| Project doc (claude.ai) | `claude/hero-<id>-<identity-slug>.md` (e.g. `hero-kael-ashen-vanguard.md`) |
| Patch drop (local only) | `Claude outputs/<task>/` |

### FX keys (`FX` in `sprites.ts`)

Format: `<prefix>-<s1|s2|ult>-<part>`. The part names are `charge`, `main`, `impact`, `impactN`, `spark`, `shock`, `residual`, `aura`, `field`, `trail`, …

| Hero | Prefix |
|---|---|
| bailong | `bailong-` / `bl3-` |
| yuezheng | `yz-` |
| moye | `my-` |
| tangxun | `tx-` |
| linxue | `lx-` |
| garrick | `gr-` |
| kael | `kl-` |

- A new hero gets a **new two-letter prefix that is not taken**. Grep `FX` before choosing one.
- `SheetDef.fx` lists the keys per clip kind (`skill`, `skill2`, `ult`).

### Clip kinds

`idle`, `walk`, `hurt`, `attack`, `die`, `skill` (S1), `skill2` (S2), `ult`. Sheet rows: 0 idle · 1 walk · 2 hurt · 3 attack · 4 die · 5 S1 · 6 S2 · 7 Ult.

### Branches

`master` · `wip/<agent>-<task>` · `feature/<task>` · `fix/<area>-<topic>` · `review/<topic>`. Agent names are lowercase: `claude`, `codex`.

## 9. File organization

See `docs/ARCHITECTURE.md`. Short version:

- `src/app/core/{models,data,rules,services}`
- `src/app/battle/{engine,render,board,…}`
- `src/app/pages/*`, `src/app/island`, `src/app/shared`
- `tools/{sprites,dev,island,backgrounds}`
- `src/testing/legacy-roster.ts` (test fixture only)

## 10. Data-driven design

- Combat numbers live in data. Never write `if (heroId === 'kael')`, `if wave == 2` or `if stageId == 1` in combat code.
- New mechanics are **generic** effect, flag or field types with a spec. Examples: `DAMAGE.travel`, `onHits`, `breakPower`, `counterStatus`, `FxDef.mirror`.
- Compare monster IDs with `baseMonsterId(id)`.

## 11. Errors, debugging, logging

- **Missing art or FX never changes combat.** FX lookups skip silently, and units without a sheet render as tokens.
- **WebGL or Pixi failure** falls back to the DOM renderer.
- **Debugging tools:**
  - `/lab?floor=N&debug=1` (or `D` in dev builds);
  - `/sprite-lab?hero=<id>&render=pixi|dom`;
  - `npm run trace -- <floor|dungeonId> [seed] [level|rec] [tactical]`.
- No logging framework. No `console.log` in commits.

## 12. Performance

- Board: one rAF loop plus a fixed 50 ms engine step. **Never use `setInterval` for the game loop.**
- Sprites: FX strips wider than 4096 px are re-packed into grids by `sprites:optimize`. Pixi chunks textures larger than `MAX_TEXTURE_SIZE`.
- Sky City: canvas layers only. No multi-thousand-px DOM layers.

## 13. Testing

| What | Command |
|---|---|
| Typecheck app / specs | `npx tsc -p tsconfig.app.json --noEmit` · `npx tsc -p tsconfig.spec.json --noEmit` |
| Unit tests (Karma, ~611 specs) | `npm test` · headless as root: `CHROME_BIN=<chromium> npx ng test --watch=false --karma-config=karma.ci.cjs` |
| Build | `npm run build` |
| Shipped-roster battle sim | `npm run hero-sim -- [runs] [--combos] [--stats] [--nosprite]` |
| Mechanics / balance sim (legacy roster) | `npm run balance -- 200 rec - --all-floors --exposure --metrics --power` |
| Economy sims | `npm run economy` · `gear-economy` · `skill-economy` · `account-economy` |
| Visual check | Playwright with `deviceScaleFactor: 2` on `/sprite-lab?hero=<id>&render=pixi` |

Every new mechanic or hero skill gets a spec.

## 14. Save data safety

- `SaveService` keeps one signal in `localStorage`. Version **6**, with `migrate()` (v4 → v6).
- Load-time repair: `prepare()`, `dropRemovedHeroes()`, `addMissingStarters()`.
- Removing or renaming a hero, item or equipment field needs a migration and a spec in `save.service.spec.ts`.
- The export format (`SaveEnvelope`, `ST1Z.`, `format 1`) stays backward compatible.

## 15. Refactoring

- Make minimal, scoped changes. No drive-by cleanup in feature commits.
- Shared shapes (`FxDef`, `AnimDef`, `SkillDefinition`, `StageDef`, `GameState`) change only with every consumer and its tests updated.
- Large refactors need user approval, plus their own commit or branch.

## 16. Content creation

Follow `docs/CONTENT_PIPELINE.md`. Inspect the registries first. Never infer "the next hero" from memory.

## 17. Balance data

- **Do not rebalance until the full roster is done** (user decision, 2026-10).
- Hero kit numbers are placeholders by design.
- `DEV_FLAGS.fullUltAtStart` is ON for testing. Turn it off before balancing or release.
- Stage tuning stays within `MONSTER_TUNING_LIMITS`.

## 18. Generated files — regenerate, never hand-edit

| Generated | Generator |
|---|---|
| `src/app/core/data/sprite-atlas.ts`, `public/sprites/opt/*` | `npm run sprites:optimize` |
| `public/sprites/hero-*.png`, `fx-*.png` | `tools/sprites/<id>*.py` (+ `normalize.py run tangxun --write` after `tangxun.py`) |
| `src/app/core/data/island/*.assets.ts`, `public/island/**` | `python3 tools/island/generate.py [theme]` |
| `src/app/core/data/sky-city.generated.ts`, `public/island/sky_city/` | `python3 tools/island/sky_city/build.py` |

Order: bake → normalize (when configured) → `sprites:optimize`.

## 19. Do-not-touch rules

- **`assets/heroes/Kael/**`:** canonical Kael source art, tracked since 2026-10-16 and read by `tools/sprites/kael.py`. Read only: never edit, rename, replace or delete.
- **`art/incoming/**`:** the user's original art. Not in git; read only.
- **`src/testing/legacy-roster.ts`:** test fixture only; app code must not import it.
- **Shared art library:** `tools/sprites/aurel_v2.py`, `aurel_{bash,rush,ult}_vfx.py` and `bailong.py` are imported by every hero script. Do not delete them.
- **Approved hero assets:** never substitute older versions automatically.

## 20. Known technical debt

See `docs/ARCHITECTURE.md` → *Known architectural issues*.
