# Project Rules — Summon Tower (ProjectGM)

> **Status: CANONICAL** · approved by the user on 2026-10-16 (after review). Change only with the user's approval.
> It applies to **every** agent: Claude, Codex and future agents.

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

Precedence, from highest to lowest (`AGENTS.md` and `CLAUDE.md` repeat this exact order):

1. **Explicit user instruction** in the current task.
2. **Canonical prescriptive docs**: `docs/COMBAT_RULES.md` → `docs/ANIMATION_PIPELINE.md` → `docs/CONTENT_PIPELINE.md` → this file.
3. **Current repository implementation.**
4. **Current tests.**
5. **`docs/ARCHITECTURE.md`**: descriptive documentation of the current implementation. It does not override code; when it disagrees, code wins and `ARCHITECTURE.md` is updated.
6. **`CLAUDE.md`**: Claude's implementation notebook (per-feature notes, history, operational context). It does not override the canonical docs or current code.
7. **`docs/AI_HANDOFF.md`**: convenience handoff note only. Never authoritative.
8. **Git history.**
9. **Previous conversation context.** Advisory only.
10. **Agent preference.**

Kinds of document:

| Kind | File(s) | Meaning |
|---|---|---|
| PRESCRIPTIVE | COMBAT_RULES, ANIMATION_PIPELINE, CONTENT_PIPELINE, PROJECT_RULES | How things **should** be. A deviation is reported, never silently "fixed" either way. |
| DESCRIPTIVE | ARCHITECTURE | How things **are**. Kept in sync with code. |
| IMPLEMENTATION NOTEBOOK | CLAUDE.md | Feature notes and history. Useful context, not a rulebook. |
| HANDOFF NOTE | AI_HANDOFF | Short state note between agents. |

Rules:

- **The repository is authoritative for what exists now:** files, registries, IDs, branch state, gameplay values. Never take these from conversation memory, `CLAUDE.md`, `AI_HANDOFF.md` or the claude.ai docs without checking the repository.
- **Prescriptive doc vs implementation:** when a canonical doc and the code disagree, report it as CURRENT IMPLEMENTATION / CANONICAL RULE / DIFFERENCE and ask. Never silently change gameplay, and never silently rewrite the rule to match the code.
- **Stale notes:** when `ARCHITECTURE.md`, `CLAUDE.md` or `AI_HANDOFF.md` disagree with the code, the code wins; update the stale note in the same task (or report it).
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

1. **Read the rules.** Read `AGENTS.md`, this file, and the doc for the system you will touch. Read `docs/AI_HANDOFF.md` as a hint (its *Next agent must inspect* list and last confirmed sync base); query the current state with `git rev-parse HEAD` / `HEAD^{tree}`. Git wins.
2. **Read other agents' work.** If any commit or `wip/*` branch was made since your last session by another agent, check the `Co-Authored-By` trailer or the handoff note, then read it (`git show <hash> --stat`, then the diff) **before** continuing.
3. **Check the registries.** Inspect the registries and tests of the system (`docs/CONTENT_PIPELINE.md`). For example, before a new hero, read `HEROES` in `core/data/heroes.ts`.
4. **Uncommitted changes you did not make:** never reset, clean, stash-drop or overwrite them. Work out whose they are; if unclear, report before touching overlapping files.
5. **"Continue from the previous agent"** means: find that work in Git (`master`, then `wip/*`). Never assume context.

## 5. Git workflow (decided 2026-10-16)

### Model: trunk-based, one active agent, a clean handoff commit

This model was chosen because Claude and Codex usually **take turns**, for example when one hits its usage limit.

- **Trunk.** `master` is the trunk and is always green: tests pass and every completed task is committed. The next agent always starts from `master`, so it automatically sees everything the previous agent finished.
- **Sequential handoff.** One agent at a time. The next agent starts from `master` (plus any `wip/*` branch it is asked to continue).
  - Example: Claude finishes hero #7 → merges to `master` → stops. Codex reconciles, sees #7 in `HEROES` and in the log, builds #8 → merges. Claude reconciles, sees #8, builds #9.
  - No long-lived branches means no merge drift. This is why it works better than parallel branches per hero when agents alternate.

### Task size classification (decides where the work happens)

An agent can hit a usage / token / session limit **without warning**, before it has time to move unfinished work to a branch. So the branch is chosen **before** implementation starts:

| Size | What | Where |
|---|---|---|
| **Small task** | Expected to finish safely in one session: a small scoped fix, a doc change, a test. | May work directly on `master`, but must end with a completed, green commit. |
| **Long task** | New hero (**always long by default**), large feature, multi-stage content, large sprite / VFX integration, system refactor, anything likely to span many files or steps. | **Create `wip/<agent>-<task>` before the first edit** (e.g. `wip/claude-hero-vaelric`, `wip/codex-hero-draeven`, `wip/claude-status-system`). |

