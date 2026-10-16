# Current Development State

**Git is authoritative.** This file is only a handoff note. Keep it short and update it at the end of every task (on the `wip/*` branch if the task is unfinished).

Never take the current commit or tree from this file. Query it on each side:
- `git rev-parse HEAD`
- `git rev-parse HEAD^{tree}`

This note never stores the hash of the commit that contains it (see `docs/PROJECT_RULES.md` §5).

Last completed task:
The user approved the shared Claude / Codex rule set. It is now CANONICAL (status headers only, documentation-only commit).

Last commit:
Query it with `git log -1`. Use `git log -1 -- docs/AI_HANDOFF.md` only to locate the last handoff-note commit. That commit is **not** automatically a confirmed sync point.

Last confirmed local commit:
`4c3d66e34ed9ffac9fb138a426dd3a340c60cf56` — "docs: sync metadata records only the last confirmed base". The local and cloud copies were both verified at this commit.

Last confirmed common tree:
`3723690b8615a3267a65032063c7bf8916ccc003`

Agent:
Claude (cloud copy → patch → `git am --3way` into `/Users/webuild/ProjectGM`)

Current branch:
`master` (ahead of `origin/master`; not pushed, per the user's rule)

Working tree expected:
Clean.

Active WIP branches:
None.

Tests:
- Docs-only change. No gameplay tests were run.
- The last full run was Karma 611/611 with `tsc` app and spec clean, on 2026-10-16 before the documentation commits.

Known issues:
- Shipped-roster balance is deferred until the roster is complete:
  - hero-sim F5 is 0 % (clip lengths);
  - F7–F10 are ≈ 0 %.
- `DEV_FLAGS.fullUltAtStart` is ON.
- Tang Xun ult surround blades launch about 2.2 cells before the target, so they appear behind him when he stands 1 cell away. This predates the latest changes.

Next suggested task:
1. Continue the hero roster. A new hero is a long task, so start a `wip/` branch first and read `HEROES` before choosing the next hero.

Next agent must inspect:
- `git rev-parse HEAD` and `git rev-parse HEAD^{tree}` on both sides;
- `git log 4c3d66e..master` (local), i.e. the commits after the confirmed base;
- `AGENTS.md`;
- `docs/PROJECT_RULES.md` §2, §4 and §5.
