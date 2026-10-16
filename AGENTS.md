# AGENTS.md — rules for every AI coding agent (Codex, Claude, others)

> Canonical since 2026-10-16. Codex reads this file automatically; Claude reads `CLAUDE.md`. **Both files point to the same rules in `docs/`**, so every agent follows one rulebook.

This repository is changed by several AI agents taking turns. **Git and the current files are the source of truth.** Chat memory, previous sessions and `docs/AI_HANDOFF.md` are hints only.

## Read first

1. `docs/PROJECT_RULES.md`: source of truth, Git workflow (§5), **naming (§8)**, tests (§13), do-not-touch (§19).
2. The doc for the system you will touch:
   - `docs/COMBAT_RULES.md`
   - `docs/ANIMATION_PIPELINE.md`
   - `docs/CONTENT_PIPELINE.md`
   - `docs/ARCHITECTURE.md`
3. `CLAUDE.md`: detailed per-feature notes, mostly in Thai. Read the sections for the area you touch. If they disagree with the code, the code wins; report the difference.

## Session start (every session)

Run **SESSION RECONCILIATION** (`docs/PROJECT_RULES.md` §4):

- branch;
- status including untracked files;
- the last 15 commits with authors;
- `wip/*` and `feature/*` branches;
- uncommitted diff;
- recently changed files.

If another agent committed or left a `wip/*` branch since you last worked, read it before anything else. Before adding any hero, enemy, skill, status, stage or item, read its registry (`docs/CONTENT_PIPELINE.md`). **Never guess the next entity.** Example: if Claude made hero #7 and Codex made #8, whoever comes next finds both in `HEROES` and builds #9.

## Roles

| Agent | Normal role |
|---|---|
| Claude | Primary implementation agent: features, systems, content, scoped refactors. Works in a cloud copy and delivers patches (PROJECT_RULES §5). |
| Codex | Secondary implementer, reviewer, debugger, test author, investigator, regression checker. May implement full features when Claude is unavailable. Works directly in the local repo. |

Work produced by any agent is first-class. Never rewrite it for style or preference.

## Git in one paragraph

- `master` is the trunk and is always green. Work in small **finished** commits on `master`, one agent at a time.
- If your session may end before the task is done, commit what exists to `wip/<agent>-<task>` and describe the state in `docs/AI_HANDOFF.md`. **Never leave half-done work on `master`.**
- Parallel work (only when the user asks) goes on `feature/<task>` branches with disjoint files. Two heroes are not disjoint.
- No push unless the user asks.
- No `reset --hard`, `clean`, force checkout, `stash drop`, `branch -D` or force push without explicit user approval.

## Naming (summary of PROJECT_RULES §8 — follow it exactly)

- **IDs:**
  - hero ID: short lowercase, no separators (`kael`, `tangxun`);
  - monster, skill, status and item IDs: `snake_case`;
  - monster variants: `<new>@<base>`;
  - events: `UPPER_SNAKE`;
  - never numeric IDs.
- **Files:**
  - sprite sheet: `public/sprites/hero-<id>.png`;
  - FX strips: `fx-<id>-<s1|s2|ult>-<part>.png`;
  - `public/portraits/<id>.webp`, `public/skills/<id>-{s1,s2,ult}.webp`, `public/banners/<id>.webp`;
  - scripts: `tools/sprites/<id>.py` and `<id>_{s1,s2,ult}.py`.
- **FX keys:** `<prefix>-<s1|s2|ult>-<part>`. Each hero has its own two-letter prefix (`yz my tx lx gr kl`; Bai Long uses `bailong-` / `bl3-`). Pick an unused one for a new hero.
- **Specs:** `battle/engine/<identity>.spec.ts` per hero kit, plus roster and clip checks in `core/data/roster-remodel.spec.ts`.

## Hard rules

- **Hotspots:** one agent at a time on `core/data/sprites.ts`, `hero-skills.ts`, `heroes.ts`, `battle/engine/battle-engine.ts`, `pages/battle/battle.component.ts` and `CLAUDE.md`.
- **Read-only:** never edit `assets/heroes/Kael/**` (tracked, read-only) or `art/incoming/**`.
- **Generated files:** never hand-edit `sprite-atlas.ts`, `public/sprites/opt/*`, `island/*.assets.ts` or `sky-city.generated.ts`. Run their generators.
- **No rebalancing** until the user says the roster is complete.
- **Conflicting approaches:** write a `CONFLICT DETECTED` report and ask before choosing.

## Finish (every task)

1. Read the diff and remove debug code and stray files.
2. Typecheck:
   - `npx tsc -p tsconfig.app.json --noEmit`
   - `npx tsc -p tsconfig.spec.json --noEmit`
3. Tests: `npm test` (headless: `--karma-config=karma.ci.cjs`), plus the relevant sims if combat changed.
4. Run `npm run sprites:optimize` if `public/sprites/*.png` changed.
5. Update `CLAUDE.md` (the feature notes; Codex too) and `docs/AI_HANDOFF.md`.
6. Commit with `git add <paths>`, a subject in the form `type(scope): summary`, and your agent trailer (`Co-Authored-By: Codex …` / `Claude …`). Then stop.
