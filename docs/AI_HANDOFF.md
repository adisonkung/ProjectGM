# Current Development State

**Git is authoritative.** This file is only a handoff note. Keep it short and update it at the end of every task (on the `wip/*` branch if the task is unfinished).

Last completed task:
Documentation-only hardening of the shared Claude / Codex rule set. Status: REVIEWED DRAFT, pending final user approval.

Last commit:
`docs: harden shared Claude Codex workflow`. This is the commit that adds this version of the note: `git log -1 -- docs/AI_HANDOFF.md`.

Last synchronized local commit:
- The commit that adds this note. Read it with `git log -1 --format=%H -- docs/AI_HANDOFF.md` in the local repo.
- Previous verified checkpoint: `57c08e7788fd32bf69c3f3773c9c610407763437`.

Last synchronized tree:
- The tree of that commit: `git log -1 --format=%T -- docs/AI_HANDOFF.md`.
- Previous verified tree: `e01b35fd02ff85100bd5628d0720e533fc52d359`.

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
- The last full run was Karma 611/611 with `tsc` app and spec clean, at the previous checkpoint.

Known issues:
- Shipped-roster balance is deferred until the roster is complete:
  - hero-sim F5 is 0 % because of clip lengths;
  - F7–F10 are ≈ 0 %.
- `DEV_FLAGS.fullUltAtStart` is ON.
- Tang Xun ult surround blades launch about 2.2 cells before the target, so they appear behind him when he stands 1 cell away. This predates the latest changes.

Next suggested task:
1. The user reviews and approves the rule documents (they are still a REVIEWED DRAFT).
2. Then continue the hero roster. A new hero is a long task, so start a `wip/` branch first and read `HEROES` before choosing the next hero.

Next agent must inspect:
- `AGENTS.md`
- `docs/PROJECT_RULES.md` §2, §4 and §5
- `git log -5`
