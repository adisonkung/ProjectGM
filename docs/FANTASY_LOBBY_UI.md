# Fantasy lobby — Home chrome

2026-10-19 (Asia/Bangkok). User supplied the inline reference **Dawnmere Tower Fantasy Lobby.png** and requested keeping the existing floating island while redesigning the surrounding menus. This is the approved direction for implementation; the earlier three discarded UI studies are not integrated.

## Baseline and scope

Fresh `origin/master` is `455de5b`, the user-authorized Elira merge. Clean detached checkout; no intervening changes or local master. `feature/codex-fantasy-lobby` starts at that master. Publish this task branch for visual review; this request does not authorize merging the new lobby. No user canonical-local sync is newly verified.

- Home has six reference-inspired navigation tiles: Home, heroes, formation, equipment, summon and adventure. `LOBBY_NAV` points to existing `/home`, `/heroes`, `/team`, `/armory`, `/gacha`, `/tower` routes. Both new shortcuts are already available at F0; a route-transition regression checks that the compact four-item `MAIN_NAV` returns on other screens and that no floor-locked feature is exposed.
- Separate gold-rimmed gem/gold counters and account access retain real balances and behavior. The game keeps its Summon Tower identity. No new currencies or payment controls.
- Left kingdom panel shows the actual island name/stage, cleared floors, next building unlock, party count and existing upgrade readiness. Its actions open the original building sheet, team or hero pages; it is not a new quest/reward system.
- Bottom party has five slots in saved team order. Each occupied slot displays the supplied portrait, class icon, actual level and name, and opens the existing hero quick sheet. Power uses `RosterService.power`, including normal progression/equipment. Empty slots lead to formation. The next-adventure preview uses the actual next `STAGES` background/name. No special-event banner or invented rewards.
- The large Enter Tower action retains the existing `/battle?floor=<next>&mode=tower` behavior. It steps aside during progression event playback. Building/hero/theme sheets are exclusive and remain above the decorative chrome.
- `public/ui/lobby-frame.svg` is a small original decorative vector used by navigation/panels/CTA. No supplied hero/island pixels are replaced, edited or regenerated. The existing City canvas/roaming/pan/click logic and classic themes remain unchanged; the quality button moves to the right to avoid the new party strip.

## Responsive behavior

- Desktop: separate wordmark/navigation/resources; left kingdom panel; party, destination and large CTA along the bottom.
- Tablet: hide the secondary destination preview; retain party and CTA.
- Portrait phone: six-item bottom dock; progress details expand/collapse; compact party and CTA above the dock. No backdrop blur over the animated map.
- Short landscape: compress desktop chrome; on narrow phones hide the party strip to preserve the map and primary action. Forming a team remains available in navigation.
- Existing fullscreen/theme/quality controls remain usable. No save schema, economic values, unlock conditions or combat changes.

## Validation and review artifacts

- App/spec TypeScript checks and **712/712 Karma** passed. The additional regression verifies the Home/ordinary-page navigation transition and F0 shortcut eligibility.
- Production build passed. Stylesheet budget warnings include the new lobby chrome; the initial bundle is near its 600 kB warning threshold. Existing hero/battle stylesheet and Pixi CommonJS warnings also remain. Budgets were not raised.
- Native Chromium DPR2 review checks 1440×1000, 1920×1080, 1024×768, 768×1024, 390×844, 320×640, 844×390 and 667×375. Chrome controls stay in the viewport with no horizontal overflow.
- Interaction review covers mobile disclosure, party hero sheet, native map building hit, classic/City theme switching, all six navigation destinations and tower CTA. A separate disposable save with a two-hero party (Elira first), three empty slots, changed balances and seven cleared floors checks that the UI follows real data and advances the CTA to floor eight.
- Review artifacts: `/workspace/scratch/fantasy-lobby-review/` (`home-*.png`, `progressed-party.png`, `verification.json`); before: `/workspace/scratch/lobby-before.png`. These use disposable browser saves, never the player's save. Browser harnesses are outside the repository. The map floats continuously, so its hit check uses an actual mouse click instead of waiting for a stationary rectangle.
- No sprite source or gameplay changes: no optimizer or combat simulation required.

