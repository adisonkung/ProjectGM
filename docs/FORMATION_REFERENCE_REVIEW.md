# Formation spacing correction — 24 Oct 2026

User rejected the first all-pages formation pass: field slots were too large/far apart; square elements should retain straight corners; Team A/B/C did not use the available width and squeezed the save/edit icons into stacked positions. User also requested the reviewed Home button gloss.

Read `docs/design/eldervane-ui/README.md` and opened sheet04 before editing. Implementation remains a legal 3×6 ally formation for five heroes; reference art's different grid/hero illustrations are not copied into game rules/assets.

Changes on `fix/codex-formation-spacing` (continues all-pages source017462e):

- Formation content max width1160; field height390px desktop,370px tablet,330px phone. Short gutters and full rectangular slot outlines replace the widely separated partial-height rectangles. Fixed grid presentation tracks align the label/field/hint with the team sidebar.
- Square slots, preset panels, team summary and roster keep straight corners. CitadelFrame adds an opt-in `rect` contour; existing panel/hex/tab/chapter contours retain their previous behavior.
- Presets use the available overview width. Desktop/tablet show three cards; phones use three full-width rows. Inside each card save/edit stay side by side with44×44px targets,12px padding and10–12px gap. Icons are18px and cannot shrink.
- Selected presets and reserve-class filters use the same crimson/lacquer material as Home. Auto/clear use the metal frame rather than flat rectangular fills. Empty presets stay dark; saving and selecting a real preset reveals the selected gloss.
- Team roster metadata uses two text lines to avoid forcing excessive row heights/blank space around the field. Original sprite art, team positions and save/service behavior are unchanged.

Validation: app/spec typechecks, Karma809/809 and production build. Native Chromium checks320/390/768/1024/1586 widths,18 slots, square slot corners, compact field bounds,44px tools on one row and no horizontal overflow. Real save/rename/load/auto flows pass; resizing and viewing do not change gameplay saves. Scripts/logs/screenshots are under ignored `work/formation-spacing/`.

No deployment or production/runtime branch ref update. Earlier all-pages formation screenshots are superseded for this page; other pages retain their review status.

Published review: [https://github.com/adisonkung/ProjectGM/blob/07fccab18a8082caa8409f65d0c85845dd7f2390/docs/review-images/2026-10-24-formation-spacing/README.md](https://github.com/adisonkung/ProjectGM/blob/07fccab18a8082caa8409f65d0c85845dd7f2390/docs/review-images/2026-10-24-formation-spacing/README.md). All8 remote files returnedHTTP200 and matched local Git blob hashes. Docs-only unattached snapshot; not a source/runtime deployment.

## Follow-up — gold cut corners on remaining slate panels

User pointed to the reserve filter bar/reserve hero cards and the rectangular backing behind “ไปหอคอย”. On `fix/codex-formation-gold-frames`, add continuous double-gold cut-corner frames to the standalone formation toolbar, reserve container/cards, hint and adventure footer; remove the obsolete slate rectangle behind the tower button. Square formation slots and the roomy A/B/C preset controls remain as reviewed in the previous correction. Frame additions to the shared placement template are conditional on allyOnly, so battle preparation retains its presentation. No gameplay changes and no deployment.

Validation: production build, app/spec typechecks, Karma809/809, and actual Chromium at five widths with real preset save/rename/load, auto formation and tap-to-move. Check screenshots in work/formation-gold; current files supersede the previous correction only for these panel frames.

Latest formation gold-frame screenshots: https://github.com/adisonkung/ProjectGM/blob/e8a0aa987afdf94fff27f4b07971cb173f8994bb/docs/review-images/2026-10-24-formation-gold/README.md . Docs-only unattached snapshot; no deployment.

User review outcome: user said “โอเค หน้าต่อไป” after the gold-frame screenshots. Formation page is visually accepted for this correction; no deployment instruction was given. Next review is Armory.
