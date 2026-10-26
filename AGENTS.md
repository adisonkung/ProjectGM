# AGENTS.md — rules for every AI coding agent (Codex, Claude, others)

> **Status: CANONICAL** · approved by the user on 2026-10-16 (after review). Change only with the user's approval.
> Codex reads this file automatically; Claude reads `CLAUDE.md`. **Both files point to the same rules in `docs/`**, so every agent follows one rulebook.

This repository is changed by several AI agents taking turns. **Git and the current files are authoritative for what exists now.** Chat memory, previous sessions and `docs/AI_HANDOFF.md` are hints only.

## Source of truth (same order as `docs/PROJECT_RULES.md` §2)

1. Explicit user instruction in the current task.
2. Canonical **prescriptive** docs: `docs/COMBAT_RULES.md`, `docs/ANIMATION_PIPELINE.md`, `docs/CONTENT_PIPELINE.md`, `docs/PROJECT_RULES.md`.
3. Current repository implementation.
4. Current tests.
5. `docs/ARCHITECTURE.md` — **descriptive**; code wins, update it when stale.
6. `CLAUDE.md` — Claude's **implementation notebook**; never overrides the docs above or the code.
7. `docs/AI_HANDOFF.md` — **handoff note**; never authoritative.
8. Git history. 9. Previous conversation context. 10. Agent preference.

A prescriptive doc that disagrees with the code is reported (CURRENT / CANONICAL / DIFFERENCE), not silently "fixed".

## Read first

1. `docs/PROJECT_RULES.md`: source of truth, Git workflow (§5), **naming (§8)**, tests (§13), do-not-touch (§19).
2. The doc for the system you will touch:
   - `docs/COMBAT_RULES.md`
   - `docs/ANIMATION_PIPELINE.md`
   - `docs/CONTENT_PIPELINE.md`
   - `docs/ARCHITECTURE.md`
3. `CLAUDE.md`: Claude's implementation notebook — detailed per-feature notes, mostly in Thai. Read the sections for the area you touch as context. It is not a rulebook: if it disagrees with the canonical docs or the code, follow the order above and report / update the stale note.

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
| Claude | Primary implementation agent: features, systems, content, scoped refactors. Works in a cloud copy; pushes its task branch to GitHub `origin` (fallback: patches onto the same-named local branch) (PROJECT_RULES §5). |
| Codex | Secondary implementer, reviewer, debugger, test author, investigator, regression checker. May implement full features when Claude is unavailable. Works in the local clone on task branches and pushes them to `origin`. |

Work produced by any agent is first-class. Never rewrite it for style or preference.

## Git in one paragraph

- **GitHub `origin/master` is the shared remote handoff point**; the user's local clone `/Users/webuild/ProjectGM` is the working canonical clone.
- **Before work:** `git fetch origin`, then branch from the latest `origin/master`. If local `master` is ahead of `origin/master`, report it and ask — do not guess.
- **Every task gets its own branch, created before the first edit.** Never commit to or push `master`; never force-push or overwrite `master`.
- **Small task** (fits safely in one session): `fix/<area>-<topic>` or `feature/<task>`, one finished green commit.
- **Long task** (a new hero is always long; also large features, multi-step content, big sprite / VFX work, refactors): `wip/<agent>-<task>` (e.g. `wip/codex-hero-draeven`), commit and push checkpoints there, keep `docs/AI_HANDOFF.md` current on that branch. A usage limit can hit without warning — that is why the branch comes first.
- **After work:** push **only the task branch** (`git push -u origin <branch>`) and report it. The user reviews; the branch is merged into `master` only after review.
- Parallel work (only when the user asks) goes on `feature/<task>` branches with disjoint files. Two heroes are not disjoint.
- Push only your own task branch. No `reset --hard`, `clean`, force checkout, `stash drop`, `branch -D`, remote-branch deletion or force push without explicit user approval.

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
- **Hybrid role labels** ("Fighter / Assassin") never create a new gameplay class on their own. Use an existing primary class; ask before adding one (`docs/CONTENT_PIPELINE.md`).
- **No rebalancing** until the user says the roster is complete.
- **Conflicting approaches:** write a `CONFLICT DETECTED` report and ask before choosing.

## Finish (every task)

1. Read the diff and remove debug code and stray files.
2. Typecheck:
   - `npx tsc -p tsconfig.app.json --noEmit`
   - `npx tsc -p tsconfig.spec.json --noEmit`
3. Tests: `npm test` (headless: `--karma-config=karma.ci.cjs`), plus the relevant sims if combat changed.
4. Run `npm run sprites:optimize` if `public/sprites/*.png` changed.
5. Update `CLAUDE.md` (the feature notes; Codex too) and `docs/AI_HANDOFF.md`. The handoff note records only the **last confirmed** sync base (a commit/tree verified identical on both sides) — never the hash of the commit that contains the note. Current state is always `git rev-parse HEAD` / `HEAD^{tree}` (PROJECT_RULES §5).
6. Commit with `git add <paths>`, a subject in the form `type(scope): summary`, and your agent trailer (`Co-Authored-By: Codex …` / `Claude …`). Then stop.

## UI visual matching — user-added rule (2026-10-25)

Every UI change must follow [docs/UI_REFERENCE_RULES.md](docs/UI_REFERENCE_RULES.md) and PROJECT_RULES §21: match the selected reference precisely, inspect real screenshots, and send both the actual game image and its reference for direct comparison. Do not claim visual completion based on passing tests. This addition is explicitly authorized by the user.
