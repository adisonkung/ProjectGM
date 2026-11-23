# Equal card-frame margins — Desktop follow-up, 2026-11-23

User reported that the previously thinned frames still sit closer to the left edge on some revealed cards and closer to the right on others. This correction continues the reviewed card-layout branch at aec3813.

## Root cause and change

The aura was .04 world units behind the card plane. Perspective projected its centre toward the middle of the screen; at the end of a ten-card row it differed from the face centre by4.14px at1280×720. The thin3D body at another depth also projected an unequal visible rim: the leftmost face had approximately−.04px on one side and1.19px on the other, reversed on the rightmost card.

Aura position now matches the card position exactly. Once a hero has opened and settled, its face sits at the slot plane and its painted border is the only visible frame; the extra3D body is hidden for opened cards. Waiting/turning cards retain the thin3D body. This removes depth parallax without cancelling the aura animation, touching portraits/names or changing the reveal/transaction timing.

## Actual game images

- [Before / after comparison](index.html)
- [Before: previous native game frame](before-summary.png)
- [After: first ten heroes](after-first-summary.png)
- [After: remaining five and repeated long names](after-second-summary.png)
- [After: single hero](after-single-summary.png)
- [Projected geometry before](before-report.json) · [after](after-report.json)

Images are unretouched native Angular/three.js frames at1280×720, not generated or composited. The before image is the prior real roster summary at aec3813; fresh baseline geometry reproduces its offsets in before-report.json. The new screenshots wait for the actual finite dialog-entry CSS animations to finish. Scene RAF is advanced in100ms steps and rendered at the final state; these are geometry/presentation checks, not native-speed/FPS claims.

## Validation

Baseline mode (`FRAME_CAPTURE=before`) must point `SUMMON_URL` to the preceding aec3813 source; the default mode checks the corrected source.

`tools/dev/summon-card-frame-browser.cjs` checks the single-card case and two deterministic real-service ten-pulls covering all15 shipped heroes. It measures actual projected face/frame/aura bounds for every slot: face and aura centres coincide, the face matches its slot centre, and painted left/right margins match within.001px geometric tolerance. Opened cards remain stationary for5seconds of scene time while aura time advances. Names still fit/align, Skip adds no transaction, and there are no page/local-resource/shader errors. External Google Fonts failures are recorded separately.

App/spec typechecks and Karma1026/1026 pass. Optimized compilation/budgets pass with the existing untracked no-inline-font Architect override because external Google Fonts returns403 in this environment; tracked build config is unchanged. No Mobile work, new master merge or deployment.
