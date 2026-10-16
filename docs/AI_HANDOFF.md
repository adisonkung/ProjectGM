# Current Development State

**Git is authoritative.** This file is only a handoff note. Keep it short and update it at the end of every task (on the `wip/*` branch if the task is unfinished).

Never take the current commit or tree from this file. Query it on each side:
- `git rev-parse HEAD`
- `git rev-parse HEAD^{tree}`

This note never stores the hash of the commit that contains it (see `docs/PROJECT_RULES.md` §5).

Last completed task:
Rule update (user, 2026-10-16): GitHub `origin/master` is the shared remote handoff point. Agents work on task branches, push only the task branch, and `master` changes only by merge after review. This change is documentation only, on branch `feature/github-remote-handoff`.

Last commit:
Query it with `git log -1`. Use `git log -1 -- docs/AI_HANDOFF.md` only to locate the last handoff-note commit. That commit is **not** automatically a confirmed sync point.

Last confirmed local commit:
`3a61ffba88f1004661f73e06d271adb6569d2396` (local `master`) — "docs: rule set approved by the user (canonical)". The local and cloud copies were both verified at this commit.

Last confirmed common tree:
`fc3456568a99d3b449a21fce552f4b3b0800b83c`

Agent:
Claude (cloud copy → patch → `git am --3way` into `/Users/webuild/ProjectGM`)

Current branch:
`feature/github-remote-handoff` (branched from local `master` 3a61ffb).
- **Remote is stale:** GitHub `origin/master` is `3c23b91`, 35 commits behind local `master`. Until the user pushes local `master`, the latest reviewed work exists only in the local clone.

Working tree expected:
Clean.

Active WIP branches:
- `feature/github-remote-handoff`: this rule update, waiting for the user's review and merge.

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
1. The user pushes local `master` to `origin` and reviews / merges `feature/github-remote-handoff`.
2. Continue the hero roster. A new hero is a long task, so start a `wip/` branch first and read `HEROES` before choosing the next hero.

Next agent must inspect:
- `git rev-parse HEAD` and `git rev-parse HEAD^{tree}` on both sides;
- `git fetch origin`, then `git rev-list --left-right --count master...origin/master` (is the remote up to date?);
- `git log 3a61ffb..master` (local), i.e. the commits after the confirmed base;
- `AGENTS.md`;
- `docs/PROJECT_RULES.md` §2, §4 and §5.
