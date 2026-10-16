# Current Development State

> A short note only. **Git wins** whenever this file disagrees with the repository. Update it at the end of every task (on the `wip/*` branch if the task is unfinished).

Last completed task:
Multi-agent workflow made canonical:
- `AGENTS.md` and `docs/*`;
- `CLAUDE.md` protocol header and stale-note cleanup;
- revive default HP 40 %;
- unused content removed;
- Kael source art tracked.

Last commit:
`docs: canonical multi-agent workflow …` on `master` (see `git log -5`).

Agent:
Claude (cloud copy → patch → `git am` into `/Users/webuild/ProjectGM`)

Current branch:
`master` (ahead of `origin/master`, not pushed by user rule). No `wip/*` or `feature/*` branches.

Tests:
- Karma all green.
- `tsc` app and spec: clean.

Known issues:
- Shipped-roster balance:
  - hero-sim F5 is 0 % (clip lengths) and F7–F10 are ≈ 0 %.
  - Deferred by the user until the roster is complete.
- `DEV_FLAGS.fullUltAtStart` is ON.
- Tang Xun ult surround blades launch about 2.2 cells before the target. When he stands 1 cell away, they appear behind him. This predates the latest change.

Next suggested task:
Continue the hero remodel roster. Read `HEROES` (`src/app/core/data/heroes.ts`) for the current list before choosing the next hero.