While a long task is incomplete:

1. Commit safe checkpoints to the `wip/` branch (subject `wip: …`), at least after every finished step (e.g. per skill of a hero).
2. Keep `docs/AI_HANDOFF.md` on that branch up to date: done, left, how to test, files to inspect.
3. Never merge incomplete work to `master`.

When the long task is finished:

1. Run the required validation (§13) on the branch.
2. Make sure the branch is complete (registries, assets, docs, tests).
3. Merge into `master` — fast-forward when possible; otherwise rebase onto `master`, re-test, then fast-forward.
4. Delete the `wip/` branch after a successful merge (with the user's approval if it is not your own branch).

If an agent is cut off on `master` during a small task anyway, the next agent treats the uncommitted changes under §4.4 (inspect, never discard).
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

Claude works in a cloud copy. `git am` re-commits every patch, so **cloud and local commit hashes never have to match. Tree content must match** (`git rev-parse HEAD^{tree}`) before Claude starts implementation work.

**Synchronization base (confirmed sync point).** `docs/AI_HANDOFF.md` may store only the **last confirmed** synchronization base:

- *Last confirmed local commit* — a **local** commit hash;
- *Last confirmed common tree* — the tree hash that the local copy and the cloud copy were **both verified** to have at that commit.

Rules:

- **No self-reference.** `AI_HANDOFF.md` never stores the hash of the commit or tree that contains it: editing the note changes the tree, so its "own" hash cannot be written into it. It records an **earlier**, already-confirmed base.
- **Current state is always queried, never read from the note:** `git rev-parse HEAD` and `git rev-parse HEAD^{tree}`, on each side.
- **A sync point becomes confirmed only after both copies verify identical tree content** (`git rev-parse HEAD^{tree}` equal locally and in the cloud). A commit that has not been verified on both sides is not a sync point, even if it was delivered.
- `git log -1 -- docs/AI_HANDOFF.md` may be used to **locate the last handoff-note commit**, but it is **not** automatically the last confirmed sync point.
- When a later session verifies a newer commit on both sides, it may record that commit / tree as the new confirmed base (in a later commit — which, again, is not itself the base).

1. **Start of session (local → Claude):**
   1. Query the current state on both sides: `git rev-parse HEAD` and `git rev-parse HEAD^{tree}`. If the trees already match, there is nothing to sync.
   2. Otherwise read the *last confirmed local commit* `<BASE>` from `AI_HANDOFF.md`. Check that the cloud copy has a commit with the same **tree** as `<BASE>` (`git log --format='%H %T'`). On the local machine run `git log --oneline <BASE>..master` to see newer commits (e.g. from Codex).
   3. `git format-patch --binary <BASE>..master -o "Claude outputs/sync"` (local), starting from the cloud commit whose tree equals the confirmed common tree.
   4. Apply them in the cloud copy with `git am --3way`.
   5. Compare `git rev-parse HEAD^{tree}` on both sides. **Do not start until they match** — that match is now a confirmed sync point.
   6. Check `wip/*` branches the same way if you are continuing one.
   - **If the confirmed base is unknown or inconsistent** (missing, or no cloud commit has its tree): do not guess a base. Inspect the history on both sides (`git log --format='%h %T %s'`), find the last commit whose **tree** exists on both sides, and report the ambiguity to the user before applying anything.
2. **Delivery (Claude → local):**
   1. Run `git format-patch --binary` and write the patch to `Claude outputs/<task>/` (gitignored).
   2. Apply it locally with `git am --3way`.
   3. Verify that the tree hash equals the cloud tree hash (`git rev-parse HEAD^{tree}` on both sides). The delivered commit is now a confirmed sync point.
   4. Record it as the confirmed base in `docs/AI_HANDOFF.md` **in a later commit** (never inside the delivered commit itself — see *No self-reference*).
   5. If `git am` fails: `git am --abort`, then report. Never force it.
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

Follow `docs/CONTENT_PIPELINE.md`. Inspect the registries first (`HEROES` for heroes). Never infer "the next hero" from memory. A new hero is a **long task** (§5).

**Hybrid role labels** ("Fighter / Assassin", "Tank / Support", "Mage / Controller") are design labels, **not** new gameplay classes. Use an existing primary `HeroClass` and express the hybrid through the kit, unless the user explicitly approves a new class — see `docs/CONTENT_PIPELINE.md` → *Hybrid role labels*.

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