Inspect the native screenshots before merging. Hero kit final Timeline Sync and roster balance are unrelated and remain at their previous status.

## Six-point refinement — 2026-10-19

The user requested keeping 85–90% of the layout and refining the kingdom panel, party readiness, map affordances, depth, readability and tower entry. The visual direction is **Dark Fantasy Premium for chrome while preserving Dawnmere's bright colours**. Other locations/themes keep their own identity; this is not a global darkening pass.

`feature/codex-lobby-polish` starts from fresh master `455de5b` then fast-forwards to the explicitly continued, published lobby dependency `328b004`. The local prior branch remains preserved. Publish this refinement branch only; no new merge or canonical-local synchronization claim.

1. Kingdom panel: lighter translucent material and a shorter content stack, retaining tower progress and next building unlock. Party/readiness details remain available on their existing team/hero pages and HUD, without inventing a quest subsystem. Subtle inset gold edge reflection and a soft cast shadow keep the frame distinct from the city.
2. Party: class-coloured borders/sigils (cosmetic class coding, not new elements), real owned stars/levels, readiness indicator and soft hover/focus glow. Short display names keep narrow cards readable; full name/class/level/stars remain accessible in button labels/tooltips and the original hero sheet.
3. City interaction: each existing hit target has a ground halo on hover/keyboard focus/selection. Icons derive from the building's first registered action. Name chips use soft shadows/backplates instead of thick text outlines; detailed status appears on hover/focus and remains visible on touch devices. Existing hit rectangles, actions, locks, geometry and walking paths are unchanged.
4. Depth: reuse the existing two canvases and single rAF. The background camera receives an eased mouse offset bounded to ±6 px; the world/front/hit camera is unchanged. Touch, dragging, lite mode and reduced motion skip this extra movement. Five small door-area motes appear only in full-motion/full-quality mode. No new giant DOM scenery layers or animated backdrop blur.
5. Readability: important Thai lobby labels, party names/level values, balances and navigation use at least 13 px. City chips counter-scale against the actual fit/focus scale, preserving 13 px on screen and 14 px when active. Decorative English captions/star glyphs can be smaller. Narrow cards may ellipsize names and expose the full label accessibly.
6. Entry: a slow gold edge trace and explicit next/replay floor label reinforce the primary action. Pressing acknowledges immediately, disables duplicate activation and lights/focuses the tower gate before navigating after 480 ms. The floor is captured at press time; leaving Home clears the timer. Reduced-motion and classic scenes navigate immediately. Cancelled/failed navigation releases the button for retry. The effect does not unlock a floor/building or alter battle data.

Validation: app/spec checks, **715/715 Karma**, production build, native DPR2 review at eight desktop/tablet/phone/landscape sizes; mobile disclosure, map hover/font size and world/hit alignment, all navigation/sheets/themes and a progressed save with a six-star Elira/empty slots. Entry regressions cover a single delayed navigation, floor snapshot, destruction cancellation and reduced-motion retry. Native full/reduced motion checks verify five/zero new motes, disabled edge animation for reduced motion and successful navigation. Build retains size/CommonJS warnings; budgets remain unchanged.

Artifacts: `/workspace/scratch/lobby-polish-review/` contains `home-*.png`, `hover-forge.png`, `progressed-party.png`, `verification.json`, `hover-check.json`, `motion-check.json` and the native tower-response recording. Before-refinement images remain in `/workspace/scratch/fantasy-lobby-review/`. All use disposable browser saves. UI verification serves the actual production build from a temporary SPA server on port 4400 to avoid development-server cache/HMR interference during compilation. Scripts/dependency selectors/video tooling stay outside the repository. No hero/island source pixels, save format, combat, balance or final skill Sync status changed.
