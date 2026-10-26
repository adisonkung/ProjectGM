# Summon reference review — 24 October 2026

User asked to continue after the final Dungeons antique-gold review. Work branch `fix/codex-summon-review`, source base `7e7799a`. Summon is pending visual review; no deployment or production branch update.

Read `docs/design/eldervane-ui/README.md` and inspected sheets 09 (Summon Gate), 10 (summon flow), 17 (information and reveal) before implementation. Composition follows the references using the original Bai Long banner and existing Sanctum background: a single left information panel with five real preview portraits, compact pity and pull actions on the right. Mobile scrolls the gate independently beneath the approved shared navigation.

Large panels and buttons use the existing responsive TowerOrnament SVG with the approved antique-gold palette, dark grooves, fine engraving and crimson lacquer. Small portraits retain CitadelFrame. `_antique-ornament.scss` shares presentation variables between the gate and reveal scene; Tower and Dungeons keep their existing rendering. The Sanctum has an optional floating-card input (default true) so the main page can disable decorative cards while the cinematic retains them.

Pool, rates, Memory, confirmation, card reveal, spotlight and results have matching typography and borders. Information dialogs keep their close control outside the scrolling body. Results use five columns on desktop and two on mobile, with a centered single-result state. Original hero images, card art, reveal timers, transaction code, services and save schema are unchanged.

## Real game information

- Existing `freeSummons` development flag remains enabled. Visible nominal prices are 100/900 gems with an explicit temporary free-testing label; screenshots show actual behavior, including free pulls with zero gems.
- Rates remain 60% / 32% / 8%, pity 50, ten-pull minimum rolled tier 2★. Current registry has twelve 3★ heroes. The original fallback disclosure is preserved: when a rolled tier has no heroes, selection falls back to the combined pool; pity tracks the rolled tier. No invented rate-up or target guarantee.
- Existing duplicates, Hero Memory, Universal Memory and star development values remain unchanged. No material art was generated; the deferred backlog remains `docs/art/material-icons/README.md`.

## Validation

App and spec TypeScript checks, production build and all 812 Karma tests pass. Existing Angular template/bundle warnings remain; no budget limits were changed. Browser review checks widths 320/390/768/1024/1586, real information dialogs, confirmation cancellation/Escape without save mutation, actual committed free pulls, original card/reveal/skip flow, ten and single results, and reopening results without rerolling. Disposable starter saves only. Screenshots are actual browser captures, desktop and mobile. User visual approval is still pending.

## Published review

https://github.com/adisonkung/ProjectGM/blob/025b6f5d91121d82e2e6d8ad6752113ab76745d6/docs/review-images/2026-10-24-summon/README.md

25 review artifacts: desktop/mobile captures, motion snapshots, source patch and validation report. Unattached docs-only snapshot, no deployment.

## Revision — campaign banner and cinematic effects

User requested deeper premium gold, a left campaign banner with details on click, future UR/limited/new-hero presentation and a grander opening. Branch `wip/codex-summon-cinematic` from `7a96b53`; this replaces the earlier pending Summon review, not a visual approval or deployment.

- `SummonCampaignComponent` takes typed presentation metadata (`standard | limited | ur | new`) and emits a details action. Only the real standard campaign is configured. No fake limited countdown, UR hero, rate-up, new rarity or unavailable selectable pool was added. Future campaigns need real service/rate/pool support before activation.
- Main left panel is now an illustrated, engraved campaign banner. Clicking opens a dedicated details state with original preview heroes and routes into existing rates/pool/Memory dialogs. Utility shortcuts remain reachable. Banner details explicitly say Bai Long is illustration, with no increased chance.
- Scoped `cinematic-palette` deepens the gold alloy, black grooves and thin highlights. CitadelFrame gains optional inherited stop colors with exactly the old fallback values; only Summon sets them. Approved navigation, Tower and Dungeons keep their appearance.
- `SummonVfxComponent` draws procedural 2D orbital seals, rune diamonds, comet ribbons, particles, a narrow beam and one expanding burst/shockwave. Main ambient, charge, burst, cards and spotlight have distinct compositions. CSS adds slow hero/foil motion, cinematic framing, approach, card float/flight and hero entrance. This is runtime Canvas/CSS VFX, not a new prerendered 3D CG movie or regenerated hero art.
- Actual 3★ intro now lasts 5.2 seconds (2.6 charge + 2.6 burst); ordinary intro remains 2.05 seconds. Skip/Escape, reduced-motion instant cards, idempotent completion and committed transaction boundaries stay intact. Reveal timers never spend or reroll.
- New VFX caps painting at 30fps/DPR1.5 and 36 mobile/70 desktop particles, runs outside Angular, pauses for hidden/out-of-view/covered states, renders a static reduced-motion composition, and disconnects observers/listeners/RAF on destroy. Lifecycle tests cover one loop, pause/restart, reduced motion and cleanup. Existing timeline tests updated for the new presentation timing.

Updated actual desktop/mobile screenshots and a browser-recorded video accompany this pass. Still pending user visual review. Free test mode, 100/900 nominal prices, 60/32/8% rates, 50 pity, fallback, hero roster, Memory and all saves/services remain unchanged. Material icon generation remains deferred. No deployment.

Revision review: https://github.com/adisonkung/ProjectGM/blob/a4272685c224557ac78e4a2cdb0491656bd95ea5/docs/review-images/2026-10-24-summon-cinematic/README.md

