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
