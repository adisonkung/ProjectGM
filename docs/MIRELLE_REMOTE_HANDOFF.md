# Mirelle remote handoff — 2026-10-17

The user explicitly authorized publishing `wip/codex-hero-mirelle` to `adisonkung/ProjectGM`. The shell GitHub identity `webuilddeveloper` returned HTTP 403. Publication therefore uses the connected repository owner `adisonkung` through the GitHub connector.

The connector does not expose original author/date fields when creating commits, so commit SHAs differ. The original messages, checkpoint order and file contents are retained. Every checkpoint below was checked against its original Git tree SHA; all ten matched exactly. The final implementation tree is `e2b6f64e574ca5559d13e5b6d94654e73f300768`.

| Checkpoint | Original local commit | GitHub commit | Identical tree SHA |
|---|---|---|---|
| 1 | `f31835d836a249729328c4c3d50ed049b85dfba4` | `d464ab8b04bb3185596c294f595e3eb35ab35049` | `dc62e722d1bb27fe5d6342e2b259dbc9cf8eaf43` |
| 2 | `f167bf99b543d09c872efff357d220026f81feaa` | `5691ac3cb5ae7d6355f22f893b74b50f6a9b5789` | `9ee7bfe5572a88b1d544ee96068d308656579ce9` |
| 3 | `9c3bbb81de7277eab6eb091b8a84a76ab0e44549` | `82b4cf48ed2fd53f40372392e4cd2898af63600d` | `9a980bb96c9bb6d7366650e2cdc4d5024c8c2646` |
| 4 | `480f4e64f42f7d2993394cc7e1bacc4a7080ce10` | `a4b1072dcfd9c82ae8764029fa635e193ad86fb2` | `0e49b1a1a6093de1bcd36d7dba41161f978ee2ec` |
| 5 | `d339adc2d748275b9718af80cf28235383dbe5e4` | `3cef86f8c7237da1fae0c46576ffd015c1ffe4a2` | `8ad8ce92233d9c2986997c7ecb3791fb978e335d` |
| 6 | `1a2c86a9d6d2191adb2f55846992a0c122c5127b` | `b284b47c3dff413fc1facfb90fe00c1d6ac793da` | `80866c46712db14b43b5d915c992c378133f2464` |
| 7 | `7c159754634de9846d9b4a8708b2ae6464aab82f` | `8c7109427dcfe7552638c8ebfda4fe19f68e2671` | `3005961806db942f51fe1fa8408cc4ac9cac4666` |
| 8 | `1d28ea1397bc74e0a4f1227fb4fd5bd144ae73db` | `1c2d865a8d1902d19693c933ac85bfe79bdce466` | `7288aad355c3c69c92b8108b85574772be13b25e` |
| 9 | `819bf8efe7ac66cb76b9c886b6116b4a4edde36d` | `c68d8e3c7fd95affa63da602542bf4223fa26be7` | `fe0e33842497f34a30a0b1233eb322243603defa` |
| 10 | `605d02fc8fb15c0eb35de85cac569a7f7e2e61a8` | `102b1e5248fe4e5807e2822dce825e8e59963aae` | `e2b6f64e574ca5559d13e5b6d94654e73f300768` |

A documentation-only handoff commit follows these ten checkpoints. Query the current branch tip using Git rather than treating a containing commit as a synchronization base. Original local history is preserved on `backup/codex-mirelle-local-history` in the Cloud workspace; the task branch tracks its published remote counterpart.

Base: `e29bc20f4b5b2a4d7e1b475445dc587841000f78`. At initial publication only the task branch was published, and master was unchanged. The user subsequently authorized merging Mirelle into master on 2026-10-17; fresh Git/connector comparison confirmed that master is an ancestor of the reviewed branch, allowing a fast-forward with all checkpoints retained. No force update or branch deletion is authorized. The canonical local clone's previously confirmed synchronization base in `AI_HANDOFF.md` remains unchanged because that clone has not been re-verified in this session.

Validation already completed on the identical implementation tree: app/spec/sim typechecks, 652/652 Karma tests, production build and Mirelle-team simulation. This publication step changes only handoff documentation. Approved originals under ignored `art/incoming/**` and temporary previews are not exported.

[Published task branch](https://github.com/adisonkung/ProjectGM/tree/wip/codex-hero-mirelle). The user has now approved merging this delivery into master. Query remote Git refs to verify completion; do not restart hero production or revert finalized timelines based on historical provisional notes.