31 review artifacts, actual screenshots and recorded MP4/GIF. Source build and app/spec types pass, 814 Karma tests pass; Tower regression 0 changed pixels. Source implementation checkpoint `974790f`; review remains pending, no deployment.

## Revision — light-bound flight and regenerated rarity backs (25 October, Asia/Bangkok)

User said the flying backs looked rigid/pasted into the scene, explicitly authorized regenerated card art and natural physics-like flight, then requested ordinary backs for1★/2★. Branch `fix/codex-summon-card-flight` from `e376f40`; previous Summon snapshot remains history, not approval.

- Generated three alpha-cutout card backs: matte steel/silver1★, understated bronze2★, antique-gold/ice-blue celestial3★. See `docs/art/summon-cards/README.md` +manifest. No hero/material art generated. Source old JPGs remain unchanged. A single presentation helper chooses the same asset for flight and sealed cards, preventing an art swap at the transition. Current live roster still only3★: ordinary card art does not add1★/2★ hero templates or alter fallback/rates.
- Removed the four persistent decorative Sanctum cards from the cinematic. One `SummonFlightComponent` now owns exactly the committed result count (1or10), with clean alpha silhouettes rather than black JPEG rectangles.
- Gather begins at the altar, follows a sampled cubic3D path and quintic settling into a depth-dependent suspended ring. Release begins at the exact final gathered pose, accelerates along a curved trajectory, banks/rotates with travel, and moves through perspective toward camera. Directional light wakes use the path tangent; masked foil/rim light and floor glow connect the texture to the scene. This is physics-inspired2.5D choreography, not a new rigid-body physics engine or prerendered3D movie.
- Uses native Web Animations with64 sampled segments, linear interpolation and no per-frame Angular/JS loop. Animation handles cancel on release and destruction; reduced motion does not start flight and original Scene still enters cards immediately. Shadows stay static to avoid repainting multiple blurred card layers during motion; foil handles the moving light.
- Existing5.2s rare/2.05s ordinary timeline, confirmation, committed results, skip/Escape, rates, pity, costs/free flag and save schema are unchanged. No deployment.

Validation: app/spec TypeScript and production build pass;816 Karma tests pass, including exact gather/release pose continuity and animation cancellation/reduced motion. Actual browser checks cover desktop1586×1050/mobile390×844 ten-card count, one continuous component across phases, no legacy floating cards, native animation cleanup on end, unchanged committed save through reveal/skip/results, no horizontal overflow and reduced-motion single pull. Focused clips are real browser recordings, not generated video. New1★/2★ images are explicitly art previews, not screenshots of nonexistent roster pulls.

Flight/card-art review: https://github.com/adisonkung/ProjectGM/blob/278e00a024e4725e89b2f8d455b2870027fd674a/docs/review-images/2026-10-25-summon-flight/README.md

16 artifacts, focused normal-speed desktop/mobile MP4 + GIF, video frames, three card assets, art manifest, validation and binary implementation patch. Source checkpoint `dfe07b2`. Pending user visual review; no deployment.

## Revision — flexible surface and continuous flutter (25 October 2026)

User still found the cards rigid and motionless. Branch `fix/codex-summon-card-flex` from `8936a18`. The existing three rarity textures and trajectories are retained; no new generation or gameplay changes.

`SummonCardSurfaceComponent` replaces the flat card body with10 connected textured bands. Nested hinges share their edge endpoints and carry the same UV texture; a travelling bend/twist wave accumulates toward the free lower edge, with a separate continuous3D sway. Each face has masked light variation. This deforms the card silhouette/texture, rather than only moving the outer card rectangle. Surface loops survive the gather→release transition without resetting, so the anticipation/hover interval is no longer motionless.

Wind uses native Web Animations (48 sampled segments; one rig,10 hinges,10 light handles per card) outside Angular. All handles receive a common explicit document-timeline origin for immediate synchronized startup; per-card seed and duration vary the motion. Loops cancel on texture replacement, reduced-motion change and destruction. CSS is prefixed to `app-summon-card-surface` with no Shadow DOM or duplicated global stylesheet per card; parent filter was removed to preserve the nested3D surface. Reduced motion retains static complete artwork and the original Scene still skips straight to cards.

The previous flight pose, wake, exact gather/release continuity, reveal timing, costs/free flag, rates, roster, pity, Memory and committed save are unchanged. Old art files and new1★/2★/3★ backs remain intact. This is a hinged2.5D deformation model, not a rigid-body/cloth physics engine. No deployment.

Validation: app/spec TypeScript, production build and818 tests pass. Actual browser verifies changing hinge matrices over time, delayed tip posture, retained component/animation handles across release, animation cancellation after reveal, and unchanged save after commit, reveal and skip. Recordings cover an actual single pull, ten pull and mobile ten pull with genuine starter data/free flag. Close-up review video is a crop of the actual recording, at normal speed.

Flexible-surface review: https://github.com/adisonkung/ProjectGM/blob/b60a5635e28301ebd1c940769c538882e30368ef/docs/review-images/2026-10-25-summon-flex/README.md

10 artifacts: normal-speed close-up MP4/GIF, single/ten/mobile recordings, two actual frames, validation and implementation patch. Source checkpoint `11161fc`; pending visual review, no deployment.

## User review — accepted for now

User said “หน้ากาชาเอาแบบนี้ไปก่อน เดี๋ยวมีไอเดียค่อยมาแก้ เอาหน้าต่อไปมาเลย”. Latest flexible-surface pass is accepted for now; continue to Hero Detail panels. This is not deployment authorization.
